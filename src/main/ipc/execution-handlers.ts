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

  ipcMain.handle('get-latest-execution', async () => {
    try {
      const execution = await executionEngine.ledgerService.getLatestExecution();
      return { success: true, execution };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to fetch latest execution' };
    }
  });
}
