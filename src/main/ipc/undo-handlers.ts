import { ipcMain } from 'electron';
import { undoEngine } from '../main';

export function registerUndoHandlers(): void {
  ipcMain.handle('execute-undo', async (_event, executionId: string) => {
    try {
      const result = await undoEngine.executeUndo(executionId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Undo failed' };
    }
  });

  ipcMain.on('modification-decision', (_event, decision: boolean) => {
    undoEngine.resolveModificationDecision(decision);
  });
}
