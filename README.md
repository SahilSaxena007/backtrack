# Backtrack AI

Backtrack AI is an Electron desktop agent for safe file organization with natural language. It is built around a strict safety loop:

1. Understand intent with Gemini.
2. Generate a structured plan.
3. Show a before/after preview.
4. Execute only after explicit approval.
5. Support deterministic undo.

## Why this project is technically strong

This repository demonstrates quality application development in the areas judges care about:

- Type-safe architecture across Electron main/renderer/shared boundaries.
- Typed IPC bridge via `preload.ts` (no direct Node access in renderer).
- Staged Gemini reasoning pipeline (intent -> plan -> safety -> undo-plan).
- Structured JSON outputs consumed by typed runtime objects.
- Transactional execution stack: trace store, backup checkpoints, ledger, execution engine, undo engine.
- Safety constraints before writes: scope boundaries, validation gates, and user approval.
- Recoverability: undo and startup recovery behavior for interrupted runs.

Quality checks:

- `npm run lint` (`tsc --noEmit`)
- `npm run build:main` (main-process TypeScript compile)

## Features

- Floating agent button + detachable chat drawer.
- Dedicated preview workspace (before/after + execution controls).
- Human-in-the-loop approval before filesystem mutations.
- Undo support for completed executions.
- Folder scope onboarding and path validation.
- MCP filesystem integration with local fallback support.

## Tech Stack

- Languages: TypeScript, JavaScript, HTML, CSS
- Desktop: Electron
- Frontend: React, Vite, Tailwind CSS, Zustand, Framer Motion
- AI: Google Gemini via `@google/generative-ai`
- Agent/tool layer: Model Context Protocol (`@modelcontextprotocol/sdk`)
- File services: `fs-extra`

## Repository Structure

- `src/main/`: Electron main process, IPC handlers, execution/safety services
- `src/renderer/`: React UI pages/components/stores
- `src/shared/`: shared types for main/renderer contracts
- `dist/`: build output

## Prerequisites

- Node.js 18+ (recommended: Node 20 LTS)
- npm 9+
- Windows is the current primary tested environment

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
copy .env.example .env
```

3. Set required env values in `.env`:

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional, default currently used by app: `gemini-3-pro-preview`)
- `BASE_PATH` (optional)
- `MCP_ALLOWED_PATHS` (optional)
- `USE_LOCAL_FS=1` (optional fallback mode if MCP filesystem server is unavailable)

## Run

```bash
npm run dev
```

What to expect:

1. Control panel opens.
2. Click `Deploy Agent Button`.
3. Open chat from the floating button.
4. Enter a request, review preview, then approve execution if correct.

Example prompt:

`Organize this folder by creating Images and Pdf folders, move image files to Images and pdf files to Pdf.`

## Commands

- `npm run dev`: start Vite + Electron
- `npm run lint`: TypeScript type-check
- `npm run build:main`: compile Electron main process
- `npm run build`: full production build
- `npm run verify`: run lint + main build

## Keyboard Shortcuts

- `Ctrl/Cmd + K`: open chat drawer
- `Ctrl/Cmd + P`: open preview workspace
- `Ctrl/Cmd + Z`: undo latest organization

## Troubleshooting

- `No files found in this folder yet`:
  - Make sure the selected folder actually contains files.
  - Re-check onboarding folder selection and active scope.
- Gemini key errors:
  - Ensure `.env` exists and `GEMINI_API_KEY` is valid.
- MCP filesystem issues:
  - Use local fallback by setting `USE_LOCAL_FS=1` in `.env`.
- Port conflict on `8000`:
  - Stop the process using the port, then re-run `npm run dev`.

## Security model

- Renderer runs with `contextIsolation: true` and `sandbox: true`.
- Filesystem operations are executed through controlled main-process handlers.
- Scope-boundary checks prevent planning/execution outside selected folder.
