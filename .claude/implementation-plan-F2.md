# Implementation Plan: F2 - AI-Powered Planning with Multi-Level Reasoning
**Backtrack Desktop App - Gemini 3 Hackathon**

**Timeline:** Day 3 (8 hours)  
**Tech Stack:** Gemini 3 API | TypeScript | Node.js | JSON Schema Validation  
**Claude Code Assistance:** Heavy - 70% code generation expected

---

## 🎯 Implementation Context

### Feature Summary
F2 is the **intelligent core** of Backtrack - it transforms natural language user intent into precise, executable action plans. Using Gemini 3's unique multi-level reasoning capabilities (thinking levels, thought signatures, 1M context), F2 generates structured JSON action graphs that are safe, reversible, and optimized for file organization.

**This is THE feature that showcases Gemini 3's power and wins the hackathon.**

### User Workflow Overview
1. F1 hands off clarified user intent + scanned file list
2. F2 Stage 1: Generate initial plan (thinking_level: low, ~800ms)
3. F2 Stage 2: Verify safety deeply (thinking_level: high, ~3s)
4. F2 Stage 3: Generate undo plan (thinking_level: high, ~2s)
5. F2 returns complete action plan to F3 for preview
6. Total time: ~5-6 seconds for 35-file organization

### Technical Context

**Three-Stage Pipeline (Gemini 3 Showcase):**

```
Stage 1: Draft Planning
├─ Input: User intent + file context
├─ Gemini: thinking_level: 'low' (speed)
├─ Output: Initial action graph JSON
└─ Time: ~800ms

Stage 2: Safety Verification  
├─ Input: Draft plan + thought_signature from Stage 1
├─ Gemini: thinking_level: 'high' (thoroughness)
├─ Output: Safety analysis + risk level
└─ Time: ~3000ms

Stage 3: Undo Generation
├─ Input: Verified plan + thought_signature from Stage 2
├─ Gemini: thinking_level: 'high' (careful inversion)
├─ Output: Complete undo plan
└─ Time: ~2000ms

Total: ~6 seconds (acceptable for hackathon demo)
```

**Key Gemini 3 Features Used:**
1. **Thinking Levels** - Low for speed, High for safety/undo
2. **Thought Signatures** - Reasoning continuity across 3 calls
3. **1M Context Window** - Entire file system + history in one call
4. **Structured Outputs** - Guaranteed valid JSON action graphs

### Success Criteria
- ✅ Stage 1 completes in <1000ms
- ✅ Stage 2 catches safety issues
- ✅ Stage 3 generates perfect inverse operations
- ✅ Thought signatures chain correctly
- ✅ JSON output is always valid
- ✅ Complete pipeline: 5-7 seconds for 35 files

---

## 📋 Implementation Tasks - Day 3

### Morning Session (4 hours): Gemini Integration + Stage 1

#### 1. Create Gemini API Client with Thinking Levels ✅ COMPLETE

- [x] Gemini SDK already installed from F1

- [x] Enhanced existing `src/main/services/gemini-client.ts` with:
  ```typescript
  import { GoogleGenerativeAI } from '@google/generative-ai';
  
  interface GeminiRequest {
    prompt: string;
    thinking_level: 'low' | 'high';
    output_format?: 'json' | 'text';
    temperature?: number;
    thought_signature?: string;
  }
  
  interface GeminiResponse {
    text: string;
    thought_signature: string;
    tokens_used: number;
    latency_ms: number;
  }
  
  export class GeminiClient {
    private model: any;
    
    constructor(apiKey: string) {
      const client = new GoogleGenerativeAI(apiKey);
      this.model = client.getGenerativeModel({ 
        model: 'gemini-2.0-flash-thinking-exp-01-21'
      });
    }
    
    async generate(request: GeminiRequest): Promise<GeminiResponse> {
      const startTime = Date.now();
      
      const response = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig: {
          thinkingConfig: { mode: request.thinking_level },
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: 4000,
          responseMimeType: request.output_format === 'json' ? 'application/json' : 'text/plain'
        }
      });
      
      return {
        text: response.response.text(),
        thought_signature: response.response.candidates[0].thinkingSignature,
        tokens_used: response.response.usageMetadata.totalTokenCount,
        latency_ms: Date.now() - startTime
      };
    }
  }
  ```

