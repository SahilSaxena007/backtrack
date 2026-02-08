import { create } from 'zustand';

interface ExecutionMetadata {
  execution_id: string;
  description: string;
  completed_at: string;
}

interface UndoState {
  canUndo: boolean;
  executionId: string | null;
  description: string;
  timestamp: string;
  isUndoing: boolean;
  enableUndo: (metadata: ExecutionMetadata) => void;
  disableUndo: () => void;
  startUndo: () => void;
  completeUndo: () => void;
}

export const useUndoStore = create<UndoState>((set) => ({
  canUndo: false,
  executionId: null,
  description: '',
  timestamp: '',
  isUndoing: false,

  enableUndo: (metadata) =>
    set({
      canUndo: true,
      executionId: metadata.execution_id,
      description: metadata.description || 'Recent organization',
      timestamp: metadata.completed_at,
    }),

  disableUndo: () =>
    set({
      canUndo: false,
      executionId: null,
      description: '',
      timestamp: '',
      isUndoing: false,
    }),

  startUndo: () => set({ isUndoing: true }),

  completeUndo: () =>
    set({
      canUndo: false,
      isUndoing: false,
      executionId: null,
    }),
}));

export type { ExecutionMetadata };
