import { getGeminiClient } from './gemini-client';
import * as path from 'path';

/**
 * Action types supported by the planning engine
 */
export type ActionType = 'create_folder' | 'move_file' | 'move_files_batch' | 'rename_file' | 'copy_file';

/**
 * Single action in the execution plan
 */
export interface Action {
  id: string;
  type: ActionType;
  params: Record<string, any>;
  description: string;
  depends_on: string[];
  estimated_time_ms: number;
}

/**
 * Complete action plan
 */
export interface ActionPlan {
  plan_id: string;
  actions: Action[];
  summary: {
    total_actions: number;
    files_affected: number;
    folders_created: number;
  };
}

/**
 * File metadata for planning
 */
export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  extension: string;
  modified: string;
  created: string;
  isDirectory: boolean;
}

/**
 * Input for planning engine from F1
 */
export interface PlanningInput {
  conversationId: string;
  userIntent: string;
  targetFolder: string;
  constraints: string[];
  scannedFiles: FileMetadata[];
  parsedIntent: any;
}

/**
 * Output from Stage 1 (Draft Planning)
 */
export interface DraftPlanResult {
  plan: ActionPlan;
  thought_signature: string;
  metadata: {
    stage: 'draft_planning';
    thinking_level: 'low';
    latency_ms: number;
    tokens_used: number;
    file_patterns: FilePatternAnalysis;
  };
}

/**
 * Safety risk levels
 */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Safety check result
 */
export interface SafetyCheck {
  passed: boolean;
  issue?: string;
  severity?: RiskLevel;
}

/**
 * Safety analysis report
 */
export interface SafetyReport {
  overall_risk: RiskLevel;
  is_safe: boolean;
  issues: Array<{
    type: string;
    severity: RiskLevel;
    description: string;
    affected_actions: string[];
  }>;
  checks: {
    data_loss_risk: SafetyCheck;
    permission_issues: SafetyCheck;
    file_conflicts: SafetyCheck;
    circular_dependencies: SafetyCheck;
    disk_space: SafetyCheck;
    protected_paths: SafetyCheck;
  };
  ai_analysis?: string;
}

/**
 * Output from Stage 2 (Safety Verification)
 */
export interface SafetyVerificationResult {
  safety_report: SafetyReport;
  thought_signature: string;
  metadata: {
    stage: 'safety_verification';
    thinking_level: 'high';
    latency_ms: number;
    tokens_used: number;
    programmatic_checks: number;
    ai_checks: number;
  };
}

/**
 * Checkpoint metadata for fallback recovery
 */
export interface Checkpoint {
  checkpoint_id: string;
  plan_id: string;
  timestamp: string;
  target_folder: string;
  file_snapshot: Array<{
    path: string;
    size: number;
    modified: string;
  }>;
}

/**
 * Undo plan structure
 */
export interface UndoPlan {
  undo_plan_id: string;
  original_plan_id: string;
  undo_actions: Action[];
  checkpoint: Checkpoint;
  deterministic: boolean;
}

/**
 * Output from Stage 3 (Undo Generation)
 */
export interface UndoGenerationResult {
  undo_plan: UndoPlan;
  thought_signature: string;
  metadata: {
    stage: 'undo_generation';
    thinking_level: 'high';
    latency_ms: number;
    tokens_used: number;
    deterministic_actions: number;
    ai_enhanced: boolean;
  };
}

/**
 * Complete F2 output (all 3 stages combined)
 */
export interface CompletePlanOutput {
  plan_id: string;
  actions: Action[];
  undo_plan: UndoPlan;
  safety_analysis: SafetyReport;
  summary: {
    total_actions: number;
    files_affected: number;
    folders_created: number;
  };
  gemini_metadata: {
    stage1_thinking_level: 'low';
    stage1_signature: string;
    stage1_latency_ms: number;
    stage1_tokens: number;
    stage2_thinking_level: 'high';
    stage2_signature: string;
    stage2_latency_ms: number;
    stage2_tokens: number;
    stage3_thinking_level: 'high';
    stage3_signature: string;
    stage3_latency_ms: number;
    stage3_tokens: number;
    total_time_ms: number;
    total_tokens: number;
  };
}

/**
 * File pattern analysis
 */
interface FilePatternAnalysis {
  by_extension: Record<string, number>;
  total_files: number;
  total_folders: number;
  special_patterns: {
    tax_docs: number;
    work_files: number;
    personal_files: number;
    media_files: number;
  };
  existing_structure: string[];
}

/**
 * Planning Engine - Stage 1: Draft Planning
 * Generates initial action plan using Gemini with low thinking level
 */
export class PlanningEngine {
  private geminiClient = getGeminiClient();

