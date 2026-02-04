import { IpcMain } from 'electron';

// Placeholder handlers for Gemini API integration
// These will be fully implemented in Day 2, Task 7

export function registerGeminiHandlers(ipcMain: IpcMain): void {
  // Parse intent handler (placeholder)
  ipcMain.handle('parse-intent', async (_event, message: string, _context: string) => {
    console.log(`[Gemini] parse-intent called with: "${message}"`);

    // Return mock response for now
    return {
      success: true,
      intent: {
        target: 'unknown',
        action: 'unknown',
        method: 'unknown',
        constraints: [],
        conflicts: [],
        clarityScore: 0,
        needsClarification: true,
      },
      message: 'Gemini integration not yet implemented. This is a placeholder response.',
    };
  });

  // Generate clarification handler (placeholder)
  ipcMain.handle('generate-clarification', async (_event, _intent: object) => {
    console.log('[Gemini] generate-clarification called');

    // Return mock clarification
    return 'Which folder would you like me to organize?';
  });

  console.log('[Gemini] IPC handlers registered (placeholder)');
}
