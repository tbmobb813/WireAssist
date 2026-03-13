# Migration Guide: Provider Architecture Enhancement

This guide helps you migrate to or adopt the new provider architecture features in `@lia-code/core` v0.1.0+.

## No Breaking Changes

**Good news**: This enhancement is fully backward compatible. All existing code continues to work without modification.

## What's New

### 1. Provider Registry

**Before** (still works):
```typescript
import { ProviderFactory } from '@lia-code/core';

const provider = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});
```

**After** (new option):
```typescript
import { ProviderRegistry } from '@lia-code/core';

const registry = ProviderRegistry.createDefault();
const provider = registry.get('openai');
```

**Benefits of using Registry**:
- Centralized provider management
- Easy switching between providers
- Automatic provider discovery
- Support for multiple providers simultaneously

### 2. Streaming Utilities

**Before** (manual stream handling):
```typescript
const stream = await provider.stream({ prompt: 'Hello' });
let fullResponse = '';

for await (const chunk of stream) {
  fullResponse += chunk;
  console.log(chunk);
}
```

**After** (using utilities):
```typescript
import { handleStream } from '@lia-code/core';

const stream = await provider.stream({ prompt: 'Hello' });
const fullResponse = await handleStream(stream, {
  onChunk: (chunk) => console.log(chunk),
  onComplete: (full) => console.log('Done:', full),
  onError: (error) => console.error('Error:', error),
});
```

**Benefits**:
- Consistent error handling
- Callback-based interface
- Buffer management
- Cleaner code

### 3. Provider Capabilities

**Before** (trial and error):
```typescript
try {
  // Hope the provider supports this
  const embedding = await provider.generateEmbedding(text);
} catch (error) {
  // Provider doesn't support embeddings
}
```

**After** (check first):
```typescript
import { ProviderFactory } from '@lia-code/core';

const caps = ProviderFactory.getCapabilities('openai');

if (caps?.supportsEmbeddings) {
  const embedding = await provider.generateEmbedding(text);
} else {
  console.log('Provider does not support embeddings');
}
```

**Benefits**:
- Know capabilities before using them
- Filter providers by features
- Better error messages
- Runtime feature detection

## Migration Strategies

### Strategy 1: Gradual Adoption (Recommended)

Keep existing code, add new features where beneficial:

```typescript
import { 
  ProviderFactory,  // Existing
  ProviderRegistry, // New
  handleStream,     // New
} from '@lia-code/core';

// Keep using ProviderFactory for individual providers
const openai = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Add registry for multi-provider scenarios
const registry = new ProviderRegistry();
registry.register(openai);

// Add capability checking where useful
const caps = openai.getCapabilities();
if (caps.supportsVision) {
  // Use vision features
}

// Use stream utilities for better DX
const stream = await openai.stream({ prompt: 'Hello' });
const response = await handleStream(stream, {
  onChunk: (chunk) => process.stdout.write(chunk),
});
```

### Strategy 2: Full Refactor

Adopt all new patterns at once:

```typescript
import { 
  ProviderRegistry,
  handleStream,
  PROVIDER_CAPABILITIES,
} from '@lia-code/core';

class MyAIService {
  private registry: ProviderRegistry;

  constructor() {
    this.registry = ProviderRegistry.createDefault();
  }

  async detectProviders() {
    return await ProviderRegistry.detectAvailable();
  }

  async generateResponse(prompt: string, preferredProvider?: string) {
    const available = await this.detectProviders();
    
    // Use preferred or first available
    const providerType = preferredProvider || available[0];
    const provider = this.registry.get(providerType);

    if (!provider) {
      throw new Error('No providers available');
    }

    // Check capabilities
    const caps = provider.getCapabilities();
    console.log(`Using ${provider.type} (max context: ${caps.maxContextLength})`);

    // Stream with utilities
    const stream = await provider.stream({ prompt });
    return await handleStream(stream, {
      onChunk: (chunk) => this.onStreamChunk(chunk),
    });
  }

  private onStreamChunk(chunk: string) {
    // Handle streaming chunks
    process.stdout.write(chunk);
  }
}
```

### Strategy 3: Conditional Adoption

Use new features only in specific scenarios:

