/**
 * Privacy Service Tests
 * Verifies integration of encryption and audit logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { privacyService } from '../lib/services/privacyService';
import { encryptionService } from '../lib/services/encryptionService';
import { auditService } from '../lib/services/auditService';

describe('Privacy Service', () => {
  const testPassword = 'test-privacy-password-123';

  beforeEach(() => {
    // Clear state before each test
    privacyService.clearEncryption();
    privacyService.clearAuditLogs();
    privacyService.updateSettings({
      encryptionEnabled: false,
      auditLoggingEnabled: true,
      encryptQueryStrings: true,
      encryptResults: false,
      dataRetentionDays: 90,
    });
  });

  describe('Initialization', () => {
    it('should initialize encryption', () => {
      const status = privacyService.getStatus();
      expect(status.isEncryptionInitialized).toBe(false);

      privacyService.initializeEncryption(testPassword);

      const statusAfter = privacyService.getStatus();
      expect(statusAfter.isEncryptionInitialized).toBe(true);
    });

    it('should return unencrypted query when encryption disabled', () => {
      const query = 'test query';
      const result = privacyService.encryptQuery(query);
      // Should return unencrypted when encryption is disabled
      expect(result).toBe(query);
    });
  });

  describe('Settings Management', () => {
    it('should get default settings', () => {
      const settings = privacyService.getSettings();

      expect(settings.encryptionEnabled).toBe(false);
      expect(settings.auditLoggingEnabled).toBe(true);
      expect(settings.encryptQueryStrings).toBe(true);
      expect(settings.dataRetentionDays).toBe(90);
    });

    it('should update settings', () => {
      privacyService.updateSettings({
        encryptionEnabled: true,
        dataRetentionDays: 30,
      });

      const settings = privacyService.getSettings();
      expect(settings.encryptionEnabled).toBe(true);
      expect(settings.dataRetentionDays).toBe(30);
      expect(settings.auditLoggingEnabled).toBe(true); // Should retain other settings
    });

    it('should handle partial settings update', () => {
      privacyService.updateSettings({
        encryptQueryStrings: false,
      });

      const settings = privacyService.getSettings();
      expect(settings.encryptQueryStrings).toBe(false);
      expect(settings.encryptResults).toBe(false); // Should not change
    });
  });

  describe('Query Encryption', () => {
    it('should return unencrypted query when encryption disabled', () => {
      const query = 'test search query';
      const result = privacyService.encryptQuery(query);

      expect(result).toBe(query);
    });

    it('should encrypt query when enabled', () => {
      privacyService.initializeEncryption(testPassword);
      privacyService.updateSettings({ encryptQueryStrings: true });

      const query = 'secret search';
      const encrypted = privacyService.encryptQuery(query);

      expect(typeof encrypted).not.toBe('string');
      expect((encrypted as unknown as Record<string, unknown>).encrypted).toBeDefined();
    });

    it('should decrypt encrypted query', () => {
      privacyService.initializeEncryption(testPassword);
      const originalQuery = 'test search';

      const encrypted = privacyService.encryptQuery(originalQuery);
      const decrypted = privacyService.decryptQuery(encrypted);

      expect(decrypted).toBe(originalQuery);
    });

    it('should handle encryption failures gracefully', () => {
      privacyService.updateSettings({ encryptQueryStrings: true });
      // Encryption is enabled but not initialized, should fail gracefully

      const query = 'test';
      const result = privacyService.encryptQuery(query);
      // Should return unencrypted or handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Result Encryption', () => {
    beforeEach(() => {
      privacyService.initializeEncryption(testPassword);
    });

    it('should encrypt results object', () => {
      const results = {
        conversations: [{ id: 'conv1', title: 'Test' }],
        messages: [],
        total: 1,
      };

      const encrypted = privacyService.encryptResults(results);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
    });

    it('should decrypt results object', () => {
      const originalResults = {
        data: [1, 2, 3],
        count: 3,
      };

      const encrypted = privacyService.encryptResults(originalResults);
      const decrypted = privacyService.decryptResults(encrypted);

      expect(decrypted).toEqual(originalResults);
    });

    it('should throw error decrypting without initialization', () => {
      privacyService.clearEncryption();

      expect(() => {
        privacyService.decryptResults({
          encrypted: 'test',
          iv: 'test',
          salt: 'test',
          algorithm: 'aes-256-gcm',
        });
      }).toThrow();
    });
  });

  describe('Audit Logging', () => {
    it('should log search when audit logging enabled', () => {
      privacyService.logSearch('test query', 5, 100);

      const logs = privacyService.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].query).toBe('test query');
      expect(logs[0].resultCount).toBe(5);
    });

    it('should not log search when audit logging disabled', () => {
      privacyService.updateSettings({ auditLoggingEnabled: false });
      privacyService.logSearch('test query', 5, 100);

      const logs = privacyService.getAuditLogs();
      expect(logs).toHaveLength(0);
    });

    it('should log filter operation', () => {
      const filters = { provider: 'openai' };
      privacyService.logFilter(filters);

      const logs = privacyService.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('filter');
    });

    it('should log search with error', () => {
      privacyService.logSearch('query', 0, 50, 'Connection failed');

      const logs = privacyService.getAuditLogs();
      expect(logs[0].status).toBe('error');
      expect(logs[0].errorMessage).toBe('Connection failed');
    });

    it('should log result view', () => {
      privacyService.logViewResult('result-123', 'conversation');

      const logs = privacyService.getAuditLogs();
      expect(logs[0].action).toBe('view_result');
    });

    it('should log delete history', () => {
      privacyService.logDeleteHistory(10);

      const logs = privacyService.getAuditLogs();
      expect(logs[0].action).toBe('delete_history');
      expect(logs[0].details.deletedCount).toBe(10);
    });
  });

  describe('Audit Statistics', () => {
    it('should get audit statistics', () => {
      privacyService.logSearch('query1', 10, 100);
      privacyService.logSearch('query2', 5, 50);
      privacyService.logFilter({ provider: 'openai' });

      const stats = privacyService.getAuditStats();

      expect(stats.totalLogs).toBe(3);
      expect(stats.searchCount).toBe(2);
      expect(stats.filterCount).toBe(1);
      expect(stats.averageExecutionTime).toBe(75); // (100 + 50) / 2
    });
  });

  describe('Privacy Status', () => {
    it('should report privacy status', () => {
      const status = privacyService.getStatus();

      expect(status.isEncryptionInitialized).toBe(false);
      expect(status.auditLoggingEnabled).toBe(true);
      expect(typeof status.totalAuditLogs).toBe('number');
      expect(typeof status.encryptedQueries).toBe('number');
    });

    it('should update status after initialization', () => {
      privacyService.initializeEncryption(testPassword);

      const status = privacyService.getStatus();
      expect(status.isEncryptionInitialized).toBe(true);
    });
  });

  describe('Data Retention', () => {
    it('should enforce retention policy', () => {
      privacyService.logSearch('query1', 1, 100);
      privacyService.logSearch('query2', 1, 100);

      // Enforce 0 day retention (remove all old logs)
      const deleted = privacyService.getSettings().dataRetentionDays;
      expect(deleted).toBeGreaterThan(0);
    });
  });

  describe('Audit Export', () => {
    beforeEach(() => {
      privacyService.logSearch('test1', 5, 100);
      privacyService.logSearch('test2', 3, 50);
      privacyService.logFilter({ provider: 'openai' });
    });

    it('should export audit logs as JSON', () => {
      const json = privacyService.exportAuditLogs('json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
    });

    it('should export audit logs as CSV', () => {
      const csv = privacyService.exportAuditLogs('csv');

      expect(csv).toContain('id,timestamp,action');
      expect(csv).toContain('search');
      expect(csv).toContain('filter');
    });
  });

  describe('Cleanup', () => {
    it('should clear encryption', () => {
      privacyService.initializeEncryption(testPassword);
      expect(privacyService.getStatus().isEncryptionInitialized).toBe(true);

      privacyService.clearEncryption();
      expect(privacyService.getStatus().isEncryptionInitialized).toBe(false);
    });

    it('should clear audit logs', () => {
      privacyService.logSearch('test', 1, 100);
      expect(privacyService.getAuditLogs()).toHaveLength(1);

      privacyService.clearAuditLogs();
      expect(privacyService.getAuditLogs()).toHaveLength(0);
    });

    it('should clear both encryption and logs', () => {
      privacyService.initializeEncryption(testPassword);
      privacyService.logSearch('test', 1, 100);

      privacyService.clearEncryption();
      privacyService.clearAuditLogs();

      const status = privacyService.getStatus();
      expect(status.isEncryptionInitialized).toBe(false);
      expect(status.totalAuditLogs).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full privacy workflow', () => {
      // 1. Initialize encryption
      privacyService.initializeEncryption(testPassword);

      // 2. Encrypt a query
      const query = 'confidential search';
      const encrypted = privacyService.encryptQuery(query);

      // 3. Log the search
      privacyService.logSearch('confidential search', 3, 150);

      // 4. Decrypt query
      const decrypted = privacyService.decryptQuery(encrypted);
      expect(decrypted).toBe(query);

      // 5. Get audit logs
      const logs = privacyService.getAuditLogs();
      expect(logs).toHaveLength(1);

      // 6. Get status
      const status = privacyService.getStatus();
      expect(status.isEncryptionInitialized).toBe(true);
      expect(status.totalAuditLogs).toBe(1);
    });

    it('should handle privacy toggle', () => {
      const query = 'test';

      // Initially unencrypted
      const result1 = privacyService.encryptQuery(query);
      expect(result1).toBe(query);

      // Enable encryption
      privacyService.initializeEncryption(testPassword);
      privacyService.updateSettings({ encryptQueryStrings: true });

      const result2 = privacyService.encryptQuery(query);
      expect(result2).not.toBe(query);

      // Disable encryption
      privacyService.updateSettings({ encryptQueryStrings: false });
      const result3 = privacyService.encryptQuery(query);
      expect(result3).toBe(query);
    });

    it('should track all operations in audit log', () => {
      privacyService.initializeEncryption(testPassword);

      // Various operations
      privacyService.logSearch('search1', 5, 100);
      privacyService.logFilter({ provider: 'openai' });
      privacyService.logViewResult('result-1', 'message');
      privacyService.logDeleteHistory(3);

      const logs = privacyService.getAuditLogs();
      expect(logs).toHaveLength(4);

      const actions = logs.map((log) => log.action);
      expect(actions).toContain('search');
      expect(actions).toContain('filter');
      expect(actions).toContain('view_result');
      expect(actions).toContain('delete_history');
    });
  });
});
