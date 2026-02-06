# Implementation Plan: F1 - Natural Language Input
**Backtrack Desktop App - Gemini 3 Hackathon**

**Timeline:** 6 Days (Day 1-2 of overall build)  
**Tech Stack:** Electron 28+ | React 18 | TypeScript | Gemini 3 API | MCP Filesystem | Git  
**Claude Code Assistance:** Heavy - 70% code generation expected

---

## 🎯 Implementation Context

### Feature Summary
F1 provides the conversational interface for Backtrack - a desktop application where users interact with AI through natural language to organize their files. The floating button expands into a chat drawer where users can delegate file organization tasks without technical knowledge, building trust through clarity and confirmation.

### User Workflow Overview
1. User clicks floating button (always visible, bottom-right)
2. Chat drawer slides in from the right (400px wide)
3. User types natural language request: "organize my downloads by file type"
4. Claude processes request via Gemini 3 (low thinking for speed)
5. System scans target folder via MCP Filesystem
6. If intent is unclear, asks clarifying questions (multi-turn)
7. Once intent is clear, hands off to F2 (Planning Engine)

### Technical Context
F1 is the **entry point** for all user interactions. It bridges human natural language and machine-executable actions by:
- Parsing user intent with Gemini 3 (thinking_level: low for responsiveness)
- Scanning file systems via MCP Filesystem Server
- Managing multi-turn conversation state
- Providing autocomplete for folder paths (fuzzy search)
- Maintaining conversation history for context

### Integration Points

**F1 → F2 (Planning):**
```javascript
{
  conversationId: "conv_abc123",
  userIntent: "Organize Downloads by file type",
  targetFolder: "/Users/sarah/Downloads",
  constraints: ["keep work files separate"],
  clarifications: [{question: "...", answer: "..."}],
  timestamp: "2026-02-04T14:30:22Z"
}
```

**F1 → MCP Filesystem:**
```javascript
// Scan folder for file list
await mcpClient.call('read_directory', {
  path: targetFolder,
  recursive: true
});
```

**F1 → Gemini 3:**
```javascript
// Parse intent quickly
await gemini.generate({
  prompt: userMessage,
  thinking_level: 'low',  // Speed over depth
  output_format: 'json'
});
```

### Success Criteria
- ✅ Chat interface responds in <1 second
- ✅ Autocomplete appears in <50ms
- ✅ Gemini intent parsing completes in <800ms
- ✅ Multi-turn conversations maintain context
- ✅ Clear error messages for invalid inputs
- ✅ Smooth animations (no jank)

### Architecture Diagram
```
User Input
    ↓
Floating Button (React) → Chat Drawer (React)
    ↓                          ↓
Main Process (Electron)  ←→  Renderer (React/TypeScript)
    ↓                          ↓
IPC Bridge              ←→  Zustand State
    ↓                          ↓
Gemini API Client      ←→  Conversation Manager
    ↓                          ↓
MCP Filesystem         ←→  Autocomplete Engine
    ↓
F2 Planning (when ready)
```

### Technical Approach
1. **Electron Shell:** Main process handles MCP/Gemini, Renderer handles UI
2. **IPC Communication:** Typed messages between main and renderer processes
3. **State Management:** Zustand for lightweight, typed global state
4. **Gemini Integration:** Low thinking level for fast responses
5. **MCP Integration:** Filesystem server for folder scanning
6. **Autocomplete:** Fuse.js for fuzzy folder path matching

### Dependencies
**External:**
- Electron 28+
- React 18
- TypeScript 5+
- Gemini 3 API access
- MCP Filesystem Server
- Node.js 18+

**Internal (other features):**
- None - F1 is the foundation

---

## 📋 Implementation Tasks

### Day 1: Electron Setup + MCP Integration

#### 1. Initialize Electron Project