  /**
   * Generate draft plan from F1 handoff data
   */
  async generateDraftPlan(input: PlanningInput): Promise<DraftPlanResult> {
    console.log('[PlanningEngine] Starting Stage 1: Draft Planning');
    console.log(`[PlanningEngine] Target: ${input.targetFolder}, Files: ${input.scannedFiles.length}`);

    // Step 1: Input validation
    this.validateInput(input);

    // Step 2: Analyze file patterns
    const filePatterns = this.analyzeFilePatterns(input.scannedFiles);
    console.log('[PlanningEngine] File pattern analysis:', filePatterns);

    // Step 3: Generate Gemini prompt
    const prompt = this.buildDraftPlanningPrompt(input, filePatterns);

    // Step 4: Call Gemini with low thinking level for speed
    console.log('[PlanningEngine] Calling Gemini (thinking_level: low)...');
    const geminiResponse = await this.geminiClient.generate({
      prompt,
      thinking_level: 'low',
      output_format: 'json',
      temperature: 0.3,
      max_tokens: 4000
    });

    // Step 5: Parse and validate JSON response
    const actionPlan = this.parseAndValidatePlan(geminiResponse.text);

    // Step 6: Return draft plan with metadata
    return {
      plan: actionPlan,
      thought_signature: geminiResponse.thought_signature || '',
      metadata: {
        stage: 'draft_planning',
        thinking_level: 'low',
        latency_ms: geminiResponse.latency_ms,
        tokens_used: geminiResponse.tokens_used,
        file_patterns: filePatterns
      }
    };
  }

  /**
   * Validate planning input
   */
  private validateInput(input: PlanningInput): void {
    // Check file count limit
    if (input.scannedFiles.length > 50) {
      throw new Error(
        `Too many files to organize (${input.scannedFiles.length}). Please organize in batches of 50 or fewer.`
      );
    }

    if (input.scannedFiles.length === 0) {
      throw new Error('No files found to organize. Please check the folder path.');
    }

    // Check target folder is specified
    if (!input.targetFolder || input.targetFolder.trim() === '') {
      throw new Error('Target folder not specified.');
    }

    console.log(`[PlanningEngine] Input validation passed: ${input.scannedFiles.length} files`);
  }

  /**
   * Analyze file patterns for smarter planning
   */
  private analyzeFilePatterns(files: FileMetadata[]): FilePatternAnalysis {
    const byExtension: Record<string, number> = {};
    let totalFiles = 0;
    let totalFolders = 0;
    const existingStructure: string[] = [];
    const specialPatterns = {
      tax_docs: 0,
      work_files: 0,
      personal_files: 0,
      media_files: 0
    };

    for (const file of files) {
      if (file.isDirectory) {
        totalFolders++;
        existingStructure.push(file.name);
      } else {
        totalFiles++;

        // Count by extension
        const ext = file.extension || 'no-extension';
        byExtension[ext] = (byExtension[ext] || 0) + 1;

        // Detect special patterns
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('tax') || nameLower.includes('w2') || nameLower.includes('1040')) {
          specialPatterns.tax_docs++;
        }
        if (nameLower.includes('work') || nameLower.includes('project') || nameLower.includes('meeting')) {
          specialPatterns.work_files++;
        }
        if (nameLower.includes('personal') || nameLower.includes('family') || nameLower.includes('photo')) {
          specialPatterns.personal_files++;
        }
        if (['.jpg', '.png', '.mp4', '.mov', '.mp3'].includes(file.extension)) {
          specialPatterns.media_files++;
        }
      }
    }

