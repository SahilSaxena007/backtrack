# Implementation Plan: F3 - Visual Diff Preview
**Backtrack Desktop App - Gemini 3 Hackathon**

**Timeline:** Day 4 Morning (4 hours)  
**Tech Stack:** React 18 | TypeScript | Tailwind CSS | Framer Motion  
**Claude Code Assistance:** Heavy - 70% code generation expected

---

## 🎯 Implementation Context

### Feature Summary
F3 is the **trust-building layer** of Backtrack - it transforms abstract action plans from F2 into beautiful, visual previews that users understand at a glance. Using a three-stage progressive disclosure pattern (toast → full panel → button), F3 shows exactly what will happen before any files are touched.

**Core Principle:** Show, don't tell. Users see the future state before committing.

### User Workflow Overview

**Three-Stage UX Flow:**

1. **Toast Notification** (auto-appears)
   - Appears when F2 completes
   - Shows key stats in compact format
   - 8-second auto-hide timer
   - Quick actions: Approve or View Full Preview

2. **Full Glass Panel** (on-demand)
   - Opens when clicking "View Full Preview" or preview button
   - Beautiful frosted glass overlay (Cluely-style)
   - Side-by-side before/after folder trees
   - Detailed statistics and risk assessment
   - Actions: Cancel, Modify, or Approve

3. **Floating Button** (persistent)
   - Appears after toast hides or panel closes
   - Small, non-intrusive corner button
   - Shows mini summary (file count + risk)
   - Click to reopen full panel anytime

### Success Criteria
- ✅ Toast appears within 200ms of F2 completion
- ✅ Toast auto-hides after 8 seconds → becomes button
- ✅ Full panel opens smoothly (<300ms animation)
- ✅ Glass effect looks polished (Cluely-style)
- ✅ Folder trees are expandable/collapsible
- ✅ All buttons work (approve, modify, cancel)
- ✅ Dark mode support

---

## 📋 Implementation Tasks - Day 4 Morning

### Hour 1: State Management + Toast Component

#### 1. Install Dependencies & Create Preview Store

- [x] **Install Framer Motion**
  ```bash
  npm install framer-motion
  ```

- [x] **Create Preview Store**
  - [x] File: `src/renderer/store/previewStore.ts`
  - [x] Define interfaces:
    ```typescript
    type PreviewMode = 'toast' | 'panel' | 'button' | 'hidden';
    
    interface PreviewStore {
      mode: PreviewMode;
      plan: F2_to_F3_Input | null;
      expandedFolders: Set<string>;
      
      showToast: (plan: F2_to_F3_Input) => void;
      showPanel: () => void;
      showButton: () => void;
      toggleFolder: (path: string) => void;
      approvePlan: () => void;
      modifyPlan: () => void;
      cancelPlan: () => void;
    }
    ```
  - [x] Implement Zustand store with 8-second auto-hide timer
  - [x] Add IPC calls for approve/modify/cancel actions

#### 2. Create Toast Notification Component

- [x] **File:** `src/renderer/components/preview/PreviewToast.tsx`
- [x] Implement with:
  - [x] Framer Motion slide-in animation from right
  - [x] Glass effect styling (backdrop-blur-[30px])
  - [x] Stats display (files, folders, duration, risk)
  - [x] Two buttons: "View Full Preview" and "Approve & Execute"
  - [x] Auto-hide behavior (8 seconds)
  - [x] Risk level color coding (green/yellow/red)

### Hour 2: Full Preview Panel

#### 3. Create Glass Panel Component

- [x] **File:** `src/renderer/components/preview/PreviewPanel.tsx`
- [x] Implement:
  - [x] Backdrop overlay (blur + semi-transparent)
  - [x] Glass panel container (70% width, 75% height, centered)
  - [x] Cluely-style glass effect (backdrop-blur-[40px], saturate-[200%])
  - [x] Header with title and close button
  - [x] Close handlers (X button, Escape key, backdrop click)
  - [x] Scale + fade animation (Framer Motion)

#### 4. Add Before/After Trees & Summary

- [x] **Create two-column layout** for Before/After trees
- [x] **Create Summary Dashboard** with:
  - [x] 4 stat cards (files, folders, time, risk)
  - [x] Undo guarantee message
  - [x] Grid layout
- [x] **Add Action Buttons**:
  - [x] Cancel (secondary)
  - [x] Modify Plan (secondary)
  - [x] Approve & Execute (primary, highlighted)

### Hour 3: Folder Tree Component

#### 5. Build Recursive Tree Component

- [x] **File:** `src/renderer/components/preview/FolderTree.tsx`
- [x] Implement:
  - [x] Recursive rendering of folders and files
  - [x] Expand/collapse functionality (click toggle)
  - [x] Indentation based on depth level
  - [x] File icons based on extension
  - [x] Badge display for "After" tree (NEW, MOVED, RENAMED, TEMP)
  - [x] Hover effects
  - [x] Smooth expand/collapse animations

### Hour 4: Floating Button + Integration

#### 6. Create Floating Preview Button

- [x] **File:** `src/renderer/components/preview/PreviewButton.tsx`
- [x] Implement:
  - [x] Compact floating button (top-right position)
  - [x] Mini stats display (file count + risk dot)
  - [x] Click handler to reopen panel
  - [x] Hover and tap animations (Framer Motion)
  - [x] Glass effect styling

#### 7. Wire Up IPC Handlers

- [x] **File:** `src/main/ipc/preview-handlers.ts`
- [x] Register handlers for:
  - [x] `execute-plan` → triggers F5
  - [x] `request-plan-modification` → returns to F1
  - [x] `cancel-plan` → returns to F1
- [x] Update preload.ts with IPC methods

#### 8. Testing & Polish

- [x] **Test all three stages**:
  - [x] Toast appearance and auto-hide
  - [x] Panel open/close (multiple methods)
  - [x] Button visibility and click
  - [x] Folder expand/collapse
  - [x] All action buttons

- [x] **Visual polish**:
  - [x] Glass effect in light and dark mode
  - [x] Animation smoothness
  - [x] Color contrast and readability
  - [x] Responsive behavior

---

## 🎯 Day 4 Morning Completion Criteria

F3 is complete when:
- ✅ Toast appears and auto-hides after 8s
- ✅ Full panel opens with beautiful glass effect
- ✅ Trees render and are expandable
- ✅ Floating button persists after hide
- ✅ All user actions work correctly
- ✅ Dark mode looks great
- ✅ Ready for F5 execution integration!

**Next:** Day 4 afternoon implements F5 (Execution via MCP + Git)

---

**Make it stunning - this is what builds trust!** ✨
