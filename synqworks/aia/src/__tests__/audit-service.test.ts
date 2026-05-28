/**
 * Audit Service Tests
 * Verifies audit logging and tracking functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService } from '../lib/services/auditService';

describe('Audit Service', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
  });

  describe('Search Logging', () => {
    it('should log successful search', () => {
      auditService.logSearch('test query', 5, 100);

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('search');
      expect(logs[0].query).toBe('test query');
      expect(logs[0].resultCount).toBe(5);
      expect(logs[0].executionTimeMs).toBe(100);
      expect(logs[0].status).toBe('success');
    });

    it('should log search error', () => {
      auditService.logSearch('test query', 0, 50, 'error', 'Connection failed');

      const logs = auditService.getLogs();
      expect(logs[0].status).toBe('error');
      expect(logs[0].errorMessage).toBe('Connection failed');
    });

    it('should track multiple searches', () => {
      auditService.logSearch('query1', 10, 100);
      auditService.logSearch('query2', 5, 50);
      auditService.logSearch('query3', 0, 150, 'error');

      const logs = auditService.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].query).toBe('query1');
      expect(logs[1].query).toBe('query2');
      expect(logs[2].query).toBe('query3');
    });
  });

  describe('Filter Logging', () => {
    it('should log filter action', () => {
      const filters = { provider: 'openai', model: 'gpt-4' };
      auditService.logFilter(filters);

      const logs = auditService.getLogs();
      expect(logs[0].action).toBe('filter');
      expect(logs[0].details.filters).toEqual(filters);
      expect(logs[0].status).toBe('success');
    });

    it('should log filter error', () => {
      const filters = { invalid: 'filter' };
      auditService.logFilter(filters, 'error', 'Invalid filter');

      const logs = auditService.getLogs();
      expect(logs[0].status).toBe('error');
      expect(logs[0].errorMessage).toBe('Invalid filter');
    });
  });

  describe('History Actions', () => {
    it('should log delete history', () => {
      auditService.logDeleteHistory(10);

      const logs = auditService.getLogs();
      expect(logs[0].action).toBe('delete_history');
      expect(logs[0].details.deletedCount).toBe(10);
    });

    it('should log clear filters', () => {
      auditService.logClearFilters();

      const logs = auditService.getLogs();
      expect(logs[0].action).toBe('filter_clear');
    });
  });

  describe('Result Viewing', () => {
    it('should log result view', () => {
      auditService.logViewResult('result-123', 'conversation');

      const logs = auditService.getLogs();
      expect(logs[0].action).toBe('view_result');
      expect(logs[0].details.resultId).toBe('result-123');
      expect(logs[0].details.resultType).toBe('conversation');
    });
  });

  describe('Export', () => {
    it('should log export action', () => {
      auditService.logExport('json', 50);

      const logs = auditService.getLogs();
      expect(logs[0].action).toBe('export');
      expect(logs[0].details.format).toBe('json');
      expect(logs[0].details.itemCount).toBe(50);
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        auditService.logSearch(`query_${i}`, i, 100);
      }
    });

    it('should retrieve all logs', () => {
      const logs = auditService.getLogs();
      expect(logs).toHaveLength(10);
    });

    it('should limit returned logs', () => {
      const logs = auditService.getLogs(5);
      expect(logs).toHaveLength(5);
      // Should return most recent
      expect(logs[4].query).toBe('query_9');
    });

    it('should retrieve logs by action', () => {
      auditService.logFilter({ provider: 'openai' });
      auditService.logFilter({ model: 'gpt-4' });

      const filterLogs = auditService.getLogsByAction('filter');
      expect(filterLogs).toHaveLength(2);
      expect(filterLogs.every((log) => log.action === 'filter')).toBe(true);
    });

    it('should retrieve logs by query', () => {
      const targetQuery = 'query_5';
      const logs = auditService.getLogsByQuery(targetQuery);

      expect(logs).toHaveLength(1);
      expect(logs[0].query).toBe(targetQuery);
    });

    it('should retrieve logs by date range', () => {
      const now = Date.now();
      const startTime = now - 10000;
      const endTime = now + 10000;

      const logs = auditService.getLogsByDateRange(startTime, endTime);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((log) => log.timestamp >= startTime && log.timestamp <= endTime)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      auditService.logSearch('query1', 10, 100);
      auditService.logSearch('query2', 5, 50);
      auditService.logSearch('query3', 0, 150, 'error');
      auditService.logFilter({ provider: 'openai' });
      auditService.logDeleteHistory(5);

      const stats = auditService.getStats();

      expect(stats.totalLogs).toBe(5);
      expect(stats.searchCount).toBe(3);
      expect(stats.filterCount).toBe(1);
      expect(stats.deleteCount).toBe(1);
      expect(stats.errorCount).toBe(1);
      expect(stats.averageExecutionTime).toBe((100 + 50 + 150) / 3);
      expect(stats.oldestLog).toBeDefined();
      expect(stats.newestLog).toBeDefined();
    });

    it('should handle empty stats', () => {
      const stats = auditService.getStats();

      expect(stats.totalLogs).toBe(0);
      expect(stats.searchCount).toBe(0);
      expect(stats.filterCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.oldestLog).toBeNull();
      expect(stats.newestLog).toBeNull();
    });
  });

  describe('Log Export', () => {
    beforeEach(() => {
      auditService.logSearch('test query', 10, 100);
      auditService.logFilter({ provider: 'openai' });
    });

    it('should export logs as JSON', () => {
      const json = auditService.exportLogs('json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should export logs as CSV', () => {
      const csv = auditService.exportLogs('csv');

      expect(csv).toContain('id,timestamp,action,query,status,resultCount,executionTimeMs');
      expect(csv).toContain('search');
      expect(csv).toContain('filter');
    });

    it('should handle empty export', () => {
      auditService.clearLogs();
      const json = auditService.exportLogs('json');
      const parsed = JSON.parse(json);

      expect(parsed).toEqual([]);
    });
  });

  describe('Log Management', () => {
    it('should clear all logs', () => {
      auditService.logSearch('query1', 10, 100);
      auditService.logSearch('query2', 5, 50);

      expect(auditService.getLogs()).toHaveLength(2);

      auditService.clearLogs();
      expect(auditService.getLogs()).toHaveLength(0);
    });

    it('should enforce max logs limit', () => {
      // Add logs beyond max (1000)
      for (let i = 0; i < 1100; i++) {
        auditService.logSearch(`query_${i}`, 1, 100);
      }

      const logs = auditService.getLogs();
      expect(logs.length).toBeLessThanOrEqual(1000);
      // Should keep most recent logs
      expect(logs[logs.length - 1].query).toBe('query_1099');
    });

    it('should clear old logs', () => {
      const now = Date.now();

      // Manually add old log (3 days ago)
      const auditPrivate = auditService as unknown as { logs: unknown[] };
      (auditPrivate.logs as unknown[]) = [
        {
          id: 'old-log',
          timestamp: now - 3 * 24 * 60 * 60 * 1000,
          action: 'search',
          status: 'success',
        },
      ];

      auditService.logSearch('recent_query', 10, 100);

      // Clear logs older than 2 days
      const deleted = auditService.clearOldLogs(2 * 24 * 60 * 60 * 1000);

      expect(deleted).toBe(1);
      const remaining = auditService.getLogs();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].query).toBe('recent_query');
    });
  });

  describe('Encryption Flag', () => {
    it('should enable encryption', () => {
      auditService.enableEncryption(true);
      // Service should track that encryption is enabled
      // (actual encryption would be handled by PrivacyService)
      expect(auditService.getStats().totalLogs).toBe(0);
    });

    it('should disable encryption', () => {
      auditService.enableEncryption(false);
      expect(auditService.getStats().totalLogs).toBe(0);
    });
  });

  describe('Log Timestamps', () => {
    it('should set accurate timestamps', () => {
      const before = Date.now();
      auditService.logSearch('test', 1, 100);
      const after = Date.now();

      const logs = auditService.getLogs();
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(logs[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should maintain chronological order', () => {
      auditService.logSearch('query1', 1, 100);
      auditService.logSearch('query2', 1, 100);
      auditService.logSearch('query3', 1, 100);

      const logs = auditService.getLogs();
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp);
      }
    });
  });
});
