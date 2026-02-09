import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  Eye,
  EyeOff,
  FolderOpen,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useConversationStore } from '../store/conversationStore';
import { BacktrackMark } from '../components/brand/BacktrackMark';

type PlanningStageKey = 'analyze' | 'detect' | 'generate' | 'safety';

interface PlanningStageState {
  key: PlanningStageKey;
  progress: number;
  message: string;
}

const stageConfig: Array<{ key: PlanningStageKey; title: string; icon: any; percent: number }> = [
  { key: 'analyze', title: 'Analyzing files', icon: Search, percent: 10 },
  { key: 'detect', title: 'Detecting file types', icon: Sparkles, percent: 40 },
  { key: 'generate', title: 'Generating optimal structure', icon: BrainCircuit, percent: 70 },
  { key: 'safety', title: 'Safety check complete', icon: ShieldCheck, percent: 100 }
];

const genericTargets = new Set(['specific_path', 'unknown', 'target_folder']);

const joinPath = (root: string, segment: string) => {
  if (!segment) {
    return root;
  }
  const separator = root.includes('\\') ? '\\' : '/';
  if (root.endsWith('\\') || root.endsWith('/')) {
    return `${root}${segment}`;
  }
  return `${root}${separator}${segment}`;
};

const formatPlanTimings = (plan: any) => {
  const metadata = plan?.gemini_metadata;
  if (!metadata) {
    return '';
  }
  const draft = Math.round((metadata.stage1_latency_ms || 0) / 100) / 10;
  const safety = Math.round((metadata.stage2_latency_ms || 0) / 100) / 10;
  const undo = Math.round((metadata.stage3_latency_ms || 0) / 100) / 10;
  return `Timing: draft ${draft}s, safety ${safety}s, undo ${undo}s.`;
};

