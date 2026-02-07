# Implementation Plan: F5 - Transactional Execution (Enhanced Hybrid)
**Backtrack Desktop App - Gemini 3 Hackathon**

**Timeline:** Day 4 Afternoon (5 hours)  
**Tech Stack:** Node.js | MCP Filesystem | TypeScript | fs-extra  
**Architecture:** Enhanced Hybrid (Inverse Operations + Backup Fallback + Trace Storage)

---

## 🎯 Implementation Context

### Feature Summary
F5 is the **execution engine** that transforms approved action plans into real file operations with **100% guaranteed undo** via a hybrid approach:

1. **Trace Layer** - Saves the AI's plan and reasoning (audit trail)
2. **Backup Layer** - Creates full folder snapshot (safety net)
3. **Execution Layer** - Performs operations via MCP with detailed logging
4. **Undo Layer** - Fast inverse operations with backup fallback

**Core Guarantee:** Every execution can be perfectly undone. No exceptions.

### How It Works (Simple)

**Execution Flow:**
```
1. Save the plan (trace JSON file)
2. Create backup of folder (safety net)
3. Execute actions via MCP (real changes)
4. Log everything that happened (ledger)
5. Keep backup for F6 undo
```

**Undo Flow (F6):**
```
1. Try inverse operations (fast - 1-2s)
2. If anything fails → Restore backup (guaranteed - 3-5s)
```

### Success Criteria
- ✅ Saves complete trace before execution (audit trail)
- ✅ Creates backup in 2-3 seconds for 35 files
- ✅ Executes actions sequentially via MCP
- ✅ Shows real-time progress (0-100%)
- ✅ Verifies each action before/after
- ✅ Keeps backup for F6 undo
- ✅ Links trace → checkpoint → execution

---

## 📁 File Structure

```
src/
├─ main/
│  ├─ services/
│  │  ├─ trace-store.ts           # NEW: Save AI plans
│  │  ├─ backup-service.ts        # Folder backup/restore
│  │  ├─ ledger-service.ts        # Execution history
│  │  └─ execution-engine.ts      # Main execution logic
│  │
│  └─ ipc/
│     └─ execution-handlers.ts    # IPC for execution
│
└─ renderer/
   ├─ components/
   │  └─ execution/
   │     └─ ProgressOverlay.tsx   # Real-time progress UI
   │
   └─ store/
      └─ executionStore.ts        # Execution state
```

```
~/.backtrack/
├─ traces/                        # NEW: Immutable planning history
│  └─ trace_{plan_id}.json        # F2 plan + Gemini reasoning
│
├─ checkpoints/                   # Backup folders
│  └─ {plan_id}/                  # Full folder copy
│     ├─ (all files copied)
│     └─ .backup-metadata.json
│
└─ ledger/                        # Execution history
   └─ exec_{execution_id}.json    # Links trace → actions → checkpoint
```

---

## 📋 Implementation Tasks - Day 4 Afternoon

### Hour 1: Trace Storage + Backup Service

- [x] Task 1: Install Dependencies
- [x] Task 2: Create Trace Store (NEW)
- [x] Task 3: Create Backup Service

#### Task 1: Install Dependencies

```bash
npm install fs-extra
npm install --save-dev @types/fs-extra
```

#### Task 2: Create Trace Store (NEW)

**File:** `src/main/services/trace-store.ts`

