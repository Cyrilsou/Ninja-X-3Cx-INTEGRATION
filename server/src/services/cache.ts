// Simple cache implementation with Redis-like interface
export const cache = {
  data: new Map<string, any>(),
  timers: new Map<string, NodeJS.Timeout>(),
  
  get(key: string) {
    return this.data.get(key);
  },
  
  set(key: string, value: any, ttl?: number) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    this.data.set(key, value);
    if (ttl) {
      const timer = setTimeout(() => {
        this.data.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }
  },
  
  // Alias for set with TTL (Redis-like)
  setex(key: string, ttl: number, value: any) {
    this.set(key, value, ttl);
  },
  
  delete(key: string) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.data.delete(key);
  },
  
  // Alias for delete (Redis-like)
  del(key: string) {
    return this.delete(key);
  },
  
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.data.clear();
  },
  
  // Get all keys matching a pattern (simplified)
  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }
};