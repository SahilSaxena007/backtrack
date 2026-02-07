# Repository Guidelines

## Project Structure & Module Organization

- `src/main/`: Electron main process (`main.ts`, `preload.ts`, `ipc/`, `services/`).
- `src/renderer/`: React app (`pages/`, `components/`, `store/`, `styles/`).
- `src/shared/`: Types shared between main and renderer.
- `dist/`: Build output.
- Config: `vite.config.ts`, `tsconfig*.json`, `electron-builder.yml`, `tailwind.config.js`.

## Architecture Overview

- Multi-window Electron app:
  - `#/control-panel` -> `MainControlPage` (600x400, entry point).
  - `#/floating-button` -> `FloatingButtonPage` (100x100, always-on-top overlay).
  - `#/chat-drawer` -> `ChatDrawerPage` (400x600, slides in left of button).
- Windows are created/destroyed via IPC (`deploy-floating-button`, `hide-floating-button`).
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
- Preview button label emphasized for clearer affordance.
- Preview panel glassmorphism adjusted to match toast translucency; panel size reduced by 10%.

## Agent Workflow Notes

- Do not commit or run git commands unless explicitly instructed.
- Do not use `.claude/progress.md` for context; only update it when tasks complete.
- After completing a task, update `.claude/implementation-plan-F1.md` or `.claude/implementation-plan-F2.md` and update `CLAUDE.md`.
- Update `AGENTS.md` at the start of a new chat or after task updates; this file is the running summary.
- **Update `.claude/implementation-plan-F1.md` or `.claude/implementation-plan-F2.md` checklist tasks or `.claude/implementation-plan-F3.md`** after completing each task implementation. Mark all subtasks as `[x]` and note what was accomplished.

## Common Development Gotchas

- Floating button must be 100x100px minimum to avoid clipping.
- Drawer state sync is polling every 500ms (see `FloatingButton.tsx`).
- If Vite port 5173 is in use: `taskkill /F /PID <pid>`.
