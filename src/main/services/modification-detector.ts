import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { BackupMetadata } from './backup-service';
import { FileModification } from '../../shared/types';


/**
 * Detects user modifications between backup and current folder.
 */
export class ModificationDetector {
  async detectModifications(backupPath: string, targetFolder: string): Promise<FileModification[]> {
    console.log('[ModificationDetector] Starting detection...');
    console.log('[ModificationDetector] Backup path:', backupPath);
    console.log('[ModificationDetector] Target folder:', targetFolder);

    const modifications: FileModification[] = [];

    const metadataPath = path.join(backupPath, '.backup-metadata.json');
    await fs.ensureFile(metadataPath); // ensure readable if missing
    // Load metadata (not used yet but reserved for future smart checks)
    await fs.readJson(metadataPath).catch(() => ({} as BackupMetadata));

    console.log('[ModificationDetector] Scanning current files...');
    const currentFiles = await this.getAllFiles(targetFolder);
    console.log('[ModificationDetector] Found', currentFiles.length, 'current files');

    console.log('[ModificationDetector] Scanning backup files...');
    const backupFiles = await this.getAllFiles(backupPath);
    console.log('[ModificationDetector] Found', backupFiles.length, 'backup files');

    // Compare backup → current
    console.log('[ModificationDetector] Comparing', backupFiles.length, 'files...');
    let comparedCount = 0;
    for (const backupFile of backupFiles) {
      if (backupFile === '.backup-metadata.json') continue;

      const backupFilePath = path.join(backupPath, backupFile);
      const currentFilePath = path.join(targetFolder, backupFile);

      if (comparedCount % 5 === 0) {
        console.log(`[ModificationDetector] Progress: ${comparedCount}/${backupFiles.length} files compared`);
      }
      comparedCount++;

      if (!(await fs.pathExists(currentFilePath))) {
        console.log(`[ModificationDetector] File deleted: ${backupFile}`);
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
        console.log(`[ModificationDetector] File modified: ${backupFile}`);
        modifications.push({
          path: backupFile,
          type: 'modified',
          message: 'File content was changed',
        });
      }
    }
    console.log('[ModificationDetector] Comparison complete');

    // Check for new files in current not in backup
    console.log('[ModificationDetector] Checking for new files...');
    for (const currentFile of currentFiles) {
      const backupFilePath = path.join(backupPath, currentFile);
      if (!(await fs.pathExists(backupFilePath))) {
        console.log(`[ModificationDetector] File added: ${currentFile}`);
        modifications.push({
          path: currentFile,
          type: 'added',
          message: 'File was added',
        });
      }
    }

    console.log('[ModificationDetector] Detection complete:', modifications.length, 'modifications found');
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
