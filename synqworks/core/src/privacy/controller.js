"use strict";
// @lai/core/src/privacy/controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyController = void 0;
const audit_1 = require("./audit");
class PrivacyController {
    constructor(settings) {
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "auditLogger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.settings = {
            localFirst: false,
            auditEnabled: false,
            encryptConversations: false,
            neverSendPatterns: [],
            ...settings,
        };
        if (this.settings.auditEnabled) {
            this.auditLogger = new audit_1.AuditLogger();
        }
    }
    async shouldUseLocal(prompt) {
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
    async logRequest(request) {
        if (!this.auditLogger)
            return;
        await this.auditLogger.log(request);
    }
    getAuditLog(options) {
        if (!this.auditLogger)
            return Promise.resolve([]);
        return this.auditLogger.query(options);
    }
    get auditEnabled() {
        return this.settings.auditEnabled;
    }
}
exports.PrivacyController = PrivacyController;
