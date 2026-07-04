import { encryptConversation, decryptConversation } from '../../privacy/encryption';

describe('Encryption', () => {
  test('should encrypt and decrypt data', async () => {
    const data = { message: 'Secret message', user: 'test' };
    const key = 'test-encryption-key';

    const encrypted = await encryptConversation(data, key);
    expect(encrypted).not.toBe(JSON.stringify(data));

    const decrypted = await decryptConversation(encrypted, key);
    expect(decrypted).toEqual(data);
  });

  test('should handle empty data', async () => {
    const data = {};
    const key = 'test-key';

    const encrypted = await encryptConversation(data, key);
    const decrypted = await decryptConversation(encrypted, key);

    expect(decrypted).toEqual(data);
  });

  test('should produce different ciphertext each time', async () => {
    const data = { message: 'Test' };
    const key = 'test-key';

    const encrypted1 = await encryptConversation(data, key);
    const encrypted2 = await encryptConversation(data, key);

    // Due to IV, should be different
    expect(encrypted1).not.toBe(encrypted2);
  });

  test('should fail with wrong key', async () => {
    const data = {
      message: 'Secret',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const key1 = 'correct-key';
    const key2 = 'wrong-key';

    const encrypted = await encryptConversation(data, key1);

    // Should throw when decrypting with wrong key
    await expect(decryptConversation(encrypted, key2)).rejects.toThrow();
  });
});
