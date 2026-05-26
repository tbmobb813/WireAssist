// src/lib/api/types.ts
// TypeScript types matching the Rust structs

export interface ApiConversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  model: string;
  provider: string;
  system_prompt?: string;
  parent_conversation_id?: string;
  branch_point_message_id?: string;
}

export interface ApiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  // Optional UI-only status to represent per-message delivery state in the frontend
  status?: "pending" | "sent" | "failed";
}

// Document search types
export interface FileMatch {
  path: string;
  line_number?: number;
  line_content?: string;
  context_before: string[];
  context_after: string[];
  file_type: string;
  score: number;
}

export interface SearchResult {
  query: string;
  matches: FileMatch[];
  total_files_searched: number;
  search_time_ms: number;
  tokens_used?: number;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: number;
}

export interface NewConversation {
  title: string;
  model: string;
  provider: string;
  system_prompt?: string;
}

export interface NewMessage {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used?: number;
}

// Profile types
export interface ApiProfile {
  id: string;
  name: string;
  description?: string;
  default_model: string;
  default_provider: string;
  system_prompt?: string;
  created_at: number;
  updated_at: number;
  is_active: boolean;
}

export interface NewProfile {
  name: string;
  description?: string;
  default_model: string;
  default_provider: string;
  system_prompt?: string;
}

// Tag types
export interface ApiTag {
  id: string;
  name: string;
  color?: string;
  created_at: number;
  updated_at: number;
}

export interface NewTag {
  name: string;
  color?: string;
}

// Workspace Template types
export interface ApiWorkspaceTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  default_model: string;
  default_provider: string;
  system_prompt?: string;
  settings_json?: string;
  ignore_patterns?: string;
  file_extensions?: string;
  context_instructions?: string;
  created_at: number;
  updated_at: number;
  is_builtin: boolean;
}

export interface NewWorkspaceTemplate {
  name: string;
  description?: string;
  category: string;
  default_model: string;
  default_provider: string;
  system_prompt?: string;
  settings_json?: string;
  ignore_patterns?: string;
  file_extensions?: string;
  context_instructions?: string;
}