- [x] **Create Electron + React + TypeScript Project**
  - [x] Initialize new project directory: `backtrack-desktop/`
  - [x] Install Electron 28+ with `npm install --save-dev electron@latest`
  - [x] Install React 18 with `npm install react@18 react-dom@18`
  - [x] Install TypeScript with `npm install --save-dev typescript @types/react @types/react-dom`
  - [x] Install Vite for fast development: `npm install --save-dev vite @vitejs/plugin-react`
  - [x] Create `tsconfig.json` with strict mode enabled
  - [x] Create `vite.config.ts` for renderer process bundling
  - [x] Set up project structure:
    ```
    backtrack-desktop/
    ├── src/
    │   ├── main/           # Electron main process
    │   │   ├── main.ts     # Entry point
    │   │   ├── ipc/        # IPC handlers
    │   │   └── services/   # MCP, Gemini clients
    │   ├── renderer/       # React app
    │   │   ├── App.tsx
    │   │   ├── components/
    │   │   ├── store/      # Zustand state
    │   │   └── types/      # TypeScript types
    │   └── shared/         # Shared types
    ├── package.json
    └── electron-builder.yml
    ```

- [x] **Configure Electron Security Best Practices**
  - [x] Create `src/main/main.ts` with the following security settings:
    ```typescript
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,      // Critical: Isolate renderer from main
        nodeIntegration: false,       // Critical: No Node.js in renderer
        sandbox: true,                // Critical: Sandbox renderer process
        preload: path.join(__dirname, 'preload.js')
      }
    });
    ```
  - [x] Create `src/main/preload.ts` to expose safe APIs to renderer:
    ```typescript
    contextBridge.exposeInMainWorld('api', {
      sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
      onMessageResponse: (callback) => ipcRenderer.on('message-response', callback),
      scanFolder: (path: string) => ipcRenderer.invoke('scan-folder', path),
      // More APIs as needed
    });
    ```
  - [x] Set Content Security Policy in main window HTML
  - [x] Disable remote module completely

- [x] **Set Up Development Environment**
  - [x] Add npm scripts to `package.json`:
    ```json
    {
      "scripts": {
        "dev": "concurrently \"npm:dev:vite\" \"npm:dev:electron\"",
        "dev:vite": "vite",
        "dev:electron": "wait-on http://localhost:5173 && electron .",
        "build": "tsc && vite build && electron-builder"
      }
    }
    ```
  - [x] Install `concurrently` and `wait-on` for parallel dev processes
  - [x] Configure hot reload for renderer process (Vite handles this)
  - [x] Test dev environment: run `npm run dev` and verify Electron window opens

#### 2. Integrate MCP Filesystem Server

- [x] **Install and Configure MCP SDK**
  - [x] Install MCP SDK: `npm install @modelcontextprotocol/sdk`
  - [x] Create `src/main/services/mcp-client.ts`
  - [x] Initialize MCP client that connects to filesystem server:
    ```typescript
    import { Client } from '@modelcontextprotocol/sdk/client/index.js';
    import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
    
    export class MCPFilesystemClient {
      private client: Client;
      
      async initialize(allowedPaths: string[]) {
        const transport = new StdioClientTransport({
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            ...allowedPaths
          ]
        });
        
        this.client = new Client({
          name: 'backtrack-client',
          version: '1.0.0'
        }, { capabilities: {} });
        
        await this.client.connect(transport);
      }
    }
    ```
  - [x] Add error handling for MCP connection failures
  - [x] Add reconnection logic if MCP server disconnects

- [x] **Create MCP Filesystem Operations**
  - [x] Implement `readDirectory(path: string, recursive: boolean)` method:
    ```typescript
    async readDirectory(path: string, recursive = false) {
      const result = await this.client.callTool('read_directory', {
        path: path,
        recursive: recursive
      });
      return this.parseDirectoryResult(result);
    }
    ```
  - [x] Implement `moveFile(source: string, destination: string)` method
  - [x] Implement `createFolder(path: string)` method
  - [x] Implement `deleteFile(path: string)` method (with backup to temp location)
  - [x] Implement `copyFile(source: string, destination: string)` method
  - [x] Add TypeScript types for all MCP responses:
    ```typescript
    interface FileMetadata {
      name: string;
      path: string;
      size: number;
      type: string;
      extension: string;
      modified: Date;
      created: Date;
      isDirectory: boolean;
    }
    ```

