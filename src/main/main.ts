import { app, BrowserWindow, dialog, ipcMain, screen, type OpenDialogOptions } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { registerFilesystemHandlers } from './ipc/filesystem-handlers';
import { registerGeminiHandlers } from './ipc/gemini-handlers';
import { registerPlanningHandlers } from './ipc/planning-handlers';
import { registerPreviewHandlers } from './ipc/preview-handlers';
import { registerExecutionHandlers } from './ipc/execution-handlers';
import { registerUndoHandlers } from './ipc/undo-handlers';
import { TraceStore } from './services/trace-store';
import { BackupService } from './services/backup-service';
import { LedgerService } from './services/ledger-service';
import { ExecutionEngine } from './services/execution-engine';
import { UndoEngine } from './services/undo-engine';
import { ModificationDetector } from './services/modification-detector';
import { getMCPClient } from './services/mcp-client';
import type { F2_to_F3_Input } from '../shared/types';

// Load environment variables from .env file
dotenv.config();

let mainControlWindow: BrowserWindow | null = null;
let floatingButtonWindow: BrowserWindow | null = null;
let chatDrawerWindow: BrowserWindow | null = null;
let previewWorkspaceWindow: BrowserWindow | null = null;
let currentPreviewPlan: F2_to_F3_Input | null = null;
export let executionEngine: ExecutionEngine;
export let undoEngine: UndoEngine;

const isDev = !app.isPackaged;

function getDemoFolderPath(): string {
  return path.join(os.homedir(), 'backtrack-demo');
}

async function ensureDemoFolder(): Promise<string> {
  const demoRoot = getDemoFolderPath();
  await fs.mkdir(demoRoot, { recursive: true });

  const sampleFiles: Array<{ relativePath: string; content: string }> = [
    {
      relativePath: 'vacation-photo-01.jpg',
      content: 'Sample image placeholder for Backtrack demo.'
    },
    {
      relativePath: 'vacation-photo-02.png',
      content: 'Sample image placeholder for Backtrack demo.'
    },
    {
      relativePath: 'tax-document-2025.pdf',
      content: 'Sample PDF placeholder for Backtrack demo.'
    },
    {
      relativePath: 'meeting-notes.txt',
      content: 'Demo notes:\n- Organize images\n- Group documents\n- Keep recent files easy to find'
    },
    {
      relativePath: 'project-proposal.docx',
      content: 'Sample Word document placeholder for Backtrack demo.'
    },
    {
      relativePath: 'receipts/january-receipt.pdf',
      content: 'Receipt placeholder content.'
    },
    {
      relativePath: 'music/idea-track.mp3',
      content: 'Sample audio placeholder for Backtrack demo.'
    }
  ];

  await Promise.all(
    sampleFiles.map(async (item) => {
      const fullPath = path.join(demoRoot, item.relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      try {
        await fs.access(fullPath);
      } catch {
        await fs.writeFile(fullPath, item.content, 'utf8');
      }
    })
  );

  return demoRoot;
}

function getActiveDisplay() {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
}

function createMainControlWindow(): void {
  mainControlWindow = new BrowserWindow({
    width: 600,
    height: 400,
    minWidth: 500,
    minHeight: 300,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
    title: 'Backtrack Control Panel',
  });

  // Load the control panel page
  if (isDev) {
    mainControlWindow.loadURL('http://localhost:8000/#/control-panel');
  } else {
    mainControlWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'control-panel'
    });
  }

  mainControlWindow.once('ready-to-show', () => {
    mainControlWindow?.show();
  });

  mainControlWindow.on('closed', () => {
    console.log('[App] Main control window closed - cleaning up other windows');
    mainControlWindow = null;
    // Clean up floating button and drawer when control window closes
    if (floatingButtonWindow) {
      floatingButtonWindow.close();
      floatingButtonWindow = null;
    }
    if (chatDrawerWindow) {
      chatDrawerWindow.close();
      chatDrawerWindow = null;
    }
    if (previewWorkspaceWindow) {
      previewWorkspaceWindow.close();
      previewWorkspaceWindow = null;
    }
    currentPreviewPlan = null;
  });
}

