// Conversation encryption
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface EncryptionOptions {
  password: string;
  algorithm?: string;
}

export class ConversationEncryption {
  private algorithm: string;
  private keyLength: number;

  constructor(options?: { algorithm?: string }) {
    this.algorithm = options?.algorithm || 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
  }

  async encrypt(data: string, password: string): Promise<string> {
    const salt = randomBytes(16);
    const iv = randomBytes(16);

    const key = (await scryptAsync(password, salt, this.keyLength)) as Buffer;
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    const result = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };

    return JSON.stringify(result);
  }

  async decrypt(encryptedData: string, password: string): Promise<string> {
    const { salt, iv, authTag, encrypted } = JSON.parse(encryptedData);

    const key = (await scryptAsync(password, Buffer.from(salt, 'hex'), this.keyLength)) as Buffer;

    const decipher = createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));

    (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async encryptConversation(conversation: any, password: string): Promise<any> {
    const encrypted = { ...conversation };

    // Encrypt messages
    if (conversation.messages && Array.isArray(conversation.messages)) {
      encrypted.messages = await Promise.all(
        conversation.messages.map(async (msg: any) => ({
          ...msg,
          content: await this.encrypt(msg.content, password),
        }))
      );
    }

    // Mark as encrypted
    encrypted.encrypted = true;

    return encrypted;
  }

  async decryptConversation(encryptedConversation: any, password: string): Promise<any> {
    if (!encryptedConversation.encrypted) {
      return encryptedConversation; // Not encrypted
    }

    const decrypted = { ...encryptedConversation };

    // Decrypt messages
    if (encryptedConversation.messages && Array.isArray(encryptedConversation.messages)) {
      decrypted.messages = await Promise.all(
        encryptedConversation.messages.map(async (msg: any) => ({
          ...msg,
          content: await this.decrypt(msg.content, password),
        }))
      );
    }

    delete decrypted.encrypted;

    return decrypted;
  }
}

// Convenience functions
export async function encryptConversation(data: any, password: string): Promise<any> {
  const encryption = new ConversationEncryption();
  return encryption.encryptConversation(data, password);
}

export async function decryptConversation(encryptedData: any, password: string): Promise<any> {
  const encryption = new ConversationEncryption();
  return encryption.decryptConversation(encryptedData, password);
}

export async function encryptString(text: string, password: string): Promise<string> {
  const encryption = new ConversationEncryption();
  return encryption.encrypt(text, password);
}

export async function decryptString(encryptedText: string, password: string): Promise<string> {
  const encryption = new ConversationEncryption();
  return encryption.decrypt(encryptedText, password);
}