- [x] **Set Up IPC Handlers for MCP Operations**
  - [x] Create `src/main/ipc/filesystem-handlers.ts`
  - [x] Register IPC handler for `scan-folder`:
    ```typescript
    ipcMain.handle('scan-folder', async (event, folderPath: string) => {
      try {
        const files = await mcpClient.readDirectory(folderPath, true);
        return { success: true, files };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    ```
  - [x] Register IPC handler for `get-folder-list` (for autocomplete)
  - [x] Register IPC handler for `validate-folder-path` (check if path exists)
  - [x] Add request/response logging for debugging
  - [x] Implement timeout handling (5 seconds for folder scans)

- [x] **Test MCP Integration End-to-End**
  - [x] Create test folder `~/Downloads/BacktrackTest/` with 10 sample files
  - [x] Test scanning the folder via IPC from renderer process
  - [x] Verify file metadata is correctly returned (name, size, type, dates)
  - [x] Test error handling: scan non-existent folder (should return error)
  - [x] Test permission handling: scan system folder (should fail gracefully)
  - [x] Log all MCP operations to console for verification

---

### Day 2: Chat Interface UI + Gemini Integration

#### 3. Build Floating Button Component ✅ COMPLETE

**NOTE:** Architecture changed to system-wide overlay (like Wisprflow). Added control panel for deployment.

- [x] **Create Main Control Panel Window**
  - [x] Created `src/renderer/pages/MainControlPage.tsx`
  - [x] Deploy button to show/hide floating button
  - [x] Status messages and instructions
  - [x] Beautiful gradient design

- [x] **Create Floating Button with Always-On-Top Behavior**
  - [x] Create `src/renderer/components/FloatingButton.tsx`
  - [x] System-wide overlay (separate window, 100x100px)
  - [x] Always on top of all windows (including File Explorer)
  - [x] Position at bottom-right: screenWidth-110, screenHeight-110
  - [x] Background: Gradient (`bg-gradient-to-br from-blue-500 to-purple-600`)
  - [x] Icon: Chat bubble (MessageCircle from lucide-react)
  - [x] Drop shadow: `shadow-2xl`
  - [x] Hover effect: scale 1.1x
  - [x] Click handler toggles chat drawer via IPC
  - [x] Click-through except on button hover

- [x] **Add Loading/Active State Animations**
  - [x] Rotating border animation when loading (Framer Motion)
  - [x] Pulsing animation when new message arrives
  - [x] Breathing animation when idle (scale 1.0 ↔ 1.05)
  - [x] Smooth transitions (0.3s ease-in-out)

- [x] **Implement Click-to-Open/Close Logic**
  - [x] Created Zustand store (`src/renderer/store/uiStore.ts`)
  - [x] IPC handlers for drawer control (toggle/open/close)
  - [x] Button icon changes to X when drawer opens
  - [x] Keyboard shortcut: Cmd/Ctrl + K
  - [x] State polling every 500ms for sync

#### 4. Build Chat Drawer Component ✅ COMPLETE

- [x] **Create Compact Floating Drawer**
  - [x] Created `src/renderer/pages/ChatDrawerPage.tsx`
  - [x] Fixed size: 400px × 600px (not full height)
  - [x] Position: Left of floating button (relative positioning)
  - [x] Transparent window with rounded container (rounded-2xl)
  - [x] Framer Motion animations (fade in, scale, spring)

- [x] **Implement Drawer Header**
  - [x] Header section (14px height)
  - [x] Backtrack logo + title
  - [x] Close button with hover effect
  - [x] Gradient background (blue to purple)

- [x] **Create Scrollable Message Area**
  - [x] Flex-1 container with overflow-y-auto
  - [x] Auto-scroll to bottom on new messages
  - [x] Custom scrollbar styling (6px, thin, rounded)
  - [x] Welcome message when no messages

- [x] **Design Message Bubbles**
  - [x] User messages: Right-aligned, blue gradient, rounded-br-sm
  - [x] Assistant messages: Left-aligned, gray background, rounded-bl-sm
  - [x] Max width 80%, proper padding
  - [x] Timestamps below each message
  - [x] Framer Motion animations on appearance

- [x] **Implement Typing Indicator**
  - [x] Three animated bouncing dots
  - [x] Left-aligned like assistant messages
  - [x] Shows during loading state
  - [x] Animated appearance/disappearance

- [x] **Create Multi-Line Text Input**
  - [x] Textarea with auto-grow (up to 5 lines)
  - [x] Placeholder text
  - [x] Border styling with focus state
  - [x] Disabled during loading

