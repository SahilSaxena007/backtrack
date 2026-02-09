import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
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

// Load environment variables from .env file
dotenv.config();

let mainControlWindow: BrowserWindow | null = null;
let floatingButtonWindow: BrowserWindow | null = null;
let chatDrawerWindow: BrowserWindow | null = null;
export let executionEngine: ExecutionEngine;
export let undoEngine: UndoEngine;

const isDev = !app.isPackaged;

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
  });
}

function createFloatingButtonWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  floatingButtonWindow = new BrowserWindow({
    width: 100,
    height: 100,
    x: screenWidth - 110, // 10px from right edge
    y: screenHeight - 110, // 10px from bottom edge
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
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Chat drawer dimensions
  const drawerWidth = 400;
  const drawerHeight = 600;
  const buttonSize = 100;

  // Floating button position
  const buttonX = screenWidth - 110;
  const buttonY = screenHeight - 110;

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

  const basePath = process.env.BASE_PATH || 'C:\\Users\\sahil\\backtrack-f5-test';
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
