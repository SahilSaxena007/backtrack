import { create } from 'zustand';
import type { F2_to_F3_Input } from '@shared/types';
import { useExecutionStore } from './executionStore';

export type PreviewMode = 'toast' | 'panel' | 'button' | 'hidden';

interface PreviewStore {
  mode: PreviewMode;
  plan: F2_to_F3_Input | null;
  expandedFolders: Set<string>;
  showToast: (plan: F2_to_F3_Input) => void;
  showPanel: () => void;
  showButton: () => void;
  toggleFolder: (path: string) => void;
  expandAll: (paths: string[]) => void;
  collapseAll: () => void;
  approvePlan: () => void;
  modifyPlan: () => void;
  cancelPlan: () => void;
}

const AUTO_HIDE_MS = 8000;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

const clearAutoHideTimer = () => {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
};

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  mode: 'hidden',
  plan: null,
  expandedFolders: new Set<string>(),

  showToast: (plan) => {
    clearAutoHideTimer();
    set({
      mode: 'toast',
      plan,
      expandedFolders: new Set<string>()
    });

    autoHideTimer = setTimeout(() => {
      if (get().mode === 'toast') {
        set({ mode: 'button' });
      }
    }, AUTO_HIDE_MS);
  },

  showPanel: () => {
    clearAutoHideTimer();
    set({ mode: 'panel' });
  },

  showButton: () => {
    clearAutoHideTimer();
    set({ mode: 'button' });
  },

  toggleFolder: (path) => set((state) => {
    const next = new Set(state.expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return { expandedFolders: next };
  }),

  expandAll: (paths) => set({
    expandedFolders: new Set(paths)
  }),

  collapseAll: () => set({
    expandedFolders: new Set<string>()
  }),

  approvePlan: () => {
    const api = (window as any)?.api;
    const plan = get().plan;
    if (api?.runExecution && plan) {
      // Map F3 plan to execution-approved shape
      const approvedPlan = {
        plan_id: plan.plan_id,
        user_intent: plan.user_intent,
        conversation_id: plan.conversation_id,
        target_folder: plan.target_folder,
        actions: plan.actions,
        summary: plan.summary,
      };
      // Optimistically set preparing state
      useExecutionStore.getState().updateProgress({
        status: 'preparing',
        progress: 0,
        message: 'Starting execution...',
      });
      void api.runExecution(approvedPlan);
    }
    set({ mode: 'hidden' });
  },

  modifyPlan: () => {
    const api = (window as any)?.api;
    if (api?.requestPlanModification && get().plan) {
      void api.requestPlanModification(get().plan);
    }
    set({ mode: 'hidden' });
  },

  cancelPlan: () => {
    const api = (window as any)?.api;
    if (api?.cancelPlan) {
      void api.cancelPlan();
    }
    set({ mode: 'hidden' });
  }
}));
