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
