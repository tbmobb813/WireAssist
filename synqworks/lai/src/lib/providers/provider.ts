// provider.ts - provider interface and factory
import type { ApiMessage as Message } from "../api/types";
import { mockProvider } from "./mockProvider";
import {
  getInvoke as getTauriInvoke,
  getListen as getTauriListen,
  hasTauri,
} from "../tauri-shim";
import { useSettingsStore } from "../stores/settingsStore";

export type ProviderMessage = {
  role: "user" | "assistant" | "system";
  content: string;
} & Partial<Message>;

export interface Provider {
  // onChunk is an optional callback used for streaming partial responses. If provided,
  // the provider should call onChunk for each partial chunk and still resolve to the
  // final combined string.
  generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string>;
}

export function getProvider(): Provider {
  return {
    async generateResponse(conversationId, messages, onChunk?) {
      try {
        const invokeFn = await getTauriInvoke();
        const listenFn = await getTauriListen();
        const isRuntimeTauri = hasTauri();
        const { defaultProvider, defaultModel } = useSettingsStore.getState();
        const provider = defaultProvider || "openai";
        const model = defaultModel || null;

        if (!isRuntimeTauri || !invokeFn) {
          // Non-tauri environment fallback
          return mockProvider.generateResponse(
            conversationId,
            messages,
            onChunk,
          );
        }

        const listenAvailable =
          isRuntimeTauri &&
          listenFn !== undefined &&
          typeof listenFn === "function";

        if (provider === "openai") {
          if (onChunk && listenAvailable) {
            const sessionId: string = await invokeFn("provider_openai_stream", {
              conversation_id: conversationId,
              messages,
              model,
            });
            let buffer = "";
            const unlistenChunkP = listenFn(
              "provider-stream-chunk",
              (e: any) => {
                const payload: any = e.payload;
                if (payload?.session_id === sessionId) {
                  const chunk = payload.chunk as string;
                  buffer += chunk;
                  try {
                    onChunk(chunk);
                  } catch {
                    // swallow errors from onChunk
                  }
                }
              },
            );
            const unlistenEndP = listenFn("provider-stream-end", (e: any) => {
              const payload: any = e.payload;
              if (payload?.session_id === sessionId) {
                Promise.all([unlistenChunkP, unlistenEndP]).then((fns: any[]) =>
                  fns.forEach((fn) => fn && fn()),
                );
              }
            });
            await new Promise((r) => setTimeout(r, 200));
            return buffer;
          }
          // fallback to non-streaming if listen unavailable
          return await invokeFn("provider_openai_generate", {
            conversation_id: conversationId,
            messages,
            model,
          });
        } else if (provider === "anthropic") {
          const res: string = await invokeFn("provider_anthropic_generate", {
            conversation_id: conversationId,
            messages,
            model,
          });
          // Simulate streaming if requested
          if (onChunk) {
            for (const tok of res.split(/(\s+)/).filter(Boolean)) {
              onChunk(tok);
              await new Promise((r) => setTimeout(r, 10));
            }
          }
          return res;
        } else if (provider === "gemini") {
          const res: string = await invokeFn("provider_gemini_generate", {
            conversation_id: conversationId,
            messages,
            model,
          });
          if (onChunk) {
            for (const tok of res.split(/(\s+)/).filter(Boolean)) {
              onChunk(tok);
              await new Promise((r) => setTimeout(r, 10));
            }
          }
          return res;
        } else if (provider === "ollama") {
          if (onChunk && listenAvailable) {
            const sessionId: string = await invokeFn("provider_ollama_stream", {
              conversation_id: conversationId,
              messages,
              model,
            });
            let buffer = "";
            const unlistenChunkP = listenFn(
              "provider-stream-chunk",
              (e: any) => {
                const payload: any = e.payload;
                if (payload?.session_id === sessionId) {
                  const chunk = payload.chunk as string;
                  buffer += chunk;
                  try {
                    onChunk(chunk);
                  } catch {
                    // swallow errors from onChunk
                  }
                }
              },
            );
            const unlistenEndP = listenFn("provider-stream-end", (e: any) => {
              const payload: any = e.payload;
              if (payload?.session_id === sessionId) {
                Promise.all([unlistenChunkP, unlistenEndP]).then((fns: any[]) =>
                  fns.forEach((fn) => fn && fn()),
                );
              }
            });
            await new Promise((r) => setTimeout(r, 200));
            return buffer;
          }
          // fallback to non-streaming
          return await invokeFn("provider_ollama_generate", {
            conversation_id: conversationId,
            messages,
            model,
          });
        } else {
          return mockProvider.generateResponse(
            conversationId,
            messages,
            onChunk,
          );
        }
      } catch (e: any) {
        throw new Error(e?.message || String(e));
      }
    },
  };
}