```typescript
import fs from 'fs-extra';
import path from 'path';

/**
 * Stores immutable AI planning traces for audit trail
 * Each trace contains the complete reasoning chain from F2
 */
export class TraceStore {
  private tracesRoot: string;
  
  constructor() {
    this.tracesRoot = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.backtrack',
      'traces'
    );
  }
  
  async initialize(): Promise<void> {
    await fs.ensureDir(this.tracesRoot);
  }
  
  /**
   * Save a trace from F2 planning
   * This is append-only - traces are never modified or deleted
   */
  async saveTrace(trace: TraceData): Promise<void> {
    const tracePath = this.getTracePath(trace.trace_id);
    
    await fs.writeJson(tracePath, trace, { spaces: 2 });
  }
  
  /**
   * Load a trace by ID
   * Used by F6 to show what was planned
   */
  async getTrace(traceId: string): Promise<TraceData | null> {
    const tracePath = this.getTracePath(traceId);
    
    if (await fs.pathExists(tracePath)) {
      return await fs.readJson(tracePath);
    }
    
    return null;
  }
  
  /**
   * Get all traces (for history view)
   */
  async getAllTraces(): Promise<TraceData[]> {
    const files = await fs.readdir(this.tracesRoot);
    const traces: TraceData[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const trace = await fs.readJson(path.join(this.tracesRoot, file));
        traces.push(trace);
      }
    }
    
    // Sort by timestamp (newest first)
    traces.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return traces;
  }
  
  private getTracePath(traceId: string): string {
    return path.join(this.tracesRoot, `trace_${traceId}.json`);
  }
}

/**
 * Complete trace from F2 planning phase
 */
export interface TraceData {
  trace_id: string;
  created_at: string;
  
  // F1: User intent
  user_intent: string;
  conversation_id: string;
  
  // F2: AI planning
  gemini_prompt?: string;
  gemini_response?: string;
  thinking_signatures?: {
    stage1_draft?: string;
    stage2_safety?: string;
    stage3_undo?: string;
  };
  
  // The actual plan
  action_plan: {
    plan_id: string;
    actions: Action[];
    target_folder: string;
    summary: {
      files_affected: number;
      folders_created: number;
      estimated_duration_seconds: number;
    };
  };
  
  // F3: Approval
  user_approved: boolean;
  approved_at?: string;
}

export interface Action {
  id: string;
  type: 'create_folder' | 'move_file' | 'move_files_batch' | 'rename_file' | 'create_file';
  params: any;
  depends_on?: string[];
  description?: string;
}
```

#### Task 3: Create Backup Service

**File:** `src/main/services/backup-service.ts`

```typescript
import fs from 'fs-extra';
import path from 'path';

/**
 * Handles backup creation and restoration
 * Creates full folder snapshots for guaranteed undo
 */
export class BackupService {
  private backupRoot: string;
  
  constructor() {
    this.backupRoot = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.backtrack',
      'checkpoints'
    );
  }
  
  async initialize(): Promise<void> {
    await fs.ensureDir(this.backupRoot);
  }
  
  /**
   * Create a full backup of target folder
   * This is our safety net for guaranteed undo
   */
  async createBackup(
    targetFolder: string, 
    planId: string
  ): Promise<BackupMetadata> {
    const backupPath = path.join(this.backupRoot, planId);
    
    // Remove existing backup if present
    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }
    
    // Copy entire folder
    const startTime = Date.now();
    await fs.copy(targetFolder, backupPath, {
      preserveTimestamps: true,
      errorOnExist: false
    });
    const duration = Date.now() - startTime;
    
    // Calculate folder size
    const size = await this.getFolderSize(backupPath);
    const fileCount = await this.countFiles(backupPath);
    
    // Create metadata
    const metadata: BackupMetadata = {
      backup_id: planId,
      backup_path: backupPath,
      source_folder: targetFolder,
      created_at: new Date().toISOString(),
      size_bytes: size,
      duration_ms: duration,
      file_count: fileCount
    };
    
    // Save metadata
    await fs.writeJson(
      path.join(backupPath, '.backup-metadata.json'),
      metadata,
      { spaces: 2 }
    );
    
    return metadata;
  }
  
  /**
   * Restore folder from backup
   * Used as fallback if inverse operations fail
   */
  async restoreFromBackup(
    backupPath: string,
    targetFolder: string
  ): Promise<void> {
    // Verify backup exists
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }
    
    // Clear target folder contents (but keep folder itself)
    const items = await fs.readdir(targetFolder);
    for (const item of items) {
      const itemPath = path.join(targetFolder, item);
      await fs.remove(itemPath);
    }
    
    // Copy backup contents to target
    const backupItems = await fs.readdir(backupPath);
    for (const item of backupItems) {
      // Skip metadata file
      if (item === '.backup-metadata.json') continue;
      
      const srcPath = path.join(backupPath, item);
      const destPath = path.join(targetFolder, item);
      await fs.copy(srcPath, destPath, {
        preserveTimestamps: true
      });
    }
  }
  
  /**
   * Delete a backup folder
   * Called after successful undo
   */
  async deleteBackup(planId: string): Promise<void> {
    const backupPath = path.join(this.backupRoot, planId);
    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }
  }
  
  /**
   * Get backup metadata
   */
  async getBackupMetadata(planId: string): Promise<BackupMetadata | null> {
    const metadataPath = path.join(
      this.backupRoot,
      planId,
      '.backup-metadata.json'
    );
    
    if (await fs.pathExists(metadataPath)) {
      return await fs.readJson(metadataPath);
    }
    return null;
  }
  
  /**
   * Cleanup old backups (keep last N)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<void> {
    const backups = await fs.readdir(this.backupRoot);
    
    // Get metadata for each
    const backupsWithDates = await Promise.all(
      backups.map(async (backup) => {
        const metadata = await this.getBackupMetadata(backup);
        return {
          id: backup,
          created_at: metadata?.created_at || '1970-01-01'
        };
      })
    );
    
    // Sort by date (newest first)
    backupsWithDates.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Delete old backups
    for (let i = keepCount; i < backupsWithDates.length; i++) {
      await this.deleteBackup(backupsWithDates[i].id);
    }
  }
  
  private async getFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0;
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item.name);
      if (item.isDirectory()) {
        totalSize += await this.getFolderSize(itemPath);
      } else {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
  
  private async countFiles(folderPath: string): Promise<number> {
    let count = 0;
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item.name);
      if (item.isDirectory()) {
        count += await this.countFiles(itemPath);
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
```

