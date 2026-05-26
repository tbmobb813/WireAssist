/**
 * Audit Service
 * Tracks and logs all search operations for privacy and accountability
 */

export interface AuditLog {
  id: string;
  timestamp: number;
  action: 'search' | 'filter' | 'view_result' | 'delete_history' | 'export' | 'filter_clear';
  query?: string;
  details: Record<string, unknown>;
  userId?: string;
  ipAddress?: string;
  status: 'success' | 'error';
  errorMessage?: string;
  resultCount?: number;
  executionTimeMs?: number;
}

export interface AuditStats {
  totalLogs: number;
  searchCount: number;
  filterCount: number;
  deleteCount: number;
  errorCount: number;
  averageExecutionTime: number;
  oldestLog: number | null;
  newestLog: number | null;
}

export class AuditService {
  private logs: AuditLog[] = [];
  private readonly MAX_LOGS = 1000;
  private encryptionEnabled = false;

  /**
   * Enable encryption for audit logs
   */
  enableEncryption(enabled: boolean): void {
    this.encryptionEnabled = enabled;
  }

  /**
   * Log a search action
   */
  logSearch(query: string, resultCount: number, executionTimeMs: number, status: 'success' | 'error' = 'success', errorMessage?: string): void {
    this.addLog({
      action: 'search',
      query,
      resultCount,
      executionTimeMs,
      status,
      errorMessage,
    });
  }

  /**
   * Log a filter action
   */
  logFilter(filters: Record<string, unknown>, status: 'success' | 'error' = 'success', errorMessage?: string): void {
    this.addLog({
      action: 'filter',
      details: { filters },
      status,
      errorMessage,
    });
  }

  /**
   * Log a result view/click
   */
  logViewResult(resultId: string, resultType: 'conversation' | 'message'): void {
    this.addLog({
      action: 'view_result',
      details: { resultId, resultType },
      status: 'success',
    });
  }

  /**
   * Log a history deletion
   */
  logDeleteHistory(count: number): void {
    this.addLog({
      action: 'delete_history',
      details: { deletedCount: count },
      status: 'success',
    });
  }

  /**
   * Log a history clear
   */
  logClearFilters(): void {
    this.addLog({
      action: 'filter_clear',
      details: {},
      status: 'success',
    });
  }

  /**
   * Log an export action
   */
  logExport(format: string, itemCount: number): void {
    this.addLog({
      action: 'export',
      details: { format, itemCount },
      status: 'success',
    });
  }

  /**
   * Internal method to add a log entry
   */
  private addLog(logData: Partial<AuditLog>): void {
    const log: AuditLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      action: logData.action as AuditLog['action'],
      query: logData.query,
      details: logData.details || {},
      status: logData.status || 'success',
      errorMessage: logData.errorMessage,
      resultCount: logData.resultCount,
      executionTimeMs: logData.executionTimeMs,
    };

    this.logs.push(log);

    // Keep only most recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Get all audit logs
   */
  getLogs(limit?: number): AuditLog[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  /**
   * Get logs for a specific action type
   */
  getLogsByAction(action: AuditLog['action'], limit?: number): AuditLog[] {
    let filtered = this.logs.filter((log) => log.action === action);
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Get logs within a time range
   */
  getLogsByDateRange(startTime: number, endTime: number): AuditLog[] {
    return this.logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Get logs for a specific query
   */
  getLogsByQuery(query: string): AuditLog[] {
    return this.logs.filter((log) => log.query === query);
  }

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    const searchLogs = this.logs.filter((log) => log.action === 'search');
    const filterLogs = this.logs.filter((log) => log.action === 'filter');
    const deleteLogs = this.logs.filter((log) => log.action === 'delete_history');
    const errorLogs = this.logs.filter((log) => log.status === 'error');

    const executionTimes = searchLogs.filter((log) => log.executionTimeMs).map((log) => log.executionTimeMs!);
    const averageExecutionTime = executionTimes.length > 0 ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;

    return {
      totalLogs: this.logs.length,
      searchCount: searchLogs.length,
      filterCount: filterLogs.length,
      deleteCount: deleteLogs.length,
      errorCount: errorLogs.length,
      averageExecutionTime,
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
    };
  }

  /**
   * Export logs in a format
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['id', 'timestamp', 'action', 'query', 'status', 'resultCount', 'executionTimeMs'];
    const rows = this.logs.map((log) => [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.action,
      log.query || '',
      log.status,
      log.resultCount?.toString() || '',
      log.executionTimeMs?.toString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    return csv;
  }

  /**
   * Clear all audit logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Clear logs older than specified age in milliseconds
   */
  clearOldLogs(ageMs: number): number {
    const cutoffTime = Date.now() - ageMs;
    const initialLength = this.logs.length;
    this.logs = this.logs.filter((log) => log.timestamp > cutoffTime);
    return initialLength - this.logs.length;
  }

  /**
   * Generate unique ID for log entry
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton
export const auditService = new AuditService();
