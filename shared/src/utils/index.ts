export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = cleanPhoneNumber(phoneNumber);
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phoneNumber;
}

export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function calculateConfidence(segments: { confidence: number }[]): number {
  if (segments.length === 0) return 0;
  const sum = segments.reduce((acc, seg) => acc + seg.confidence, 0);
  return sum / segments.length;
}

export function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'et', 'ou', 'mais',
    'pour', 'dans', 'sur', 'avec', 'sans', 'sous', 'je', 'tu', 'il', 'elle',
    'nous', 'vous', 'ils', 'elles', 'être', 'avoir', 'faire', 'dire', 'aller'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\sàâäçèéêëîïôùûü]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));

  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export function sanitizeForMarkdown(text: string): string {
  return text
    .replace(/[*_`~\[\]()#+-=|{}.!]/g, '\\$&')
    .replace(/\n/g, '  \n');
}

export class Logger {
  constructor(private service: string) {}

  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.service}] INFO:`, message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.service}] ERROR:`, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.service}] WARN:`, message, ...args);
  }

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] [${this.service}] DEBUG:`, message, ...args);
    }
  }
}