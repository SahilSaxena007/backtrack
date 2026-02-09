import { IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getMCPClient } from '../services/mcp-client';
import { getFolderIndexer } from '../services/folder-indexer';

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

const BASE_PATH = process.env.BASE_PATH || 'C:\\Users\\sahil\\backtrack-f5-test';
let useMCP = false; // Flag to switch between MCP and fs

/**
 * Get all indexed folders (scanned 2 levels deep)
 */
async function getIndexedFolders(): Promise<string[]> {
  try {
    const indexer = await getFolderIndexer();
    const folders = indexer.getItems()
      .filter(item => item.isDirectory)
      .map(item => item.fullPath);
    console.log(`[Filesystem] Returning ${folders.length} indexed folders`);
    return folders;
  } catch (error) {
    console.error('[Filesystem] Error getting indexed folders:', error);
    return [];
  }
}

/**
 * Scan folder using MCP
 */
async function scanFolderMCP(folderPath: string, recursive: boolean = false): Promise<ScanResult> {
  try {
    console.log(`[MCP Filesystem] Scanning: ${folderPath}`);

    // Security check
    const normalizedPath = path.normalize(folderPath);
    if (!normalizedPath.startsWith(BASE_PATH)) {
      return { success: false, error: `Access denied: Can only scan folders within ${BASE_PATH}` };
    }

    // Get MCP client
    const mcpClient = await getMCPClient([BASE_PATH]);

    // Read directory using MCP
    const files = await mcpClient.readDirectory(folderPath, recursive);

    // Detect server error text in response
    const hasToolError = files.some((f) =>
      typeof f.name === 'string' &&
      f.name.toLowerCase().includes('read_directory') &&
      f.name.toLowerCase().includes('not found')
    );
    if (hasToolError) {
      throw new Error('MCP read_directory not available');
    }

    console.log(`[MCP Filesystem] Scanned ${files.length} files in ${folderPath}`);
    return { success: true, files };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MCP Filesystem] Error scanning folder: ${message}`);

    // Fallback to fs if MCP tool is unavailable
    if (message.includes('read_directory not found') || (message.includes('Tool') && message.includes('not found'))) {
      console.warn('[MCP Filesystem] Falling back to Node fs scan due to missing MCP tool.');
      return scanFolderFS(folderPath, recursive);
    }

    return { success: false, error: message };
  }
}

/**
 * Scan folder using Node.js fs (fallback)
 */
async function scanFolderFS(folderPath: string, recursive: boolean = false): Promise<ScanResult> {
  try {
    // Resolve home directory shortcut
    const resolvedPath = folderPath.startsWith('~')
      ? path.join(BASE_PATH, folderPath.slice(1))
      : folderPath;

    // Security: Only allow scanning within backtrack-testing directory
    const normalizedPath = path.normalize(resolvedPath);
    if (!normalizedPath.startsWith(BASE_PATH)) {
      return { success: false, error: `Access denied: Can only scan folders within ${BASE_PATH}` };
    }

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

/**
 * Validate if a folder path exists
 */
async function validateFolderPath(folderPath: string): Promise<ValidationResult> {
  try {
    const resolvedPath = folderPath.startsWith('~')
      ? path.join(BASE_PATH, folderPath.slice(1))
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

/**
 * Register all filesystem IPC handlers
 */
export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  // Initialize MCP client and folder indexer on startup
  (async () => {
    try {
      const client = await getMCPClient([BASE_PATH]);
      // Probe that required tool exists; if not, fall back.
      try {
        await client.readDirectory(BASE_PATH, false);
        useMCP = true;
        console.log('[Filesystem] MCP client initialized, using MCP for file operations');
      } catch (probeError: any) {
        console.warn('[Filesystem] MCP probe failed, falling back to Node.js fs:', probeError?.message || probeError);
        useMCP = false;
      }
    } catch (error) {
      console.warn('[Filesystem] MCP initialization failed, falling back to Node.js fs:', error);
      useMCP = false;
    }

    // Initialize folder indexer for autocomplete
    try {
      await getFolderIndexer();
      console.log('[Filesystem] Folder indexer initialized');
    } catch (error) {
      console.error('[Filesystem] Folder indexer initialization failed:', error);
    }
  })();

  // Scan folder handler
  ipcMain.handle('scan-folder', async (_event, folderPath: string, recursive?: boolean) => {
    console.log(`[IPC] scan-folder: ${folderPath}, recursive: ${recursive}, using MCP: ${useMCP}`);

    if (useMCP) {
      return scanFolderMCP(folderPath, recursive ?? false);
    } else {
      return scanFolderFS(folderPath, recursive ?? false);
    }
  });

  // Get list of indexed folders for autocomplete (scanned 2 levels deep)
  ipcMain.handle('get-folder-list', async () => {
    console.log('[IPC] get-folder-list');
    return await getIndexedFolders();
  });

  // Validate folder path
  ipcMain.handle('validate-folder-path', async (_event, folderPath: string) => {
    console.log(`[IPC] validate-folder-path: ${folderPath}`);
    return validateFolderPath(folderPath);
  });

  console.log('[Filesystem] IPC handlers registered');
}