export function ChatDrawerPage() {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [fuse, setFuse] = useState<Fuse<string> | null>(null);
  const [isPreviewWorkspaceOpen, setIsPreviewWorkspaceOpen] = useState(false);
  const [planningState, setPlanningState] = useState<PlanningStageState>({
    key: 'analyze',
    progress: 0,
    message: ''
  });
  const [canCancelPlanning, setCanCancelPlanning] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const planningTimeoutsRef = useRef<number[]>([]);
  const planningCancelledRef = useRef(false);

  const { messages, isLoading, addUserMessage, addAssistantMessage, setLoading, buildConversationContext } =
    useConversationStore();

  const stageStatus = useMemo(() => {
    const currentIndex = stageConfig.findIndex((item) => item.key === planningState.key);
    return stageConfig.map((stage, index) => ({
      ...stage,
      state: index < currentIndex ? 'complete' : index === currentIndex ? 'active' : 'pending'
    }));
  }, [planningState.key]);

  const clearPlanningTimers = () => {
    planningTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    planningTimeoutsRef.current = [];
  };

  const updatePlanningStage = (key: PlanningStageKey, progress: number, message: string) => {
    setPlanningState({ key, progress, message });
  };

  const startPlanningTimeline = (fileCount: number) => {
    updatePlanningStage('analyze', 10, `Analyzing ${fileCount} files...`);
    setCanCancelPlanning(true);

    planningTimeoutsRef.current.push(
      window.setTimeout(() => {
        updatePlanningStage('detect', 40, 'Detecting file types...');
      }, 1200)
    );

    planningTimeoutsRef.current.push(
      window.setTimeout(() => {
        updatePlanningStage('generate', 70, 'Generating optimal structure...');
      }, 2800)
    );
  };

  const stopPlanningTimeline = () => {
    clearPlanningTimers();
    setCanCancelPlanning(false);
  };

  useEffect(() => {
    setLoading(false);

    (async () => {
      try {
        const folders = await window.api.getFolderList();
        const fuseInstance = new Fuse<string>(folders, {
          threshold: 0.3,
          includeScore: true,
          minMatchCharLength: 2
        });
        setFuse(fuseInstance);
      } catch (error) {
        console.error('[ChatDrawer] Could not load folder list:', error);
      }
    })();

    return () => {
      clearPlanningTimers();
    };
  }, [setLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, planningState.progress]);

  useEffect(() => {
    let cancelled = false;

    const syncPreviewWorkspaceState = async () => {
      try {
        const isOpen = await window.api.isPreviewWorkspaceOpen();
        if (!cancelled) {
          setIsPreviewWorkspaceOpen(isOpen);
        }
      } catch (error) {
        console.error('[ChatDrawer] Failed to read preview workspace visibility:', error);
      }
    };

    void syncPreviewWorkspaceState();
    const interval = window.setInterval(syncPreviewWorkspaceState, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleTogglePreviewWorkspace = async () => {
    const result = await window.api.togglePreviewWorkspace();
    if (result.success) {
      setIsPreviewWorkspaceOpen(Boolean(result.visible));
      return;
    }
    if (result.message) {
      addAssistantMessage(result.message);
    }
  };

  const detectAndShowAutocomplete = (value: string) => {
    const pathPattern = /[C-Z]:\\[^"\s]*$|\/[^"\s]*$|~\/[^"\s]*/i;
    const match = value.match(pathPattern);

    if (match && fuse && match[0].length >= 2) {
      const query = match[0];
      const results = fuse.search(query);
      const topMatches = results.slice(0, 10).map((result) => result.item);
      if (topMatches.length > 0) {
        setSuggestions(topMatches);
        setShowAutocomplete(true);
        setSelectedSuggestionIndex(0);
      } else {
        setShowAutocomplete(false);
      }
      return;
    }

    setShowAutocomplete(false);
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;

    setInputValue(target.value);
    detectAndShowAutocomplete(target.value);
  };

  const insertSelectedSuggestion = (index = selectedSuggestionIndex) => {
    if (!textareaRef.current || suggestions.length === 0) {
      return;
    }

    const selectedPath = suggestions[index];
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = inputValue.substring(0, cursorPos);
    const textAfter = inputValue.substring(cursorPos);
    const pathPattern = /[C-Z]:\\[^"\s]*$|\/[^"\s]*$|~\/[^"\s]*/i;
    const match = textBefore.match(pathPattern);

    if (!match) {
      return;
    }

    const pathStart = cursorPos - match[0].length;
    const newValue = inputValue.substring(0, pathStart) + selectedPath + textAfter;
    setInputValue(newValue);

    window.setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = pathStart + selectedPath.length;
      textarea.focus();
    }, 0);

    setShowAutocomplete(false);
  };

  const handleCancelPlanning = () => {
    planningCancelledRef.current = true;
    stopPlanningTimeline();
    setLoading(false);
    addAssistantMessage('Planning cancelled. You can send a new instruction anytime.');
  };

  const resolveBasePath = async () => {
    const stored = localStorage.getItem('backtrack.active-folder');
    if (stored) {
      return stored;
    }
    return window.api.getActiveBasePath();
  };

  const resolveTargetPath = (intentTarget: string, userMessage: string, basePath: string) => {
    if (genericTargets.has(intentTarget)) {
      return basePath;
    }

    if (/^[A-Z]:\\/i.test(intentTarget) || intentTarget.startsWith('/')) {
      return intentTarget;
    }

    const baseFolderName = basePath.split(/[\\/]/).pop()?.toLowerCase();
    if (baseFolderName && userMessage.toLowerCase().includes(baseFolderName)) {
      return basePath;
    }

    return joinPath(basePath, intentTarget);
  };

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) {
      return;
    }

    addUserMessage(trimmed);
    setInputValue('');
    planningCancelledRef.current = false;
    updatePlanningStage('analyze', 4, 'Planning your organization...');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const conversationContext = buildConversationContext();
      const parseResult = await window.api.parseIntent(trimmed, conversationContext);

      if (planningCancelledRef.current) {
        return;
      }

      if (!parseResult.success || !parseResult.intent) {
        addAssistantMessage('I could not understand that request clearly. Please rephrase what you want organized.');
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      const intent = parseResult.intent;
      const basePath = await resolveBasePath();

      if (genericTargets.has(intent.target)) {
        intent.target = basePath;
      }

      if (intent.needsClarification) {
        const clarificationResult = await window.api.generateClarification(intent);
        if (clarificationResult.success && clarificationResult.question) {
          addAssistantMessage(clarificationResult.question);
        } else {
          addAssistantMessage('Which folder should I organize for you?');
        }
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      const targetPath = resolveTargetPath(intent.target, trimmed, basePath);
      const scopeResult = await window.api.setActiveBasePath(targetPath);
      if (!scopeResult.success) {
        addAssistantMessage('That folder could not be accessed. Please choose a valid folder path and try again.');
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      addAssistantMessage(`Scanning files in ${targetPath}...`);
      updatePlanningStage('analyze', 8, 'Scanning folder contents...');

      const scanResult = await window.api.scanFolder(targetPath, true);
      if (planningCancelledRef.current) {
        return;
      }

      if (!scanResult.success) {
        addAssistantMessage('Could not organize files in that location. Please try a different folder.');
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      const files = scanResult.files || [];
      const fileOnlyCount = files.filter((item: any) => !item.isDirectory).length;
      const folderCount = files.filter((item: any) => item.isDirectory).length;

      if (fileOnlyCount === 0) {
        addAssistantMessage('No files found in this folder yet. Add files and try again.');
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      if (fileOnlyCount < 2) {
        addAssistantMessage('Too few files to organize meaningfully. Add a few more files and try again.');
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      if (folderCount >= 4) {
        addAssistantMessage('This folder already has multiple subfolders. I will preserve structure where possible.');
      }

      addAssistantMessage(`Found ${fileOnlyCount} files. Creating a smart organization plan...`);
      startPlanningTimeline(fileOnlyCount);

      const enforcedConstraints = [
        ...(intent.constraints || []),
        'Use the existing target folder; do not create a new root folder.',
        'Only create subfolders inside the target folder when necessary.',
        'Do not delete user files.'
      ];

      const handoffData = {
        conversationId: useConversationStore.getState().conversationId,
        userIntent: trimmed,
        targetFolder: targetPath,
        constraints: enforcedConstraints,
        clarifications: [],
        scannedFiles: files,
        timestamp: new Date().toISOString(),
        parsedIntent: intent
      };

      const planResult = await window.api.generatePlan(handoffData);
      if (planningCancelledRef.current) {
        return;
      }

      if (!planResult?.success || !planResult.plan) {
        addAssistantMessage(
          'Could not generate a safe organization plan for this folder. Please adjust your request and try again.'
        );
        setLoading(false);
        stopPlanningTimeline();
        return;
      }

      updatePlanningStage('safety', 100, 'Safety check complete!');
      stopPlanningTimeline();

      const previewResult = await window.api.presentPreviewPlan(planResult.plan);
      if (previewResult.success) {
        setIsPreviewWorkspaceOpen(Boolean(previewResult.visible));
        const timingSummary = formatPlanTimings(planResult.plan);
        addAssistantMessage(
          `Ready to organize! This plan moves ${planResult.plan.summary.files_affected} files into ${planResult.plan.summary.folders_created} categories. ${timingSummary}`.trim()
        );
      } else if (previewResult.cancelled) {
        addAssistantMessage('Kept your current preview. I did not replace it.');
      } else {
        addAssistantMessage(previewResult.message || 'Preview could not be opened right now.');
      }

      setLoading(false);
    } catch (error) {
      console.error('[ChatDrawer] handleSendMessage failed:', error);
      if (!planningCancelledRef.current) {
        addAssistantMessage(
          'Something went wrong while preparing your plan. Please try again in a moment.'
        );
      }
      setLoading(false);
      stopPlanningTimeline();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        insertSelectedSuggestion();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
      return;
    }

    if (event.key === 'Escape' && !inputValue.trim()) {
      void window.api.closeDrawer();
    }
  };

  const handleClose = async () => {
    await window.api.closeDrawer();
  };

  return (
    <div className="h-full w-full flex items-end justify-end">
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl rounded-br-none rounded-tr-none border-l border-blue-100 bg-white/95 shadow-2xl backdrop-blur-lg"
      >
        <div className="h-15 flex flex-shrink-0 items-center justify-between border-b border-blue-100 bg-blue-50/70 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500">
              <BacktrackMark className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Backtrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-blue-100"
              title="Settings (coming soon)"
              type="button"
            >
              <Settings className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={handleTogglePreviewWorkspace}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-blue-100"
              title={isPreviewWorkspaceOpen ? 'Hide preview workspace' : 'Show preview workspace'}
              type="button"
            >
              {isPreviewWorkspaceOpen ? (
                <EyeOff className="h-4 w-4 text-slate-600" />
              ) : (
                <Eye className="h-4 w-4 text-slate-600" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-blue-100"
              type="button"
            >
              <XCircle className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-xs text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500">
                  <BacktrackMark className="h-8 w-8 text-white" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-slate-900">Welcome to Backtrack</h2>
                <p className="text-sm text-slate-600">Describe how you want your folder organized.</p>
              </div>
            </div>
          ) : (
            <>
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'rounded-br-none bg-blue-600 text-white'
                          : 'rounded-bl-none border border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <p
                        className={`mt-1 text-xs ${
                          message.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[92%] rounded-2xl border border-blue-200 bg-blue-50/70 p-4"
                >
                  <p className="text-sm font-semibold text-blue-900">Planning your organization...</p>
                  <p className="mt-1 text-xs text-blue-700">{planningState.message || 'Preparing...'}</p>

                  <div className="mt-3 h-2 w-full rounded-full bg-blue-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-700"
                      style={{ width: `${planningState.progress}%` }}
                    />
                  </div>

                  <div className="mt-3 space-y-1">
                    {stageStatus.map((stage) => {
                      const Icon = stage.icon;
                      const classes =
                        stage.state === 'complete'
                          ? 'text-emerald-700'
                          : stage.state === 'active'
                            ? 'text-blue-800'
                            : 'text-slate-500';
                      return (
                        <div key={stage.key} className={`flex items-center gap-2 text-xs ${classes}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span>{stage.title}</span>
                          <span className="ml-auto font-medium">[{stage.percent}%]</span>
                        </div>
                      );
                    })}
                  </div>

                  {canCancelPlanning && (
                    <button
                      type="button"
                      onClick={handleCancelPlanning}
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  )}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="min-h-[60px] flex-shrink-0 border-t border-blue-100 bg-blue-50/60 p-3 backdrop-blur-sm">
          <div className="relative flex items-end gap-2">
            <AnimatePresence>
              {showAutocomplete && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-12 z-50 mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                >
                  {suggestions.map((folder, index) => (
                    <button
                      type="button"
                      key={folder}
                      onClick={() => insertSelectedSuggestion(index)}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                        index === selectedSuggestionIndex
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{folder}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Describe how you want this folder organized..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              style={{ maxHeight: '120px' }}
            />

            <button
              onClick={() => void handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                inputValue.trim() && !isLoading
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500'
              }`}
              type="button"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Enter to send. Shift+Enter for new line. Esc to close drawer.
          </p>
        </div>
      </motion.div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
