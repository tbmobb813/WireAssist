/**
 * Privacy Service
 * Manages encryption, audit logging, and privacy settings for search data
 */

import { encryptionService, type EncryptedData } from './encryptionService';
import { auditService } from './auditService';

export interface PrivacySettings {
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  autoDeleteHistoryDays?: number; // Auto-delete search history after N days
  encryptQueryStrings: boolean; // Encrypt search queries in storage
  encryptResults: boolean; // Encrypt result data
  anonymizeIpAddress: boolean; // Hide IP addresses in audit logs
  dataRetentionDays: number; // Keep logs for N days
}

export interface PrivacyStatus {
  isEncryptionInitialized: boolean;
  auditLoggingEnabled: boolean;
  totalAuditLogs: number;
  encryptedQueries: number;
}

export class PrivacyService {
  private settings: PrivacySettings = {
    encryptionEnabled: false,
    auditLoggingEnabled: true,
    autoDeleteHistoryDays: 90,
    encryptQueryStrings: true,
    encryptResults: false,
    anonymizeIpAddress: true,
    dataRetentionDays: 90,
  };

  private encryptedCache: Map<string, EncryptedData> = new Map();

  /**
   * Initialize privacy service with encryption
   */
  initializeEncryption(password: string): void {
    encryptionService.initialize(password);
    this.settings.encryptionEnabled = true;
    auditService.enableEncryption(true);
  }

  /**
   * Update privacy settings
   */
  updateSettings(settings: Partial<PrivacySettings>): void {
    this.settings = { ...this.settings, ...settings };
    auditService.enableEncryption(settings.encryptionEnabled ?? this.settings.encryptionEnabled);
  }

  /**
   * Get current privacy settings
   */
  getSettings(): PrivacySettings {
    return { ...this.settings };
  }

  /**
   * Get privacy status
   */
  getStatus(): PrivacyStatus {
    return {
      isEncryptionInitialized: encryptionService.isInitialized(),
      auditLoggingEnabled: this.settings.auditLoggingEnabled,
      totalAuditLogs: auditService.getLogs().length,
      encryptedQueries: this.encryptedCache.size,
    };
  }

  /**
   * Encrypt a search query if encryption is enabled
   */
  encryptQuery(query: string): string | EncryptedData {
    if (!this.settings.encryptionEnabled || !this.settings.encryptQueryStrings) {
      return query;
    }

    try {
      const encrypted = encryptionService.encrypt(query);
      // Cache for later decryption
      const cacheKey = encryptionService.hash(query);
      this.encryptedCache.set(cacheKey, encrypted);
      return encrypted;
    } catch (error) {
      console.error('Failed to encrypt query:', error);
      return query; // Fallback to unencrypted
    }
  }

  /**
   * Decrypt a query
   */
  decryptQuery(data: string | EncryptedData): string {
    if (typeof data === 'string') {
      return data;
    }

    if (!this.settings.encryptionEnabled) {
      throw new Error('Encryption is not enabled');
    }

    try {
      return encryptionService.decrypt(data);
    } catch (error) {
      console.error('Failed to decrypt query:', error);
      throw error;
    }
  }

  /**
   * Encrypt search results
   */
  encryptResults(results: unknown): EncryptedData {
    if (!encryptionService.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      return encryptionService.encryptObject(results);
    } catch (error) {
      console.error('Failed to encrypt results:', error);
      throw error;
    }
  }

  /**
   * Decrypt search results
   */
  decryptResults<T>(encryptedData: EncryptedData): T {
    if (!encryptionService.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      return encryptionService.decryptObject<T>(encryptedData);
    } catch (error) {
      console.error('Failed to decrypt results:', error);
      throw error;
    }
  }

  /**
   * Log a search operation
   */
  logSearch(query: string, resultCount: number, executionTimeMs: number, error?: string): void {
    if (!this.settings.auditLoggingEnabled) {
      return;
    }

    auditService.logSearch(query, resultCount, executionTimeMs, error ? 'error' : 'success', error);
  }

  /**
   * Log a filter operation
   */
  logFilter(filters: Record<string, unknown>, error?: string): void {
    if (!this.settings.auditLoggingEnabled) {
      return;
    }

    auditService.logFilter(filters, error ? 'error' : 'success', error);
  }

  /**
   * Log viewing a result
   */
  logViewResult(resultId: string, resultType: 'conversation' | 'message'): void {
    if (!this.settings.auditLoggingEnabled) {
      return;
    }

    auditService.logViewResult(resultId, resultType);
  }

  /**
   * Log history deletion
   */
  logDeleteHistory(count: number): void {
    if (!this.settings.auditLoggingEnabled) {
      return;
    }

    auditService.logDeleteHistory(count);
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit?: number) {
    return auditService.getLogs(limit);
  }

  /**
   * Get audit statistics
   */
  getAuditStats() {
    return auditService.getStats();
  }

  /**
   * Clear encryption keys from memory
   */
  clearEncryption(): void {
    encryptionService.clear();
    this.settings.encryptionEnabled = false;
    this.encryptedCache.clear();
  }

  /**
   * Clear all audit logs
   */
  clearAuditLogs(): void {
    auditService.clearLogs();
  }

  /**
   * Enforce data retention policy
   */
  enforceRetention(): number {
    const retentionMs = this.settings.dataRetentionDays * 24 * 60 * 60 * 1000;
    return auditService.clearOldLogs(retentionMs);
  }

  /**
   * Export audit logs
   */
  exportAuditLogs(format: 'json' | 'csv' = 'json'): string {
    return auditService.exportLogs(format);
  }
}

// Export singleton
export const privacyService = new PrivacyService();
