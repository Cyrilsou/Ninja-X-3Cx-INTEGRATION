// Simple Logger pour le navigateur
class Logger {
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
    console.log(`[${new Date().toISOString()}] [${this.service}] DEBUG:`, message, ...args);
  }
}

// Simple EventEmitter pour le navigateur
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
}

export interface OfflineData {
  id: string;
  type: 'call' | 'transcription' | 'analysis' | 'audio';
  timestamp: Date;
  data: any;
  retryCount: number;
  lastRetry?: Date;
}

export interface OfflineConfig {
  maxRetries?: number;
  retryDelay?: number;
  maxStorageSize?: number; // MB
  maxAge?: number; // heures
  batchSize?: number;
}

export class OfflineManager extends EventEmitter {
  private logger = new Logger('OfflineManager');
  private config: Required<OfflineConfig>;
  private queue: OfflineData[] = [];
  private processing = false;
  private retryTimer?: NodeJS.Timeout;
  private isOnline = navigator.onLine;

  constructor(config: OfflineConfig = {}) {
    super();
    
    this.config = {
      maxRetries: 5,
      retryDelay: 30000, // 30 secondes
      maxStorageSize: 100, // 100 MB
      maxAge: 24, // 24 heures
      batchSize: 10,
      ...config
    };

    this.setupOnlineDetection();
    this.loadFromStorage();
    this.scheduleCleanup();
  }

  // Détecter les changements de connectivité
  private setupOnlineDetection(): void {
    const handleOnline = () => {
      this.logger.info('Connection restored');
      this.isOnline = true;
      this.emit('online');
      this.processQueue();
    };

    const handleOffline = () => {
      this.logger.info('Connection lost');
      this.isOnline = false;
      this.emit('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Ajouter des données à la queue offline
  async addToQueue(type: OfflineData['type'], data: any): Promise<void> {
    const item: OfflineData = {
      id: this.generateId(),
      type,
      timestamp: new Date(),
      data,
      retryCount: 0
    };

    this.queue.push(item);
    this.emit('item:added', item);
    
    // Sauvegarder
    await this.saveToStorage();
    
    // Nettoyer si nécessaire
    await this.cleanup();
    
    this.logger.info(`Added ${type} to offline queue (${this.queue.length} items)`);
  }

  // Traiter la queue
  async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.logger.info(`Processing offline queue (${this.queue.length} items)`);

    try {
      // Traiter par batch
      const batch = this.queue.slice(0, this.config.batchSize);
      
      for (const item of batch) {
        try {
          await this.processItem(item);
          
          // Retirer de la queue
          this.queue = this.queue.filter(q => q.id !== item.id);
          this.emit('item:processed', item);
          
        } catch (error) {
          this.logger.error(`Failed to process item ${item.id}:`, error);
          
          // Incrémenter le compteur de retry
          item.retryCount++;
          item.lastRetry = new Date();
          
          if (item.retryCount >= this.config.maxRetries) {
            this.logger.error(`Max retries reached for item ${item.id}, removing`);
            this.queue = this.queue.filter(q => q.id !== item.id);
            this.emit('item:failed', item);
          } else {
            this.emit('item:retry', item);
          }
        }
      }

      // Sauvegarder l'état
      await this.saveToStorage();
      
      // Continuer s'il reste des éléments
      if (this.queue.length > 0) {
        this.scheduleRetry();
      }
      
    } finally {
      this.processing = false;
    }
  }

  // Traiter un élément individuel
  private async processItem(item: OfflineData): Promise<void> {
    switch (item.type) {
      case 'call':
        await this.processCall(item);
        break;
      case 'transcription':
        await this.processTranscription(item);
        break;
      case 'analysis':
        await this.processAnalysis(item);
        break;
      case 'audio':
        await this.processAudio(item);
        break;
      default:
        throw new Error(`Unknown item type: ${item.type}`);
    }
  }

  // Traitement spécifique par type
  private async processCall(item: OfflineData): Promise<void> {
    const response = await fetch('/api/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
      },
      body: JSON.stringify(item.data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async processTranscription(item: OfflineData): Promise<void> {
    const response = await fetch('/api/transcriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
      },
      body: JSON.stringify(item.data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async processAnalysis(item: OfflineData): Promise<void> {
    const response = await fetch('/api/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
      },
      body: JSON.stringify(item.data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async processAudio(item: OfflineData): Promise<void> {
    const formData = new FormData();
    formData.append('audio', item.data.audioBlob);
    formData.append('callId', item.data.callId);
    formData.append('metadata', JSON.stringify(item.data.metadata));

    const response = await fetch('/api/audio', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // Programmer un retry
  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      this.processQueue();
    }, this.config.retryDelay);
  }

  // Nettoyage périodique
  private scheduleCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Toutes les minutes
  }

  // Nettoyer les anciennes données
  private async cleanup(): Promise<void> {
    const now = new Date();
    const maxAge = this.config.maxAge * 60 * 60 * 1000; // Convertir en ms
    
    const initialCount = this.queue.length;
    
    // Supprimer les éléments trop anciens
    this.queue = this.queue.filter(item => {
      const age = now.getTime() - item.timestamp.getTime();
      return age < maxAge;
    });

    // Supprimer les éléments qui ont atteint le max de retries
    this.queue = this.queue.filter(item => item.retryCount < this.config.maxRetries);

    // Limiter par taille si nécessaire
    const currentSize = this.calculateStorageSize();
    if (currentSize > this.config.maxStorageSize) {
      // Supprimer les plus anciens
      this.queue.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      while (this.calculateStorageSize() > this.config.maxStorageSize * 0.8) {
        this.queue.shift();
      }
    }

    const removedCount = initialCount - this.queue.length;
    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} items from offline queue`);
      await this.saveToStorage();
    }
  }

  // Calculer la taille de stockage
  private calculateStorageSize(): number {
    const data = JSON.stringify(this.queue);
    return new Blob([data]).size / 1024 / 1024; // MB
  }

  // Sauvegarder dans le localStorage
  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        queue: this.queue,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('offline-queue', JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to save offline queue:', error);
    }
  }

  // Charger depuis le localStorage
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('offline-queue');
      if (data) {
        const parsed = JSON.parse(data);
        this.queue = parsed.queue.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
          lastRetry: item.lastRetry ? new Date(item.lastRetry) : undefined
        }));
        
        this.logger.info(`Loaded ${this.queue.length} items from offline storage`);
      }
    } catch (error) {
      this.logger.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  // Générer un ID unique
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Méthodes publiques
  
  // Obtenir les statistiques
  getStats(): {
    queueSize: number;
    storageSize: number;
    oldestItem?: Date;
    newestItem?: Date;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    
    this.queue.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });

    return {
      queueSize: this.queue.length,
      storageSize: this.calculateStorageSize(),
      oldestItem: this.queue.length > 0 ? new Date(Math.min(...this.queue.map(i => i.timestamp.getTime()))) : undefined,
      newestItem: this.queue.length > 0 ? new Date(Math.max(...this.queue.map(i => i.timestamp.getTime()))) : undefined,
      byType
    };
  }

  // Vider la queue
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveToStorage();
    this.emit('queue:cleared');
  }

  // Forcer le traitement
  async forceProcess(): Promise<void> {
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  // Getter pour l'état en ligne
  get online(): boolean {
    return this.isOnline;
  }

  // Destruction
  destroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.removeAllListeners();
  }
}