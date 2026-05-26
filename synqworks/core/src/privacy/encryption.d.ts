export interface EncryptionOptions {
    password: string;
    algorithm?: string;
}
export declare class ConversationEncryption {
    private algorithm;
    private keyLength;
    constructor(options?: {
        algorithm?: string;
    });
    encrypt(data: string, password: string): Promise<string>;
    decrypt(encryptedData: string, password: string): Promise<string>;
    encryptConversation(conversation: any, password: string): Promise<any>;
    decryptConversation(encryptedConversation: any, password: string): Promise<any>;
}
export declare function encryptConversation(data: any, password: string): Promise<any>;
export declare function decryptConversation(encryptedData: any, password: string): Promise<any>;
export declare function encryptString(text: string, password: string): Promise<string>;
export declare function decryptString(encryptedText: string, password: string): Promise<string>;
//# sourceMappingURL=encryption.d.ts.map