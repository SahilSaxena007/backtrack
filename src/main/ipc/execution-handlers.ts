import { ipcMain } from 'electron';
import * as os from 'os';
import * as path from 'path';
import { executionEngine } from '../main';

function toFriendlyExecutionError(rawMessage?: string): string {
  const message = (rawMessage || '').toLowerCase();

  if (message.includes('access denied') || message.includes('permission')) {
    return 'Backtrack could not organize this folder because permission is restricted. Please choose a folder you can edit.';
  }

  if (message.includes('source not found') || message.includes('folder not found')) {
    return 'Could not organize these files because one or more paths are no longer available. Please rescan and try again.';
  }

  if (message.includes('destination') || message.includes('move_files_batch missing')) {
    return 'Could not organize these files. The folder structure changed during execution. Please generate a fresh plan and retry.';
  }

  return 'Backtrack could not complete the organization safely. No permanent changes were committed.';
}

/**
 * IPC handlers for execution (F5).
 */
export function registerExecutionHandlers(): void {
  ipcMain.handle('execute-plan', async (_event, approvedPlan) => {
    console.log('[IPC] execute-plan called');
    console.log('[IPC] Plan:', JSON.stringify(approvedPlan, null, 2));
    try {
      const result = await executionEngine.executePlan(approvedPlan);
      console.log('[IPC] execute-plan SUCCESS:', result);
      return { success: true, result };
    } catch (error: any) {
      console.error('[IPC] execute-plan FAILED:', error);
      console.error('[IPC] Error stack:', error?.stack);
      return {
        success: false,
        error: toFriendlyExecutionError(error?.message),
        technicalError: error?.message || 'Execution failed'
      };
    }
  });

  ipcMain.handle('run-demo-execution', async () => {
    try {
      const basePath = process.env.BASE_PATH || path.join(os.homedir(), 'backtrack-demo');
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
