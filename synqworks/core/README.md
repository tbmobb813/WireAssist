# @lai/core

Core AI engine for LAI (Linux AI Assistant) and UDP - Multi-provider AI with privacy controls and streaming support.

[![npm version](https://img.shields.io/npm/v/@lai/core.svg)](https://www.npmjs.com/package/@lai/core)
[![license](https://img.shields.io/npm/l/@lai/core.svg)](https://github.com/tbmobb813/lai-core/blob/main/LICENSE)

## Features

- 🚀 **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, Ollama
- 🔒 **Privacy Controls** - Built-in encryption and audit logging
- 📡 **Streaming Support** - Real-time response streaming
- 🗂️ **SQLite Backend** - Persistent conversation storage
- 🔍 **Full-Text Search** - Advanced search with filtering and ranking
- 🎯 **Context Awareness** - Workspace and file context injection
- ⚡ **High Performance** - Caching, indexing, and optimization

## Installation

```bash
npm install @lai/core
```

or with yarn:

```bash
yarn add @lai/core
```

or with pnpm:

```bash
pnpm add @lai/core
```

## Quick Start

### Basic Usage

```typescript
import {
  CoreStreamingProvider,
  SearchService,
  PrivacyService,
} from '@lai/core';

// Initialize provider
const provider = new CoreStreamingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.7,
});

// Send a message with streaming
const response = await provider.generateResponse(
  'conversation-123',
  [{ role: 'user', content: 'Hello!' }],
  (chunk) => {
    process.stdout.write(chunk);
  }
);

console.log('Full response:', response);
```

### Search with Filtering

```typescript
import { SearchService } from '@lai/core';

const searchService = new SearchService();

const results = await searchService.search('typescript', {
  provider: 'openai',
  model: 'gpt-4',
  limit: 10,
  sortBy: 'relevance',
});

console.log(`Found ${results.total} results`);
results.conversations.forEach((result) => {
  console.log(`${result.item.title} (score: ${result.score})`);
});
```

### Privacy & Encryption

```typescript
import { PrivacyService } from '@lai/core';

// Initialize encryption
const privacyService = new PrivacyService();
privacyService.initializeEncryption('secure-password');

// Encrypt search queries
const encrypted = privacyService.encryptQuery('confidential search');

// Log searches for audit trail
privacyService.logSearch('search query', 5, 150);

// Get audit statistics
const stats = privacyService.getAuditStats();
console.log(`Total searches: ${stats.searchCount}`);

// Export audit logs
const logs = privacyService.exportAuditLogs('csv');
```

### Context-Aware Providers

```typescript
import {
  CoreStreamingProvider,
  ContextAwareProvider,
} from '@lai/core';

const baseProvider = new CoreStreamingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// Wrap with context awareness
const contextProvider = new ContextAwareProvider(baseProvider, {
  conversationId: 'conv-123',
  workspacePath: '/home/user/project',
  selectedFiles: ['src/app.ts', 'src/utils.ts'],
  autoRefresh: true,
});

// Provider automatically injects workspace context
const response = await contextProvider.generateResponse(
  'conv-123',
  messages,
  (chunk) => console.log(chunk)
);
```

## Providers

### OpenAI

```typescript
import { getCoreStreamingProvider } from '@lai/core';

const provider = getCoreStreamingProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
});
```

### Anthropic

```typescript
const provider = getCoreStreamingProvider({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus',
  maxTokens: 2000,
});
```

### Google Gemini

```typescript
const provider = getCoreStreamingProvider({
  type: 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-pro',
  temperature: 0.7,
});
```

### Ollama (Local)

```typescript
const provider = getCoreStreamingProvider({
  type: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
});
```

## Database

```typescript
import { Database } from '@lai/core';

const db = new Database(':memory:'); // or './conversations.db'

// Create tables
await db.init();

// Save conversation
const conversation = await db.conversations.create({
  id: 'conv-123',
  title: 'My Conversation',
  provider: 'openai',
  model: 'gpt-4',
});

// Save message
const message = await db.messages.create({
  conversation_id: 'conv-123',
  role: 'user',
  content: 'Hello!',
});

// Retrieve conversation
const conv = await db.conversations.getOne('conv-123');
const messages = await db.messages.getByConversation('conv-123');
```

## Search

```typescript
import { SearchService } from '@lai/core';

const search = new SearchService();

// Basic search
const results = await search.search('typescript');

// Advanced search with filters
const filtered = await search.search('react', {
  provider: 'openai',
  model: 'gpt-4',
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  limit: 20,
  offset: 0,
  sortBy: 'relevance',
});

// Get search suggestions
const suggestions = await search.getSuggestions('type', 10);

// Get trending searches
const trending = search.getTrendingSearches(10);

// Get search history
const history = search.getHistory(50);
```

## Privacy Controls

```typescript
import { PrivacyService } from '@lai/core';

const privacy = new PrivacyService();

// Initialize encryption
privacy.initializeEncryption('my-secure-password');

// Update settings
privacy.updateSettings({
  encryptionEnabled: true,
  auditLoggingEnabled: true,
  encryptQueryStrings: true,
  dataRetentionDays: 90,
});

// Encrypt queries
const encrypted = privacy.encryptQuery('secret search');
const decrypted = privacy.decryptQuery(encrypted);

// Log operations
privacy.logSearch('query', 5, 100);
privacy.logFilter({ provider: 'openai' });
privacy.logViewResult('result-id', 'conversation');

// Get status
const status = privacy.getStatus();
console.log(`Encryption enabled: ${status.isEncryptionInitialized}`);
console.log(`Total audit logs: ${status.totalAuditLogs}`);

// Export audit logs
const json = privacy.exportAuditLogs('json');
const csv = privacy.exportAuditLogs('csv');

// Enforce data retention
privacy.enforceRetention();
```

## API Reference

### CoreStreamingProvider

Main provider for streaming AI responses.

#### Methods

- `generateResponse(conversationId: string, messages: Message[], onChunk?: (chunk: string) => void): Promise<string>`
- `updateOptions(options: Partial<ProviderOptions>): void`

### SearchService

Advanced search with filtering, caching, and ranking.

#### Methods

- `search(query: string, options?: SearchOptions): Promise<SearchResultSet>`
- `searchConversation(conversationId: string, query: string, limit?: number): Promise<SearchResultSet>`
- `getSuggestions(query: string, limit?: number): Promise<string[]>`
- `getHistory(limit?: number): SearchHistory[]`
- `getTrendingSearches(limit?: number): Array<{ query: string; count: number }>`
- `clearCache(): void`
- `clearHistory(): void`

### PrivacyService

Privacy controls with encryption and audit logging.

#### Methods

- `initializeEncryption(password: string): void`
- `encryptQuery(query: string): string | EncryptedData`
- `decryptQuery(data: string | EncryptedData): string`
- `logSearch(query: string, resultCount: number, executionTimeMs: number, error?: string): void`
- `logFilter(filters: Record<string, unknown>, error?: string): void`
- `getAuditLogs(limit?: number): AuditLog[]`
- `getAuditStats(): AuditStats`
- `exportAuditLogs(format: 'json' | 'csv'): string`
- `enforceRetention(): number`
- `clearEncryption(): void`
- `clearAuditLogs(): void`

### Database

SQLite-based persistence layer.

#### Methods

- `init(): Promise<void>`
- `conversations.create(data): Promise<Conversation>`
- `conversations.getOne(id): Promise<Conversation>`
- `conversations.getAll(limit): Promise<Conversation[]>`
- `messages.create(data): Promise<Message>`
- `messages.getByConversation(conversationId): Promise<Message[]>`
- `messages.search(query, limit): Promise<Message[]>`

## Architecture

```
@lai/core
├── Providers (OpenAI, Anthropic, Gemini, Ollama)
├── Streaming (Real-time response streaming)
├── Context (Workspace and file context injection)
├── Search (Full-text search with filtering)
├── Privacy (Encryption and audit logging)
└── Database (SQLite persistence)
```

## Types

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  created_at: number;
  updated_at: number;
}

interface SearchResult<T> {
  item: T;
  score: number;
  matchFields: string[];
}

interface SearchResultSet {
  conversations: SearchResult<Conversation>[];
  messages: SearchResult<Message>[];
  total: number;
  query: string;
  executionTimeMs: number;
}

interface PrivacySettings {
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  encryptQueryStrings: boolean;
  dataRetentionDays: number;
}

interface AuditLog {
  id: string;
  timestamp: number;
  action: 'search' | 'filter' | 'view_result' | 'delete_history' | 'export';
  query?: string;
  status: 'success' | 'error';
  resultCount?: number;
  executionTimeMs?: number;
}
```

## Performance

| Operation | Time |
|-----------|------|
| Stream response | Real-time (varies by provider) |
| Search with cache | <1ms |
| Search without cache | 50-200ms |
| Encryption | 5-50ms |
| Database query | <10ms |

## Security

- **Encryption:** AES-256-GCM with authenticated encryption
- **Key Derivation:** PBKDF2-SHA256, 100,000 iterations
- **Audit Trail:** Immutable, chronological logging
- **Privacy:** Optional encryption and logging

## Error Handling

```typescript
try {
  const response = await provider.generateResponse(
    'conv-123',
    messages,
    (chunk) => console.log(chunk)
  );
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limited, please retry');
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else {
    console.error('Search failed:', error.message);
  }
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT - see LICENSE file for details

## Support

- 📖 [Documentation](https://github.com/tbmobb813/lai-core/wiki)
- 🐛 [Issue Tracker](https://github.com/tbmobb813/lai-core/issues)
- 💬 [Discussions](https://github.com/tbmobb813/lai-core/discussions)

## Changelog

### 0.1.0 (2024-11-06)

- ✨ Initial release
- 🚀 Streaming support for multiple AI providers
- 🔍 Advanced search with FTS
- 🔒 Privacy controls with encryption
- 📋 Audit logging
- 🎯 Workspace context injection
- 💾 SQLite persistence

---

Built with ❤️ for the open source community.
