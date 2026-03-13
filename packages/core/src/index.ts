// @lai/core/src/index.ts

// Main client
export { AIClient } from './client';

// Storage
export { ConversationStore, MessageStore, SettingsStore, SearchEngine } from './storage';

// Context building
export { ContextBuilder } from './context';

// Privacy controls
export { PrivacyController, AuditLogger, ConversationEncryption } from './privacy';

// Provider system (ENHANCED)
export { ProviderFactory, ProviderRegistry } from './providers';
export { StreamManager, handleStream } from './providers/streaming';
export { PROVIDER_CAPABILITIES } from './providers/capabilities';
export type { 
  Provider, 
  ProviderCompletionOptions, 
  ProviderResponse,
  ModelInfo,
} from './providers/base';
export type { ProviderCapabilities } from './providers/capabilities';
export type { StreamCallbacks } from './providers/streaming';

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