function createFloatingButtonWindow(): void {
  const display = getActiveDisplay();
  const { x: workX, y: workY, width: workWidth, height: workHeight } = display.workArea;

  floatingButtonWindow = new BrowserWindow({
    width: 100,
    height: 100,
    x: workX + workWidth - 110, // 10px from right edge of active display work area
    y: workY + workHeight - 110, // 10px from bottom edge of active display work area
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Make window click-through except for button
  floatingButtonWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the floating button page
  if (isDev) {
    floatingButtonWindow.loadURL('http://localhost:8000/#/floating-button');
  } else {
    floatingButtonWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'floating-button'
    });
  }

  floatingButtonWindow.once('ready-to-show', () => {
    floatingButtonWindow?.show();
  });

  floatingButtonWindow.on('closed', () => {
    floatingButtonWindow = null;
  });
}

function createChatDrawerWindow(): void {
  const display = getActiveDisplay();
  const { x: workX, y: workY, width: workWidth, height: workHeight } = display.workArea;

  // Chat drawer dimensions
  const drawerWidth = 400;
  const drawerHeight = 600;
  const buttonSize = 100;

  // Floating button position
  const buttonX = workX + workWidth - 110;
  const buttonY = workY + workHeight - 110;

  // Position drawer to the left of button, with bottom edges aligned
  const drawerX = buttonX - drawerWidth - 10; // 10px gap from button
  const drawerY = buttonY - (drawerHeight - buttonSize); // Align bottom edges

  chatDrawerWindow = new BrowserWindow({
    width: drawerWidth,
    height: drawerHeight,
    x: drawerX,
    y: drawerY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Load the chat drawer page
  if (isDev) {
    chatDrawerWindow.loadURL('http://localhost:8000/#/chat-drawer');
  } else {
    chatDrawerWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'chat-drawer'
    });
  }

  chatDrawerWindow.on('closed', () => {
    chatDrawerWindow = null;
  });
}

type PreviewWorkspaceEvent =
  | { type: 'present-plan'; plan: F2_to_F3_Input; mode: 'toast' | 'panel' | 'button' }
  | { type: 'set-mode'; mode: 'toast' | 'panel' | 'button' };

function getPreviewWorkspaceDisplay() {
  if (chatDrawerWindow && !chatDrawerWindow.isDestroyed()) {
    const bounds = chatDrawerWindow.getBounds();
    const anchor = {
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + Math.floor(bounds.height / 2),
    };
    return screen.getDisplayNearestPoint(anchor);
  }

  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    const bounds = floatingButtonWindow.getBounds();
    const anchor = {
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + Math.floor(bounds.height / 2),
    };
    return screen.getDisplayNearestPoint(anchor);
  }

  return screen.getPrimaryDisplay();
}

function createPreviewWorkspaceWindow(): void {
  const display = getPreviewWorkspaceDisplay();
  const workArea = display.workArea;
  const workspaceWidth = Math.min(workArea.width, Math.max(1100, Math.floor(workArea.width * 0.86)));
  const workspaceHeight = Math.min(workArea.height, Math.max(760, Math.floor(workArea.height * 0.84)));
  const workspaceX = workArea.x + Math.floor((workArea.width - workspaceWidth) / 2);
  const workspaceY = workArea.y + Math.floor((workArea.height - workspaceHeight) / 2);

  previewWorkspaceWindow = new BrowserWindow({
    width: workspaceWidth,
    height: workspaceHeight,
    x: workspaceX,
    y: workspaceY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  if (isDev) {
    previewWorkspaceWindow.loadURL('http://localhost:8000/#/preview-workspace');
  } else {
    previewWorkspaceWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'preview-workspace'
    });
  }

  previewWorkspaceWindow.on('closed', () => {
    previewWorkspaceWindow = null;
  });
}

function ensurePreviewWorkspaceWindow(): BrowserWindow {
  if (!previewWorkspaceWindow || previewWorkspaceWindow.isDestroyed()) {
    createPreviewWorkspaceWindow();
  }
  return previewWorkspaceWindow!;
}