---

### Hour 2: Ledger Service + Execution Context

- [x] Task 4: Create Ledger Service
- [x] Task 5: Create Execution Engine

#### Task 4: Create Ledger Service

**File:** `src/main/services/ledger-service.ts`

```typescript
import fs from 'fs-extra';
import path from 'path';

/**
 * Stores execution history (what actually happened)
 * Links trace → checkpoint → actions
 */
export class LedgerService {
  private ledgerRoot: string;
  
  constructor() {
    this.ledgerRoot = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.backtrack',
      'ledger'
    );
  }
  
  async initialize(): Promise<void> {
    await fs.ensureDir(this.ledgerRoot);
  }
  
  /**
   * Create new execution record
   */
  async createExecution(execution: ExecutionRecord): Promise<void> {
    const execPath = this.getExecutionPath(execution.execution_id);
    await fs.writeJson(execPath, execution, { spaces: 2 });
  }
  
  /**
   * Log a single action result
   */
  async logAction(
    executionId: string,
    actionLog: ActionLog
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.actions.push(actionLog);
    execution.completed_actions++;
    await this.saveExecution(execution);
  }
  
  /**
   * Mark execution as complete (success or failed)
   */
  async completeExecution(
    executionId: string,
    status: 'success' | 'failed',
    error?: string
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = status;
    execution.completed_at = new Date().toISOString();
    execution.error = error || null;
    await this.saveExecution(execution);
  }
  
  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<ExecutionRecord> {
    const execPath = this.getExecutionPath(executionId);
    
    if (!await fs.pathExists(execPath)) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    return await fs.readJson(execPath);
  }
  
  /**
   * Get latest execution (for F6 undo button)
   */
  async getLatestExecution(): Promise<ExecutionRecord | null> {
    const files = await fs.readdir(this.ledgerRoot);
    
    if (files.length === 0) return null;
    
    // Get most recent file
    const stats = await Promise.all(
      files.map(async (file) => ({
        file,
        mtime: (await fs.stat(path.join(this.ledgerRoot, file))).mtime
      }))
    );
    
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    const latestFile = stats[0].file;
    return await fs.readJson(path.join(this.ledgerRoot, latestFile));
  }
  
  private getExecutionPath(executionId: string): string {
    return path.join(this.ledgerRoot, `exec_${executionId}.json`);
  }
  
  private async saveExecution(execution: ExecutionRecord): Promise<void> {
    const execPath = this.getExecutionPath(execution.execution_id);
    await fs.writeJson(execPath, execution, { spaces: 2 });
  }
}

/**
 * Complete execution record
 * Links: Trace (planning) → Checkpoint (backup) → Actions (what happened)
 */
export interface ExecutionRecord {
  execution_id: string;
  
  // Links to other layers
  trace_id: string;              // Links to planning trace
  checkpoint_id: string;         // Links to backup folder
  target_folder: string;
  
  // Execution details
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'success' | 'failed';
  error: string | null;
  
  // Actions performed
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
```