- [x] **Add Send Button**
  - [x] Send icon from lucide-react
  - [x] Enabled when text present
  - [x] Disabled state styling
  - [x] Gradient background when active

- [x] **Implement Keyboard Shortcuts**
  - [x] Enter to send message
  - [x] Shift+Enter for newline
  - [x] Escape to close drawer
  - [x] Helper text showing shortcuts
  - [x] Implement slide-in animation using Framer Motion (spring transition)
  - [x] Background: Semi-transparent with backdrop blur (`bg-white/95 backdrop-blur-lg`)
  - [x] Border: Subtle left border (`border-l border-gray-200 border-r-0`)
  - [x] Shadow: Large drop shadow (`shadow-2xl`)
  - [x] Settings icon in header for future preferences

#### 5. Build Input Area ✅ COMPLETE (Implemented in Task 4)

(All input area functionality was implemented as part of Task 4)

#### 6. Implement Conversation State Management ✅ COMPLETE

- [x] **Create Zustand Store for Messages**
  - [x] Create `src/renderer/store/conversationStore.ts`
  - [x] Define message type:
    ```typescript
    interface Message {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
      metadata?: {
        thinking_level?: 'low' | 'high';
        thought_signature?: string;
        tokens_used?: number;
      };
    }
    ```
  - [ ] Store structure:
    ```typescript
    interface ConversationStore {
      conversationId: string;
      messages: Message[];
      isLoading: boolean;
      addUserMessage: (content: string) => void;
      addAssistantMessage: (content: string, metadata?: any) => void;
      setLoading: (loading: boolean) => void;
      clearConversation: () => void;
    }
    ```
  - [x] Generate unique conversation IDs: `conv_${Date.now()}`
  - [x] Add timestamp to each message automatically

- [x] **Implement Message Persistence**
  - [x] Store conversation history in browser localStorage
  - [x] Use Zustand persist middleware for automatic persistence
  - [x] Save messages after each addition (automatic with persist)
  - [x] Load previous conversation on app restart (automatic with persist)
  - [x] Custom serialization to handle Date objects properly

- [x] **Create Conversation Context Builder**
  - [x] Function to build context for Gemini from message history:
    ```typescript
    function buildConversationContext(messages: Message[]): string {
      return messages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');
    }
    ```
  - [x] Include last 10 messages for context (or up to token limit)
  - [x] Add system message at the beginning defining assistant role
  - [x] Return formatted string ready for Gemini 3 API

#### 7. Integrate Gemini 3 API for Intent Parsing ✅ COMPLETE

- [x] **Create Gemini API Client**
  - [x] Create `src/main/services/gemini-client.ts`
  - [x] Install Gemini SDK: `npm install @google/generative-ai`
  - [x] Initialize client with API key from environment variable:
    ```typescript
    import { GoogleGenerativeAI } from '@google/generative-ai';
    
    export class GeminiClient {
      private client: GoogleGenerativeAI;
      private model: any;
      
      constructor(apiKey: string) {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp' });
      }
    }
    ```
  - [x] Add error handling for missing API key
  - [x] Add retry logic with exponential backoff (3 attempts)
  - [x] Add timeout handling (10 seconds)

