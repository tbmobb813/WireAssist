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
export { ProviderHttpError } from './providers/base';
export type {
  Provider,
  ProviderCompletionOptions,
  ProviderResponse,
  ProviderToolDefinition,
  ProviderToolCall,
  ProviderMessage,
  ProviderContentBlock,
  ImageAttachment,
  DocumentAttachment,
} from './providers/base';

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

// NEW — WireAssist agent platform additions
export * from './agents';
export { logger } from './logger';
export * from './memory';
export * from './approval';
export * from './mcp';
export * from './events';
export * from './skills';

// Command Center portfolio (Zone 1/2 data layer)
export * from './portfolio/store';

// Cross-agent Objective data layer — tasks from any agent can tag into one
export * from './objectives/store';
