// src/lib/providers/hybridProvider.ts
// Smart routing provider that chooses between local and cloud based on availability

import type { ProviderMessage, Provider } from "./provider";
import { useSettingsStore } from "../stores/settingsStore";
import { invokeSafe } from "../utils/tauri";
import { getProvider } from "./provider";

export interface HybridProvider extends Provider {
  getAvailableProviders(): Promise<{
    local: { available: boolean; models: string[] };
    cloud: { available: boolean; providers: string[] };
  }>;
  chooseProvider(requestedModel?: string): Promise<{
    provider: string;
    model: string;
    isLocal: boolean;
  }>;
}

export class HybridRoutingProvider implements HybridProvider {
  private cachedOllamaCheck: { timestamp: number; available: boolean } | null =
    null;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  async getAvailableProviders() {
    // Check Ollama availability (with caching)
    let ollamaAvailable = false;
    const now = Date.now();

    if (
      this.cachedOllamaCheck &&
      now - this.cachedOllamaCheck.timestamp < this.CACHE_DURATION
    ) {
      ollamaAvailable = this.cachedOllamaCheck.available;
    } else {
      try {
        ollamaAvailable =
          (await invokeSafe<boolean>("ollama_check_connection")) || false;
        this.cachedOllamaCheck = { timestamp: now, available: ollamaAvailable };
      } catch {
        ollamaAvailable = false;
        this.cachedOllamaCheck = { timestamp: now, available: false };
      }
    }

    // Get Ollama models if available
    let ollamaModels: string[] = [];
    if (ollamaAvailable) {
      try {
        ollamaModels = (await invokeSafe<string[]>("ollama_list_models")) || [];
      } catch {
        console.warn("Failed to get Ollama models:");
      }
    }

    // Check cloud provider availability (API key check)
    const { apiKeys } = useSettingsStore.getState();
    const cloudProviders = [];

    if (apiKeys.openai) {
      cloudProviders.push("openai");
    }
    if (apiKeys.anthropic) {
      cloudProviders.push("anthropic");
    }
    if (apiKeys.gemini) {
      cloudProviders.push("gemini");
    }

    return {
      local: {
        available: ollamaAvailable,
        models: ollamaModels,
      },
      cloud: {
        available: cloudProviders.length > 0,
        providers: cloudProviders,
      },
    };
  }

  async chooseProvider(requestedModel?: string): Promise<{
    provider: string;
    model: string;
    isLocal: boolean;
  }> {
    const { defaultProvider, defaultModel } = useSettingsStore.getState();
    const enableHybridRouting = false; // Simplified: hybrid routing not yet implemented
    const preferLocal = false; // Simplified: hybrid routing not yet implemented

    // If hybrid routing is disabled, use the default provider
    if (!enableHybridRouting) {
      return {
        provider: defaultProvider,
        model: requestedModel || defaultModel,
        isLocal: defaultProvider === "ollama",
      };
    }

    const availability = await this.getAvailableProviders();

    // If user prefers local and Ollama is available
    if (preferLocal && availability.local.available) {
      // Check if the requested model is available locally
      if (requestedModel) {
        const modelAvailable = availability.local.models.some(
          (model) =>
            model.toLowerCase().includes(requestedModel.toLowerCase()) ||
            requestedModel.toLowerCase().includes(model.toLowerCase()),
        );

        if (modelAvailable) {
          return {
            provider: "ollama",
            model: requestedModel,
            isLocal: true,
          };
        }
      } else {
        // Use first available local model or fallback
        const localModel = availability.local.models[0] || "llama3.2";
        return {
          provider: "ollama",
          model: localModel,
          isLocal: true,
        };
      }
    }

    // Fallback to cloud providers
    if (availability.cloud.available) {
      // Choose the first available cloud provider
      const cloudProvider = availability.cloud.providers[0];
      const model =
        requestedModel || this.getDefaultModelForProvider(cloudProvider);

      return {
        provider: cloudProvider,
        model,
        isLocal: false,
      };
    }

    // If nothing is available, fallback to the default provider
    // This might fail, but it's better than not trying
    return {
      provider: defaultProvider,
      model: requestedModel || defaultModel,
      isLocal: defaultProvider === "ollama",
    };
  }

  private getDefaultModelForProvider(provider: string): string {
    switch (provider) {
      case "openai":
        return "gpt-4";
      case "anthropic":
        return "claude-3-5-sonnet-20241022";
      case "gemini":
        return "gemini-1.5-flash";
      case "ollama":
        return "llama3.2";
      default:
        return "gpt-4";
    }
  }

  async generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const { provider, model } = await this.chooseProvider();

    // Temporarily override the settings store to use the chosen provider/model
    const settingsStore = useSettingsStore.getState();
    const originalProvider = settingsStore.defaultProvider;
    const originalModel = settingsStore.defaultModel;

    // Set chosen provider/model
    settingsStore.setDefaultProvider(provider);
    settingsStore.setDefaultModel(model);

    try {
      // Use the regular provider system with our chosen settings
      const regularProvider = getProvider();
      const result = await regularProvider.generateResponse(
        conversationId,
        messages,
        onChunk,
      );

      return result;
    } finally {
      // Restore original settings
      settingsStore.setDefaultProvider(originalProvider);
      settingsStore.setDefaultModel(originalModel);
    }
  }
}

export function getHybridProvider(): HybridProvider {
  return new HybridRoutingProvider();
}
