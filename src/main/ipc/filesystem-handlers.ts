import { IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

// Get common user folders
function getCommonFolders(): string[] {
  // Use environment variable BASE_PATH if set, otherwise use home directory
  const basePath = process.env.BASE_PATH || os.homedir();

  const folders = [
    path.join(basePath, 'Downloads'),
    path.join(basePath, 'Documents'),
    path.join(basePath, 'Desktop'),
    path.join(basePath, 'Pictures'),
    path.join(basePath, 'Music'),
    path.join(basePath, 'Videos'),
  ];

  // Filter to only existing folders
  return folders.filter(folder => {
    try {
      return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
    } catch {
      return false;
    }
  });
}

// Scan a folder and return file metadata
async function scanFolder(folderPath: string, recursive: boolean = false): Promise<ScanResult> {
  try {
    // Resolve home directory shortcut
    const resolvedPath = folderPath.startsWith('~')
      ? path.join(os.homedir(), folderPath.slice(1))
      : folderPath;

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `Folder not found: ${folderPath}` };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: `Not a directory: ${folderPath}` };
    }

    const files: FileMetadata[] = [];

    async function scanDir(dirPath: string): Promise<void> {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          const entryStats = fs.statSync(fullPath);

          files.push({
            name: entry.name,
            path: fullPath,
            size: entryStats.size,
            extension: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase(),
            modified: entryStats.mtime.toISOString(),
            created: entryStats.birthtime.toISOString(),
            isDirectory: entry.isDirectory(),
          });

          // Recursively scan subdirectories if requested
          if (recursive && entry.isDirectory()) {
            await scanDir(fullPath);
          }
        } catch (err) {
          // Skip files we can't access (permission errors, etc.)
          console.warn(`Skipping ${fullPath}: ${err}`);
        }
      }
    }

    await scanDir(resolvedPath);

    console.log(`[Filesystem] Scanned ${files.length} files in ${folderPath}`);
    return { success: true, files };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Filesystem] Error scanning folder: ${message}`);
    return { success: false, error: message };
  }
}

// Validate if a folder path exists
async function validateFolderPath(folderPath: string): Promise<ValidationResult> {
  try {
    const resolvedPath = folderPath.startsWith('~')
      ? path.join(os.homedir(), folderPath.slice(1))
      : folderPath;

    if (!fs.existsSync(resolvedPath)) {
      return { success: true, exists: false, isDirectory: false };
    }

    const stats = fs.statSync(resolvedPath);
    return {
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, exists: false, isDirectory: false, error: message };
  }
}

// Register all filesystem IPC handlers
export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  // Scan folder handler
  ipcMain.handle('scan-folder', async (_event, folderPath: string, recursive?: boolean) => {
    console.log(`[IPC] scan-folder: ${folderPath}, recursive: ${recursive}`);
    return scanFolder(folderPath, recursive ?? false);
  });

  // Get list of common folders for autocomplete
  ipcMain.handle('get-folder-list', async () => {
    console.log('[IPC] get-folder-list');
    return getCommonFolders();
  });

  // Validate folder path
  ipcMain.handle('validate-folder-path', async (_event, folderPath: string) => {
    console.log(`[IPC] validate-folder-path: ${folderPath}`);
    return validateFolderPath(folderPath);
  });

  console.log('[Filesystem] IPC handlers registered');
}
