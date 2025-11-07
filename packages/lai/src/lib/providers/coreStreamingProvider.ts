/**
 * Core Streaming Provider
 * Integrates @lia-code/core's native streaming with LAI app's provider interface
 * Provides direct streaming without Tauri IPC overhead
 */

import { ProviderFactory, handleStream } from '@lia-code/core';
import type { ProviderMessage, Provider } from './provider';
import { useSettingsStore } from '../stores/settingsStore';

export class CoreStreamingProvider implements Provider {
  async generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const { defaultProvider, defaultModel, apiKeys } = useSettingsStore.getState();
    const provider = defaultProvider || 'openai';
    const model = defaultModel;

    // Build config based on provider type
    const config: any = {
      type: provider,
      model,
    };

    // Add provider-specific configuration
    switch (provider) {
      case 'openai':
        config.apiKey = apiKeys.openai;
        if (!config.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        break;

      case 'anthropic':
        config.apiKey = apiKeys.anthropic;
        if (!config.apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        break;

      case 'gemini':
        config.apiKey = apiKeys.gemini;
        if (!config.apiKey) {
          throw new Error('Gemini API key not configured');
        }
        break;

      case 'ollama':
        config.baseUrl = apiKeys.ollamaBaseUrl || 'http://localhost:11434';
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Create provider instance
    const providerInstance = ProviderFactory.create(config);

    // Build messages for provider
    const providerMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      // Use streaming if onChunk is provided
      if (onChunk) {
        return await this.streamResponse(providerInstance, providerMessages, onChunk);
      } else {
        // Non-streaming fallback
        const response = await providerInstance.complete({
          prompt: providerMessages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        });
        return response.content || '';
      }
    } catch (error) {
      throw new Error(
        `Failed to generate response from ${provider}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async streamResponse(
    provider: any,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    try {
      // Get streaming generator from provider
      const stream = await provider.stream({
        prompt: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      });

      // Handle stream with @lia-code/core's stream handler
      const fullResponse = await handleStream(stream, {
        onChunk,
        onComplete: () => {
          // Stream complete
        },
        onError: (error) => {
          console.error('Stream error:', error);
        },
      });

      return fullResponse;
    } catch (error) {
      throw new Error(
        `Streaming failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export function getCoreStreamingProvider(): Provider {
  return new CoreStreamingProvider();
}