```typescript
import { ProviderFactory, ProviderRegistry } from '@lia-code/core';

// Simple case: use factory
function quickQuery(prompt: string) {
  const provider = ProviderFactory.create({
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  return provider.complete({ prompt });
}

// Complex case: use registry
async function multiProviderQuery(prompt: string) {
  const registry = ProviderRegistry.createDefault();
  const available = await ProviderRegistry.detectAvailable();
  
  // Try providers in priority order
  for (const type of available) {
    const provider = registry.get(type);
    if (provider) {
      try {
        return await provider.complete({ prompt });
      } catch (error) {
        console.warn(`${type} failed, trying next...`);
      }
    }
  }
  
  throw new Error('All providers failed');
}
```

## Common Use Cases

### Use Case 1: Provider Fallback Chain

```typescript
import { ProviderRegistry } from '@lia-code/core';

async function generateWithFallback(prompt: string) {
  const registry = ProviderRegistry.createDefault();
  const providers = ['openai', 'anthropic', 'gemini', 'ollama'];
  
  for (const type of providers) {
    const provider = registry.get(type);
    if (provider) {
      try {
        const response = await provider.complete({ prompt });
        console.log(`Used ${type}`);
        return response;
      } catch (error) {
        console.warn(`${type} failed: ${error.message}`);
        continue;
      }
    }
  }
  
  throw new Error('All providers exhausted');
}
```

### Use Case 2: Capability-Based Selection

```typescript
import { ProviderFactory, ProviderRegistry } from '@lia-code/core';

async function selectBestProvider(requirements: {
  needsEmbeddings?: boolean;
  needsVision?: boolean;
  minContextLength?: number;
}) {
  const allTypes: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
    'openai', 'anthropic', 'gemini', 'ollama'
  ];
  
  for (const type of allTypes) {
    const caps = ProviderFactory.getCapabilities(type);
    
    if (requirements.needsEmbeddings && !caps?.supportsEmbeddings) continue;
    if (requirements.needsVision && !caps?.supportsVision) continue;
    if (requirements.minContextLength && 
        caps.maxContextLength < requirements.minContextLength) continue;
    
    // This provider meets requirements
    return type;
  }
  
  return null;
}

// Usage
const providerType = await selectBestProvider({
  needsEmbeddings: true,
  minContextLength: 100000,
});
// Returns: 'openai' (has embeddings and 128k context)
```

### Use Case 3: Progressive Enhancement

```typescript
import { ProviderFactory, handleStream } from '@lia-code/core';

async function smartGenerate(prompt: string, onChunk?: (chunk: string) => void) {
  const provider = ProviderFactory.create({
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const caps = provider.getCapabilities();
  
  if (onChunk && caps.supportsStreaming) {
    // Use streaming if requested and supported
    const stream = await provider.stream({ prompt });
    return await handleStream(stream, { onChunk });
  } else {
    // Fall back to complete
    const response = await provider.complete({ prompt });
    if (onChunk) {
      onChunk(response.content);
    }
    return response.content;
  }
}
```

## Testing

No changes needed to existing tests. New features can be tested independently:

```typescript
import { ProviderRegistry, StreamManager } from '@lia-code/core';

describe('Provider Features', () => {
  test('registry works', () => {
    const registry = new ProviderRegistry();
    expect(registry.list()).toHaveLength(0);
  });

  test('streaming works', async () => {
    const manager = new StreamManager();
    const stream = async function* () {
      yield 'hello';
      yield ' ';
      yield 'world';
    }();
    
    const result = await manager.streamToString(stream);
    expect(result).toBe('hello world');
  });
});
```

## Summary

- ✅ **No breaking changes** - existing code continues to work
- ✅ **Opt-in features** - use what you need, when you need it
- ✅ **Gradual migration** - adopt features incrementally
- ✅ **Backward compatible** - all old patterns still supported
- ✅ **Well tested** - 85+ tests ensure reliability

## Getting Help

- See [PROVIDER_ARCHITECTURE.md](./PROVIDER_ARCHITECTURE.md) for detailed examples
- Check the [README.md](./README.md) for quick reference
- All new features have comprehensive test coverage in `src/__tests__/providers/`