---

### Hour 3: Execution Engine Core

#### Task 5: Create Execution Engine

**File:** `src/main/services/execution-engine.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';
import { TraceStore, TraceData, Action } from './trace-store';
import { BackupService, BackupMetadata } from './backup-service';
import { LedgerService, ExecutionRecord, ActionLog } from './ledger-service';

/**
 * Main execution engine
 * Orchestrates: Trace → Backup → Execute → Ledger
 */
export class ExecutionEngine {
  private traceStore: TraceStore;
  private backupService: BackupService;
  private ledgerService: LedgerService;
  private mcpClient: any; // Your MCP client from F1
  private mainWindow: BrowserWindow;
  
  constructor(
    traceStore: TraceStore,
    backupService: BackupService,
    ledgerService: LedgerService,
    mcpClient: any,
    mainWindow: BrowserWindow
  ) {
    this.traceStore = traceStore;
    this.backupService = backupService;
    this.ledgerService = ledgerService;
    this.mcpClient = mcpClient;
    this.mainWindow = mainWindow;
  }
  
  /**
   * Main execution method
   * Receives approved plan from F3
   */
  async executePlan(approvedPlan: ApprovedPlan): Promise<ExecutionResult> {
    let executionId: string;
    let checkpoint: BackupMetadata;
    
    try {
      // Stage 1: Save trace (NEW - audit trail)
      this.sendProgress({ status: 'preparing', progress: 0, message: 'Saving plan...' });
      await this.saveTraceFromPlan(approvedPlan);
      
      // Stage 2: Create backup (safety net)
      this.sendProgress({ status: 'preparing', progress: 20, message: 'Creating backup...' });
      checkpoint = await this.backupService.createBackup(
        approvedPlan.target_folder,
        approvedPlan.plan_id
      );
      
      // Stage 3: Initialize execution record
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
        actions: []
      });
      
      // Stage 4: Execute actions
      this.sendProgress({ status: 'executing', progress: 0 });
      await this.executeActions(executionId, approvedPlan.actions);
      
      // Stage 5: Mark success
      await this.ledgerService.completeExecution(executionId, 'success');
      this.sendProgress({ status: 'success', progress: 100 });
      
      // Cleanup old backups
      await this.backupService.cleanupOldBackups(10);
      
      return { success: true, executionId };
      
    } catch (error: any) {
      // Rollback on error
      await this.handleExecutionError(executionId!, checkpoint!, error);
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  
  /**
   * Save trace from approved plan (NEW)
   */
  private async saveTraceFromPlan(plan: ApprovedPlan): Promise<void> {
    const trace: TraceData = {
      trace_id: plan.plan_id,
      created_at: new Date().toISOString(),
      
      // From F1
      user_intent: plan.user_intent,
      conversation_id: plan.conversation_id || '',
      
      // From F2 (if available)
      gemini_prompt: plan.gemini_prompt,
      gemini_response: plan.gemini_response,
      thinking_signatures: plan.thinking_signatures,
      
      // The plan itself
      action_plan: {
        plan_id: plan.plan_id,
        actions: plan.actions,
        target_folder: plan.target_folder,
        summary: plan.summary
      },
      
      // From F3
      user_approved: true,
      approved_at: new Date().toISOString()
    };
    
    await this.traceStore.saveTrace(trace);
  }
  
  /**
   * Execute actions sequentially with dependency resolution
   */
  private async executeActions(
    executionId: string,
    actions: Action[]
  ): Promise<void> {
    // Sort by dependencies (topological sort)
    const sortedActions = this.topologicalSort(actions);
    
    for (let i = 0; i < sortedActions.length; i++) {
      const action = sortedActions[i];
      
      // Update progress
      const progress = Math.floor((i / sortedActions.length) * 100);
      this.sendProgress({
        status: 'executing',
        progress,
        currentAction: action.description || action.type
      });
      
      // Execute single action
      const actionLog = await this.executeSingleAction(action);
      
      // Log to ledger
      await this.ledgerService.logAction(executionId, actionLog);
    }
  }
  
  /**
   * Execute a single action with verification
   */
  private async executeSingleAction(action: Action): Promise<ActionLog> {
    const startTime = Date.now();
    const actionLog: ActionLog = {
      action_id: action.id,
      action_type: action.type,
      action_params: action.params,
      started_at: new Date().toISOString(),
      completed_at: '',
      duration_ms: 0,
      status: 'success',
      error: null
    };
    
    try {
      // Pre-execution verification
      await this.verifyPreConditions(action);
      
      // Execute via MCP
      switch (action.type) {
        case 'create_folder':
          await this.executeCreateFolder(action);
          break;
        
        case 'move_file':
          await this.executeMoveFile(action);
          break;
        
        case 'move_files_batch':
          await this.executeMoveFilesBatch(action);
          break;
        
        case 'rename_file':
          await this.executeRenameFile(action);
          break;
        
        case 'create_file':
          await this.executeCreateFile(action);
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      // Post-execution verification
      await this.verifyPostConditions(action);
      
      actionLog.completed_at = new Date().toISOString();
      actionLog.duration_ms = Date.now() - startTime;
      actionLog.status = 'success';
      
    } catch (error: any) {
      actionLog.completed_at = new Date().toISOString();
      actionLog.duration_ms = Date.now() - startTime;
      actionLog.status = 'failed';
      actionLog.error = error.message;
      
      throw error; // Propagate to trigger rollback
    }
    
    return actionLog;
  }
  
  /**
   * Execute create_folder via MCP
   */
  private async executeCreateFolder(action: Action): Promise<void> {
    const { path } = action.params;
    await this.mcpClient.callTool('create_directory', { path });
  }
  
  /**
   * Execute move_file via MCP
   */
  private async executeMoveFile(action: Action): Promise<void> {
    const { source, destination } = action.params;
    await this.mcpClient.callTool('move_file', { source, destination });
  }
  
  /**
   * Execute move_files_batch via MCP
   */
  private async executeMoveFilesBatch(action: Action): Promise<void> {
    const { files, source_folder, destination } = action.params;
    
    // Move files sequentially (safer than parallel)
    for (const file of files) {
      const source = path.join(source_folder, file);
      const dest = path.join(destination, file);
      await this.mcpClient.callTool('move_file', { source, destination: dest });
    }
  }
  
  /**
   * Execute rename_file via MCP
   */
  private async executeRenameFile(action: Action): Promise<void> {
    const { path: filePath, new_name } = action.params;
    const parentDir = path.dirname(filePath);
    const destination = path.join(parentDir, new_name);
    await this.mcpClient.callTool('move_file', { source: filePath, destination });
  }
  
  /**
   * Execute create_file via MCP
   */
  private async executeCreateFile(action: Action): Promise<void> {
    const { path: filePath, content } = action.params;
    await this.mcpClient.callTool('write_file', { 
      path: filePath, 
      content: content || '' 
    });
  }
  
  /**
   * Verify pre-conditions before action
   */
  private async verifyPreConditions(action: Action): Promise<void> {
    switch (action.type) {
      case 'create_folder':
        const parentDir = path.dirname(action.params.path);
        const parentExists = await this.mcpClient.pathExists(parentDir);
        if (!parentExists) {
          throw new Error(`Parent directory does not exist: ${parentDir}`);
        }
        break;
      
      case 'move_file':
      case 'rename_file':
        const sourceExists = await this.mcpClient.pathExists(action.params.source);
        if (!sourceExists) {
          throw new Error(`Source file not found: ${action.params.source}`);
        }
        break;
    }
  }
  
  /**
   * Verify post-conditions after action
   */
  private async verifyPostConditions(action: Action): Promise<void> {
    switch (action.type) {
      case 'create_folder':
        const folderExists = await this.mcpClient.pathExists(action.params.path);
        if (!folderExists) {
          throw new Error(`Failed to create folder: ${action.params.path}`);
        }
        break;
      
      case 'move_file':
      case 'rename_file':
        const destPath = action.params.destination || 
                        path.join(path.dirname(action.params.path), action.params.new_name);
        const destExists = await this.mcpClient.pathExists(destPath);
        if (!destExists) {
          throw new Error(`File not at destination: ${destPath}`);
        }
        break;
    }
  }
  
  /**
   * Handle execution error (rollback)
   */
  private async handleExecutionError(
    executionId: string,
    checkpoint: BackupMetadata,
    error: Error
  ): Promise<void> {
    try {
      this.sendProgress({
        status: 'executing',
        progress: 0,
        message: 'Error detected - Rolling back...'
      });
      
      // Restore from backup
      await this.backupService.restoreFromBackup(
        checkpoint.backup_path,
        checkpoint.source_folder
      );
      
      // Mark as failed
      await this.ledgerService.completeExecution(
        executionId,
        'failed',
        error.message
      );
      
      // Delete backup (failed execution)
      await this.backupService.deleteBackup(checkpoint.backup_id);
      
      this.sendProgress({
        status: 'error',
        message: error.message
      });
      
    } catch (rollbackError: any) {
      throw new Error(
        `CRITICAL: Rollback failed: ${rollbackError.message}. ` +
        `Backup preserved at: ${checkpoint.backup_path}`
      );
    }
  }
  
  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(actions: Action[]): Action[] {
    const graph = new Map<string, Action>();
    const inDegree = new Map<string, number>();
    
    // Build graph
    actions.forEach(action => {
      graph.set(action.id, action);
      inDegree.set(action.id, (action.depends_on || []).length);
    });
    
    // Find actions with no dependencies
    const queue: Action[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(graph.get(id)!);
      }
    }
    
    // Process queue
    const sorted: Action[] = [];
    while (queue.length > 0) {
      const action = queue.shift()!;
      sorted.push(action);
      
      // Reduce in-degree for dependents
      actions.forEach(a => {
        if (a.depends_on && a.depends_on.includes(action.id)) {
          const newDegree = inDegree.get(a.id)! - 1;
          inDegree.set(a.id, newDegree);
          if (newDegree === 0) {
            queue.push(a);
          }
        }
      });
    }
    
    return sorted;
  }
  
  /**
   * Send progress updates to renderer
   */
  private sendProgress(progress: ProgressUpdate): void {
    this.mainWindow.webContents.send('execution-progress', progress);
  }
  
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface ApprovedPlan {
  plan_id: string;
  user_intent: string;
  conversation_id?: string;
  target_folder: string;
  actions: Action[];
  summary: {
    files_affected: number;
    folders_created: number;
    estimated_duration_seconds: number;
  };
  
  // Optional F2 metadata
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
}
```

