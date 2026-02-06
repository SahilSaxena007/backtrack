import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Planning state for F2 pipeline
 */
interface PlanningState {
  // Current plan being generated or displayed
  currentPlan: any | null;

  // Planning status
  isGenerating: boolean;
  generationStage: 'idle' | 'stage1' | 'stage2' | 'stage3' | 'complete' | 'error';

  // Error handling
  error: string | null;

  // Timing metrics
  startTime: number | null;

  // Actions
  startPlanGeneration: () => void;
  setGenerationStage: (stage: PlanningState['generationStage']) => void;
  setPlan: (plan: any) => void;
  setError: (error: string) => void;
  clearPlan: () => void;
  reset: () => void;
}

/**
 * Zustand store for planning state
 */
export const usePlanningStore = create<PlanningState>()(
  persist(
    (set) => ({
      // Initial state
      currentPlan: null,
      isGenerating: false,
      generationStage: 'idle',
      error: null,
      startTime: null,

      // Start plan generation
      startPlanGeneration: () => set({
        isGenerating: true,
        generationStage: 'stage1',
        error: null,
        startTime: Date.now()
      }),

      // Update generation stage
      setGenerationStage: (stage) => set({
        generationStage: stage,
        isGenerating: stage !== 'complete' && stage !== 'error' && stage !== 'idle'
      }),

      // Set completed plan
      setPlan: (plan) => set({
        currentPlan: plan,
        isGenerating: false,
        generationStage: 'complete',
        error: null
      }),

      // Set error
      setError: (error) => set({
        error,
        isGenerating: false,
        generationStage: 'error'
      }),

      // Clear current plan
      clearPlan: () => set({
        currentPlan: null,
        generationStage: 'idle'
      }),

      // Reset all state
      reset: () => set({
        currentPlan: null,
        isGenerating: false,
        generationStage: 'idle',
        error: null,
        startTime: null
      })
    }),
    {
      name: 'planning-storage',
      // Only persist the plan, not the generation state
      partialize: (state) => ({
        currentPlan: state.currentPlan
      })
    }
  )
);
