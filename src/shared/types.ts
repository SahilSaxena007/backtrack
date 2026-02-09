// Shared types between main and renderer processes

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  extension: string;
  modified: string;
  created: string;
  isDirectory: boolean;
}

export interface ScanResult {
  success: boolean;
  files?: FileMetadata[];
  error?: string;
}

export interface ValidationResult {
  success: boolean;
  exists: boolean;
  isDirectory: boolean;
  error?: string;
}

export interface ParsedIntent {
  target: string;
  action: 'organize' | 'find' | 'create' | 'delete' | 'unknown';
  method: 'by_type' | 'by_date' | 'by_name' | 'unknown';
  constraints: string[];
  conflicts: string[];
  clarityScore: number;
  needsClarification: boolean;
}

export interface IntentResult {
  success: boolean;
  intent?: ParsedIntent;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    thinking_level?: 'low' | 'high';
    thought_signature?: string;
    tokens_used?: number;
  };
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// F2 to F3 handoff types (visual preview)
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface Action {
  id: string;
  type: string;
  params: Record<string, any>;
  description: string;
  depends_on: string[];
  estimated_time_ms: number;
}

export interface SafetyCheck {
  passed: boolean;
  issue?: string;
  severity?: RiskLevel;
}

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

export interface UndoPlan {
  undo_plan_id: string;
  original_plan_id: string;
  undo_actions: Action[];
  checkpoint: {
    checkpoint_id: string;
    plan_id: string;
    timestamp: string;
    target_folder: string;
    file_snapshot: Array<{
      path: string;
      size: number;
      modified: string;
    }>;
  };
  deterministic: boolean;
}

export interface F2_to_F3_Input {
  plan_id: string;
  target_folder: string;
  user_intent: string;
  conversation_id: string;
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

// F1 to F2 handoff interface
export interface F1_to_F2_Handoff {
  conversationId: string;
  userIntent: string;
  targetFolder: string;
  constraints: string[];
  clarifications: Array<{
    question: string;
    answer: string;
  }>;
  scannedFiles: FileMetadata[];
  timestamp: string;
}

// Undo / modification detection
export interface FileModification {
  path: string;
  type: 'modified' | 'deleted' | 'added';
  message: string;
}
