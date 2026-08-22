/**
 * Encryption Service Tests
 * Verifies data encryption and decryption functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from '../lib/services/encryptionService';

describe('Encryption Service', () => {
  let encryptionService: EncryptionService;
  const testPassword = 'test-secure-password-123';

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('Initialization', () => {
    it('should initialize with a password', () => {
      expect(encryptionService.isInitialized()).toBe(false);
      encryptionService.initialize(testPassword);
      expect(encryptionService.isInitialized()).toBe(true);
    });

    it('should throw error when encrypting without initialization', () => {
      expect(() => {
        encryptionService.encrypt('test data');
      }).toThrow('Encryption service not initialized');
    });

    it('should generate master key', () => {
      encryptionService.initialize(testPassword);
      const key = encryptionService.getMasterKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should restore key from hex string', () => {
      encryptionService.initialize(testPassword);
      const key = encryptionService.getMasterKey();

      const service2 = new EncryptionService();
      service2.setMasterKey(key);
      expect(service2.isInitialized()).toBe(true);
    });
  });

  describe('Encryption and Decryption', () => {
    beforeEach(() => {
      encryptionService.initialize(testPassword);
    });

    it('should encrypt and decrypt simple string', () => {
      const originalText = 'Hello, World!';
      const encrypted = encryptionService.encrypt(originalText);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const originalText = 'Test data';
      const encrypted1 = encryptionService.encrypt(originalText);
      const encrypted2 = encryptionService.encrypt(originalText);

      // Different IV and salt should produce different ciphertexts
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);

      // Both should decrypt to same value
      expect(encryptionService.decrypt(encrypted1)).toBe(originalText);
      expect(encryptionService.decrypt(encrypted2)).toBe(originalText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptionService.encrypt(specialText);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(specialText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا بالعالم';
      const encrypted = encryptionService.encrypt(unicodeText);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(unicodeText);
    });

    it('should handle large strings', () => {
      const largeText = 'a'.repeat(100000);
      const encrypted = encryptionService.encrypt(largeText);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(largeText);
    });

    it('should fail to decrypt with wrong password', () => {
      const originalText = 'Secret message';
      const encrypted = encryptionService.encrypt(originalText);

      const service2 = new EncryptionService();
      service2.initialize('wrong-password');

      expect(() => {
        service2.decrypt(encrypted);
      }).toThrow();
    });

    it('should fail if ciphertext is tampered', () => {
      const originalText = 'Secure data';
      const encrypted = encryptionService.encrypt(originalText);

      // Tamper with encrypted data (modify auth tag)
      const tampered = encrypted.encrypted;
      encrypted.encrypted = tampered.slice(0, -32) + '0'.repeat(32); // Replace auth tag

      expect(() => {
        encryptionService.decrypt(encrypted);
      }).toThrow();
    });
  });

  describe('Object Encryption', () => {
    beforeEach(() => {
      encryptionService.initialize(testPassword);
    });

    it('should encrypt and decrypt objects', () => {
      const originalObj = {
        query: 'test search',
        filters: { provider: 'openai' },
        timestamp: Date.now(),
      };

      const encrypted = encryptionService.encryptObject(originalObj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(originalObj);
    });

    it('should handle complex nested objects', () => {
      const complexObj = {
        search: {
          query: 'test',
          results: [
            { id: '1', title: 'Result 1', nested: { value: 'test' } },
            { id: '2', title: 'Result 2', nested: { value: 'test2' } },
          ],
        },
        metadata: {
          timestamp: Date.now(),
          count: 2,
        },
      };

      const encrypted = encryptionService.encryptObject(complexObj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(complexObj);
    });

    it('should handle arrays', () => {
      const arrayData = ['search1', 'search2', 'search3'];
      const encrypted = encryptionService.encryptObject(arrayData);
      const decrypted = encryptionService.decryptObject<string[]>(encrypted);
      expect(decrypted).toEqual(arrayData);
    });
  });

  describe('Hashing', () => {
    beforeEach(() => {
      encryptionService.initialize(testPassword);
    });

    it('should generate consistent hashes', () => {
      const data = 'test data to hash';
      const hash1 = encryptionService.hash(data);
      const hash2 = encryptionService.hash(data);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = encryptionService.hash('data1');
      const hash2 = encryptionService.hash('data2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce SHA256 hashes', () => {
      const data = 'test';
      const hash = encryptionService.hash(data);
      // SHA256 produces 64 character hex strings
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Memory Management', () => {
    it('should clear master key from memory', () => {
      encryptionService.initialize(testPassword);
      expect(encryptionService.isInitialized()).toBe(true);

      encryptionService.clear();
      expect(encryptionService.isInitialized()).toBe(false);

      // Should not be able to encrypt after clear
      expect(() => {
        encryptionService.encrypt('test');
      }).toThrow('Encryption service not initialized');
    });
  });

  describe('Key Derivation', () => {
    it('should derive same key from same password', () => {
      encryptionService.initialize(testPassword);
      const key1 = encryptionService.getMasterKey();

      encryptionService.clear();
      encryptionService.initialize(testPassword);
      const key2 = encryptionService.getMasterKey();

      expect(key1).toBe(key2);
    });

    it('should derive different keys from different passwords', () => {
      encryptionService.initialize('password1');
      const key1 = encryptionService.getMasterKey();

      encryptionService.clear();
      encryptionService.initialize('password2');
      const key2 = encryptionService.getMasterKey();

      expect(key1).not.toBe(key2);
    });
  });
});
