# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL RULES

**DO NOT commit changes until explicitly instructed to do so by the user.** Wait for user confirmation before running any git commands.

**DO NOT use `.claude/progress.md` as a reference file.** Only update it to mark completed tasks. Use CLAUDE.md and implementation plans for context.

**Update `.claude/implementation-plan-F1.md` or `.claude/implementation-plan-F2.md` checklist tasks or `.claude/implementation-plan-F3.md`** after completing each task implementation. Mark all subtasks as `[x]` and note what was accomplished.

**Update `CLAUDE.md` after completing each task**

## Project Overview

Backtrack is an Electron desktop application for AI-powered file organization, built for the Gemini 3 Global Hackathon. Users deploy a system-wide floating button overlay, interact through natural language chat, and organize files with AI assistance (Gemini 3 API) via MCP Filesystem Server.

## Key Architecture Decisions

### Multi-Window System (Wisprflow-style)

The app uses **four separate Electron windows**, not a traditional single-window app:

1. **Main Control Panel** (`MainControlPage`) - 600x400px
   - Entry point when app launches
   - First-run flow now shows `OnboardingPage` before control panel content
   - Onboarding lets user choose Demo Mode or Custom Folder
   - Contains "Deploy Backtrack Button" to show/hide floating button
   - Loads at `http://localhost:5173/#/control-panel`

2. **Floating Button Overlay** (`FloatingButtonPage`) - 100x100px
   - System-wide overlay (always-on-top, frameless, transparent)
   - Positioned at `screenWidth-110, screenHeight-110`
   - Click-through enabled except on button hover (`setIgnoreMouseEvents`)
   - Loads at `http://localhost:5173/#/floating-button`

3. **Chat Drawer** (`ChatDrawerPage`) - 400x600px
   - Floating window positioned **20px left of floating button**
   - Semi-transparent (`bg-white/90`) with backdrop blur
   - Slides in from left with Framer Motion
   - Loads at `http://localhost:5173/#/chat-drawer`

4. **Preview Workspace** (`PreviewWorkspacePage`) - centered dedicated preview window
   - Separate window for preview panel, before/after tree, execution progress, and undo UI
   - Opened only when a plan is ready or user toggles it from chat
   - Asks user confirmation before replacing an active preview with a newly generated plan
   - After execution success, reopening workspace defaults to preview button mode (does not auto-force panel open)
   - Loads at `http://localhost:5173/#/preview-workspace`

**Critical**: Windows are created/destroyed dynamically via IPC handlers (`deploy-floating-button`, `hide-floating-button`). When control panel closes, all windows close.

### IPC Communication Pattern

All renderer↔main communication uses **typed IPC via preload script** (`src/main/preload.ts`):

- Renderer calls `window.api.methodName()`
- Main process handles via `ipcMain.handle('method-name', ...)`
- Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- New onboarding/filesystem IPC added:
  - `select-folder-dialog`
  - `setup-demo-folder`
  - `set-active-base-path`
  - `get-active-base-path`

### State Management

Two Zustand stores in renderer process:

- **`uiStore.ts`**: Drawer visibility, loading state, new message flags
- **`conversationStore.ts`**: Message history (user/assistant), conversation ID
- **`previewStore.ts`**: F3 preview mode state + approve/modify/cancel actions
- **`executionStore.ts` / `undoStore.ts`**: execution and undo overlays
- Undo state is hydrated from latest successful ledger execution on app load for control/chat/preview surfaces.

### Reliability Guards

- Startup recovery for interrupted runs: `main.ts` checks ledger for `in_progress` executions and restores from backup before marking failed.
- Repeated-organization guard: chat flow asks explicit confirmation when the same target folder was recently organized.
- Filesystem permission/path errors are translated to judge-friendly user messages in filesystem IPC handlers.
- Undo visibility is session-scoped (enabled after successful execution events in current run; not auto-hydrated from old runs).
- In dev mode, onboarding/sandbox selection is session-based so it appears again on fresh `npm run dev` launches.
- Chat persistence is reset once per new app session and retained during active session interactions.

**Important**: Button polls drawer state every 500ms to stay synced (see `FloatingButton.tsx`).

### MCP Filesystem Integration

File operations use **MCP (Model Context Protocol)** server, not Node.js `fs`:

- Client spawned via stdio transport: `npx @modelcontextprotocol/server-filesystem`
- Allowed paths configured at startup (e.g., `C:\\Users\\backtrack-testing`)
- All file ops route through `MCPFilesystemClient` singleton
- See `src/main/services/mcp-client.ts` for implementation

## Development Commands

```bash
# Start development (Vite + Electron)
npm run dev

# Build main process only (after editing main.ts)
npm run build:main

# Type check without building
npm run lint

# Build for production
npm run build
```

**Important**: After editing files in `src/main/`, you must run `npm run build:main` before changes take effect. The dev server auto-compiles renderer but not main process.

