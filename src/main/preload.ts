import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer
const api = {
  // Test IPC connection
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),

  // Filesystem operations
  scanFolder: (folderPath: string, recursive?: boolean): Promise<ScanResult> =>
    ipcRenderer.invoke('scan-folder', folderPath, recursive),

  getFolderList: (): Promise<string[]> =>
    ipcRenderer.invoke('get-folder-list'),

  validateFolderPath: (folderPath: string): Promise<ValidationResult> =>
    ipcRenderer.invoke('validate-folder-path', folderPath),

  // Gemini operations (to be implemented)
  parseIntent: (message: string, context: string): Promise<IntentResult> =>
    ipcRenderer.invoke('parse-intent', message, context),

  generateClarification: (intent: object): Promise<string> =>
    ipcRenderer.invoke('generate-clarification', intent),

  // Drawer control
  toggleDrawer: (): Promise<boolean> => ipcRenderer.invoke('toggle-drawer'),
  openDrawer: (): Promise<boolean> => ipcRenderer.invoke('open-drawer'),
  closeDrawer: (): Promise<boolean> => ipcRenderer.invoke('close-drawer'),
  isDrawerOpen: (): Promise<boolean> => ipcRenderer.invoke('is-drawer-open'),

  // Floating button mouse events control
  setButtonMouseEvents: (ignore: boolean): void =>
    ipcRenderer.send('set-button-mouse-events', ignore),

  // Deploy/hide floating button
  deployFloatingButton: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('deploy-floating-button'),
  hideFloatingButton: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('hide-floating-button'),
  isButtonDeployed: (): Promise<boolean> => ipcRenderer.invoke('is-button-deployed'),
};

// Type definitions for the API
interface FileMetadata {
  name: string;
  path: string;
  size: number;
  extension: string;
  modified: string;
  created: string;
  isDirectory: boolean;
}

interface ScanResult {
  success: boolean;
  files?: FileMetadata[];
  error?: string;
}

interface ValidationResult {
  success: boolean;
  exists: boolean;
  isDirectory: boolean;
  error?: string;
}

interface IntentResult {
  success: boolean;
  intent?: {
    target: string;
    action: string;
    method: string;
    constraints: string[];
    conflicts: string[];
    clarityScore: number;
    needsClarification: boolean;
  };
  error?: string;
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// TypeScript declaration for the renderer
declare global {
  interface Window {
    api: typeof api;
  }
}
