export {};

declare global {
  interface Window {
    api: {
      // Filesystem / folder utilities
      getFolderList: () => Promise<string[]>;
      scanFolder: (folderPath: string, recursive?: boolean) => Promise<any>;
      validateFolderPath: (folderPath: string) => Promise<any>;

      // Intent + planning (F1/F2)
      parseIntent: (message: string, context: string) => Promise<any>;
      generateClarification: (intent: object) => Promise<any>;
      generatePlan: (input: any) => Promise<any>;

      // Preview (F3)
      requestPlanModification: (plan: any) => Promise<any>;
      cancelPlan: () => Promise<any>;

      // Execution (F5)
      runExecution: (approvedPlan: any) => Promise<any>;
      runDemoExecution: () => Promise<any>;
      getLatestExecution: () => Promise<any>;
      onExecutionProgress: (callback: (progress: any) => void) => () => void;

      // Undo (F6)
      executeUndo: (executionId: string) => Promise<any>;
      onUndoProgress: (callback: (progress: any) => void) => () => void;
      sendModificationDecision: (decision: boolean) => void;
      onModificationWarning: (callback: (mods: any) => void) => () => void;

      // Drawer / floating button
      toggleDrawer: () => Promise<boolean>;
      openDrawer: () => Promise<boolean>;
      closeDrawer: () => Promise<boolean>;
      isDrawerOpen: () => Promise<boolean>;
      setButtonMouseEvents: (ignore: boolean) => void;
      deployFloatingButton: () => Promise<{ success: boolean; message: string }>;
      hideFloatingButton: () => Promise<{ success: boolean; message: string }>;
      isButtonDeployed: () => Promise<boolean>;
    };
  }
}
