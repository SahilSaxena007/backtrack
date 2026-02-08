import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { BackupMetadata } from './backup-service';

export interface FileModification {
  path: string;
  type: 'modified' | 'deleted' | 'added';
  message: string;
}

/**
 * Detects user modifications between backup and current folder.
 */
export class ModificationDetector {
  async detectModifications(backupPath: string, targetFolder: string): Promise<FileModification[]> {
    const modifications: FileModification[] = [];

    const metadataPath = path.join(backupPath, '.backup-metadata.json');
    await fs.ensureFile(metadataPath); // ensure readable if missing
    // Load metadata (not used yet but reserved for future smart checks)
    await fs.readJson(metadataPath).catch(() => ({} as BackupMetadata));

    const currentFiles = await this.getAllFiles(targetFolder);
    const backupFiles = await this.getAllFiles(backupPath);

    // Compare backup → current
    for (const backupFile of backupFiles) {
      if (backupFile === '.backup-metadata.json') continue;

      const backupFilePath = path.join(backupPath, backupFile);
      const currentFilePath = path.join(targetFolder, backupFile);

      if (!(await fs.pathExists(currentFilePath))) {
        modifications.push({
          path: backupFile,
          type: 'deleted',
          message: 'File was deleted',
        });
        continue;
      }

      const backupHash = await this.calculateFileHash(backupFilePath);
      const currentHash = await this.calculateFileHash(currentFilePath);

      if (backupHash !== currentHash) {
        modifications.push({
          path: backupFile,
          type: 'modified',
          message: 'File content was changed',
        });
      }
    }

    // Check for new files in current not in backup
    for (const currentFile of currentFiles) {
      const backupFilePath = path.join(backupPath, currentFile);
      if (!(await fs.pathExists(backupFilePath))) {
        modifications.push({
          path: currentFile,
          type: 'added',
          message: 'File was added',
        });
      }
    }

    return modifications;
  }

  private async getAllFiles(folderPath: string): Promise<string[]> {
    const files: string[] = [];
    const items = await fs.readdir(folderPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const sub = await this.getAllFiles(path.join(folderPath, item.name));
        files.push(...sub.map((f) => path.join(item.name, f)));
      } else {
        files.push(item.name);
      }
    }
    return files;
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
