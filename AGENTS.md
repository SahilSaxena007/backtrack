# Repository Guidelines

## Project Structure & Module Organization

- `src/main/`: Electron main process (`main.ts`, `preload.ts`, `ipc/`, `services/`).
- `src/renderer/`: React app (`pages/`, `components/`, `store/`, `styles/`).
- `src/shared/`: Types shared between main and renderer.
- `dist/`: Build output.
- Config: `vite.config.ts`, `tsconfig*.json`, `electron-builder.yml`, `tailwind.config.js`.

## Architecture Overview

- Multi-window Electron app:
  - `#/control-panel` -> first-run `OnboardingPage` then `MainControlPage` (600x400, entry point).
  - `#/floating-button` -> `FloatingButtonPage` (100x100, always-on-top overlay).
  - `#/chat-drawer` -> `ChatDrawerPage` (400x600, slides in left of button).
  - `#/preview-workspace` -> `PreviewWorkspacePage` (dedicated centered preview/undo workspace window).
- Windows are created/destroyed via IPC (`deploy-floating-button`, `hide-floating-button`, preview workspace show/hide handlers).
- Hash-based routing in `src/renderer/App.tsx` (no React Router).
- IPC uses typed preload bridge (`src/main/preload.ts`): renderer calls `window.api.*`.
- File operations must go through MCP (`src/main/services/mcp-client.ts`); allowed paths live in `src/main/ipc/filesystem-handlers.ts`.

## Build, Test, and Development Commands

- `npm run dev`: Start Vite + Electron.
- `npm run build:main`: Compile main process after any `src/main` changes.
- `npm run build`: Full production build.
- `npm run lint`: Type-check only (`tsc --noEmit`).

## Coding Style & Naming Conventions

- TypeScript + React, 2-space indentation, semicolons, single quotes.
- Components/pages: `PascalCase` (e.g., `ChatDrawerPage.tsx`).
- Stores/utilities: `camelCase` (e.g., `conversationStore.ts`).
- Tailwind utilities for renderer styling.

## Testing Guidelines

- No formal test framework; `npm test` fails by design.
- Ad-hoc scripts: `interactive-test.js`, `test-f2-pipeline.js` (run with `node`).

## Commit & Pull Request Guidelines

- Commit messages must be 3-5 words, imperative, present tense.
- PRs: summary, testing notes, and screenshots/clips for UI changes.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
- Optional: set `BASE_PATH` and `MCP_ALLOWED_PATHS` to scope filesystem access.
- All windows must use secure `webPreferences` (`contextIsolation`, `sandbox`, `preload`).

## Current Status

- F2 planning pipeline is complete (3 stages: draft, safety, undo).
- F3 Visual Diff Preview is complete; Tasks 1-8 done (preview store, toast, glass panel, trees layout, recursive FolderTree, preview button, IPC wiring, polish).
- F5 Transactional Execution: Hours 1-5 complete (deps, trace store, backup service, ledger, execution engine, progress overlay + IPC, services initialized, F3 triggers F5).
- F5 demo mode available in preview test page (runs execution against BASE_PATH).
- Undo flow hardened to fetch latest execution if none selected.
- IPC registration moved earlier to avoid missing handlers on first load.
- Guarded execution progress subscription for browser preview mode (window.api may be undefined).
- Preview button label emphasized for clearer affordance.
- Preview panel glassmorphism adjusted to match toast translucency; panel size reduced by 10%.
- Fixed undo engine import to source `FileModification` from shared types (resolves TS2459).
- Reordered startup to create main window before initializing execution engine, preventing "Main window not initialized" during dev:electron.
- F1 → F2 → F3 pipeline wired: ChatDrawer now triggers `generatePlan`, handles errors, and opens preview toast after scan.
- Added planning stage messaging/loading handling and robust error catch around F2/F3 handoff.
- Undo engine uses MCP `moveFile` plus fs-extra deletes (no unsupported MCP delete tools) and interface aligned to MCP client.
- Renderer typing stabilized with `window.api` declarations; lint now clean.
- BASE_PATH defaults aligned to `C:\Users\sahil\backtrack-f5-test` in renderer and main fallbacks.
- Filesystem handlers now respect BASE_PATH env/fallback (`C:\Users\sahil\backtrack-f5-test`) so scanFolder no longer denies access when using that path.
- Preview toast/panel now portal to body with high z-index so previews appear overlayed (not trapped in chat).
- Planning tightened: hard guards in prompt, path-boundary validation rejects plans outside target or recreating target folder; target existence checked via MCP before planning.
- Added execution progress logging in renderer to observe stuck-progress issues.
- Preview/undo UI has been decoupled from chat drawer into a dedicated preview workspace window centered on the active monitor work area.
- Chat drawer now includes a mini eye toggle button to open/close the preview workspace independently.
- New plan previews ask for confirmation before replacing an already-visible preview workspace session.
- First-run onboarding now appears before control panel with two choices: Demo Mode (safe sandbox) or Custom Folder.
- Demo mode creates `backtrack-demo` in the current OS user home directory with sample files for judge-safe testing.
- Added folder picker + runtime folder scope IPC (`select-folder-dialog`, `setup-demo-folder`, `set/get-active-base-path`) and synced renderer/main path scope.
- Chat drawer now uses stage-based planning progress messaging with cancellable in-flight UX and judge-friendly error copy.
- Visual refresh completed: purple accents removed, professional blue/green palette applied across control, chat, preview, and floating button.
- Preview readability improved with high-contrast glass, folder file counts, size hints, and explicit "This will happen" transition annotations.
- Execution success overlay now includes celebration confetti, summary metrics, and quick actions (`View Changes`, `Undo`).
- Control panel keyboard shortcuts added: `Ctrl/Cmd+K` (chat), `Ctrl/Cmd+P` (preview), `Ctrl/Cmd+Z` (undo latest).
- Preview workspace reopen now returns to compact preview button mode after execution (does not force before/after panel open again).
- Undo availability now hydrates from latest successful execution and is visible from control panel/chat surfaces, not only preview pages.
- Added startup recovery for interrupted executions: if app closes mid-run, latest in-progress executions are restored from backup on next launch and marked failed safely.
- Added judge guardrail for repeated organization on the same folder (explicit confirmation before generating a new plan).
- Filesystem path/permission failures now return user-friendly error copy for judges instead of raw technical messages.
- Undo button visibility is now session-scoped: appears only after a successful execution in the current app run.
- Dev behavior now re-shows onboarding/sandbox choice each `npm run dev` launch (session-based onboarding completion in dev).
- Chat history is cleared once at the beginning of a new app session, while preserving messages during active in-session usage.
- Preview before/after readability increased by reducing excessive transparency on inner cards while keeping background haze minimal.

## Agent Workflow Notes

- Do not commit or run git commands unless explicitly instructed.
- Do not use `.claude/progress.md` for context; only update it when tasks complete.
- After completing a task, update `.claude/implementation-plan-F1.md` or `.claude/implementation-plan-F2.md` and update `CLAUDE.md`.
- Update `AGENTS.md` at the start of a new chat or after task updates; this file is the running summary.
- **Update `.claude/implementation-plan-F1.md` or `.claude/implementation-plan-F2.md` checklist tasks or `.claude/implementation-plan-F3.md` or `.claude/FINAL-F5-enhanced-hybrid.md`** after completing each task implementation. Mark all subtasks as `[x]` and note what was accomplished.

## Common Development Gotchas

- Floating button must be 100x100px minimum to avoid clipping.
- Drawer state sync is polling every 500ms (see `FloatingButton.tsx`).
- If Vite port 5173 is in use: `taskkill /F /PID <pid>`.
