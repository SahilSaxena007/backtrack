import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Handles backup creation and restoration for guaranteed undo.
 */
export class BackupService {
  private readonly backupRoot: string;

  constructor() {
    this.backupRoot = path.join(os.homedir(), '.backtrack', 'checkpoints');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.backupRoot);
  }

  /**
   * Create a full backup of the target folder.
   */
  async createBackup(targetFolder: string, planId: string): Promise<BackupMetadata> {
    const backupPath = path.join(this.backupRoot, planId);

    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }

    const startTime = Date.now();
    await fs.copy(targetFolder, backupPath, {
      preserveTimestamps: true,
      errorOnExist: false,
    });
    const duration = Date.now() - startTime;

    const size = await this.getFolderSize(backupPath);
    const fileCount = await this.countFiles(backupPath);

    const metadata: BackupMetadata = {
      backup_id: planId,
      backup_path: backupPath,
      source_folder: targetFolder,
      created_at: new Date().toISOString(),
      size_bytes: size,
      duration_ms: duration,
      file_count: fileCount,
    };

    await fs.writeJson(path.join(backupPath, '.backup-metadata.json'), metadata, {
      spaces: 2,
    });

    return metadata;
  }

  /**
   * Restore folder from backup (fallback when inverse ops fail).
   */
  async restoreFromBackup(backupPath: string, targetFolder: string): Promise<void> {
    if (!(await fs.pathExists(backupPath))) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // Clear target folder contents
    if (await fs.pathExists(targetFolder)) {
      const items = await fs.readdir(targetFolder);
      for (const item of items) {
        await fs.remove(path.join(targetFolder, item));
      }
    } else {
      await fs.ensureDir(targetFolder);
    }

    const backupItems = await fs.readdir(backupPath);
    for (const item of backupItems) {
      if (item === '.backup-metadata.json') continue;
      await fs.copy(path.join(backupPath, item), path.join(targetFolder, item), {
        preserveTimestamps: true,
      });
    }
  }

  /**
   * Delete a backup folder (after successful undo).
   */
  async deleteBackup(planId: string): Promise<void> {
    const backupPath = path.join(this.backupRoot, planId);
    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }
  }

  async getBackupMetadata(planId: string): Promise<BackupMetadata | null> {
    const metadataPath = path.join(this.backupRoot, planId, '.backup-metadata.json');
    if (await fs.pathExists(metadataPath)) {
      return (await fs.readJson(metadataPath)) as BackupMetadata;
    }
    return null;
  }

  async cleanupOldBackups(keepCount = 10): Promise<void> {
    const backups = await fs.readdir(this.backupRoot);
    const backupsWithDates = await Promise.all(
      backups.map(async (backup) => {
        const meta = await this.getBackupMetadata(backup);
        return { id: backup, created_at: meta?.created_at ?? '1970-01-01' };
      })
    );

    backupsWithDates.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (let i = keepCount; i < backupsWithDates.length; i++) {
      await this.deleteBackup(backupsWithDates[i].id);
    }
  }

  private async getFolderSize(folderPath: string): Promise<number> {
    let total = 0;
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(folderPath, item.name);
      if (item.isDirectory()) {
        total += await this.getFolderSize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        total += stats.size;
      }
    }
    return total;
  }

  private async countFiles(folderPath: string): Promise<number> {
    let count = 0;
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(folderPath, item.name);
      if (item.isDirectory()) {
        count += await this.countFiles(fullPath);
      } else {
        count++;
      }
    }
    return count;
  }
}

export interface BackupMetadata {
  backup_id: string;
  backup_path: string;
  source_folder: string;
  created_at: string;
  size_bytes: number;
  duration_ms: number;
  file_count: number;
}
