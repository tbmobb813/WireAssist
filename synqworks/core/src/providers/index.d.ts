import type { Provider, ProviderType } from './base';
import type { ProviderConfig } from '../types';
export declare class ProviderFactory {
    static create(config: ProviderConfig): Provider;
    static detectAvailable(): Promise<ProviderType[]>;
}
//# sourceMappingURL=index.d.ts.map