---

### Hour 4: Progress UI + IPC Integration

#### Task 6: Create Progress Overlay

**File:** `src/renderer/components/execution/ProgressOverlay.tsx`

```typescript
import { motion } from 'framer-motion';
import { useExecutionStore } from '../../store/executionStore';

export default function ProgressOverlay() {
  const { status, progress, currentAction, message, error } = useExecutionStore();
  
  if (status === 'idle') return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
    >
      <div className="w-[500px] bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl">
        {status === 'preparing' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Preparing</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {message || 'Creating backup...'}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
        
        {status === 'executing' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Executing Plan</h2>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <p className="text-lg font-medium">{progress}% complete</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {currentAction || 'Executing...'}
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">Success!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              All files organized successfully
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ You can undo this operation anytime
            </p>
            <button
              onClick={() => useExecutionStore.getState().reset()}
              className="mt-6 w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Done
            </button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-2">Error</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mb-4">
              ✓ All changes have been rolled back - your files are safe
            </p>
            <button
              onClick={() => useExecutionStore.getState().reset()}
              className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Close
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
```

#### Task 7: Create Execution Store

**File:** `src/renderer/store/executionStore.ts`

```typescript
import create from 'zustand';

interface ExecutionState {
  status: 'idle' | 'preparing' | 'executing' | 'success' | 'error';
  progress: number;
  currentAction: string;
  message: string;
  error: string | null;
  
  updateProgress: (update: ProgressUpdate) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  status: 'idle',
  progress: 0,
  currentAction: '',
  message: '',
  error: null,
  
  updateProgress: (update) => set({
    status: update.status,
    progress: update.progress || 0,
    currentAction: update.currentAction || '',
    message: update.message || '',
    error: update.error || null
  }),
  
  reset: () => set({
    status: 'idle',
    progress: 0,
    currentAction: '',
    message: '',
    error: null
  })
}));

interface ProgressUpdate {
  status: 'idle' | 'preparing' | 'executing' | 'success' | 'error';
  progress?: number;
  currentAction?: string;
  message?: string;
  error?: string;
}
```

