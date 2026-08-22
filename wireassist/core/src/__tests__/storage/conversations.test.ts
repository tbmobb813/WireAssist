import { ConversationStore } from '../../storage/conversations';
import { unlinkSync } from 'fs';
import { existsSync } from 'fs';

const TEST_DB = './test-conversations.db';

describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
    store = new ConversationStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  test('should create a conversation', async () => {
    const id = await store.create({
      title: 'Test Conversation',
      provider: 'openai',
      model: 'gpt-4',
      metadata: { tags: ['test'] },
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  test('should get a conversation by id', async () => {
    const id = await store.create({
      title: 'Test Conversation',
      provider: 'openai',
      model: 'gpt-4',
    });

    const conversation = await store.get(id);
    expect(conversation.id).toBe(id);
    expect(conversation.title).toBe('Test Conversation');
    expect(conversation.provider).toBe('openai');
    expect(conversation.model).toBe('gpt-4');
  });

  test('should throw error for non-existent conversation', async () => {
    await expect(store.get('non-existent-id')).rejects.toThrow();
  });

  test('should update conversation', async () => {
    const id = await store.create({
      title: 'Original Title',
      provider: 'openai',
      model: 'gpt-4',
    });

    await store.update(id, { title: 'Updated Title' });
    const conversation = await store.get(id);
    expect(conversation.title).toBe('Updated Title');
  });

  test('should delete conversation', async () => {
    const id = await store.create({
      title: 'Test Conversation',
      provider: 'openai',
      model: 'gpt-4',
    });

    await store.delete(id);
    await expect(store.get(id)).rejects.toThrow();
  });

  test('should list conversations', async () => {
    await store.create({
      title: 'Conversation 1',
      provider: 'openai',
      model: 'gpt-4',
    });
    await store.create({
      title: 'Conversation 2',
      provider: 'anthropic',
      model: 'claude-3',
    });

    const conversations = await store.list();
    expect(conversations.length).toBe(2);
  });

  test('should search conversations', async () => {
    await store.create({
      title: 'Important Meeting Notes',
      provider: 'openai',
      model: 'gpt-4',
    });
    await store.create({
      title: 'Random Thoughts',
      provider: 'openai',
      model: 'gpt-4',
    });

    const results = await store.search('meeting');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Meeting');
  });
});
