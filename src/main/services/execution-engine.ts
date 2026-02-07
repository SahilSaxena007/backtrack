import { BrowserWindow } from 'electron';
import path from 'path';
import { TraceStore, TraceData, TraceAction } from './trace-store';
import { BackupService, BackupMetadata } from './backup-service';
import { LedgerService, ActionLog } from './ledger-service';

/**
 * Main execution engine: Trace → Backup → Execute → Ledger.
 */
export class ExecutionEngine {
  constructor(
    private traceStore: TraceStore,
    private backupService: BackupService,
    private ledgerService: LedgerService,
    private mcpClient: MCPClient,
    private mainWindow: BrowserWindow
  ) {}

  async executePlan(approvedPlan: ApprovedPlan): Promise<ExecutionResult> {
    let executionId: string | null = null;
    let checkpoint: BackupMetadata | null = null;

    try {
      this.sendProgress({ status: 'preparing', progress: 0, message: 'Saving plan...' });
      await this.saveTraceFromPlan(approvedPlan);

      this.sendProgress({ status: 'preparing', progress: 20, message: 'Creating backup...' });
      checkpoint = await this.backupService.createBackup(
        approvedPlan.target_folder,
        approvedPlan.plan_id
      );

      this.sendProgress({ status: 'preparing', progress: 50, message: 'Initializing...' });
      executionId = this.generateExecutionId();

      await this.ledgerService.createExecution({
        execution_id: executionId,
        trace_id: approvedPlan.plan_id,
        checkpoint_id: checkpoint.backup_id,
        target_folder: approvedPlan.target_folder,
        started_at: new Date().toISOString(),
        completed_at: null,
        status: 'in_progress',
        error: null,
        total_actions: approvedPlan.actions.length,
        completed_actions: 0,
        actions: [],
      });

      this.sendProgress({ status: 'executing', progress: 0, message: 'Executing actions...' });
      await this.executeActions(executionId, approvedPlan.actions);

      await this.ledgerService.completeExecution(executionId, 'success');
      this.sendProgress({ status: 'success', progress: 100, message: 'Execution complete' });

      await this.backupService.cleanupOldBackups(10);

      return { success: true, executionId };
    } catch (error: any) {
      await this.handleExecutionError(executionId, checkpoint, error);
      return { success: false, error: error?.message || 'Execution failed' };
    }
  }

  private async executeActions(executionId: string, actions: TraceAction[]): Promise<void> {
    const ordered = this.topologicalSort(actions);
    const total = ordered.length;

    for (let i = 0; i < total; i++) {
      const action = ordered[i];
      this.sendProgress({
        status: 'executing',
        progress: Math.round((i / total) * 100),
        currentAction: action.description || action.type,
      });

      const log = await this.executeSingleAction(action);
      await this.ledgerService.logAction(executionId, log);
    }
  }

  private async executeSingleAction(action: TraceAction): Promise<ActionLog> {
    const start = Date.now();
    const log: ActionLog = {
      action_id: action.id,
      action_type: action.type,
      action_params: action.params,
      started_at: new Date().toISOString(),
      completed_at: '',
      duration_ms: 0,
      status: 'success',
      error: null,
    };

    try {
      await this.verifyPreConditions(action);
      await this.runAction(action);
      await this.verifyPostConditions(action);

      log.completed_at = new Date().toISOString();
      log.duration_ms = Date.now() - start;
      log.status = 'success';
    } catch (error: any) {
      log.completed_at = new Date().toISOString();
      log.duration_ms = Date.now() - start;
      log.status = 'failed';
      log.error = error?.message || 'Unknown error';
      throw error;
    }

    return log;
  }

