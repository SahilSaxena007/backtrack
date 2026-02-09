import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Stores execution history (what actually happened).
 * Links trace → checkpoint → actions.
 */
export class LedgerService {
  private readonly ledgerRoot: string;

  constructor() {
    this.ledgerRoot = path.join(os.homedir(), '.backtrack', 'ledger');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.ledgerRoot);
  }

  async createExecution(execution: ExecutionRecord): Promise<void> {
    await fs.writeJson(this.getExecutionPath(execution.execution_id), execution, {
      spaces: 2,
    });
  }

  async logAction(executionId: string, actionLog: ActionLog): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.actions.push(actionLog);
    execution.completed_actions += 1;
    await this.saveExecution(execution);
  }

  async completeExecution(
    executionId: string,
    status: 'success' | 'failed',
    error?: string
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = status;
    execution.completed_at = new Date().toISOString();
    execution.error = error ?? null;
    await this.saveExecution(execution);
  }

  async getExecution(executionId: string): Promise<ExecutionRecord> {
    const execPath = this.getExecutionPath(executionId);
    if (!(await fs.pathExists(execPath))) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    return (await fs.readJson(execPath)) as ExecutionRecord;
  }

  async getLatestExecution(): Promise<ExecutionRecord | null> {
    const files = await fs.readdir(this.ledgerRoot);
    if (files.length === 0) return null;

    const stats = await Promise.all(
      files.map(async (file) => ({
        file,
        mtime: (await fs.stat(path.join(this.ledgerRoot, file))).mtime,
      }))
    );

    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const latest = stats[0].file;
    return (await fs.readJson(path.join(this.ledgerRoot, latest))) as ExecutionRecord;
  }

  async getExecutionsByStatus(status: ExecutionRecord['status']): Promise<ExecutionRecord[]> {
    const files = await fs.readdir(this.ledgerRoot);
    if (files.length === 0) {
      return [];
    }

    const records: ExecutionRecord[] = [];
    for (const file of files) {
      const fullPath = path.join(this.ledgerRoot, file);
      const record = (await fs.readJson(fullPath)) as ExecutionRecord;
      if (record.status === status) {
        records.push(record);
      }
    }

    records.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    return records;
  }

  private getExecutionPath(executionId: string): string {
    return path.join(this.ledgerRoot, `exec_${executionId}.json`);
  }

  private async saveExecution(execution: ExecutionRecord): Promise<void> {
    await fs.writeJson(this.getExecutionPath(execution.execution_id), execution, {
      spaces: 2,
    });
  }
}

/**
 * Complete execution record.
 */
export interface ExecutionRecord {
  execution_id: string;
  trace_id: string;
  checkpoint_id: string;
  target_folder: string;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'success' | 'failed';
  error: string | null;
  total_actions: number;
  completed_actions: number;
  actions: ActionLog[];
}

export interface ActionLog {
  action_id: string;
  action_type: string;
  action_params: any;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: 'success' | 'failed' | 'skipped';
  error: string | null;
}
