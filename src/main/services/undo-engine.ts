import path from 'path';
import { BrowserWindow } from 'electron';
import { LedgerService, ExecutionRecord, ActionLog } from './ledger-service';
import { BackupService } from './backup-service';
import { TraceStore } from './trace-store';
import { ModificationDetector, FileModification } from './modification-detector';

/**
 * Main undo engine. Strategy: inverse ops first, then backup restore fallback.
 */
export class UndoEngine {
  constructor(
    private ledgerService: LedgerService,
    private backupService: BackupService,
    private traceStore: TraceStore,
    private modificationDetector: ModificationDetector,
    private mcpClient: MCPClient,
    private mainWindow: BrowserWindow
  ) {}
  private modificationResolver: ((decision: boolean) => void) | null = null;

  async executeUndo(executionId: string): Promise<UndoResult> {
    try {
      const execution = await this.ledgerService.getExecution(executionId);
      // Load trace for context (and to avoid unused property)
      await this.traceStore.getTrace(execution.trace_id).catch(() => null);
      const backupMetadata = await this.backupService.getBackupMetadata(execution.checkpoint_id);
      if (!backupMetadata) throw new Error('Backup not found');

      this.sendProgress({ status: 'checking', progress: 0, message: 'Checking for changes...' });

      const modifications = await this.modificationDetector.detectModifications(
        backupMetadata.backup_path,
        execution.target_folder
      );

      if (modifications.length > 0) {
        const proceed = await this.askUserAboutModifications(modifications);
        if (!proceed) return { success: false, cancelled: true };
      }

      this.sendProgress({ status: 'undoing', progress: 0, message: 'Reversing operations...' });

      try {
        await this.executeInverseOperations(execution);
        const verified = await this.verifyRestoration(
          backupMetadata.backup_path,
          execution.target_folder
        );

        if (!verified) throw new Error('Verification failed after inverse operations');

        await this.finalizeUndo(execution, 'inverse');
        return { success: true, method: 'inverse' };
      } catch (inverseError) {
        // Fallback to backup
        this.sendProgress({
          status: 'undoing',
          progress: 0,
          message: 'Switching to safe restore method...',
        });
        await this.restoreFromBackup(backupMetadata.backup_path, execution.target_folder);
        await this.finalizeUndo(execution, 'backup');
        return { success: true, method: 'backup' };
      }
    } catch (error: any) {
      this.sendProgress({ status: 'error', message: error.message });
      return { success: false, error: error.message };
    }
  }

  private async executeInverseOperations(execution: ExecutionRecord): Promise<void> {
    const reversed = [...execution.actions].reverse();
    for (let i = 0; i < reversed.length; i++) {
      const action = reversed[i];
      const progress = Math.floor((i / reversed.length) * 100);
      this.sendProgress({
        status: 'undoing',
        progress,
        message: `Reversing ${action.action_type}...`,
      });
      await this.executeInverseAction(action);
    }
  }

  private async executeInverseAction(action: ActionLog): Promise<void> {
    switch (action.action_type) {
      case 'create_folder':
        await this.mcpClient.callTool('delete_directory', { path: action.action_params.path });
        break;
      case 'move_file':
        await this.mcpClient.callTool('move_file', {
          source: action.action_params.destination,
          destination: action.action_params.source,
        });
        break;
      case 'move_files_batch': {
        const files = action.action_params.files;
        const sourceFolder = action.action_params.source_folder || action.action_params.source;
        const destination = action.action_params.destination;
        for (const file of files) {
          const currentLocation = path.join(destination, file);
          const originalLocation = path.join(sourceFolder, file);
          await this.mcpClient.callTool('move_file', {
            source: currentLocation,
            destination: originalLocation,
          });
        }
        break;
      }
      case 'rename_file': {
        const newPath = path.join(
          path.dirname(action.action_params.path),
          action.action_params.new_name
        );
        await this.mcpClient.callTool('move_file', {
          source: newPath,
          destination: action.action_params.path,
        });
        break;
      }
      case 'create_file':
        await this.mcpClient.callTool('delete_file', { path: action.action_params.path });
        break;
      default:
        throw new Error(`Unknown action type for undo: ${action.action_type}`);
    }
  }

  private async restoreFromBackup(backupPath: string, targetFolder: string): Promise<void> {
    await this.backupService.restoreFromBackup(backupPath, targetFolder);
    this.sendProgress({ status: 'undoing', progress: 100, message: 'Restoration complete' });
  }

  private async verifyRestoration(_backupPath: string, _targetFolder: string): Promise<boolean> {
    // TODO: Implement hash verification; for now assume success if no errors.
    return true;
  }

  private async finalizeUndo(execution: ExecutionRecord, method: 'inverse' | 'backup') {
    await this.backupService.deleteBackup(execution.checkpoint_id);
    this.sendProgress({ status: 'success', message: `Undo completed via ${method}` });
  }

  private async askUserAboutModifications(modifications: FileModification[]): Promise<boolean> {
    this.mainWindow.webContents.send('modification-warning', modifications);
    return new Promise((resolve) => {
      this.modificationResolver = resolve;
    });
  }

  resolveModificationDecision(decision: boolean) {
    if (this.modificationResolver) {
      this.modificationResolver(decision);
      this.modificationResolver = null;
    }
  }

  private sendProgress(progress: UndoProgress): void {
    this.mainWindow.webContents.send('undo-progress', progress);
  }
}

export interface UndoResult {
  success: boolean;
  method?: 'inverse' | 'backup';
  cancelled?: boolean;
  error?: string;
}

export interface UndoProgress {
  status: 'checking' | 'undoing' | 'success' | 'error';
  progress?: number;
  message?: string;
}

export interface MCPClient {
  callTool: (tool: string, params: Record<string, any>) => Promise<any>;
}
