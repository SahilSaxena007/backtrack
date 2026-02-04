# Backtrack - AI-Powered File Organization Desktop App

## Project Overview
Backtrack is a desktop application for the Gemini 3 Global Hackathon that provides a transactional execution layer for AI-powered file organization. Users interact through natural language, see visual previews before changes, and can undo any operation with one click.

## Timeline
6 days total (hackathon deadline: [your date])
- Days 1-2: F1 - Natural Language Input ← WE ARE HERE
- Day 3: F2 - AI-Powered Planning (Gemini 3 showcase)
- Day 4: F3 - Visual Preview + F5 - Execution
- Day 5: F6 - Undo + Polish
- Day 6: Demo video + Submission

## Tech Stack
- **Desktop:** Electron 28+
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **State:** Zustand
- **AI:** Gemini 3 API (thinking levels, thought signatures, 1M context)
- **File Ops:** MCP Filesystem Server
- **Checkpoints:** Git (simple-git library)
- **Animations:** Framer Motion

## Current Status
Day 1 in progress - Electron project initialized, basic IPC working. Next: MCP Filesystem integration.

## Architecture
```
User Input → Chat Interface (React)
    ↓
Gemini 3 API (thinking_level: low for speed)
    ↓
MCP Filesystem (real file operations)
    ↓
Git Checkpoints (undo capability)
```

## Key Gemini 3 Features We're Showcasing
1. **Thinking Levels:** Low (800ms planning) vs High (3s verification)
2. **Thought Signatures:** Reasoning continuity across 3 API calls
3. **1M Context Window:** Entire file system + history in one call
4. **Structured Outputs:** Guaranteed valid JSON action graphs

## Implementation Plan Location
See `.claude/implementation-plan-F1.md` for detailed Day 1-2 tasks.

## Development Workflow
1. Read current task from implementation plan
2. Ask Claude Code to implement that specific task
3. Test the implementation
4. Move to next task
5. Track progress in checklist below

## Day 1 Checklist
- [x] Initialize Electron + React + TypeScript project
- [x] Install all dependencies
- [x] Configure Electron security (contextIsolation, etc.)
- [ ] Set up MCP Filesystem Server integration
- [x] Create IPC handlers for file operations (basic Node.js fs, MCP pending)
- [x] Test folder scanning works (verified: 1088 files in Downloads)
- [x] Verify dev environment runs (`npm run dev`)

## Day 2 Checklist
- [ ] Build floating button component
- [ ] Build chat drawer with animations
- [ ] Implement message state management (Zustand)
- [ ] Integrate Gemini 3 API for intent parsing
- [ ] Implement autocomplete for folder paths
- [ ] Test complete conversation flow
- [ ] Ready to hand off to F2

## Important Notes
- MCP Filesystem does the file operations (don't build from scratch)
- Git handles checkpoints (don't build custom system)
- Focus on Gemini 3 integration - that's what wins the hackathon
- Sonnet for 90% of work, Opus only when stuck

## Commands
```bash
# Development
npm run dev          # Start dev server (Vite + Electron)
npm run build        # Build for production
npm run lint         # Check TypeScript errors

# Testing
npm test            # Run tests (once added)
```

## API Keys Needed
- GEMINI_API_KEY (from Google AI Studio)
- MCP allows folders: ~/Downloads, ~/Documents

## Security Configuration
All Electron windows must have:
- contextIsolation: true
- nodeIntegration: false
- sandbox: true
- preload script for safe IPC
