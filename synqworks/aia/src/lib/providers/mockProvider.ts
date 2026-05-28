import type { Provider, ProviderMessage } from "./provider";

// Very small mock provider used for DEV and tests.
export const mockProvider: Provider = {
  async generateResponse(
    _conversationId: string,
    messages: ProviderMessage[],
    onChunk?,
  ) {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const payload = last ? last.content : "Hello from mock provider!";

    // Simulate chunked streaming by splitting the reply into words and calling onChunk
    const reply = `AI response will go here (mock): ${payload}`;
    const parts = reply.split(/(\s+)/).filter(Boolean);

    for (const p of parts) {
      // small delay between chunks
      await new Promise((r) => setTimeout(r, 40));
      if (onChunk) onChunk(p);
    }

    return reply;
  },
};
