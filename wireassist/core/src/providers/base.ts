// @aia/core/src/providers/base.ts

import type { ProviderType, AIContext } from '../types';

export interface Provider {
  type: ProviderType;
  currentModel: string;
  // Whether this provider's complete() honors options.tools/messages for a
  // real multi-turn tool-calling loop. BaseAgent.runToolLoop() falls back to
  // a single-shot think() call when false — see base-agent.ts.
  supportsTools: boolean;
  // Whether this provider can accept image content blocks in a user turn.
  // BaseAgent.runToolLoop() strips images (with a note in the text turn
  // instead of silently dropping them) when this is false or unset.
  supportsVision?: boolean;
  // Whether this provider can accept document (PDF/text) content blocks in a
  // user turn. Deliberately never set on OpenRouter — PDF support varies too
  // much per underlying model to trust uniformly, unlike vision. BaseAgent
  // strips documents (with a note) when this is false or unset, and skips
  // the OpenRouter fallback entirely for document-bearing requests rather
  // than silently retrying without the attachment.
  supportsDocuments?: boolean;

  complete(options: ProviderCompletionOptions): Promise<ProviderResponse>;
  stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>>;
  listModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
}

// Thrown by a provider's complete()/stream() on a non-ok HTTP response, with
// the real status code attached — lets callers (e.g. BaseAgent's fallback
// wrapper) distinguish a retryable outage/rate-limit from a genuine bad
// request without parsing the error message string.
export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

// JSON-Schema tool definition handed to the model, and the structured call
// it hands back — provider-agnostic; see Provider.supportsTools for which
// providers actually implement it (anthropic.ts, openrouter.ts).
export interface ProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// A raw image attachment as it flows from the UI through routes/tasks/skills
// before becoming a ProviderContentBlock — `data` is raw base64, no `data:`
// URI prefix.
export interface ImageAttachment {
  mediaType: string;
  data: string;
}

// Same shape/flow as ImageAttachment, for PDF or plain-text file attachments.
// `data` is always raw base64 (even for text/plain — the provider that
// supports documents decodes it back to a string itself, e.g. anthropic.ts).
export interface DocumentAttachment {
  mediaType: 'application/pdf' | 'text/plain';
  data: string;
  filename?: string;
}

// A block within a user turn's content when it's more than plain text.
// `data` is raw base64, no `data:` URI prefix (providers that need one, e.g.
// OpenRouter's OpenAI-compatible wire format, add it themselves in
// buildMessages()).
export type ProviderContentBlock =
  | { type: 'text'; text: string }
  | ({ type: 'image' } & ImageAttachment)
  | ({ type: 'document' } & DocumentAttachment);

// Turn history for a multi-turn tool-calling loop. Providers without tool
// support can ignore `messages`/`tools` entirely and fall back to `prompt`.
// A user turn's content is an array only when it carries an image — plain
// text stays a bare string in every other case.
export type ProviderMessage =
  | { role: 'user'; content: string | ProviderContentBlock[] }
  | { role: 'assistant'; content: string; toolCalls?: ProviderToolCall[] }
  | { role: 'tool_result'; toolCallId: string; content: string; isError?: boolean };

export interface ProviderCompletionOptions {
  prompt: string;
  // Full turn history for a tool-calling loop. When set, takes precedence
  // over `prompt` for providers that support it (`prompt` stays required so
  // non-tool-calling providers and callers have a single-shot fallback).
  messages?: ProviderMessage[];
  tools?: ProviderToolDefinition[];
  context?: AIContext;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderResponse {
  content: string;
  // Present when the model chose to call one or more tools instead of (or
  // alongside) returning a final answer. Only populated by providers that
  // implement tool-calling.
  toolCalls?: ProviderToolCall[];
  tokensUsed?: number;
  // Split input/output counts, when the provider's API exposes them —
  // needed for accurate per-token cost accounting (output tokens are
  // priced differently than input tokens).
  promptTokens?: number;
  completionTokens?: number;
  model: string;
  finishReason?: string;
}

export { ProviderType } from '../types';