- [x] Added `GeminiRequest` and `GeminiResponse` interfaces
- [x] Implemented `generate()` method with thinking level support ('low' | 'high')
- [x] Added thought signature extraction from response
- [x] Implemented token usage and latency tracking
- [x] Error handling: API key validation, timeouts (30s), retry logic
- [x] Retry logic: 3 attempts with exponential backoff (2s, 4s, 8s)
- [x] Supports both JSON and text output formats
- [x] Ready for F2 3-stage pipeline integration

#### 2. Create Planning Engine - Stage 1 (Draft Planning) ✅ COMPLETE

- [x] Created file: `src/main/services/planning-engine.ts`

- [x] Defined TypeScript interfaces:
  ```typescript
  interface Action {
    id: string;
    type: 'create_folder' | 'move_file' | 'move_files_batch' | 'rename_file';
    params: Record<string, any>;
    description: string;
    depends_on: string[];
    estimated_time_ms: number;
  }
  
  interface ActionPlan {
    plan_id: string;
    actions: Action[];
    summary: {
      total_actions: number;
      files_affected: number;
      folders_created: number;
    };
  }
  ```

- [x] Implemented input validation:
  - [x] Check file count ≤ 50 (throws clear error)
  - [x] Check files exist (non-empty validation)
  - [x] Check target folder specified
  - [x] Clear error messages for all validation failures

- [x] Implemented file pattern analysis:
  - [x] Group files by extension (byExtension map)
  - [x] Identify special patterns (tax_docs, work_files, personal_files, media_files)
  - [x] Detect existing folder structure (existingStructure array)
  - [x] Count total files and folders

- [x] Generated comprehensive Gemini prompt with:
  - [x] User intent clearly stated
  - [x] Complete file breakdown (by extension, patterns, existing structure)
  - [x] Safety rules (5 critical rules: no delete, create folders first, handle conflicts, preserve metadata, dependency order)
  - [x] JSON schema for output (detailed structure)
  - [x] Two few-shot examples (organize by type, organize by date)

- [x] Call Gemini with `thinking_level: 'low'` for speed (~800ms target)
- [x] Parse JSON response and validate against schema (comprehensive validation)
- [x] Store thought_signature for Stage 2 continuity
- [x] Return draft plan + metadata (includes latency, tokens, file patterns)

### Afternoon Session (4 hours): Stage 2 Safety + Stage 3 Undo

#### 3. Implement Stage 2: Safety Verification ✅ COMPLETE

- [x] Created `verifySafety()` method in planning-engine.ts

- [x] Generated comprehensive safety prompt asking Gemini to analyze:
  - [x] Data loss risks (check for delete operations, excessive moves)
  - [x] Permission issues (paths outside target folder)
  - [x] File conflicts (multiple files to same destination)
  - [x] Circular dependencies (DFS cycle detection)
  - [x] Disk space constraints (size estimation)
  - [x] Protected system paths (Windows/Linux system folders)

- [x] Call Gemini with:
  - [x] `thinking_level: 'high'` for thorough analysis (~3s)
  - [x] `thought_signature` from Stage 1 for reasoning continuity
  - [x] `output_format: 'json'` for structured safety report
  - [x] Temperature 0.2 for consistent safety judgments

- [x] Implemented 6 programmatic safety checks:
  - [x] `detectCircularDependencies()` - DFS graph traversal to find cycles
  - [x] `checkProtectedPaths()` - Prevent access to system folders
  - [x] `detectFileConflicts()` - Track destination paths for duplicates
  - [x] `checkDiskSpace()` - Estimate space requirements
  - [x] `checkDataLossRisk()` - Flag delete operations and excessive moves
  - [x] `checkPermissionIssues()` - Ensure all paths within target folder

- [x] Merged AI safety analysis with programmatic checks
  - [x] Combined issues from both sources
  - [x] Determined overall risk level (highest severity wins)
  - [x] is_safe flag based on critical/high issues
- [x] Return SafetyReport with risk level, issues, checks, AI analysis
- [x] Store thought_signature for Stage 3 continuity

#### 4. Implement Stage 3: Undo Plan Generation ✅ COMPLETE