#### Task 8: Set Up IPC Handlers

**File:** `src/main/ipc/execution-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { executionEngine } from '../index'; // Import your initialized engine

export function setupExecutionHandlers() {
  /**
   * Execute an approved plan from F3
   */
  ipcMain.handle('execute-plan', async (event, approvedPlan) => {
    try {
      const result = await executionEngine.executePlan(approvedPlan);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get latest execution (for F6 undo button)
   */
  ipcMain.handle('get-latest-execution', async () => {
    try {
      const execution = await executionEngine.ledgerService.getLatestExecution();
      return { success: true, execution };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

// Progress updates are sent automatically via executionEngine.sendProgress()
```

**Update:** `src/main/preload.ts`

```typescript
contextBridge.exposeInMainWorld('api', {
  // ... existing methods
  
  // F5: Execution
  executePlan: (approvedPlan: any) => 
    ipcRenderer.invoke('execute-plan', approvedPlan),
  
  getLatestExecution: () =>
    ipcRenderer.invoke('get-latest-execution'),
  
  onExecutionProgress: (callback: (progress: any) => void) =>
    ipcRenderer.on('execution-progress', (_, data) => callback(data))
});
```

---

### Hour 5: Initialize Services + Testing

#### Task 9: Initialize All Services

**File:** `src/main/index.ts` (main process entry)

