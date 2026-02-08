import { ipcMain } from 'electron';
import { executionEngine } from '../main';

/**
 * IPC handlers for execution (F5).
 */
export function registerExecutionHandlers(): void {
  ipcMain.handle('execute-plan', async (_event, approvedPlan) => {
    try {
      const result = await executionEngine.executePlan(approvedPlan);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Execution failed' };
    }
  });

  ipcMain.handle('run-demo-execution', async () => {
    try {
      const basePath = process.env.BASE_PATH || 'C:\\Users\\backtrack-testing';
      const folderName = `BacktrackDemo_${Date.now()}`;
      const targetFolder = basePath;
      const newFolderPath = `${basePath}\\${folderName}`;

      const approvedPlan = {
        plan_id: `demo_${Date.now()}`,
        user_intent: 'Demo: create preview folder',
        conversation_id: 'demo',
        target_folder: targetFolder,
        actions: [
          {
            id: 'demo_create_folder',
            type: 'create_folder' as const,
            params: { path: newFolderPath },
            description: `Create ${folderName}`,
            depends_on: [],
          },
        ],
        summary: {
          files_affected: 0,
          folders_created: 1,
          estimated_duration_seconds: 1,
        },
        gemini_prompt: 'demo',
        gemini_response: 'demo',
        thinking_signatures: { stage1_draft: 'demo' },
      };

      const result = await executionEngine.executePlan(approvedPlan);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Demo execution failed' };
    }
  });

  ipcMain.handle('get-latest-execution', async () => {
    try {
      const execution = await executionEngine.getLedgerService().getLatestExecution();
      return { success: true, execution };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to fetch latest execution' };
    }
  });
}