- [x] Created deterministic undo generator:
  - [x] Implemented `generateDeterministicUndo()` - reverses action order
  - [x] Implemented `invertAction()` for each action type:
    - [x] create_folder → remove_folder (marked for deletion)
    - [x] move_file → move_file (swap source/destination)
    - [x] move_files_batch → move_files_batch (batch reverse)
    - [x] rename_file → rename_file (restore original name)
    - [x] copy_file → remove_copy (delete copied file)
  - [x] All undo actions have proper params, descriptions, dependencies

- [x] Called Gemini for AI-enhanced undo (optional but recommended):
  - [x] `thinking_level: 'high'` for careful inversion (~2s)
  - [x] `thought_signature` from Stage 2 for full context
  - [x] Generate inverse operations for entire plan
  - [x] AI reviews deterministic undo for correctness
  - [x] AI adds validation steps and error handling
  - [x] Fallback to deterministic if AI enhancement fails

- [x] Created checkpoint metadata for fallback recovery:
  - [x] Unique checkpoint_id with timestamp
  - [x] References original plan_id
  - [x] File snapshot with paths, sizes, modified times
  - [x] Target folder reference
  - [x] Timestamp for audit trail

- [x] Return UndoPlan with:
  - [x] undo_plan_id, original_plan_id
  - [x] Array of undo actions (enhanced or deterministic)
  - [x] Checkpoint metadata
  - [x] deterministic flag
  - [x] Thought signature for Stage 3

#### 5. Integration & Testing ✅ COMPLETE

- [x] Created complete pipeline orchestration:
  - [x] Implemented `generateCompletePlan()` in PlanningEngine
  - [x] Orchestrates all 3 stages sequentially
  - [x] Passes thought signatures between stages (Stage1 → Stage2 → Stage3)
  - [x] Validates safety before proceeding to undo generation
  - [x] Tracks total time and token usage
  - [x] Returns CompletePlanOutput with all metadata

- [x] Added IPC handler: `generate-plan`
  - [x] Created `src/main/ipc/planning-handlers.ts`
  - [x] Registered in `main.ts` setupIPC()
  - [x] Exposed via preload.ts as `window.api.generatePlan()`
  - [x] Added TypeScript types for PlanningInput and PlanResult
  - [x] Error handling with success/error response format

- [x] Created renderer store for planning state
  - [x] Created `src/renderer/store/planningStore.ts`
  - [x] Zustand store with persist middleware
  - [x] Tracks: currentPlan, isGenerating, generationStage, error
  - [x] Actions: startPlanGeneration, setGenerationStage, setPlan, setError, clearPlan, reset
  - [x] Stage tracking: idle → stage1 → stage2 → stage3 → complete/error

- [x] Complete F1 → F2 integration ready
  - [x] F1 handoff data structure matches PlanningInput
  - [x] IPC bridge complete (main ↔ renderer)
  - [x] State management ready for UI

- [x] Timing verification built-in:
  - [x] Logs individual stage timings
  - [x] Warns if Stage 1 > 1000ms
  - [x] Warns if Stage 2 > 3500ms
  - [x] Warns if Stage 3 > 2500ms
  - [x] Warns if Total > 7000ms

- [x] Thought signature chaining verified:
  - [x] Stage 1 signature → Stage 2
  - [x] Stage 2 signature → Stage 3
  - [x] All signatures logged for debugging
  - [x] Full reasoning continuity across pipeline

- [x] Production-ready features:
  - [x] Comprehensive logging with visual separators
  - [x] Error handling at each stage
  - [x] Metrics tracking (time, tokens, actions)
  - [x] Safety validation before undo generation
  - [x] TypeScript types throughout

---

## 🎯 Day 3 Completion Criteria

F2 is complete when:
- ✅ Gemini client works with thinking levels
- ✅ 3-stage pipeline executes successfully
- ✅ Thought signatures chain correctly
- ✅ Safety verification catches issues
- ✅ Undo plan is generated
- ✅ Complete pipeline: 5-7 seconds for 35 files
- ✅ JSON output is always valid
- ✅ Ready to hand off to F3!

**This is your Gemini 3 showcase - make it impressive!** 🌟
