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

  generateClarification: (intent: object): Promise<ClarificationResult> =>
    ipcRenderer.invoke('generate-clarification', intent),

  // Planning operations (F2)
  generatePlan: (input: PlanningInput): Promise<PlanResult> =>
    ipcRenderer.invoke('generate-plan', input),

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

interface ClarificationResult {
  success: boolean;
  question?: string;
  error?: string;
}

interface PlanningInput {
  conversationId: string;
  userIntent: string;
  targetFolder: string;
  constraints: string[];
  scannedFiles: FileMetadata[];
  parsedIntent: any;
}

interface PlanResult {
  success: boolean;
  plan?: {
    plan_id: string;
    actions: any[];
    undo_plan: any;
    safety_analysis: any;
    summary: {
      total_actions: number;
      files_affected: number;
      folders_created: number;
    };
    gemini_metadata: {
      stage1_thinking_level: string;
      stage1_signature: string;
      stage1_latency_ms: number;
      stage1_tokens: number;
      stage2_thinking_level: string;
      stage2_signature: string;
      stage2_latency_ms: number;
      stage2_tokens: number;
      stage3_thinking_level: string;
      stage3_signature: string;
      stage3_latency_ms: number;
      stage3_tokens: number;
      total_time_ms: number;
      total_tokens: number;
    };
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
