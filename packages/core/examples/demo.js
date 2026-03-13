#!/usr/bin/env node
/**
 * Demo script showing the new provider architecture features
 * Run with: node examples/demo.js
 */

const { 
  ProviderRegistry, 
  ProviderFactory, 
  handleStream,
  PROVIDER_CAPABILITIES 
} = require('../dist/index');

async function demo() {
  console.log('🚀 Provider Architecture Demo\n');

  // 1. Show capabilities without creating providers
  console.log('📊 Provider Capabilities:');
  console.log('-------------------------');
  
  const providers = ['openai', 'anthropic', 'gemini', 'ollama'];
  providers.forEach(type => {
    const caps = ProviderFactory.getCapabilities(type);
    console.log(`${type}:`);
    console.log(`  - Streaming: ${caps.supportsStreaming}`);
    console.log(`  - Embeddings: ${caps.supportsEmbeddings}`);
    console.log(`  - Vision: ${caps.supportsVision}`);
    console.log(`  - API Key Required: ${caps.requiresApiKey}`);
    console.log(`  - Max Context: ${caps.maxContextLength.toLocaleString()} tokens`);
  });

  // 2. Create a default registry
  console.log('\n🗂️  Creating Provider Registry:');
  console.log('------------------------------');
  
  const registry = ProviderRegistry.createDefault();
  const registered = registry.list();
  console.log(`Registered providers: ${registered.join(', ')}`);
  console.log(`Total: ${registered.length} provider(s)`);

  // 3. Show capability-based filtering
  console.log('\n🔍 Capability-Based Filtering:');
  console.log('------------------------------');
  
  const embeddingProviders = providers.filter(type => {
    const caps = ProviderFactory.getCapabilities(type);
    return caps.supportsEmbeddings;
  });
  console.log(`Providers with embeddings: ${embeddingProviders.join(', ')}`);

  const visionProviders = providers.filter(type => {
    const caps = ProviderFactory.getCapabilities(type);
    return caps.supportsVision;
  });
  console.log(`Providers with vision: ${visionProviders.join(', ')}`);

  const noKeyRequired = providers.filter(type => {
    const caps = ProviderFactory.getCapabilities(type);
    return !caps.requiresApiKey;
  });
  console.log(`Providers without API key: ${noKeyRequired.join(', ')}`);

  // 4. Find provider with largest context
  const largestContext = providers.reduce((best, current) => {
    const bestCaps = ProviderFactory.getCapabilities(best);
    const currentCaps = ProviderFactory.getCapabilities(current);
    return currentCaps.maxContextLength > bestCaps.maxContextLength ? current : best;
  });
  const largestCaps = ProviderFactory.getCapabilities(largestContext);
  console.log(`\n🏆 Largest context window: ${largestContext} (${largestCaps.maxContextLength.toLocaleString()} tokens)`);

  console.log('\n✅ Demo completed successfully!');
  console.log('\nNote: This demo shows the architecture without making actual API calls.');
  console.log('See PROVIDER_ARCHITECTURE.md and MIGRATION_GUIDE.md for usage examples.');
}

demo().catch(console.error);
