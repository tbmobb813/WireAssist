// @lai/core/src/providers/capabilities.ts

export interface ProviderCapabilities {
  /** Provider supports real-time streaming responses */
  supportsStreaming: boolean;
  
  /** Provider supports generating embeddings */
  supportsEmbeddings: boolean;
  
  /** Provider supports vision/image inputs */
  supportsVision: boolean;
  
  /** Provider requires API key for authentication */
  requiresApiKey: boolean;
  
  /** Maximum context window size in tokens */
  maxContextLength: number;
  
  /** Supported file types for context (if any) */
  supportedFileTypes?: string[];
  
  /** Additional provider-specific features */
  features?: {
    functionCalling?: boolean;
    jsonMode?: boolean;
    toolUse?: boolean;
  };
}

export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsEmbeddings: false,
  supportsVision: false,
  requiresApiKey: true,
  maxContextLength: 4096,
};

/**
 * Provider capability definitions for built-in providers
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  openai: {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: true,
    requiresApiKey: true,
    maxContextLength: 128000, // GPT-4 Turbo
    features: {
      functionCalling: true,
      jsonMode: true,
      toolUse: true,
    },
  },
  
  anthropic: {
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
    requiresApiKey: true,
    maxContextLength: 200000, // Claude 3
    features: {
      functionCalling: true,
      toolUse: true,
    },
  },
  
  gemini: {
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
    requiresApiKey: true,
    maxContextLength: 1000000, // Gemini 1.5 Pro
    features: {
      functionCalling: true,
    },
  },
  
  ollama: {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: false, // Depends on model
    requiresApiKey: false,
    maxContextLength: 4096, // Varies by model
  },
};