  private async runAction(action: TraceAction): Promise<void> {
    switch (action.type) {
      case 'create_folder': {
        const { path: folderPath } = action.params;
        await this.mcpClient.callTool('create_directory', { path: folderPath });
        break;
      }
      case 'move_file': {
        const { source, destination } = action.params;
        await this.mcpClient.callTool('move_file', { source, destination });
        break;
      }
      case 'move_files_batch': {
        const { files, source_folder, destination } = action.params;
        for (const file of files) {
          const source = path.join(source_folder, file);
          const dest = path.join(destination, file);
          await this.mcpClient.callTool('move_file', { source, destination: dest });
        }
        break;
      }
      case 'rename_file': {
        const { path: filePath, new_name } = action.params;
        const parent = path.dirname(filePath);
        const dest = path.join(parent, new_name);
        await this.mcpClient.callTool('move_file', { source: filePath, destination: dest });
        break;
      }
      case 'create_file': {
        const { path: filePath, content } = action.params;
        await this.mcpClient.callTool('write_file', { path: filePath, content: content || '' });
        break;
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async verifyPreConditions(action: TraceAction): Promise<void> {
    switch (action.type) {
      case 'create_folder': {
        const parent = path.dirname(action.params.path);
        if (!(await this.mcpClient.pathExists(parent))) {
          throw new Error(`Parent directory does not exist: ${parent}`);
        }
        break;
      }
      case 'move_file':
      case 'rename_file': {
        const source = action.params.source || action.params.path;
        if (!(await this.mcpClient.pathExists(source))) {
          throw new Error(`Source not found: ${source}`);
        }
        break;
      }
    }
  }

  private async verifyPostConditions(action: TraceAction): Promise<void> {
    switch (action.type) {
      case 'create_folder': {
        if (!(await this.mcpClient.pathExists(action.params.path))) {
          throw new Error(`Folder not created: ${action.params.path}`);
        }
        break;
      }
      case 'move_file':
      case 'rename_file': {
        const dest =
          action.params.destination ||
          path.join(path.dirname(action.params.path), action.params.new_name);
        if (!(await this.mcpClient.pathExists(dest))) {
          throw new Error(`Destination missing: ${dest}`);
        }
        break;
      }
    }
  }

  private async saveTraceFromPlan(plan: ApprovedPlan): Promise<void> {
    const trace: TraceData = {
      trace_id: plan.plan_id,
      created_at: new Date().toISOString(),
      user_intent: plan.user_intent,
      conversation_id: plan.conversation_id ?? '',
      gemini_prompt: plan.gemini_prompt,
      gemini_response: plan.gemini_response,
      thinking_signatures: plan.thinking_signatures,
      action_plan: {
        plan_id: plan.plan_id,
        actions: plan.actions,
        target_folder: plan.target_folder,
        summary: plan.summary,
      },
      user_approved: true,
      approved_at: new Date().toISOString(),
    };
    await this.traceStore.saveTrace(trace);
  }

  private async handleExecutionError(
    executionId: string | null,
    checkpoint: BackupMetadata | null,
    error: Error
  ): Promise<void> {
    this.sendProgress({
      status: 'executing',
      progress: 0,
      message: 'Error detected - Rolling back...',
    });

    if (checkpoint) {
      await this.backupService.restoreFromBackup(checkpoint.backup_path, checkpoint.source_folder);
      await this.backupService.deleteBackup(checkpoint.backup_id);
    }

    if (executionId) {
      await this.ledgerService.completeExecution(executionId, 'failed', error.message);
    }

    this.sendProgress({ status: 'error', message: error.message });
  }

  private topologicalSort(actions: TraceAction[]): TraceAction[] {
    const graph = new Map<string, TraceAction>();
    const inDegree = new Map<string, number>();

    actions.forEach((a) => {
      graph.set(a.id, a);
      inDegree.set(a.id, (a.depends_on || []).length);
    });

    const queue: TraceAction[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(graph.get(id)!);
    }

    const sorted: TraceAction[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      actions.forEach((a) => {
        if (a.depends_on?.includes(current.id)) {
          const newDeg = (inDegree.get(a.id) || 0) - 1;
          inDegree.set(a.id, newDeg);
          if (newDeg === 0) queue.push(a);
        }
      });
    }

    return sorted;
  }

  private sendProgress(progress: ProgressUpdate): void {
    this.mainWindow.webContents.send('execution-progress', progress);
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export interface ApprovedPlan {
  plan_id: string;
  user_intent: string;
  conversation_id?: string;
  target_folder: string;
  actions: TraceAction[];
  summary: {
    files_affected: number;
    folders_created: number;
    estimated_duration_seconds: number;
  };
  gemini_prompt?: string;
  gemini_response?: string;
  thinking_signatures?: {
    stage1_draft?: string;
    stage2_safety?: string;
    stage3_undo?: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export interface ProgressUpdate {
  status: 'preparing' | 'executing' | 'success' | 'error';
  progress?: number;
  message?: string;
  currentAction?: string;
  error?: string;
}

/**
 * Minimal MCP client surface used by execution engine.
 */
export interface MCPClient {
  callTool: (tool: string, params: Record<string, any>) => Promise<any>;
  pathExists: (path: string) => Promise<boolean>;
}
