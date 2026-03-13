/**
 * Encryption Service
 * Handles encryption and decryption of sensitive search data
 */

import crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  algorithm: string;
}

export class EncryptionService {
  private masterKey: Buffer | null = null;
  private readonly DEFAULT_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16, // 128 bits
    saltLength: 16,
    iterations: 100000, // PBKDF2 iterations
  };

  /**
   * Initialize encryption service with a master key
   */
  initialize(password: string): void {
    // Derive key from password using PBKDF2
    this.masterKey = crypto.pbkdf2Sync(
      password,
      'lai-encryption-salt', // Static salt for consistent key derivation
      this.DEFAULT_CONFIG.iterations,
      this.DEFAULT_CONFIG.keyLength,
      'sha256',
    );
  }

  /**
   * Check if encryption service is initialized
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Set master key directly (for testing or key restoration)
   */
  setMasterKey(key: string): void {
    this.masterKey = Buffer.from(key, 'hex');
  }

  /**
   * Get master key as hex string (for backup)
   */
  getMasterKey(): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }
    return this.masterKey.toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): EncryptedData {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    // Generate random IV and salt
    const iv = crypto.randomBytes(this.DEFAULT_CONFIG.ivLength);
    const salt = crypto.randomBytes(this.DEFAULT_CONFIG.saltLength);

    // Derive key from master key and salt
    const derivedKey = crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      this.DEFAULT_CONFIG.iterations,
      this.DEFAULT_CONFIG.keyLength,
      'sha256',
    );

    // Create cipher and encrypt
    const cipher = crypto.createCipheriv(this.DEFAULT_CONFIG.algorithm, derivedKey, iv) as crypto.CipherGCM;
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag for GCM
    const tag = cipher.getAuthTag();

    // Combine encrypted data with auth tag
    const combinedEncrypted = encrypted + tag.toString('hex');

    return {
      encrypted: combinedEncrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      algorithm: this.DEFAULT_CONFIG.algorithm,
    };
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const salt = Buffer.from(encryptedData.salt, 'hex');

      // Derive key from master key and salt (same as encryption)
      const derivedKey = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        this.DEFAULT_CONFIG.iterations,
        this.DEFAULT_CONFIG.keyLength,
        'sha256',
      );

      // Extract auth tag (last 16 bytes in hex = 32 chars)
      const combinedEncrypted = encryptedData.encrypted;
      const encryptedWithoutTag = combinedEncrypted.slice(0, -32);
      const tagHex = combinedEncrypted.slice(-32);
      const tag = Buffer.from(tagHex, 'hex');

      // Create decipher and decrypt
      const decipher = crypto.createDecipheriv(encryptedData.algorithm, derivedKey, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedWithoutTag, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Encrypt an object (converts to JSON first)
   */
  encryptObject(obj: unknown): EncryptedData {
    const jsonStr = JSON.stringify(obj);
    return this.encrypt(jsonStr);
  }

  /**
   * Decrypt to an object
   */
  decryptObject<T>(encryptedData: EncryptedData): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Clear master key from memory
   */
  clear(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
  }

  /**
   * Hash a value (for deduplication, not encryption)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Export singleton
export const encryptionService = new EncryptionService();