```typescript
import { app, BrowserWindow } from 'electron';
import { TraceStore } from './services/trace-store';
import { BackupService } from './services/backup-service';
import { LedgerService } from './services/ledger-service';
import { ExecutionEngine } from './services/execution-engine';
import { setupExecutionHandlers } from './ipc/execution-handlers';

let mainWindow: BrowserWindow;
let executionEngine: ExecutionEngine;

async function createWindow() {
  mainWindow = new BrowserWindow({
    // ... your window config
  });
  
  // Initialize services
  const traceStore = new TraceStore();
  await traceStore.initialize();
  
  const backupService = new BackupService();
  await backupService.initialize();
  
  const ledgerService = new LedgerService();
  await ledgerService.initialize();
  
  // Get MCP client (already initialized in F1)
  const mcpClient = getMCPClient(); // Your existing MCP client
  
  // Create execution engine
  executionEngine = new ExecutionEngine(
    traceStore,
    backupService,
    ledgerService,
    mcpClient,
    mainWindow
  );
  
  // Set up IPC handlers
  setupExecutionHandlers();
  
  // ... rest of window setup
}

app.whenReady().then(createWindow);

// Export for IPC handlers
export { executionEngine };
```

#### Task 10: Connect Execution Store to IPC

**File:** `src/renderer/App.tsx` (or wherever you initialize)

