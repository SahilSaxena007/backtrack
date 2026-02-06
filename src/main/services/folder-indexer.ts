import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

const BASE_PATH = 'C:\\Users\\backtrack-testing';
const MAX_DEPTH = 2; // Scan 2 levels deep as per spec

export interface FileSystemItem {
  name: string;        // Friendly name (e.g., "Documents", "file.pdf")
  fullPath: string;    // Full path (e.g., "C:\Users\backtrack-testing\Documents")
  isDirectory: boolean;
}

export class FolderIndexer {
  private items: FileSystemItem[] = [];  // Store both files and folders
  private watcher: chokidar.FSWatcher | null = null;
  private isIndexing = false;

  /**
   * Initialize the folder indexer
   * Scans BASE_PATH up to MAX_DEPTH levels deep
   */
  async initialize(): Promise<void> {
    console.log(`[FolderIndexer] Initializing for: ${BASE_PATH}`);
    const startTime = Date.now();

    try {
      // Build initial index
      await this.buildIndex();

      // Set up file watcher for real-time updates
      this.setupWatcher();

      const duration = Date.now() - startTime;
      console.log(`[FolderIndexer] Indexed ${this.items.length} items in ${duration}ms`);
    } catch (error) {
      console.error('[FolderIndexer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Build the index by scanning BASE_PATH (files and folders)
   */
  private async buildIndex(): Promise<void> {
    if (this.isIndexing) {
      console.warn('[FolderIndexer] Already indexing, skipping...');
      return;
    }

    this.isIndexing = true;
    this.items = [];

    try {
      // Check if BASE_PATH exists
      if (!fs.existsSync(BASE_PATH)) {
        console.error(`[FolderIndexer] Base path does not exist: ${BASE_PATH}`);
        this.isIndexing = false;
        return;
      }

      // Always include the base path itself
      this.items.push({
        name: path.basename(BASE_PATH),
        fullPath: BASE_PATH,
        isDirectory: true
      });

      // Recursively scan files and folders
      await this.scanDirectory(BASE_PATH, 0);

      console.log(`[FolderIndexer] Index built: ${this.items.length} items (files + folders)`);
    } catch (error) {
      console.error('[FolderIndexer] Error building index:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Recursively scan a directory up to MAX_DEPTH (files and folders)
   */
  private async scanDirectory(dirPath: string, currentDepth: number): Promise<void> {
    // Stop if we've reached max depth
    if (currentDepth >= MAX_DEPTH) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          // Verify we can access this item (permission check)
          fs.accessSync(fullPath, fs.constants.R_OK);

          // Add to index (both files and folders)
          this.items.push({
            name: entry.name,
            fullPath: fullPath,
            isDirectory: entry.isDirectory()
          });

          // Recursively scan subdirectories
          if (entry.isDirectory()) {
            await this.scanDirectory(fullPath, currentDepth + 1);
          }
        } catch (err) {
          // Skip items we can't access (permission denied)
          console.debug(`[FolderIndexer] Skipping inaccessible item: ${fullPath}`);
        }
      }
    } catch (error) {
      console.error(`[FolderIndexer] Error scanning ${dirPath}:`, error);
    }
  }

  /**
   * Set up file watcher to update index when folders change
   */
  private setupWatcher(): void {
    try {
      console.log('[FolderIndexer] Setting up file watcher...');

      // Watch for directory changes (add/remove folders)
      this.watcher = chokidar.watch(BASE_PATH, {
        ignored: /(^|[\/\\])\../, // Ignore hidden files/folders
        persistent: true,
        ignoreInitial: true, // Don't trigger events for initial scan
        depth: MAX_DEPTH,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        }
      });

      // When a new directory is created
      this.watcher.on('addDir', (itemPath: string) => {
        if (!this.items.some(item => item.fullPath === itemPath)) {
          console.log(`[FolderIndexer] New folder detected: ${itemPath}`);
          this.items.push({
            name: path.basename(itemPath),
            fullPath: itemPath,
            isDirectory: true
          });
        }
      });

      // When a new file is created
      this.watcher.on('add', (itemPath: string) => {
        if (!this.items.some(item => item.fullPath === itemPath)) {
          console.log(`[FolderIndexer] New file detected: ${itemPath}`);
          this.items.push({
            name: path.basename(itemPath),
            fullPath: itemPath,
            isDirectory: false
          });
        }
      });

      // When a directory is deleted
      this.watcher.on('unlinkDir', (itemPath: string) => {
        const index = this.items.findIndex(item => item.fullPath === itemPath);
        if (index > -1) {
          console.log(`[FolderIndexer] Folder removed: ${itemPath}`);
          this.items.splice(index, 1);
        }
      });

      // When a file is deleted
      this.watcher.on('unlink', (itemPath: string) => {
        const index = this.items.findIndex(item => item.fullPath === itemPath);
        if (index > -1) {
          console.log(`[FolderIndexer] File removed: ${itemPath}`);
          this.items.splice(index, 1);
        }
      });

      // Handle watcher errors
      this.watcher.on('error', (error) => {
        console.error('[FolderIndexer] Watcher error:', error);
      });

      console.log('[FolderIndexer] File watcher active');
    } catch (error) {
      console.error('[FolderIndexer] Failed to setup watcher:', error);
    }
  }

  /**
   * Get all indexed items (files and folders)
   */
  getItems(): FileSystemItem[] {
    return [...this.items]; // Return copy to prevent external modifications
  }

  /**
   * Search items by query (basic filtering, Fuse.js will be used in renderer)
   */
  searchItems(query: string): FileSystemItem[] {
    if (!query) {
      return this.getItems();
    }

    const lowerQuery = query.toLowerCase();
    return this.items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Refresh the index manually
   */
  async refresh(): Promise<void> {
    console.log('[FolderIndexer] Manual refresh triggered');
    await this.buildIndex();
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      console.log('[FolderIndexer] Watcher closed');
    }
    this.items = [];
  }
}

// Singleton instance
let indexerInstance: FolderIndexer | null = null;

export async function getFolderIndexer(): Promise<FolderIndexer> {
  if (!indexerInstance) {
    indexerInstance = new FolderIndexer();
    await indexerInstance.initialize();
  }
  return indexerInstance;
}
