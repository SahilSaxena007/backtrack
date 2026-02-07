import { create } from 'zustand';

type Status = 'idle' | 'preparing' | 'executing' | 'success' | 'error';

interface ProgressUpdate {
  status: Status;
  progress?: number;
  currentAction?: string;
  message?: string;
  error?: string;
}

interface ExecutionState {
  status: Status;
  progress: number;
  currentAction: string;
  message: string;
  error: string | null;
  updateProgress: (update: ProgressUpdate) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  status: 'idle',
  progress: 0,
  currentAction: '',
  message: '',
  error: null,

  updateProgress: (update) =>
    set((state) => ({
      status: update.status,
      progress: update.progress ?? state.progress,
      currentAction: update.currentAction ?? state.currentAction,
      message: update.message ?? state.message,
      error: update.error ?? null,
    })),

  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      currentAction: '',
      message: '',
      error: null,
    }),
}));