    return {
      by_extension: byExtension,
      total_files: totalFiles,
      total_folders: totalFolders,
      special_patterns: specialPatterns,
      existing_structure: existingStructure
    };
  }

  /**
   * Build Gemini prompt for draft planning
   */
  private buildDraftPlanningPrompt(input: PlanningInput, patterns: FilePatternAnalysis): string {
    // Build file breakdown
    const fileBreakdown = Object.entries(patterns.by_extension)
      .map(([ext, count]) => `  - ${ext}: ${count} files`)
      .join('\n');

    return `You are a file organization expert. Generate a precise action plan to organize files.

**USER INTENT:**
"${input.userIntent}"

**TARGET FOLDER:**
${input.targetFolder}

**CONSTRAINTS:**
${input.constraints.length > 0 ? input.constraints.map(c => `- ${c}`).join('\n') : '- None'}

**FILE ANALYSIS:**
- Total files: ${patterns.total_files}
- Total folders (existing): ${patterns.total_folders}

**Files by Extension:**
${fileBreakdown}

**Special Patterns Detected:**
- Tax documents: ${patterns.special_patterns.tax_docs}
- Work files: ${patterns.special_patterns.work_files}
- Personal files: ${patterns.special_patterns.personal_files}
- Media files: ${patterns.special_patterns.media_files}

**EXISTING FOLDER STRUCTURE:**
${patterns.existing_structure.length > 0 ? patterns.existing_structure.map(f => `- ${f}`).join('\n') : '- No existing folders'}

**SAFETY RULES (CRITICAL):**
1. NEVER permanently delete files - use move operations only
2. ALWAYS create destination folders before moving files
3. Handle file name conflicts by appending numbers (file.txt → file_1.txt)
4. Preserve file metadata (timestamps, permissions)
5. Create folders in dependency order (parent before child)

**OUTPUT JSON SCHEMA:**
Generate a valid JSON action plan with this exact structure:

{
  "plan_id": "plan_<timestamp>",
  "actions": [
    {
      "id": "action_001",
      "type": "create_folder" | "move_file" | "move_files_batch" | "rename_file",
      "params": {
        "path": "C:\\\\path\\\\to\\\\folder",
        "source": "C:\\\\path\\\\to\\\\file.txt",
        "destination": "C:\\\\path\\\\to\\\\new\\\\location\\\\file.txt",
        "files": ["file1.txt", "file2.txt"] // for batch operations
      },
      "description": "Human-readable description of action",
      "depends_on": ["action_001", "action_002"], // IDs of actions that must complete first
      "estimated_time_ms": 100
    }
  ],
  "summary": {
    "total_actions": 10,
    "files_affected": 35,
    "folders_created": 3
  }
}

**EXAMPLE 1: Organize by file type**
User Intent: "organize downloads by type"
Files: 10 PDFs, 5 images, 3 videos

Plan:
1. Create folder "Documents" (action_001)
2. Create folder "Images" (action_002)
3. Create folder "Videos" (action_003)
4. Batch move all PDFs to Documents (action_004, depends_on: ["action_001"])
5. Batch move all images to Images (action_005, depends_on: ["action_002"])
6. Batch move all videos to Videos (action_006, depends_on: ["action_003"])

**EXAMPLE 2: Organize by date**
User Intent: "organize photos by year"
Files: 20 photos from 2023, 15 from 2024

Plan:
1. Create folder "2023" (action_001)
2. Create folder "2024" (action_002)
3. Batch move 2023 photos to 2023 folder (action_003, depends_on: ["action_001"])
4. Batch move 2024 photos to 2024 folder (action_004, depends_on: ["action_002"])

**NOW GENERATE THE ACTION PLAN:**
Based on the user intent "${input.userIntent}", create a complete, safe, and efficient action plan in JSON format.`;
  }

  /**
   * Parse and validate Gemini's JSON response
   */
  private parseAndValidatePlan(jsonText: string): ActionPlan {
    try {
      const plan = JSON.parse(jsonText) as ActionPlan;

      // Validate plan structure
      if (!plan.plan_id || !plan.actions || !plan.summary) {
        throw new Error('Invalid plan structure: missing required fields');
      }

      if (!Array.isArray(plan.actions)) {
        throw new Error('Invalid plan: actions must be an array');
      }

      // Validate each action
      for (const action of plan.actions) {
        this.validateAction(action);
      }

      // Validate summary matches actions
      if (plan.summary.total_actions !== plan.actions.length) {
        console.warn('[PlanningEngine] Summary mismatch: correcting total_actions');
        plan.summary.total_actions = plan.actions.length;
      }

      console.log(`[PlanningEngine] Plan validated: ${plan.actions.length} actions`);
      return plan;

    } catch (error) {
      console.error('[PlanningEngine] Failed to parse plan JSON:', error);
      throw new Error(`Invalid JSON response from Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate single action structure
   */
  private validateAction(action: Action): void {
    if (!action.id) throw new Error('Action missing ID');
    if (!action.type) throw new Error('Action missing type');
    if (!action.params) throw new Error('Action missing params');
    if (!action.description) throw new Error('Action missing description');
    if (!action.depends_on) action.depends_on = []; // Default to empty array
    if (typeof action.estimated_time_ms !== 'number') action.estimated_time_ms = 100; // Default

    // Validate action type
    const validTypes: ActionType[] = ['create_folder', 'move_file', 'move_files_batch', 'rename_file', 'copy_file'];
    if (!validTypes.includes(action.type)) {
      throw new Error(`Invalid action type: ${action.type}`);
    }
  }

  /**
   * Stage 2: Verify plan safety with deep analysis
   * Uses high thinking level for thorough safety checks
   */
  async verifySafety(
    plan: ActionPlan,
    input: PlanningInput,
    stage1_signature: string
  ): Promise<SafetyVerificationResult> {
    console.log('[PlanningEngine] Starting Stage 2: Safety Verification');
    console.log('[PlanningEngine] Using high thinking level for deep analysis');

    const startTime = Date.now();

    // Step 1: Run programmatic safety checks
    const programmaticChecks = this.runProgrammaticChecks(plan, input);
    console.log('[PlanningEngine] Programmatic checks:', programmaticChecks);

    // Step 2: Generate AI safety analysis with Gemini (high thinking)
    const aiAnalysis = await this.runAISafetyAnalysis(plan, input, stage1_signature);
    console.log('[PlanningEngine] AI safety analysis complete');

    // Step 3: Merge programmatic and AI checks
    const safetyReport = this.mergeSafetyAnalyses(programmaticChecks, aiAnalysis.analysis);

    // Step 4: Return complete safety verification result
    return {
      safety_report: safetyReport,
      thought_signature: aiAnalysis.thought_signature,
      metadata: {
        stage: 'safety_verification',
        thinking_level: 'high',
        latency_ms: Date.now() - startTime,
        tokens_used: aiAnalysis.tokens_used,
        programmatic_checks: 6, // Number of programmatic checks
        ai_checks: 1
      }
    };
  }

  /**
   * Run programmatic safety checks
   */
  private runProgrammaticChecks(plan: ActionPlan, input: PlanningInput): SafetyReport['checks'] {
    return {
      circular_dependencies: this.detectCircularDependencies(plan.actions),
      protected_paths: this.checkProtectedPaths(plan.actions, input.targetFolder),
      file_conflicts: this.detectFileConflicts(plan.actions),
      disk_space: this.checkDiskSpace(plan.actions, input.scannedFiles),
      data_loss_risk: this.checkDataLossRisk(plan.actions),
      permission_issues: this.checkPermissionIssues(plan.actions, input.targetFolder)
    };
  }

  /**
   * Detect circular dependencies in action graph
   */
  private detectCircularDependencies(actions: Action[]): SafetyCheck {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build dependency graph
    for (const action of actions) {
      graph.set(action.id, action.depends_on || []);
    }

    // DFS to detect cycles
    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check all nodes
    for (const action of actions) {
      if (hasCycle(action.id)) {
        return {
          passed: false,
          issue: 'Circular dependency detected in action graph',
          severity: 'critical'
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check for protected system paths
   */
  private checkProtectedPaths(actions: Action[], _targetFolder: string): SafetyCheck {
    const protectedPaths = [
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      '/System',
      '/usr',
      '/bin',
      '/sbin'
    ];

    for (const action of actions) {
      const paths = [
        action.params.path,
        action.params.source,
        action.params.destination
      ].filter(Boolean);

      for (const p of paths) {
        const normalized = path.normalize(p as string).toLowerCase();
        for (const protected_path of protectedPaths) {
          if (normalized.startsWith(protected_path.toLowerCase())) {
            return {
              passed: false,
              issue: `Action ${action.id} targets protected system path: ${p}`,
              severity: 'critical'
            };
          }
        }
      }
    }

    return { passed: true };
  }

  /**
   * Detect file naming conflicts
   */
  private detectFileConflicts(actions: Action[]): SafetyCheck {
    const destinationMap = new Map<string, string[]>();

    for (const action of actions) {
      if (action.type === 'move_file' || action.type === 'copy_file') {
        const dest = action.params.destination as string;
        if (!destinationMap.has(dest)) {
          destinationMap.set(dest, []);
        }
        destinationMap.get(dest)!.push(action.id);
      }
    }

    // Check for multiple files to same destination
    for (const [dest, actionIds] of destinationMap) {
      if (actionIds.length > 1) {
        return {
          passed: false,
          issue: `Multiple files being moved to same destination: ${dest}`,
          severity: 'high'
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check disk space requirements
   */
  private checkDiskSpace(actions: Action[], files: FileMetadata[]): SafetyCheck {
    // Calculate total file size
    const totalSize = files
      .filter(f => !f.isDirectory)
      .reduce((sum, f) => sum + f.size, 0);

    // Estimate required space (copy operations need more space)
    const copyActions = actions.filter(a => a.type === 'copy_file').length;
    const estimatedRequired = totalSize + (copyActions * 1024 * 1024); // Add 1MB buffer per copy

    // For now, we can't check actual disk space in this context
    // This would require OS-specific calls or additional dependencies
    // For demo purposes, we'll pass if estimated < 10GB
    if (estimatedRequired > 10 * 1024 * 1024 * 1024) {
      return {
        passed: false,
        issue: `Plan requires significant disk space: ${(estimatedRequired / 1024 / 1024).toFixed(2)} MB`,
        severity: 'medium'
      };
    }

    return { passed: true };
  }

  /**
   * Check for data loss risks
   */
  private checkDataLossRisk(actions: Action[]): SafetyCheck {
    // Check for any delete operations (should never happen per safety rules)
    const hasDelete = actions.some(a => a.type.includes('delete'));
    if (hasDelete) {
      return {
        passed: false,
        issue: 'Plan contains delete operations - violates safety rules',
        severity: 'critical'
      };
    }

    // Check for overwrites without backup
    const moveActions = actions.filter(a => a.type === 'move_file');
    // This is simplified - in production we'd check if destination already exists
    if (moveActions.length > 50) {
      return {
        passed: false,
        issue: 'Too many move operations increases risk of data loss',
        severity: 'medium'
      };
    }

    return { passed: true };
  }

  /**
   * Check for permission issues
   */
  private checkPermissionIssues(actions: Action[], targetFolder: string): SafetyCheck {
    // Check if all actions are within the allowed target folder
    for (const action of actions) {
      const paths = [
        action.params.path,
        action.params.source,
        action.params.destination
      ].filter(Boolean);

      for (const p of paths) {
        const normalized = path.normalize(p as string);
        if (!normalized.startsWith(targetFolder)) {
          return {
            passed: false,
            issue: `Action ${action.id} attempts to access path outside target folder: ${p}`,
            severity: 'high'
          };
        }
      }
    }

    return { passed: true };
  }

  /**
   * Run AI-powered safety analysis with Gemini (high thinking)
   */
  private async runAISafetyAnalysis(
    plan: ActionPlan,
    input: PlanningInput,
    stage1_signature: string
  ): Promise<{ analysis: string; thought_signature: string; tokens_used: number }> {
    const prompt = this.buildSafetyAnalysisPrompt(plan, input);

    console.log('[PlanningEngine] Calling Gemini for safety analysis (thinking_level: high)...');
    const geminiResponse = await this.geminiClient.generate({
      prompt,
      thinking_level: 'high',
      thought_signature: stage1_signature, // Reasoning continuity from Stage 1
      output_format: 'json',
      temperature: 0.2, // Lower for more consistent safety analysis
      max_tokens: 2000
    });

    return {
      analysis: geminiResponse.text,
      thought_signature: geminiResponse.thought_signature || '',
      tokens_used: geminiResponse.tokens_used
    };
  }

  /**
   * Build Gemini prompt for safety analysis
   */
  private buildSafetyAnalysisPrompt(plan: ActionPlan, input: PlanningInput): string {
    return `You are a file system safety expert. Analyze this action plan for potential risks and issues.

**ORIGINAL USER INTENT:**
"${input.userIntent}"

**ACTION PLAN TO VERIFY:**
${JSON.stringify(plan, null, 2)}

**TARGET FOLDER:**
${input.targetFolder}

**SAFETY ANALYSIS REQUIREMENTS:**

Analyze the plan for these risks:
1. **Data Loss Risk:** Could any files be permanently lost?
2. **Permission Issues:** Are all paths accessible and writable?
3. **File Conflicts:** Will any files overwrite existing files?
4. **Circular Dependencies:** Do action dependencies form cycles?
5. **Disk Space:** Is there enough space for all operations?
6. **Unintended Consequences:** Could this plan harm the user's file system?

**OUTPUT JSON SCHEMA:**
{
  "overall_risk": "safe" | "low" | "medium" | "high" | "critical",
  "is_safe": true | false,
  "issues": [
    {
      "type": "data_loss" | "permission" | "conflict" | "dependency" | "space" | "other",
      "severity": "safe" | "low" | "medium" | "high" | "critical",
      "description": "Detailed description of the issue",
      "affected_actions": ["action_001", "action_002"]
    }
  ],
  "ai_analysis": "Comprehensive analysis of the plan's safety"
}

**SAFETY RULES TO VERIFY:**
- No permanent deletions (files should only be moved)
- Folders must be created before files are moved into them
- File name conflicts should be handled (not overwrite silently)
- All paths must be within the target folder
- Dependencies must not form cycles

**NOW ANALYZE THE PLAN:**
Provide a thorough safety analysis in JSON format.`;
  }

  /**
   * Merge programmatic checks with AI analysis
   */
  private mergeSafetyAnalyses(
    programmaticChecks: SafetyReport['checks'],
    aiAnalysisJson: string
  ): SafetyReport {
    let aiAnalysis: any = {};
    try {
      aiAnalysis = JSON.parse(aiAnalysisJson);
    } catch (error) {
      console.error('[PlanningEngine] Failed to parse AI safety analysis:', error);
      aiAnalysis = {
        overall_risk: 'medium',
        is_safe: true,
        issues: [],
        ai_analysis: 'AI analysis failed to parse'
      };
    }

    // Combine issues from programmatic and AI checks
    const allIssues = [...(aiAnalysis.issues || [])];

    // Add programmatic check failures as issues
    for (const [checkName, check] of Object.entries(programmaticChecks)) {
      if (!check.passed && check.issue) {
        allIssues.push({
          type: checkName,
          severity: check.severity || 'medium',
          description: check.issue,
          affected_actions: []
        });
      }
    }

    // Determine overall risk level (highest severity wins)
    const severityLevels: RiskLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];
    let overallRisk: RiskLevel = 'safe';
    for (const issue of allIssues) {
      const issueIndex = severityLevels.indexOf(issue.severity);
      const currentIndex = severityLevels.indexOf(overallRisk);
      if (issueIndex > currentIndex) {
        overallRisk = issue.severity;
      }
    }

    // Plan is safe only if no critical/high issues and AI agrees
    const isSafe = overallRisk !== 'critical' &&
                   overallRisk !== 'high' &&
                   (aiAnalysis.is_safe !== false);

    return {
      overall_risk: overallRisk,
      is_safe: isSafe,
      issues: allIssues,
      checks: programmaticChecks,
      ai_analysis: aiAnalysis.ai_analysis || 'No AI analysis available'
    };
  }

  /**
   * Stage 3: Generate undo plan with careful inversion logic
   * Uses high thinking level for complex undo scenarios
   */
  async generateUndoPlan(
    plan: ActionPlan,
    input: PlanningInput,
    stage2_signature: string
  ): Promise<UndoGenerationResult> {
    console.log('[PlanningEngine] Starting Stage 3: Undo Plan Generation');
    console.log('[PlanningEngine] Using high thinking level for careful inversion');

    const startTime = Date.now();

    // Step 1: Generate deterministic undo actions (fast, reliable)
    const undoActions = this.generateDeterministicUndo(plan.actions);
    console.log(`[PlanningEngine] Generated ${undoActions.length} deterministic undo actions`);

    // Step 2: Enhance with AI for complex cases (optional but recommended)
    const aiEnhancement = await this.enhanceUndoWithAI(plan, undoActions, input, stage2_signature);
    console.log('[PlanningEngine] AI enhancement complete');

    // Step 3: Create checkpoint metadata for fallback recovery
    const checkpoint = this.createCheckpoint(plan, input);
    console.log(`[PlanningEngine] Checkpoint created: ${checkpoint.checkpoint_id}`);

    // Step 4: Build complete undo plan
    const undoPlan: UndoPlan = {
      undo_plan_id: `undo_${Date.now()}`,
      original_plan_id: plan.plan_id,
      undo_actions: aiEnhancement.enhanced_actions || undoActions,
      checkpoint: checkpoint,
      deterministic: true
    };

    return {
      undo_plan: undoPlan,
      thought_signature: aiEnhancement.thought_signature,
      metadata: {
        stage: 'undo_generation',
        thinking_level: 'high',
        latency_ms: Date.now() - startTime,
        tokens_used: aiEnhancement.tokens_used,
        deterministic_actions: undoActions.length,
        ai_enhanced: aiEnhancement.enhanced
      }
    };
  }

  /**
   * Generate deterministic undo actions by inverting each operation
   */
  private generateDeterministicUndo(actions: Action[]): Action[] {
    // Reverse action order (undo last action first)
    const reversedActions = [...actions].reverse();
    const undoActions: Action[] = [];

    for (let i = 0; i < reversedActions.length; i++) {
      const action = reversedActions[i];
      const undoAction = this.invertAction(action, i);
      if (undoAction) {
        undoActions.push(undoAction);
      }
    }

    return undoActions;
  }

  /**
   * Invert a single action to create its undo operation
   */
  private invertAction(action: Action, index: number): Action | null {
    const undoId = `undo_${String(index + 1).padStart(3, '0')}`;

    switch (action.type) {
      case 'create_folder':
        // Undo: Delete the created folder
        return {
          id: undoId,
          type: 'create_folder', // We use a special marker, not actual delete
          params: {
            path: action.params.path,
            undo_operation: 'remove_folder'
          },
          description: `[UNDO] Remove folder: ${action.params.path}`,
          depends_on: [],
          estimated_time_ms: 50
        };

      case 'move_file':
        // Undo: Move file back to original location
        return {
          id: undoId,
          type: 'move_file',
          params: {
            source: action.params.destination, // Swap source and destination
            destination: action.params.source
          },
          description: `[UNDO] Move ${path.basename(action.params.source as string)} back to original location`,
          depends_on: [],
          estimated_time_ms: action.estimated_time_ms
        };

      case 'move_files_batch':
        // Undo: Move all files back to their original locations
        return {
          id: undoId,
          type: 'move_files_batch',
          params: {
            files: action.params.files,
            source: action.params.destination, // Swap source and destination
            destination: action.params.source || action.params.original_location
          },
          description: `[UNDO] Move ${(action.params.files as string[]).length} files back to original location`,
          depends_on: [],
          estimated_time_ms: action.estimated_time_ms
        };

      case 'rename_file':
        // Undo: Rename back to original name
        return {
          id: undoId,
          type: 'rename_file',
          params: {
            path: action.params.new_path || action.params.path,
            new_name: action.params.original_name || path.basename(action.params.path as string),
            old_name: action.params.new_name
          },
          description: `[UNDO] Rename ${action.params.new_name} back to ${action.params.original_name}`,
          depends_on: [],
          estimated_time_ms: 50
        };

      case 'copy_file':
        // Undo: Delete the copied file (keep original)
        return {
          id: undoId,
          type: 'move_file', // Use move to simulate delete (move to temp)
          params: {
            source: action.params.destination,
            destination: action.params.destination + '.deleted',
            undo_operation: 'remove_copy'
          },
          description: `[UNDO] Remove copied file: ${action.params.destination}`,
          depends_on: [],
          estimated_time_ms: 50
        };

      default:
        console.warn(`[PlanningEngine] Unknown action type for undo: ${action.type}`);
        return null;
    }
  }

  /**
   * Enhance undo plan with AI for complex scenarios
   */
  private async enhanceUndoWithAI(
    originalPlan: ActionPlan,
    deterministicUndo: Action[],
    input: PlanningInput,
    stage2_signature: string
  ): Promise<{ enhanced_actions?: Action[]; thought_signature: string; tokens_used: number; enhanced: boolean }> {
    const prompt = this.buildUndoEnhancementPrompt(originalPlan, deterministicUndo, input);

    try {
      console.log('[PlanningEngine] Calling Gemini for undo enhancement (thinking_level: high)...');
      const geminiResponse = await this.geminiClient.generate({
        prompt,
        thinking_level: 'high',
        thought_signature: stage2_signature, // Full context from Stage 2
        output_format: 'json',
        temperature: 0.2,
        max_tokens: 3000
      });

      const enhancedPlan = JSON.parse(geminiResponse.text);

      // Validate enhanced undo plan
      if (enhancedPlan.undo_actions && Array.isArray(enhancedPlan.undo_actions)) {
        console.log('[PlanningEngine] AI successfully enhanced undo plan');
        return {
          enhanced_actions: enhancedPlan.undo_actions,
          thought_signature: geminiResponse.thought_signature || '',
          tokens_used: geminiResponse.tokens_used,
          enhanced: true
        };
      }

      // Fallback to deterministic if AI enhancement failed
      console.warn('[PlanningEngine] AI enhancement invalid, using deterministic undo');
      return {
        thought_signature: geminiResponse.thought_signature || '',
        tokens_used: geminiResponse.tokens_used,
        enhanced: false
      };

    } catch (error) {
      console.error('[PlanningEngine] AI undo enhancement failed:', error);
      return {
        thought_signature: stage2_signature,
        tokens_used: 0,
        enhanced: false
      };
    }
  }

  /**
   * Build Gemini prompt for undo plan enhancement
   */
  private buildUndoEnhancementPrompt(
    originalPlan: ActionPlan,
    deterministicUndo: Action[],
    input: PlanningInput
  ): string {
    return `You are a file system recovery expert. Review and enhance this undo plan to ensure perfect reversibility.

**ORIGINAL ACTION PLAN:**
${JSON.stringify(originalPlan, null, 2)}

**DETERMINISTIC UNDO PLAN (GENERATED):**
${JSON.stringify(deterministicUndo, null, 2)}

**USER INTENT (ORIGINAL):**
"${input.userIntent}"

**YOUR TASK:**
Verify the undo plan is correct and enhance it if needed. Consider:

1. **Correctness:** Does each undo action perfectly reverse its corresponding forward action?
2. **Order:** Are undo actions in the correct order (reverse of forward actions)?
3. **Dependencies:** Do undo actions have correct dependencies?
4. **Edge Cases:** Are there any scenarios where the undo might fail?
5. **Data Preservation:** Will the undo fully restore the original state?

**ENHANCEMENT OPPORTUNITIES:**
- Add error handling for missing files
- Handle cases where folders were modified after creation
- Account for permission changes
- Consider file conflicts during undo
- Add validation steps before each undo action

**OUTPUT JSON SCHEMA:**
{
  "undo_actions": [
    {
      "id": "undo_001",
      "type": "move_file" | "create_folder" | etc.,
      "params": {...},
      "description": "Human-readable description",
      "depends_on": [],
      "estimated_time_ms": 100,
      "validation": "Optional validation step before executing"
    }
  ],
  "enhancement_notes": "Explanation of enhancements made",
  "confidence": 0.95
}

**NOW ENHANCE THE UNDO PLAN:**
Return an improved undo plan in JSON format. If the deterministic plan is perfect, return it unchanged.`;
  }

  /**
   * Create checkpoint metadata for fallback recovery
   */
  private createCheckpoint(plan: ActionPlan, input: PlanningInput): Checkpoint {
    const checkpointId = `checkpoint_${Date.now()}`;

    // Create file snapshot (metadata only, not actual file copies)
    const fileSnapshot = input.scannedFiles
      .filter(f => !f.isDirectory)
      .map(f => ({
        path: f.path,
        size: f.size,
        modified: f.modified
      }));

    return {
      checkpoint_id: checkpointId,
      plan_id: plan.plan_id,
      timestamp: new Date().toISOString(),
      target_folder: input.targetFolder,
      file_snapshot: fileSnapshot
    };
  }

  /**
   * COMPLETE PIPELINE: Generate full action plan with all 3 stages
   * This is the main entry point for F2
   */
  async generateCompletePlan(input: PlanningInput): Promise<CompletePlanOutput> {
    console.log('='.repeat(80));
    console.log('[PlanningEngine] Starting Complete 3-Stage Pipeline');
    console.log('[PlanningEngine] Target:', input.targetFolder);
    console.log('[PlanningEngine] Files:', input.scannedFiles.length);
    console.log('[PlanningEngine] Intent:', input.userIntent);
    console.log('='.repeat(80));

    const pipelineStartTime = Date.now();

    // Stage 1: Draft Planning (low thinking, ~800ms)
    console.log('\n[Stage 1/3] Draft Planning (thinking_level: low)');
    const stage1 = await this.generateDraftPlan(input);
    console.log(`[Stage 1/3] ✓ Complete in ${stage1.metadata.latency_ms}ms`);
    console.log(`[Stage 1/3] Actions: ${stage1.plan.actions.length}, Tokens: ${stage1.metadata.tokens_used}`);

    // Stage 2: Safety Verification (high thinking, ~3s)
    console.log('\n[Stage 2/3] Safety Verification (thinking_level: high)');
    const stage2 = await this.verifySafety(
      stage1.plan,
      input,
      stage1.thought_signature
    );
    console.log(`[Stage 2/3] ✓ Complete in ${stage2.metadata.latency_ms}ms`);
    console.log(`[Stage 2/3] Risk: ${stage2.safety_report.overall_risk}, Safe: ${stage2.safety_report.is_safe}`);
    console.log(`[Stage 2/3] Issues: ${stage2.safety_report.issues.length}, Tokens: ${stage2.metadata.tokens_used}`);

    // Check if plan is safe before generating undo
    if (!stage2.safety_report.is_safe) {
      console.error('[PlanningEngine] ❌ Plan failed safety verification');
      console.error('[PlanningEngine] Risk level:', stage2.safety_report.overall_risk);
      console.error('[PlanningEngine] Issues:', stage2.safety_report.issues);
      throw new Error(`Plan failed safety verification: ${stage2.safety_report.overall_risk} risk level`);
    }

    // Stage 3: Undo Generation (high thinking, ~2s)
    console.log('\n[Stage 3/3] Undo Generation (thinking_level: high)');
    const stage3 = await this.generateUndoPlan(
      stage1.plan,
      input,
      stage2.thought_signature
    );
    console.log(`[Stage 3/3] ✓ Complete in ${stage3.metadata.latency_ms}ms`);
    console.log(`[Stage 3/3] Undo Actions: ${stage3.undo_plan.undo_actions.length}, Tokens: ${stage3.metadata.tokens_used}`);

    // Calculate total metrics
    const totalTime = Date.now() - pipelineStartTime;
    const totalTokens = stage1.metadata.tokens_used +
                       stage2.metadata.tokens_used +
                       stage3.metadata.tokens_used;

    console.log('\n' + '='.repeat(80));
    console.log('[PlanningEngine] ✓ Pipeline Complete!');
    console.log(`[PlanningEngine] Total Time: ${totalTime}ms (~${(totalTime / 1000).toFixed(1)}s)`);
    console.log(`[PlanningEngine] Total Tokens: ${totalTokens}`);
    console.log(`[PlanningEngine] Thought Signature Chain: Stage1 → Stage2 → Stage3 ✓`);
    console.log('='.repeat(80));

    // Verify timing targets (log warnings if exceeded)
    if (stage1.metadata.latency_ms > 1000) {
      console.warn(`[PlanningEngine] ⚠ Stage 1 exceeded target: ${stage1.metadata.latency_ms}ms > 1000ms`);
    }
    if (stage2.metadata.latency_ms > 3500) {
      console.warn(`[PlanningEngine] ⚠ Stage 2 exceeded target: ${stage2.metadata.latency_ms}ms > 3500ms`);
    }
    if (stage3.metadata.latency_ms > 2500) {
      console.warn(`[PlanningEngine] ⚠ Stage 3 exceeded target: ${stage3.metadata.latency_ms}ms > 2500ms`);
    }
    if (totalTime > 7000) {
      console.warn(`[PlanningEngine] ⚠ Total pipeline exceeded target: ${totalTime}ms > 7000ms`);
    }

    // Build complete output
    return {
      plan_id: stage1.plan.plan_id,
      actions: stage1.plan.actions,
      undo_plan: stage3.undo_plan,
      safety_analysis: stage2.safety_report,
      summary: stage1.plan.summary,
      gemini_metadata: {
        stage1_thinking_level: 'low',
        stage1_signature: stage1.thought_signature,
        stage1_latency_ms: stage1.metadata.latency_ms,
        stage1_tokens: stage1.metadata.tokens_used,
        stage2_thinking_level: 'high',
        stage2_signature: stage2.thought_signature,
        stage2_latency_ms: stage2.metadata.latency_ms,
        stage2_tokens: stage2.metadata.tokens_used,
        stage3_thinking_level: 'high',
        stage3_signature: stage3.thought_signature,
        stage3_latency_ms: stage3.metadata.latency_ms,
        stage3_tokens: stage3.metadata.tokens_used,
        total_time_ms: totalTime,
        total_tokens: totalTokens
      }
    };
  }
}

// Singleton instance
let planningEngineInstance: PlanningEngine | null = null;

/**
 * Get or create PlanningEngine singleton
 */
export function getPlanningEngine(): PlanningEngine {
  if (!planningEngineInstance) {
    planningEngineInstance = new PlanningEngine();
  }
  return planningEngineInstance;
}
