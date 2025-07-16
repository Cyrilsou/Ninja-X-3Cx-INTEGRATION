"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.formatDuration = formatDuration;
exports.cleanPhoneNumber = cleanPhoneNumber;
exports.formatPhoneNumber = formatPhoneNumber;
exports.generateCallId = generateCallId;
exports.debounce = debounce;
exports.calculateConfidence = calculateConfidence;
exports.extractKeywords = extractKeywords;
exports.sanitizeForMarkdown = sanitizeForMarkdown;
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
function cleanPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '');
}
function formatPhoneNumber(phoneNumber) {
    const cleaned = cleanPhoneNumber(phoneNumber);
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
}
function generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
function calculateConfidence(segments) {
    if (segments.length === 0)
        return 0;
    const sum = segments.reduce((acc, seg) => acc + seg.confidence, 0);
    return sum / segments.length;
}
function extractKeywords(text) {
    const commonWords = new Set([
        'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'et', 'ou', 'mais',
        'pour', 'dans', 'sur', 'avec', 'sans', 'sous', 'je', 'tu', 'il', 'elle',
        'nous', 'vous', 'ils', 'elles', 'être', 'avoir', 'faire', 'dire', 'aller'
    ]);
    const words = text.toLowerCase()
        .replace(/[^\w\sàâäçèéêëîïôùûü]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));
    const wordCount = new Map();
    words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    return Array.from(wordCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
}
function sanitizeForMarkdown(text) {
    return text
        .replace(/[*_`~\[\]()#+-=|{}.!]/g, '\\$&')
        .replace(/\n/g, '  \n');
}
class Logger {
    service;
    constructor(service) {
        this.service = service;
    }
    info(message, ...args) {
        console.log(`[${new Date().toISOString()}] [${this.service}] INFO:`, message, ...args);
    }
    error(message, ...args) {
        console.error(`[${new Date().toISOString()}] [${this.service}] ERROR:`, message, ...args);
    }
    warn(message, ...args) {
        console.warn(`[${new Date().toISOString()}] [${this.service}] WARN:`, message, ...args);
    }
    debug(message, ...args) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${new Date().toISOString()}] [${this.service}] DEBUG:`, message, ...args);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=index.js.map