# Provider Architecture Enhancement Examples

This document demonstrates how to use the new provider architecture enhancements in `@lai/core`.

## Provider Registry

### Basic Usage

```typescript
import { ProviderRegistry, ProviderFactory } from '@lia-code/core';

// Create a registry and register providers
const registry = new ProviderRegistry();

// Register individual providers
const openai = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});
registry.register(openai);

const anthropic = ProviderFactory.create({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus',
});
registry.register(anthropic);

// Use the registry
const provider = registry.get('openai');
if (provider) {
  const response = await provider.complete({ prompt: 'Hello!' });
  console.log(response.content);
}
```

### Create Default Registry

```typescript
import { ProviderRegistry } from '@lia-code/core';

// Automatically attempt to register all built-in providers
const registry = ProviderRegistry.createDefault();

// Check which providers are available
console.log('Available providers:', registry.list());

// Get a specific provider
const ollama = registry.get('ollama');
if (ollama) {
  // Ollama is available
}
```

### Detect Available Providers

```typescript
import { ProviderRegistry } from '@lia-code/core';

// Detect which providers are available and working
const available = await ProviderRegistry.detectAvailable();
console.log('Working providers:', available);
// Example output: ['openai', 'ollama']
```

## Streaming Utilities

### Basic Stream Handling

```typescript
import { StreamManager, handleStream } from '@lia-code/core';

const provider = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const stream = await provider.stream({ prompt: 'Tell me a story' });

// Option 1: Using StreamManager
const manager = new StreamManager();
const fullResponse = await manager.handleStream(stream, {
  onChunk: (chunk) => console.log('Received:', chunk),
  onComplete: (full) => console.log('Complete:', full),
  onError: (error) => console.error('Error:', error),
});

// Option 2: Using convenience function
const stream2 = await provider.stream({ prompt: 'Tell me a joke' });
const response = await handleStream(stream2, {
  onChunk: (chunk) => process.stdout.write(chunk),
});
```

### Buffered Streaming

```typescript
import { StreamManager } from '@lia-code/core';

const manager = new StreamManager();
const stream = await provider.stream({ prompt: 'Count to 100' });

// Buffer chunks and emit in batches of 50 characters
const buffered = manager.bufferStream(stream, 50);

for await (const batch of buffered) {
  console.log('Batch:', batch);
}
```

### Simple Stream to String

```typescript
import { StreamManager } from '@lia-code/core';

const manager = new StreamManager();
const stream = await provider.stream({ prompt: 'Hello' });

// Just get the full response without callbacks
const fullText = await manager.streamToString(stream);
console.log(fullText);
```

## Provider Capabilities

### Check Capabilities Before Creating Provider

```typescript
import { ProviderFactory, PROVIDER_CAPABILITIES } from '@lia-code/core';

// Get capabilities without creating a provider
const openaiCaps = ProviderFactory.getCapabilities('openai');
console.log('OpenAI supports embeddings:', openaiCaps?.supportsEmbeddings);

// Or use the constant directly
console.log('Max context:', PROVIDER_CAPABILITIES.openai.maxContextLength);
```

### Filter Providers by Capability

```typescript
import { ProviderFactory } from '@lia-code/core';

const allProviders: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
  'openai',
  'anthropic',
  'gemini',
  'ollama',
];

// Find providers that support embeddings
const embeddingProviders = allProviders.filter((type) => {
  const caps = ProviderFactory.getCapabilities(type);
  return caps?.supportsEmbeddings;
});
console.log('Providers with embeddings:', embeddingProviders);
// Output: ['openai', 'ollama']

// Find provider with largest context window
const largestContextProvider = allProviders.reduce((best, current) => {
  const bestCaps = ProviderFactory.getCapabilities(best);
  const currentCaps = ProviderFactory.getCapabilities(current);
  return (currentCaps?.maxContextLength || 0) > (bestCaps?.maxContextLength || 0)
    ? current
    : best;
});
console.log('Largest context:', largestContextProvider);
// Output: 'gemini' (1M tokens)
```

### Runtime Capability Checking

```typescript
import { ProviderFactory } from '@lia-code/core';

const provider = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const capabilities = provider.getCapabilities();

if (capabilities.supportsVision) {
  // Can use vision features
  console.log('This provider supports vision inputs');
}

if (capabilities.features?.functionCalling) {
  // Can use function calling
  console.log('This provider supports function calling');
}
```

## Complete Example: Multi-Provider Application

```typescript
import {
  ProviderRegistry,
  ProviderFactory,
  handleStream,
  PROVIDER_CAPABILITIES,
} from '@lia-code/core';

async function main() {
  // Create registry with all available providers
  const registry = ProviderRegistry.createDefault();

  // Detect which are actually working
  const available = await ProviderRegistry.detectAvailable();
  console.log('Available providers:', available);

  // Get capabilities for each available provider
  for (const providerType of available) {
    const caps = PROVIDER_CAPABILITIES[providerType];
    console.log(`\n${providerType}:`);
    console.log(`  - Streaming: ${caps.supportsStreaming}`);
    console.log(`  - Embeddings: ${caps.supportsEmbeddings}`);
    console.log(`  - Vision: ${caps.supportsVision}`);
    console.log(`  - Max Context: ${caps.maxContextLength} tokens`);
  }

  // Use the first available provider
  if (available.length > 0) {
    const provider = registry.get(available[0]);
    if (provider) {
      console.log(`\nUsing ${provider.type}...`);

      const stream = await provider.stream({
        prompt: 'Write a haiku about TypeScript',
      });

      const response = await handleStream(stream, {
        onChunk: (chunk) => process.stdout.write(chunk),
      });

      console.log('\n\nComplete response:', response);
    }
  }
}

main().catch(console.error);
```

## Backward Compatibility

All existing code continues to work without modification:

```typescript
import { ProviderFactory } from '@lia-code/core';

// Old code still works exactly the same
const provider = ProviderFactory.create({
  type: 'openai',
  apiKey: 'sk-...',
});

const response = await provider.complete({ prompt: 'Hello' });
console.log(response.content);

// listModels still returns string[]
const models = await provider.listModels();
console.log('Available models:', models);
```

## Benefits

1. **Provider Discovery**: Automatically detect available providers
2. **Capability Checking**: Know what features are supported before using them
3. **Unified Streaming**: Consistent stream handling across all providers
4. **Type Safety**: Full TypeScript support with proper types
5. **Backward Compatible**: No breaking changes to existing code
6. **Extensible**: Easy to add new providers
