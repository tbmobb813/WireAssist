import { MessageStore } from '../../storage/messages';
import { ConversationStore } from '../../storage/conversations';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = './test-messages.db';

describe('MessageStore', () => {
  let messageStore: MessageStore;
  let conversationStore: ConversationStore;
  let conversationId: string;

  beforeEach(async () => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
    messageStore = new MessageStore(TEST_DB);
    conversationStore = new ConversationStore(TEST_DB);

    conversationId = await conversationStore.create({
      title: 'Test Conversation',
      provider: 'openai',
      model: 'gpt-4',
    });
  });

  afterEach(() => {
    messageStore.close();
    conversationStore.close();
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  test('should create a message', async () => {
    const id = await messageStore.create({
      conversationId,
      role: 'user',
      content: 'Hello, AI!',
      timestamp: Date.now(),
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  test('should get a message by id', async () => {
    const id = await messageStore.create({
      conversationId,
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    });

    const message = await messageStore.get(id);
    expect(message.id).toBe(id);
    expect(message.content).toBe('Test message');
    expect(message.role).toBe('user');
  });

  test('should get messages by conversation', async () => {
    await messageStore.create({
      conversationId,
      role: 'user',
      content: 'First message',
      timestamp: Date.now(),
    });
    await messageStore.create({
      conversationId,
      role: 'assistant',
      content: 'Second message',
      timestamp: Date.now() + 1000,
    });

    const messages = await messageStore.getByConversation(conversationId);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
  });

  test('should delete a message', async () => {
    const id = await messageStore.create({
      conversationId,
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    });

    await messageStore.delete(id);
    await expect(messageStore.get(id)).rejects.toThrow();
  });

  test('should search messages', async () => {
    await messageStore.create({
      conversationId,
      role: 'user',
      content: 'How do I solve this problem?',
      timestamp: Date.now(),
    });
    await messageStore.create({
      conversationId,
      role: 'assistant',
      content: 'Random response',
      timestamp: Date.now() + 1000,
    });

    const results = await messageStore.search('problem');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('problem');
  });
});
