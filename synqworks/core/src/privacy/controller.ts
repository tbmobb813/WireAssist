// @lai/core/src/privacy/controller.ts

import type { PrivacySettings, AIRequest, AuditLogOptions } from '../types';
import { AuditLogger } from './audit';

export class PrivacyController {
  private settings: PrivacySettings;
  private auditLogger?: AuditLogger;

  constructor(settings?: PrivacySettings) {
    this.settings = {
      localFirst: false,
      auditEnabled: false,
      encryptConversations: false,
      neverSendPatterns: [],
      ...settings,
    };

    if (this.settings.auditEnabled) {
      this.auditLogger = new AuditLogger();
    }
  }

  async shouldUseLocal(prompt: string): Promise<boolean> {
    if (this.settings.localFirst) {
      return true;
    }

    // Check for sensitive patterns
    if (this.settings.neverSendPatterns) {
      for (const pattern of this.settings.neverSendPatterns) {
        if (new RegExp(pattern).test(prompt)) {
          console.warn(`Prompt matches sensitive pattern: ${pattern}`);
          return true; // Force local processing
        }
      }
    }

    return false;
  }

  async logRequest(request: AIRequest): Promise<void> {
    if (!this.auditLogger) return;
    await this.auditLogger.log(request);
  }

  getAuditLog(options?: AuditLogOptions): Promise<AIRequest[]> {
    if (!this.auditLogger) return Promise.resolve([]);
    return this.auditLogger.query(options);
  }

  get auditEnabled(): boolean {
    return this.settings.auditEnabled;
  }
}
