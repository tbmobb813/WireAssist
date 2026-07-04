'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ConversationEncryption = void 0;
exports.encryptConversation = encryptConversation;
exports.decryptConversation = decryptConversation;
exports.encryptString = encryptString;
exports.decryptString = decryptString;
// Conversation encryption
const crypto_1 = require('crypto');
const util_1 = require('util');
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
class ConversationEncryption {
  constructor(options) {
    Object.defineProperty(this, 'algorithm', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'keyLength', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.algorithm = options?.algorithm || 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
  }
  async encrypt(data, password) {
    const salt = (0, crypto_1.randomBytes)(16);
    const iv = (0, crypto_1.randomBytes)(16);
    const key = await scryptAsync(password, salt, this.keyLength);
    const cipher = (0, crypto_1.createCipheriv)(this.algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Combine salt, iv, authTag, and encrypted data
    const result = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };
    return JSON.stringify(result);
  }
  async decrypt(encryptedData, password) {
    const { salt, iv, authTag, encrypted } = JSON.parse(encryptedData);
    const key = await scryptAsync(password, Buffer.from(salt, 'hex'), this.keyLength);
    const decipher = (0, crypto_1.createDecipheriv)(this.algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  async encryptConversation(conversation, password) {
    const encrypted = { ...conversation };
    // Encrypt messages
    if (conversation.messages && Array.isArray(conversation.messages)) {
      encrypted.messages = await Promise.all(
        conversation.messages.map(async (msg) => ({
          ...msg,
          content: await this.encrypt(msg.content, password),
        }))
      );
    }
    // Mark as encrypted
    encrypted.encrypted = true;
    return encrypted;
  }
  async decryptConversation(encryptedConversation, password) {
    if (!encryptedConversation.encrypted) {
      return encryptedConversation; // Not encrypted
    }
    const decrypted = { ...encryptedConversation };
    // Decrypt messages
    if (encryptedConversation.messages && Array.isArray(encryptedConversation.messages)) {
      decrypted.messages = await Promise.all(
        encryptedConversation.messages.map(async (msg) => ({
          ...msg,
          content: await this.decrypt(msg.content, password),
        }))
      );
    }
    delete decrypted.encrypted;
    return decrypted;
  }
}
exports.ConversationEncryption = ConversationEncryption;
// Convenience functions
async function encryptConversation(data, password) {
  const encryption = new ConversationEncryption();
  return encryption.encryptConversation(data, password);
}
async function decryptConversation(encryptedData, password) {
  const encryption = new ConversationEncryption();
  return encryption.decryptConversation(encryptedData, password);
}
async function encryptString(text, password) {
  const encryption = new ConversationEncryption();
  return encryption.encrypt(text, password);
}
async function decryptString(encryptedText, password) {
  const encryption = new ConversationEncryption();
  return encryption.decrypt(encryptedText, password);
}