```typescript
import { useEffect } from 'react';
import { useExecutionStore } from './store/executionStore';
import ProgressOverlay from './components/execution/ProgressOverlay';

function App() {
  useEffect(() => {
    // Listen for progress updates
    const unsubscribe = window.api.onExecutionProgress((progress) => {
      useExecutionStore.getState().updateProgress(progress);
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <>
      {/* ... your existing components */}
      <ProgressOverlay />
    </>
  );
}
```

#### Task 11: Update F3 to Trigger F5

**In your F3 component** (where user clicks "Approve & Execute"):

```typescript
async function handleApprove() {
  const approvedPlan = {
    plan_id: currentPlan.plan_id,
    user_intent: currentPlan.user_intent,
    conversation_id: currentPlan.conversation_id,
    target_folder: currentPlan.target_folder,
    actions: currentPlan.actions,
    summary: currentPlan.summary,
    
    // Include F2 metadata if available
    gemini_prompt: currentPlan.gemini_prompt,
    gemini_response: currentPlan.gemini_response,
    thinking_signatures: currentPlan.thinking_signatures
  };
  
  // Close F3 preview
  usePreviewStore.getState().closePanel();
  
  // Trigger F5 execution
  const result = await window.api.executePlan(approvedPlan);
  
  if (result.success) {
    console.log('Execution started:', result.result.executionId);
  } else {
    console.error('Execution failed:', result.error);
  }
}
```

---

## 🧪 Testing Checklist

### Backup System
- [ ] Backup created in `~/.backtrack/checkpoints/{plan_id}/`
- [ ] All files copied correctly
- [ ] Metadata JSON created
- [ ] Backup completes in 2-3 seconds for 35 files

### Trace Storage (NEW)
- [ ] Trace saved in `~/.backtrack/traces/trace_{plan_id}.json`
- [ ] Contains user intent, Gemini response, actions
- [ ] Thinking signatures preserved
- [ ] Can load trace by ID

### Execution
- [ ] Actions execute in correct order (dependencies respected)
- [ ] Progress updates show correctly (0-100%)
- [ ] Current action description displays
- [ ] All files end up in correct locations

### Ledger
- [ ] Execution record created in `~/.backtrack/ledger/`
- [ ] Links trace_id and checkpoint_id correctly
- [ ] Each action logged with timestamps
- [ ] Can retrieve latest execution

### Error Handling
- [ ] Error caught and logged
- [ ] Backup restoration happens automatically
- [ ] Error message shown to user
- [ ] Files restored to original state

---

## ✅ Day 4 Afternoon Completion Criteria

F5 is complete when:
- ✅ Trace storage working (saves F2 plans)
- ✅ Backup creation working (2-3s for demo)
- ✅ Execution via MCP working
- ✅ Progress overlay shows correctly
- ✅ Ledger links trace → checkpoint → actions
- ✅ Error rollback working
- ✅ Can retrieve latest execution for F6

**Next:** Day 5 Morning implements F6 (Undo with inverse + backup fallback)

---

## 📝 Implementation Notes

**Key Files Created:**
1. `trace-store.ts` - Immutable planning history (NEW)
2. `backup-service.ts` - Folder snapshots
3. `ledger-service.ts` - Execution history
4. `execution-engine.ts` - Main orchestration
5. `ProgressOverlay.tsx` - Real-time UI
6. `executionStore.ts` - State management

**Storage Locations:**
- `~/.backtrack/traces/` - Planning traces (NEW)
- `~/.backtrack/checkpoints/` - Backups
- `~/.backtrack/ledger/` - Execution logs

**This architecture enables:**
- Complete audit trail (who, what, when, why)
- Re-execution of plans after undo
- Clear separation: planning → execution → undo
- 100% safety via backup fallback

---

**Ready for Claude Code Opus 4.5! Feed this entire plan.** 🚀
