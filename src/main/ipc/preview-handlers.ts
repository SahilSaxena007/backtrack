import { IpcMain } from 'electron';
import type { F2_to_F3_Input } from '../../shared/types';

interface PreviewActionResult {
  success: boolean;
  message: string;
}

export function registerPreviewHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('request-plan-modification', async (_event, plan: F2_to_F3_Input): Promise<PreviewActionResult> => {
    console.log('[IPC] request-plan-modification called', plan?.plan_id);
    // TODO: Return to F1 clarification flow
    return { success: true, message: 'Modification requested (stub)' };
  });

  ipcMain.handle('cancel-plan', async (): Promise<PreviewActionResult> => {
    console.log('[IPC] cancel-plan called');
    // TODO: Return to F1 flow
    return { success: true, message: 'Plan cancelled (stub)' };
  });
}
