import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Stores immutable AI planning traces for audit trail.
 * Each trace contains the complete reasoning chain from F2.
 */
export class TraceStore {
  private readonly tracesRoot: string;

  constructor() {
    this.tracesRoot = path.join(os.homedir(), '.backtrack', 'traces');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.tracesRoot);
  }

  /**
   * Save a trace from F2 planning (append-only).
   */
  async saveTrace(trace: TraceData): Promise<void> {
    const tracePath = this.getTracePath(trace.trace_id);
    await fs.writeJson(tracePath, trace, { spaces: 2 });
  }

  /**
   * Load a trace by ID (used by F6 / history views).
   */
  async getTrace(traceId: string): Promise<TraceData | null> {
    const tracePath = this.getTracePath(traceId);
    if (await fs.pathExists(tracePath)) {
      return await fs.readJson(tracePath);
    }
    return null;
  }

  /**
   * Get all traces sorted newest first.
   */
  async getAllTraces(): Promise<TraceData[]> {
    const files = await fs.readdir(this.tracesRoot);
    const traces: TraceData[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const trace = await fs.readJson(path.join(this.tracesRoot, file));
      traces.push(trace as TraceData);
    }

    traces.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return traces;
  }

  private getTracePath(traceId: string): string {
    return path.join(this.tracesRoot, `trace_${traceId}.json`);
  }
}

/**
 * Complete trace from F2 planning phase.
 */
export interface TraceData {
  trace_id: string;
  created_at: string;
  user_intent: string;
  conversation_id: string;

  gemini_prompt?: string;
  gemini_response?: string;
  thinking_signatures?: {
    stage1_draft?: string;
    stage2_safety?: string;
    stage3_undo?: string;
  };

  action_plan: {
    plan_id: string;
    actions: TraceAction[];
    target_folder: string;
    summary: {
      files_affected: number;
      folders_created: number;
      estimated_duration_seconds: number;
    };
  };

  user_approved: boolean;
  approved_at?: string;
}

export interface TraceAction {
  id: string;
  type: 'create_folder' | 'move_file' | 'move_files_batch' | 'rename_file' | 'create_file';
  params: Record<string, any>;
  depends_on?: string[];
  description?: string;
}
