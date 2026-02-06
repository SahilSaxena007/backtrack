import { IpcMain } from 'electron';
import { getPlanningEngine, PlanningInput } from '../services/planning-engine';

/**
 * Register all planning-related IPC handlers
 */
export function registerPlanningHandlers(ipcMain: IpcMain): void {
  /**
   * Generate complete action plan (F2 Pipeline: 3 stages)
   * Input: F1 handoff data
   * Output: Complete plan with actions, undo, safety analysis
   */
  ipcMain.handle('generate-plan', async (_event, input: PlanningInput) => {
    try {
      console.log('[IPC] generate-plan called');
      console.log(`[IPC] Target: ${input.targetFolder}`);
      console.log(`[IPC] Files: ${input.scannedFiles.length}`);
      console.log(`[IPC] Intent: ${input.userIntent}`);

      const planningEngine = getPlanningEngine();
      const result = await planningEngine.generateCompletePlan(input);

      console.log('[IPC] generate-plan success');
      console.log(`[IPC] Plan ID: ${result.plan_id}`);
      console.log(`[IPC] Actions: ${result.actions.length}`);
      console.log(`[IPC] Total time: ${result.gemini_metadata.total_time_ms}ms`);

      return {
        success: true,
        plan: result
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[IPC] generate-plan error:', message);

      return {
        success: false,
        error: message
      };
    }
  });

  console.log('[Planning] IPC handlers registered');
}