function sendPreviewWorkspaceEvent(payload: PreviewWorkspaceEvent): void {
  if (!previewWorkspaceWindow || previewWorkspaceWindow.isDestroyed()) {
    return;
  }

  if (previewWorkspaceWindow.webContents.isLoading()) {
    previewWorkspaceWindow.webContents.once('did-finish-load', () => {
      if (previewWorkspaceWindow && !previewWorkspaceWindow.isDestroyed()) {
        previewWorkspaceWindow.webContents.send('preview-workspace-event', payload);
      }
    });
    return;
  }

  previewWorkspaceWindow.webContents.send('preview-workspace-event', payload);
}

// Register IPC handlers
function setupIPC(): void {
  registerFilesystemHandlers(ipcMain);
  registerGeminiHandlers(ipcMain);
  registerPlanningHandlers(ipcMain);
  registerPreviewHandlers(ipcMain);
  registerExecutionHandlers();
  registerUndoHandlers();

  // Simple ping handler for testing IPC
  ipcMain.handle('ping', () => 'pong');

  // Toggle chat drawer
  ipcMain.handle('toggle-drawer', () => {
    if (chatDrawerWindow) {
      if (chatDrawerWindow.isVisible()) {
        chatDrawerWindow.hide();
      } else {
        chatDrawerWindow.show();
        chatDrawerWindow.focus();
      }
      return chatDrawerWindow.isVisible();
    }
    return false;
  });

  // Open chat drawer
  ipcMain.handle('open-drawer', () => {
    if (chatDrawerWindow) {
      chatDrawerWindow.show();
      chatDrawerWindow.focus();
      return true;
    }
    return false;
  });

  // Close chat drawer
  ipcMain.handle('close-drawer', () => {
    if (chatDrawerWindow) {
      chatDrawerWindow.hide();
      return true;
    }
    return false;
  });

  // Check if drawer is open
  ipcMain.handle('is-drawer-open', () => {
    return chatDrawerWindow?.isVisible() || false;
  });

  ipcMain.handle('present-preview-plan', async (event, plan: F2_to_F3_Input) => {
    if (!plan) {
      return { success: false, message: 'No plan available to preview' };
    }

    if (previewWorkspaceWindow?.isVisible() && currentPreviewPlan) {
      const sourceWindow =
        BrowserWindow.fromWebContents(event.sender) ?? previewWorkspaceWindow ?? mainControlWindow ?? undefined;
      const confirmation = await dialog.showMessageBox(sourceWindow, {
        type: 'question',
        buttons: ['Replace Preview', 'Keep Current'],
        defaultId: 0,
        cancelId: 1,
        title: 'Replace current preview?',
        message: 'A preview is already open.',
        detail: 'Do you want to replace the current before/after preview with this newly generated plan?'
      });

      if (confirmation.response !== 0) {
        return { success: false, cancelled: true, message: 'Kept current preview' };
      }
    }

    currentPreviewPlan = plan;
    const previewWindow = ensurePreviewWorkspaceWindow();
    if (previewWindow.isMinimized()) {
      previewWindow.restore();
    }
    previewWindow.show();
    previewWindow.focus();
    sendPreviewWorkspaceEvent({ type: 'present-plan', plan, mode: 'panel' });

    return { success: true, visible: true, message: 'Preview opened in workspace' };
  });

  ipcMain.handle('toggle-preview-workspace', () => {
    if (previewWorkspaceWindow?.isVisible()) {
      previewWorkspaceWindow.hide();
      return { success: true, visible: false, message: 'Preview workspace hidden' };
    }

    if (!currentPreviewPlan) {
      return { success: false, visible: false, message: 'No preview available yet. Generate a plan first.' };
    }

    const previewWindow = ensurePreviewWorkspaceWindow();
    if (previewWindow.isMinimized()) {
      previewWindow.restore();
    }
    previewWindow.show();
    previewWindow.focus();
    sendPreviewWorkspaceEvent({ type: 'set-mode', mode: 'button' });
    return { success: true, visible: true, message: 'Preview workspace shown' };
  });

  ipcMain.handle('show-preview-workspace', () => {
    if (!currentPreviewPlan) {
      return { success: false, visible: false, message: 'No preview available yet. Generate a plan first.' };
    }

    const previewWindow = ensurePreviewWorkspaceWindow();
    if (previewWindow.isMinimized()) {
      previewWindow.restore();
    }
    previewWindow.show();
    previewWindow.focus();
    sendPreviewWorkspaceEvent({ type: 'set-mode', mode: 'button' });
    return { success: true, visible: true, message: 'Preview workspace shown' };
  });

  ipcMain.handle('hide-preview-workspace', () => {
    if (previewWorkspaceWindow && !previewWorkspaceWindow.isDestroyed()) {
      previewWorkspaceWindow.hide();
    }
    return { success: true, visible: false, message: 'Preview workspace hidden' };
  });

  ipcMain.handle('is-preview-workspace-open', () => {
    return previewWorkspaceWindow?.isVisible() || false;
  });

  ipcMain.handle('clear-preview-plan', () => {
    currentPreviewPlan = null;
    return { success: true };
  });

  ipcMain.handle('select-folder-dialog', async () => {
    const sourceWindow = mainControlWindow ?? chatDrawerWindow ?? previewWorkspaceWindow ?? undefined;
    const options: OpenDialogOptions = {
      title: 'Choose folder to organize',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Use this folder'
    };
    const result = sourceWindow
      ? await dialog.showOpenDialog(sourceWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true, message: 'No folder selected' };
    }

    return {
      success: true,
      cancelled: false,
      path: result.filePaths[0],
      message: 'Folder selected'
    };
  });

  ipcMain.handle('setup-demo-folder', async () => {
    try {
      const demoPath = await ensureDemoFolder();
      return {
        success: true,
        path: demoPath,
        message: 'Demo folder is ready'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create demo folder';
      return {
        success: false,
        message
      };
    }
  });

  // Enable/disable mouse events on floating button (for button hover area)
  ipcMain.on('set-button-mouse-events', (_event, ignore: boolean) => {
    if (floatingButtonWindow) {
      floatingButtonWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  // Deploy floating button
  ipcMain.handle('deploy-floating-button', () => {
    if (!floatingButtonWindow) {
      createFloatingButtonWindow();
      createChatDrawerWindow();
      return { success: true, message: 'Floating button deployed' };
    }
    return { success: false, message: 'Floating button already deployed' };
  });

  // Hide floating button
  ipcMain.handle('hide-floating-button', () => {
    if (floatingButtonWindow) {
      floatingButtonWindow.close();
      floatingButtonWindow = null;
    }
    if (chatDrawerWindow) {
      chatDrawerWindow.close();
      chatDrawerWindow = null;
    }
    if (previewWorkspaceWindow) {
      previewWorkspaceWindow.close();
      previewWorkspaceWindow = null;
    }
    currentPreviewPlan = null;
    return { success: true, message: 'Floating button hidden' };
  });

  // Check if floating button is deployed
  ipcMain.handle('is-button-deployed', () => {
    return floatingButtonWindow !== null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  setupIPC(); // register handlers before any renderer calls them
  createMainControlWindow();
  await initializeExecutionEngine();

  app.on('activate', () => {
    if (!mainControlWindow) {
      createMainControlWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[App] All windows closed');
  console.log('[App] mainControlWindow:', mainControlWindow ? 'exists' : 'null');
  console.log('[App] floatingButtonWindow:', floatingButtonWindow ? 'exists' : 'null');
  console.log('[App] chatDrawerWindow:', chatDrawerWindow ? 'exists' : 'null');
  console.log('[App] previewWorkspaceWindow:', previewWorkspaceWindow ? 'exists' : 'null');

  if (process.platform !== 'darwin') {
    console.log('[App] Quitting app (Windows/Linux)');
    app.quit();
  }
});

async function initializeExecutionEngine() {
  const traceStore = new TraceStore();
  await traceStore.initialize();

  const backupService = new BackupService();
  await backupService.initialize();

  const ledgerService = new LedgerService();
  await ledgerService.initialize();

  const basePath = process.env.BASE_PATH || os.homedir();
  const mcpClient = await getMCPClient([basePath]);

  if (!mainControlWindow) {
    throw new Error('Main window not initialized');
  }

  executionEngine = new ExecutionEngine(
    traceStore,
    backupService,
    ledgerService,
    mcpClient,
    mainControlWindow
  );

  const modificationDetector = new ModificationDetector();
  undoEngine = new UndoEngine(
    ledgerService,
    backupService,
    traceStore,
    modificationDetector,
    mcpClient,
    mainControlWindow
  );
}

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