## Routing System

Uses **hash-based routing** (not React Router):

```typescript
// App.tsx determines which page to render based on window.location.hash
#/control-panel → MainControlPage
#/floating-button → FloatingButtonPage
#/chat-drawer → ChatDrawerPage
#/preview-workspace → PreviewWorkspacePage
```

Each Electron window loads a different hash. Change routing logic in `src/renderer/App.tsx`.

## Gemini 3 API Integration (Pending)

Placeholder response currently in `ChatDrawerPage.tsx:44-49`. Replace with:

- API client in `src/main/services/`
- IPC handler for `parse-intent`
- Use `thinking_level: 'low'` for speed
- Return structured JSON via `responseMimeType: 'application/json'`

## File Organization Constraints

**Commit messages**: Must be 3-5 words maximum (enforced by project rules).

**Window creation**: All windows must have security config:

```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: path.join(__dirname, 'preload.js')
}
```

**MCP allowed paths**: Only add paths to `allowedPaths` array in `filesystem-handlers.ts`. Never bypass MCP for file operations.

## Common Development Gotchas

1. **Floating button appears cut off**: Window must be 100x100px minimum to show 64px button with shadow
2. **Drawer doesn't update when closed**: Button polls state every 500ms, not event-driven
3. **Port 5173 already in use**: Kill lingering Vite process: `taskkill /F /PID <pid>`
4. **Changes to main.ts not reflected**: Must run `npm run build:main` after edits
5. **Click-through not working**: Check `setIgnoreMouseEvents(true, { forward: true })` in `createFloatingButtonWindow()`

## Project Structure Context

```
src/
├── main/               # Electron main process (Node.js)
│   ├── main.ts        # Window creation & lifecycle
│   ├── preload.ts     # IPC bridge (contextBridge)
│   ├── ipc/           # IPC handlers (filesystem, gemini)
│   └── services/      # MCP client, future Gemini client
├── renderer/          # React app (browser context)
│   ├── App.tsx        # Hash-based router
│   ├── components/    # FloatingButton
│   ├── pages/         # MainControlPage, FloatingButtonPage, ChatDrawerPage
│   └── store/         # Zustand state (uiStore, conversationStore)
└── shared/            # Types shared between main & renderer
```

## Next Steps

Current status: **Tasks 3-8 complete + Task 9 (folder scanning) partial**

**Completed:**

- ✅ Task 3: Floating button with system-wide overlay and animations
- ✅ Task 4: Chat drawer with message bubbles, typing indicator, and input area
- ✅ Task 5: Input area (implemented as part of Task 4)
- ✅ Task 6: Conversation state management (Zustand conversationStore)
- ✅ Task 7: Gemini 3 API integration for intent parsing
- ✅ Task 8: Autocomplete for folder paths
- ✅ Task 9 (partial): Folder scanning integration - MCP folder scanning works, handoff data prepared for F2

**Completed:**

- ✅ F1 Tasks 1-8: Electron setup, MCP, Gemini, UI, State Management, Autocomplete
- ✅ F1 Task 9 (partial): Folder scanning integration
- ✅ F2 COMPLETE: AI-Powered Planning Engine (3-stage pipeline)
  - Task 1: Enhanced Gemini client with thinking levels
  - Task 2: Stage 1 Draft Planning (low thinking, ~800ms)
  - Task 3: Stage 2 Safety Verification (6 checks + AI, ~3s)
  - Task 4: Stage 3 Undo Generation (deterministic + AI, ~2s)
  - Task 5: Integration & Testing (IPC, stores, complete pipeline)
- ✅ F3 Task 1: Preview store + F2→F3 shared types
- ✅ F3 Task 2: Preview toast component
- ✅ F3 Task 3: Glass preview panel
- ✅ F3 Task 4: Before/after trees + summary dashboard
- ✅ F3 Task 5: Recursive folder tree + badges
- ✅ F3 Task 6: Floating preview button
- ✅ F3 Task 7: Preview IPC handlers + preload wiring
- ✅ F3 Task 8: Testing + visual polish
- ✅ F3 UI polish: Preview button affordance emphasized
- ✅ F5 Hour 1: deps installed, trace store, backup service
- ✅ F5 Hour 2-3: ledger service + execution engine
- ✅ F5 Hour 4: progress overlay + IPC wiring
- ✅ F5 Hour 5 Task 9: service initialization in main
- ✅ F5 Hour 5 Tasks 10-11: renderer execution wiring + F3 triggers F5
- ✅ F5 Demo: preview test page triggers execution via BASE_PATH
- ✅ Dedicated preview workspace window: preview/undo UI moved out of chat drawer and controlled via IPC + chat mini toggle

**Next:**

- Add optional onboarding reset in control panel settings
- Add richer runtime planning progress events from main process (currently renderer timeline-based)
- Expand demo fixture generation to include nested folders with richer file metadata
