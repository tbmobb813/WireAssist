// @aia/core/src/index.ts

// Main client
export { AIClient } from './client';

// Storage
export { ConversationStore, MessageStore, SettingsStore, SearchEngine } from './storage';

// Context building
export { ContextBuilder } from './context';

// Privacy controls
export { PrivacyController, AuditLogger, ConversationEncryption } from './privacy';

// Provider types
export { ProviderFactory } from './providers';
export type { Provider, ProviderCompletionOptions, ProviderResponse } from './providers/base';

// Streaming
export { StreamHandler, ResponseBuffer, StreamParser } from './streaming';

// Types
export type {
  Conversation,
  Message,
  CompletionOptions,
  StreamOptions,
  AIContext,
  PrivacySettings,
  ProviderType,
  ProviderConfig,
  FileContext,
  ProjectStructure,
  WorkspaceInfo,
  FileChange,
  ContextOptions,
  AIRequest,
  AuditLogOptions,
} from './types';

// NEW — SynqWorks agent platform additions
export * from './agents';
export * from './memory';
export * from './approval';
export * from './mcp';
export * from './events';