- [x] **Implement Intent Parsing with Low Thinking Level**
  - [ ] Create method `parseIntent(userMessage: string, context: string)`:
    ```typescript
    async parseIntent(userMessage: string, conversationContext: string) {
      const prompt = `
        ${conversationContext}
        
        User Request: "${userMessage}"
        
        Analyze this request and determine:
        1. Target folder (which folder to organize)
        2. Action type (organize, find, create, delete, etc.)
        3. Method (by type, by date, by name, etc.)
        4. Constraints (keep X separate, don't touch Y, etc.)
        5. Conflicts (contradictory requirements)
        
        Output JSON:
        {
          "target": "Downloads" | "Desktop" | "unknown",
          "action": "organize" | "find" | "create" | "unknown",
          "method": "by_type" | "by_date" | "unknown",
          "constraints": ["string array"],
          "conflicts": ["string array"],
          "clarityScore": 0.9,
          "needsClarification": false
        }
      `;
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: { mode: 'low' },  // Fast for real-time UX
          responseMimeType: 'application/json'
        }
      });
      
      return JSON.parse(result.response.text());
    }
    ```
  - [x] Store `thought_signature` from response for later use
  - [x] Add validation for JSON structure
  - [x] Handle malformed JSON responses gracefully

- [x] **Implement Clarification Question Generation**
  - [ ] When `needsClarification === true`, generate follow-up questions:
    ```typescript
    async generateClarification(intent: ParsedIntent) {
      const prompt = `
        User intent unclear: ${JSON.stringify(intent)}
        
        Generate a friendly clarification question.
        Options:
        - If target folder unknown: "Which folder should I organize?"
        - If action unclear: "What would you like me to do?"
        - If method ambiguous: "How should I organize? By type or by date?"
        
        Return single clear question as plain text.
      `;
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: { mode: 'low' }
        }
      });
      
      return result.response.text();
    }
    ```
  - [x] Add suggested response buttons (optional UI enhancement)
  - [x] Track clarification count (max 3 rounds before suggesting alternative approach)

- [x] **Create IPC Handler for Gemini Calls**
  - [ ] Register handler `parse-intent` in main process:
    ```typescript
    ipcMain.handle('parse-intent', async (event, message: string, context: string) => {
      try {
        const intent = await geminiClient.parseIntent(message, context);
        return { success: true, intent };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    ```
  - [x] Register handler `generate-clarification`
  - [x] Add request logging for debugging
  - [x] Return Gemini metadata (tokens, latency, thinking level)

#### 8. Implement Autocomplete for Folder Paths ✅ COMPLETE

- [x] **Index Common Folders on App Start**
  - [x] Create `src/main/services/folder-indexer.ts`
  - [x] Scan `C:\Users\backtrack-testing` on startup (BASE_PATH only)
  - [x] For each folder, scan 2 levels deep to build folder tree
  - [x] Store in memory as array of folder paths
  - [x] Add file watcher to update index when folders change (use `chokidar`)
  - [x] Index should complete in <2 seconds for 1000+ folders

- [x] **Implement Fuzzy Search for Autocomplete**
  - [x] Fuse.js already installed (in package.json)
  - [x] Create search function in renderer process (ChatDrawerPage.tsx)
  - [x] Initialize Fuse.js with folder list on component mount
  - [x] Trigger search after 2+ characters typed
  - [x] Real-time search as user types (auto-triggered)

- [x] **Create Autocomplete Dropdown UI**
  - [x] Show dropdown above input when typing folder path
  - [x] Trigger detection: Look for "C:\" pattern in message
  - [x] Dropdown styling with shadow, border, rounded corners
  - [x] Keyboard navigation: Up/Down arrows to navigate, Enter to select
  - [x] Mouse click to select suggestion
  - [x] Insert selected path into input at cursor position

- [x] **Handle Edge Cases**
  - [x] No matches: Show "No folders found" message with folder icon
  - [x] Too many matches (>50): Show "Type more to narrow results"
  - [x] Permission denied folders: Skip silently during indexing (try-catch in scanDirectory)
  - [x] Escape key to close autocomplete dropdown
  - [x] Helper text changes to show navigation instructions when autocomplete is active

#### 9. Connect Chat Flow End-to-End

- [ ] **Implement Send Message Handler**
  - [ ] User types message and clicks send (or presses Enter)
  - [ ] Add user message to store: `addUserMessage(content)`
  - [ ] Set loading state: `setLoading(true)`
  - [ ] Show typing indicator in UI
  - [ ] Call Gemini via IPC: `await window.api.parseIntent(message, context)`
  - [ ] Wait for response (800-1000ms typical)
  - [ ] Parse intent from response
  - [ ] Check `needsClarification` flag

- [ ] **Handle Clarification Flow**
  - [ ] If `needsClarification === true`:
    - [ ] Generate clarification question via Gemini
    - [ ] Add assistant message with question to store
    - [ ] Set loading state: `setLoading(false)`
    - [ ] Wait for user response
    - [ ] Repeat intent parsing with updated context
  - [ ] If `needsClarification === false`:
    - [ ] Add confirmation message: "Got it! Let me scan your folder..."
    - [ ] Hand off to F2 Planning (next phase)

- [x] **Integrate Folder Scanning** ✅ COMPLETE
  - [x] Once intent is clear, scan target folder via MCP
  - [x] Call `window.api.scanFolder(intent.target, true)` for recursive scan
  - [x] Handle scan errors and show user-friendly error messages
  - [x] Store scanned files in F1 → F2 handoff data structure
  - [x] Save handoff data to localStorage for F2 to consume
  - [x] Show scanning progress in chat: "Scanning folder..."
  - [x] Display scan results: "Scanned X items"

- [ ] **Error Handling**
  - [ ] Gemini API error: "Sorry, I'm having trouble processing that. Please try again."
  - [ ] MCP error: "I couldn't access that folder. Please check the path."
  - [ ] Network error: "Connection lost. Please check your internet."
  - [ ] Timeout: "This is taking longer than expected. Please try a smaller folder."
  - [ ] Add retry button for failed operations

- [ ] **Test Complete Flow**
  - [ ] Test 1: Simple request → Clear intent → Scan folder → Success
  - [ ] Test 2: Unclear request → Clarification question → User answers → Success
  - [ ] Test 3: Invalid folder path → Error message → Retry with valid path
  - [ ] Test 4: Network timeout → Error message → Retry button works
  - [ ] Test 5: Multiple clarifications (3 rounds) → Eventually reaches clear intent

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Test message store actions (add, clear, loading state)
- [ ] Test autocomplete search algorithm (fuzzy matching accuracy)
- [ ] Test conversation context builder (correct formatting)
- [ ] Test IPC message serialization/deserialization

### Integration Tests
- [ ] Test Electron ↔ Renderer IPC communication
- [ ] Test MCP Filesystem connection and operations
- [ ] Test Gemini API calls with mock responses
- [ ] Test error propagation from main to renderer

### User Acceptance Tests
- [ ] User can open/close chat drawer smoothly
- [ ] User can type and send messages
- [ ] Autocomplete appears when typing folder paths
- [ ] Clarification questions are clear and helpful
- [ ] Error messages are user-friendly
- [ ] Keyboard shortcuts work as expected

### Performance Tests
- [ ] Chat drawer animation is smooth (60 FPS)
- [ ] Autocomplete responds in <50ms
- [ ] Gemini intent parsing completes in <1000ms
- [ ] Folder scanning handles 100+ files in <2s
- [ ] App remains responsive during long operations

---

## 🚀 Deployment Considerations

### Environment Setup
- [ ] Create `.env` file with:
  ```
  GEMINI_API_KEY=your_api_key_here
  MCP_ALLOWED_PATHS=/Users/you/Downloads,/Users/you/Documents
  ```
- [ ] Add `.env` to `.gitignore`
- [ ] Document how to obtain Gemini API key in README

### Build Configuration
- [ ] Configure `electron-builder.yml` for packaging:
  ```yaml
  appId: com.backtrack.app
  productName: Backtrack
  directories:
    output: dist
  files:
    - "**/*"
    - "!**/*.ts"
  mac:
    category: public.app-category.productivity
  win:
    target: nsis
  ```

### Platform-Specific Notes
- [ ] **macOS:** Code signing required for distribution (skip for hackathon demo)
- [ ] **Windows:** MCP filesystem paths use backslashes (handle in path normalization)
- [ ] **Linux:** Test on Ubuntu 20.04+ (most common)

---

## 📚 Dependencies Summary

### Production Dependencies
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "@google/generative-ai": "^0.1.0",
  "@modelcontextprotocol/sdk": "^0.1.0",
  "zustand": "^4.4.0",
  "fuse.js": "^7.0.0",
  "framer-motion": "^10.16.0",
  "lucide-react": "^0.300.0",
  "chokidar": "^3.5.0",
  "electron-store": "^8.1.0"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.3.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0",
  "electron-builder": "^24.9.0",
  "concurrently": "^8.2.0",
  "wait-on": "^7.2.0"
}
```

---

## 🎯 Success Metrics

### Day 1 Completion Checklist
- [x] Electron app opens successfully
- [x] MCP Filesystem can scan a folder
- [x] IPC communication works between main and renderer
- [x] Console shows MCP operations logging

### Day 2 Completion Checklist
- [x] Chat drawer opens/closes smoothly
- [x] User can send messages
- [x] Gemini responds with intent parsing
- [x] Autocomplete shows folder suggestions
- [x] Clarification questions display correctly
- [x] End-to-end flow: Message → Parse → Scan → Ready for F2

### Quality Gates
- [ ] No console errors during normal operation
- [ ] Animations run at 60 FPS
- [ ] API calls complete in <2 seconds
- [ ] Error messages are clear and actionable
- [ ] Code follows TypeScript strict mode (no `any` types)

---

## 🔄 Handoff to F2 (Planning)

Once F1 is complete, it provides the following to F2:

```typescript
interface F1_to_F2_Handoff {
  conversationId: string;
  userIntent: string;              // e.g., "Organize Downloads by file type"
  targetFolder: string;            // e.g., "/Users/sarah/Downloads"
  constraints: string[];           // e.g., ["keep work files separate"]
  clarifications: Array<{
    question: string;
    answer: string;
  }>;
  scannedFiles: FileMetadata[];   // Result from MCP scan
  timestamp: string;
}
```

F2 will use this data to generate the action plan using Gemini 3 with high thinking level.

---

## 📝 Notes for Claude Code Assistance

### Effective Prompts for Claude Code

**Day 1 Setup:**
```
"Create an Electron 28 application with React 18 and TypeScript. Set up the project structure with:
- Main process in src/main/
- Renderer process in src/renderer/
- Proper security configuration (contextIsolation: true, nodeIntegration: false)
- Vite for dev server
- IPC handlers setup
Include all necessary package.json scripts and tsconfig.json"
```

**MCP Integration:**
```
"Integrate the MCP Filesystem Server into the Electron main process:
1. Install @modelcontextprotocol/sdk
2. Create a client that connects to the filesystem server
3. Implement methods: readDirectory, moveFile, createFolder, deleteFile
4. Set up IPC handlers to expose these methods to the renderer
5. Add error handling and TypeScript types for all operations"
```

**Chat UI:**
```
"Build a chat interface with:
- Floating button (bottom-right, 64px circle)
- Sliding drawer (400px wide, slides from right)
- Message bubbles (user: right-aligned blue, assistant: left-aligned gray)
- Input area at bottom with send button
- Use Framer Motion for animations
- Use Tailwind CSS for styling
Make it look modern and professional"
```

**Gemini Integration:**
```
"Create a Gemini API client in the Electron main process:
1. Use @google/generative-ai library
2. Implement parseIntent method with thinking_level: 'low'
3. Parse user messages into structured JSON with:
   - target folder
   - action type
   - method
   - constraints
   - clarity score
