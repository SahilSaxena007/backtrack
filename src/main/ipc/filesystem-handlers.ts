import { IpcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getMCPClient } from '../services/mcp-client';

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

const DEFAULT_BASE_PATH = process.env.BASE_PATH || path.join(os.homedir(), 'backtrack-demo');
let activeBasePath = path.normalize(DEFAULT_BASE_PATH);
let useMCP = process.env.USE_LOCAL_FS === '1' ? false : false;

const friendlyFsError = (raw: string, targetPath: string) => {
  const msg = raw.toLowerCase();
  if (msg.includes('eacces') || msg.includes('access denied') || msg.includes('operation not permitted')) {
    return `Backtrack cannot access this folder right now: ${targetPath}. Please choose a folder you can read and write.`;
  }
  if (msg.includes('enoent') || msg.includes('not found')) {
    return `That folder no longer exists: ${targetPath}. Please pick a different folder.`;
  }
  return `Backtrack could not read this folder: ${targetPath}. Please try a different location.`;
};

const normalizeForCompare = (value: string) =>
  path.normalize(value).replace(/[\\/]+$/, '').toLowerCase();

const isWithinActiveBasePath = (inputPath: string): boolean => {
  const normalizedInput = normalizeForCompare(inputPath);
  const normalizedBase = normalizeForCompare(activeBasePath);
  return normalizedInput === normalizedBase || normalizedInput.startsWith(`${normalizedBase}${path.sep}`);
};

const toFileMetadata = (fullPath: string, entryStats: fs.Stats): FileMetadata => ({
  name: path.basename(fullPath),
  path: fullPath,
  size: entryStats.size,
  extension: entryStats.isDirectory() ? '' : path.extname(fullPath).toLowerCase(),
  modified: entryStats.mtime.toISOString(),
  created: entryStats.birthtime.toISOString(),
  isDirectory: entryStats.isDirectory(),
});

async function getIndexedFolders(): Promise<string[]> {
  const folders: string[] = [];
  const maxDepth = 2;

  const scan = async (dirPath: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      return;
    }

    if (!fs.existsSync(dirPath)) {
      return;
    }

    folders.push(dirPath);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      await scan(path.join(dirPath, entry.name), depth + 1);
    }
  };

  try {
    await scan(activeBasePath, 0);
    return folders;
  } catch (error) {
    console.error('[Filesystem] Error building folder suggestions:', error);
    return [activeBasePath];
  }
}

async function scanFolderMCP(folderPath: string, recursive = false): Promise<ScanResult> {
  try {
    const normalizedPath = path.normalize(folderPath);
    if (!isWithinActiveBasePath(normalizedPath)) {
      return {
        success: false,
        error: `For safety, Backtrack can only scan inside the selected folder scope: ${activeBasePath}`
      };
    }

    const mcpClient = await getMCPClient([os.homedir()]);
    const files = await mcpClient.readDirectory(normalizedPath, recursive);
    return { success: true, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MCP Filesystem] Error scanning folder:', message);
    return scanFolderFS(folderPath, recursive);
  }
}

async function scanFolderFS(folderPath: string, recursive = false): Promise<ScanResult> {
  try {
    const normalizedPath = path.normalize(folderPath);
    if (!isWithinActiveBasePath(normalizedPath)) {
      return {
        success: false,
        error: `For safety, Backtrack can only scan inside the selected folder scope: ${activeBasePath}`
      };
    }

    if (!fs.existsSync(normalizedPath)) {
      return { success: false, error: `Folder not found: ${folderPath}` };
    }

    const stats = fs.statSync(normalizedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: `Not a directory: ${folderPath}` };
    }

    const files: FileMetadata[] = [];

    const scan = async (dirPath: string): Promise<void> => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const entryStats = fs.statSync(fullPath);
          files.push(toFileMetadata(fullPath, entryStats));

          if (recursive && entry.isDirectory()) {
            await scan(fullPath);
          }
        } catch (err) {
          console.warn('[Filesystem] Skipping inaccessible item:', fullPath, err);
        }
      }
    };

    await scan(normalizedPath);
    return { success: true, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: friendlyFsError(message, folderPath) };
  }
}

async function validateFolderPath(folderPath: string): Promise<ValidationResult> {
  try {
    const normalizedPath = path.normalize(folderPath);
    if (!fs.existsSync(normalizedPath)) {
      return { success: true, exists: false, isDirectory: false };
    }

    const stats = fs.statSync(normalizedPath);
    return {
      success: true,
      exists: true,
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      exists: false,
      isDirectory: false,
      error: friendlyFsError(message, folderPath)
    };
  }
}

async function setActiveBasePath(folderPath: string) {
  const normalizedPath = path.normalize(folderPath);
  if (!fs.existsSync(normalizedPath)) {
    return { success: false, message: 'That folder does not exist. Please choose another folder.' };
  }

  const stats = fs.statSync(normalizedPath);
  if (!stats.isDirectory()) {
    return { success: false, message: 'That path is not a folder. Please choose a directory.' };
  }

  activeBasePath = normalizedPath;
  console.log('[Filesystem] Active base path set to:', activeBasePath);
  return { success: true, path: activeBasePath, message: 'Folder scope updated' };
}

export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  (async () => {
    try {
      if (!fs.existsSync(activeBasePath)) {
        fs.mkdirSync(activeBasePath, { recursive: true });
      }
    } catch (error) {
      console.warn('[Filesystem] Could not initialize active base path:', error);
    }

    if (process.env.USE_LOCAL_FS === '1') {
      useMCP = false;
      return;
    }

    try {
      const client = await getMCPClient([os.homedir()]);
      await (client as any).readDirectory(activeBasePath, false);
      useMCP = true;
      console.log('[Filesystem] MCP enabled for folder scans');
    } catch (error) {
      useMCP = false;
      console.warn('[Filesystem] MCP unavailable, using local fs fallback:', error);
    }
  })();

  ipcMain.handle('scan-folder', async (_event, folderPath: string, recursive?: boolean) => {
    if (useMCP) {
      return scanFolderMCP(folderPath, recursive ?? false);
    }
    return scanFolderFS(folderPath, recursive ?? false);
  });

  ipcMain.handle('get-folder-list', async () => getIndexedFolders());

  ipcMain.handle('validate-folder-path', async (_event, folderPath: string) => {
    return validateFolderPath(folderPath);
  });

  ipcMain.handle('set-active-base-path', async (_event, folderPath: string) => {
    return setActiveBasePath(folderPath);
  });

  ipcMain.handle('get-active-base-path', async () => {
    return activeBasePath;
  });

  console.log('[Filesystem] IPC handlers registered');
}
