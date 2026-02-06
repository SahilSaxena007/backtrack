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

- [ ] **Install Framer Motion**
  ```bash
  npm install framer-motion
  ```

- [ ] **Create Preview Store**
  - [ ] File: `src/renderer/store/previewStore.ts`
  - [ ] Define interfaces:
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
  - [ ] Implement Zustand store with 8-second auto-hide timer
  - [ ] Add IPC calls for approve/modify/cancel actions

#### 2. Create Toast Notification Component

- [ ] **File:** `src/renderer/components/preview/PreviewToast.tsx`
- [ ] Implement with:
  - [ ] Framer Motion slide-in animation from right
  - [ ] Glass effect styling (backdrop-blur-[30px])
  - [ ] Stats display (files, folders, duration, risk)
  - [ ] Two buttons: "View Full Preview" and "Approve & Execute"
  - [ ] Auto-hide behavior (8 seconds)
  - [ ] Risk level color coding (green/yellow/red)

### Hour 2: Full Preview Panel

#### 3. Create Glass Panel Component

- [ ] **File:** `src/renderer/components/preview/PreviewPanel.tsx`
- [ ] Implement:
  - [ ] Backdrop overlay (blur + semi-transparent)
  - [ ] Glass panel container (70% width, 75% height, centered)
  - [ ] Cluely-style glass effect (backdrop-blur-[40px], saturate-[200%])
  - [ ] Header with title and close button
  - [ ] Close handlers (X button, Escape key, backdrop click)
  - [ ] Scale + fade animation (Framer Motion)

#### 4. Add Before/After Trees & Summary

- [ ] **Create two-column layout** for Before/After trees
- [ ] **Create Summary Dashboard** with:
  - [ ] 4 stat cards (files, folders, time, risk)
  - [ ] Undo guarantee message
  - [ ] Grid layout
- [ ] **Add Action Buttons**:
  - [ ] Cancel (secondary)
  - [ ] Modify Plan (secondary)
  - [ ] Approve & Execute (primary, highlighted)

### Hour 3: Folder Tree Component

#### 5. Build Recursive Tree Component

- [ ] **File:** `src/renderer/components/preview/FolderTree.tsx`
- [ ] Implement:
  - [ ] Recursive rendering of folders and files
  - [ ] Expand/collapse functionality (click toggle)
  - [ ] Indentation based on depth level
  - [ ] File icons based on extension
  - [ ] Badge display for "After" tree (NEW, MOVED, RENAMED, TEMP)
  - [ ] Hover effects
  - [ ] Smooth expand/collapse animations

### Hour 4: Floating Button + Integration

#### 6. Create Floating Preview Button

- [ ] **File:** `src/renderer/components/preview/PreviewButton.tsx`
- [ ] Implement:
  - [ ] Compact floating button (top-right position)
  - [ ] Mini stats display (file count + risk dot)
  - [ ] Click handler to reopen panel
  - [ ] Hover and tap animations (Framer Motion)
  - [ ] Glass effect styling

#### 7. Wire Up IPC Handlers

- [ ] **File:** `src/main/ipc/preview-handlers.ts`
- [ ] Register handlers for:
  - [ ] `execute-plan` → triggers F5
  - [ ] `request-plan-modification` → returns to F1
  - [ ] `cancel-plan` → returns to F1
- [ ] Update preload.ts with IPC methods

#### 8. Testing & Polish

- [ ] **Test all three stages**:
  - [ ] Toast appearance and auto-hide
  - [ ] Panel open/close (multiple methods)
  - [ ] Button visibility and click
  - [ ] Folder expand/collapse
  - [ ] All action buttons

- [ ] **Visual polish**:
  - [ ] Glass effect in light and dark mode
  - [ ] Animation smoothness
  - [ ] Color contrast and readability
  - [ ] Responsive behavior

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