4. Add retry logic and error handling
5. Set up IPC handler to call from renderer"
```

---

## ⚠️ Common Pitfalls to Avoid

1. **IPC Type Safety:** Always type IPC messages, don't use `any`
2. **MCP Connection:** Check if MCP server is running before operations
3. **Gemini Rate Limits:** Add exponential backoff for retries
4. **Folder Permissions:** Handle permission denied errors gracefully
5. **Memory Leaks:** Clean up IPC listeners on component unmount
6. **Path Handling:** Use `path.join()` for cross-platform compatibility
7. **Context Overflow:** Limit conversation context to last 10 messages
8. **Autocomplete Performance:** Debounce search calls, limit results to 10

---

## 🎉 Day 1-2 Completion Criteria

F1 is complete when:
- ✅ User can open the app and see the floating button
- ✅ Clicking the button opens a smooth chat drawer
- ✅ User can type and send messages
- ✅ Gemini parses intent in under 1 second
- ✅ Autocomplete suggests folder paths
- ✅ Clarification questions work for ambiguous requests
- ✅ Folder scanning via MCP returns file list
- ✅ Errors display helpful messages
- ✅ Ready to hand off to F2 with complete context

**When Day 2 ends, you should be able to:**
1. Type "organize my downloads"
2. System clarifies if needed: "By file type or by date?"
3. User responds: "By type"
4. System scans folder and shows: "Found 35 files, generating plan..."
5. Ready for F2 to take over!

---

**Next Steps:** Once F1 is tested and working, proceed to implementation-plan-F2-ai-powered-planning.md for Day 3-4 work.
