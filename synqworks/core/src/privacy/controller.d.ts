import type { PrivacySettings, AIRequest, AuditLogOptions } from '../types';
export declare class PrivacyController {
    private settings;
    private auditLogger?;
    constructor(settings?: PrivacySettings);
    shouldUseLocal(prompt: string): Promise<boolean>;
    logRequest(request: AIRequest): Promise<void>;
    getAuditLog(options?: AuditLogOptions): Promise<AIRequest[]>;
    get auditEnabled(): boolean;
}
//# sourceMappingURL=controller.d.ts.map