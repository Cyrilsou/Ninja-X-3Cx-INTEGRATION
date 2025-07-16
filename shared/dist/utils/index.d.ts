export declare function formatDuration(seconds: number): string;
export declare function cleanPhoneNumber(phoneNumber: string): string;
export declare function formatPhoneNumber(phoneNumber: string): string;
export declare function generateCallId(): string;
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
export declare function calculateConfidence(segments: {
    confidence: number;
}[]): number;
export declare function extractKeywords(text: string): string[];
export declare function sanitizeForMarkdown(text: string): string;
export declare class Logger {
    private service;
    constructor(service: string);
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
//# sourceMappingURL=index.d.ts.map