// @lai/core/src/types.ts

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface FileContext {
  path: string;
  content: string;
  language: string;
  startLine?: number;
  endLine?: number;
}

export interface ProjectStructure {
  type: string;
  rootPath: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  mainFiles?: string[];
}

export interface WorkspaceInfo {
  path: string;
  structure: ProjectStructure;
  openFiles?: string[];
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  timestamp: number;
  diff?: string;
}

export interface CompletionOptions {
  prompt: string;
  context?: AIContext;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  conversationId?: string;
}

export interface AIContext {
  files?: FileContext[];
  gitDiff?: string;
  gitLog?: string;
  gitBranch?: string;
  projectStructure?: ProjectStructure;
  recentChanges?: FileChange[];
  workspace?: WorkspaceInfo;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: ProviderType;
  model: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokensUsed?: number;
  context?: AIContext;
}

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface PrivacySettings {
  localFirst: boolean;
  auditEnabled: boolean;
  encryptConversations: boolean;
  dataRetentionDays?: number;
  neverSendPatterns?: string[]; // Regex patterns for sensitive data
}

export interface StreamOptions extends CompletionOptions {
  conversationId?: string;
  onChunk?: (chunk: string) => void;
}

export interface ContextOptions {
  files?: string[];
  gitRepo?: string;
  workspace?: string;
}

export interface AIRequest {
  prompt: string;
  provider: ProviderType;
  model?: string;
  timestamp: number;
  tokensUsed?: number;
  response?: string;
}

export interface AuditLogOptions {
  startDate?: number;
  endDate?: number;
  provider?: ProviderType;
  limit?: number;
}
