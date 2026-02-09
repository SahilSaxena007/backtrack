import { IpcMain } from 'electron';
import * as os from 'os';
import { getPlanningEngine, PlanningInput } from '../services/planning-engine';
import { getMCPClient } from '../services/mcp-client';

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

      // Validate target folder exists and is accessible
      let targetExists = false;
      try {
        const mcp = await getMCPClient([process.env.BASE_PATH || os.homedir()]);
        targetExists = await mcp.pathExists(input.targetFolder);
      } catch (e) {
        // Fallback to fs if MCP path check fails
        const fs = await import('fs');
        targetExists = fs.existsSync(input.targetFolder);
      }

      if (!targetExists) {
        return {
          success: false,
          error: 'Could not access that folder for planning. Please choose a valid folder and try again.'
        };
      }

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
        error: 'Planning could not complete safely for this folder. Please try a simpler request or choose another folder.',
        technicalError: message
      };
    }
  });

  console.log('[Planning] IPC handlers registered');
}
