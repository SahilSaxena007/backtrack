import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Settings, FolderOpen } from 'lucide-react';
import { useConversationStore } from '../store/conversationStore';
import Fuse from 'fuse.js';

export function ChatDrawerPage() {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [fuse, setFuse] = useState<Fuse<string> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, addUserMessage, addAssistantMessage, setLoading, buildConversationContext } =
    useConversationStore();

  // Initialize folder list and Fuse.js on mount
  useEffect(() => {
    // Safety: reset loading state in case it persisted from a previous session/crash
    setLoading(false);

    (async () => {
      try {
        const folders = await window.api.getFolderList();
        console.log('[ChatDrawer] Loaded folder list:', folders.length, 'folders');

        // Initialize Fuse.js for fuzzy search
        const fuseInstance = new Fuse<string>(folders, {
          threshold: 0.3, // Fuzzy matching sensitivity (0 = exact, 1 = match anything)
          includeScore: true,
          minMatchCharLength: 2,
        });
        setFuse(fuseInstance);
      } catch (error) {
        console.error('[ChatDrawer] Error loading folder list:', error);
      }
    })();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea as user types and trigger autocomplete
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
    const value = target.value;
    setInputValue(value);

    // Trigger autocomplete detection (debounced)
    detectAndShowAutocomplete(value);
  };

  // Detect if user is typing a path and show autocomplete
  const detectAndShowAutocomplete = (value: string) => {
    // Look for path patterns: "C:\", "/", or "~/"
    const pathPattern = /[C-Z]:\\[^"\s]*$|\/[^"\s]*$|~\/[^"\s]*/i;
    const match = value.match(pathPattern);

    if (match && fuse && match[0].length >= 2) {
      // Extract the path query
      const query = match[0];
      console.log('[ChatDrawer] Path detected:', query);

      // Fuzzy search for matching folders
      const results = fuse.search(query);
      const topMatches = results.slice(0, 10).map(r => r.item);

      if (topMatches.length > 0) {
        setSuggestions(topMatches);
        setShowAutocomplete(true);
        setSelectedSuggestionIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    // Add user message
    addUserMessage(trimmed);
    setInputValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Show loading state
    setLoading(true);

    try {
      // Build conversation context from message history
      const conversationContext = buildConversationContext();

      console.log('[ChatDrawer] Calling Gemini API to parse intent...');
      const startTime = Date.now();

      // Call Gemini API via IPC to parse intent
      const result = await window.api.parseIntent(trimmed, conversationContext);

      const duration = Date.now() - startTime;
      console.log(`[ChatDrawer] Gemini responded in ${duration}ms:`, result);

      if (!result.success) {
        // Show technical error (as requested)
        addAssistantMessage(
          `❌ Error parsing your request:\n\n${result.error}\n\nPlease try again or check your Gemini API key configuration.`
        );
        setLoading(false);
        return;
      }

      const intent = result.intent!;

      // Normalize intent target: if Gemini returns placeholder like "specific_path" or "unknown", fall back to default base path
      const DEFAULT_BASE_PATH = import.meta.env.VITE_BASE_PATH || 'C:\\Users\\sahil\\backtrack-f5-test';
      if (intent.target === 'specific_path' || intent.target === 'unknown') {
        intent.target = DEFAULT_BASE_PATH;
      }

      // Check if clarification is needed
      if (intent.needsClarification) {
        console.log('[ChatDrawer] Intent unclear, generating clarification...');

        // Generate clarification question
        const clarificationResult = await window.api.generateClarification(intent);

        if (clarificationResult.success && clarificationResult.question) {
          addAssistantMessage(clarificationResult.question);
        } else {
          // Fallback clarification if generation fails
          addAssistantMessage(
            "I'd like to help, but I need a bit more information. Which folder would you like me to work with?"
          );
        }

        // Stop loading so user can answer the clarification
        setLoading(false);
        return;
      } else {
        // Intent is clear! Show confirmation
        const confirmationMessage = `✓ Got it! I'll help you **${intent.action}** files in **${intent.target}** ${intent.method !== 'unknown' ? `**${intent.method.replace('_', ' ')}**` : ''}.

${intent.constraints.length > 0 ? `📋 Constraints: ${intent.constraints.join(', ')}` : ''}

Scanning folder...`;

        addAssistantMessage(confirmationMessage);

        // Resolve target folder to full path
        const BASE_PATH =
          import.meta.env.VITE_BASE_PATH || 'C:\\Users\\sahil\\backtrack-f5-test';

        let targetPath: string;

        // If intent.target is generic/descriptive (like "specific_path"), use BASE_PATH directly
        if (intent.target === 'specific_path' || intent.target === 'unknown' || intent.target === 'target_folder') {
          targetPath = BASE_PATH;
          console.log(`[ChatDrawer] Intent target is generic ("${intent.target}"), using BASE_PATH: ${targetPath}`);
        }
        // If target mentions the BASE_PATH folder name, extract it
        else if (trimmed.toLowerCase().includes('backtrack-f5-test')) {
          targetPath = BASE_PATH;
          console.log(`[ChatDrawer] User mentioned backtrack-f5-test, using BASE_PATH: ${targetPath}`);
        }
        // If target is absolute path, use it directly
        else if (intent.target.match(/^[A-Z]:\\/i)) {
          targetPath = intent.target;
          console.log(`[ChatDrawer] Using absolute path from intent: ${targetPath}`);
        }
        // Otherwise, treat as subfolder of BASE_PATH
        else {
          targetPath = `${BASE_PATH}\\${intent.target}`;
          console.log(`[ChatDrawer] Resolved "${intent.target}" to subfolder: ${targetPath}`);
        }

        // Scan the target folder
        console.log(`[ChatDrawer] Scanning folder: ${targetPath}`);
        const scanResult = await window.api.scanFolder(targetPath, true); // recursive scan

        if (!scanResult.success) {
          // Show error if scan fails
          addAssistantMessage(
            `❌ Couldn't access folder: ${scanResult.error}\n\nPlease check the path and try again.`
          );
          setLoading(false);
          return;
        }

        const files = scanResult.files || [];
        console.log(`[ChatDrawer] Scanned ${files.length} items`);

        // Prepare F1 → F2 handoff data
        const enforcedConstraints = [
          ...intent.constraints,
          'Use the existing target folder; do not create a new root folder.',
          'Only create subfolders inside the target folder when necessary.',
          'Move existing files (especially images) into the target/Images folder; do not duplicate or re-create the target folder.'
        ];

        const handoffData = {
          conversationId: useConversationStore.getState().conversationId,
          userIntent: trimmed,
          targetFolder: targetPath, // Use resolved path, not intent.target
          constraints: enforcedConstraints,
          clarifications: [], // Will be populated if clarification flow is implemented
          scannedFiles: files,
          timestamp: new Date().toISOString(),
          parsedIntent: intent,
        };

        // Store handoff data for debugging/traceability
        console.log('[ChatDrawer] F1 → F2 Handoff Data:', handoffData);
        window.localStorage.setItem('f1-to-f2-handoff', JSON.stringify(handoffData));

        // Show scan results
        const scanSummary = `📁 Scanned **${files.length}** items in ${targetPath}

_Clarity Score: ${(intent.clarityScore * 100).toFixed(0)}%_`;
        addAssistantMessage(scanSummary);

        // ---- F2: Planning pipeline ----
        addAssistantMessage('🤖 Generating action plan...');
        try {
          const planResult = await window.api.generatePlan(handoffData);

          if (!planResult?.success || !planResult.plan) {
            addAssistantMessage(`❌ Planning failed: ${planResult?.error || 'Unknown error'}`);
            setLoading(false);
            return;
          }

          // Optional stage timing summary if available
          if (planResult.plan.gemini_metadata) {
            const { stage1_latency_ms, stage2_latency_ms, stage3_latency_ms } =
              planResult.plan.gemini_metadata;
            addAssistantMessage(
              `Stage timings — Draft: ${stage1_latency_ms ?? '?'}ms, Safety: ${
                stage2_latency_ms ?? '?'
              }ms, Undo: ${stage3_latency_ms ?? '?'}ms`
            );
          }

          // ---- F3: Preview ----
          addAssistantMessage('✅ Plan ready! Opening preview...');
          const { usePreviewStore } = await import('../store/previewStore');
          usePreviewStore.getState().showToast(planResult.plan);
        } catch (planningError) {
          console.error('[ChatDrawer] Planning error:', planningError);
          addAssistantMessage('⚠️ Planning engine encountered an error. Please try again.');
          setLoading(false);
          return;
        }
      }

      setLoading(false);

    } catch (error) {
      console.error('[ChatDrawer] Error in handleSendMessage:', error);

      // Show technical error details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addAssistantMessage(
        `❌ Unexpected error:\n\n${errorMessage}\n\nPlease check the console for more details.`
      );
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle autocomplete navigation
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertSelectedSuggestion();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    // Normal key handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape' && !inputValue.trim()) {
      window.api.closeDrawer();
    }
  };

  // Insert selected suggestion at cursor position
  const insertSelectedSuggestion = () => {
    if (suggestions.length === 0 || !textareaRef.current) return;

    const selectedPath = suggestions[selectedSuggestionIndex];
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = inputValue.substring(0, cursorPos);
    const textAfter = inputValue.substring(cursorPos);

    // Find the start of the path pattern
    const pathPattern = /[C-Z]:\\[^"\s]*$|\/[^"\s]*$|~\/[^"\s]*/i;
    const match = textBefore.match(pathPattern);

    if (match) {
      const pathStart = cursorPos - match[0].length;
      const newValue = inputValue.substring(0, pathStart) + selectedPath + textAfter;
      setInputValue(newValue);

      // Set cursor position after inserted path
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pathStart + selectedPath.length;
        textarea.focus();
      }, 0);
    }

    setShowAutocomplete(false);
  };

  // Handle clicking a suggestion
  const handleSuggestionClick = (index: number) => {
    if (suggestions.length === 0 || !textareaRef.current) return;

    const selectedPath = suggestions[index];
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = inputValue.substring(0, cursorPos);
    const textAfter = inputValue.substring(cursorPos);

    // Find the start of the path pattern
    const pathPattern = /[C-Z]:\\[^"\s]*$|\/[^"\s]*$|~\/[^"\s]*/i;
    const match = textBefore.match(pathPattern);

    if (match) {
      const pathStart = cursorPos - match[0].length;
      const newValue = inputValue.substring(0, pathStart) + selectedPath + textAfter;
      setInputValue(newValue);

      // Set cursor position after inserted path
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pathStart + selectedPath.length;
        textarea.focus();
      }, 0);
    }

    setShowAutocomplete(false);
  };

  const handleClose = async () => {
    await window.api.closeDrawer();
  };

  return (
    <div className="w-full h-full flex items-end justify-end">
      {/* Chat Drawer Container - slides in from right, aligns with button */}
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full h-full bg-white/95 backdrop-blur-lg rounded-2xl rounded-tr-none rounded-br-none shadow-2xl flex flex-col overflow-hidden border-l border-gray-200 border-r-0"
      >
        {/* Header - 60px height as per spec */}
        <div className="h-15 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Logo 24x24px */}
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Backtrack</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Optional Settings button for future preferences */}
            <button
              className="w-7 h-7 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
              title="Settings (coming soon)"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        </div>

        {/* Scrollable Message Area with generous spacing (16px vertical) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            // Welcome message when no messages
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Welcome to Backtrack!
                </h2>
                <p className="text-sm text-gray-600">
                  Tell me how you'd like to organize your files
                </p>
              </div>
            </div>
          ) : (
            // Message bubbles
            <>
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-900 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing Indicator - Left-aligned like assistant messages */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-3 max-w-[80%]">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area - Fixed at bottom, 60px height initial */}
        <div className="border-t border-gray-200 p-3 bg-gray-50/80 backdrop-blur-sm flex-shrink-0 min-h-[60px]">
          <div className="relative flex items-end gap-2">
            {/* Autocomplete Dropdown - positioned above input */}
            <AnimatePresence>
              {showAutocomplete && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-0 right-12 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50"
                >
                  {suggestions.length > 50 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      Too many results ({suggestions.length}). Type more to narrow down...
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      No folders found
                    </div>
                  ) : (
                    suggestions.map((folder, index) => (
                      <div
                        key={folder}
                        onClick={() => handleSuggestionClick(index)}
                        className={`px-4 py-2 cursor-pointer text-sm flex items-center gap-2 transition-colors ${
                          index === selectedSuggestionIndex
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <FolderOpen className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{folder}</span>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Multi-line textarea with auto-grow up to 5 lines (120px) */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type your request..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-3 text-[14px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ maxHeight: '120px' }}
            />
            {/* Send Button - 36x36px, absolute positioning inside input */}
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                inputValue.trim() && !isLoading
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {showAutocomplete
              ? '↑↓ to navigate • Enter to select • Esc to cancel'
              : 'Enter to send • Shift+Enter for new line • Esc to close • Type C:\\ for folder autocomplete'}
          </p>
        </div>
      </motion.div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
