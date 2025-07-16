import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { Agent, Logger } from '@3cx-ninja/shared';

export interface ConnectionConfig {
  serverUrl: string;
  apiKey: string;
  agentInfo: Agent;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  latency?: number;
  serverVersion?: string;
  serverTime?: Date;
}

export class ConnectionManager extends EventEmitter {
  private socket: Socket | null = null;
  private config: ConnectionConfig;
  private status: ConnectionStatus;
  private logger = new Logger('ConnectionManager');
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private latencyTimer?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(config: ConnectionConfig) {
    super();
    this.config = {
      reconnectAttempts: 10,
      reconnectDelay: 5000,
      heartbeatInterval: 30000,
      timeout: 10000,
      ...config
    };
    
    this.status = {
      connected: false,
      authenticated: false,
      reconnectAttempts: 0
    };
  }

  // Connexion initiale
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('ConnectionManager has been destroyed');
    }

    return new Promise((resolve, reject) => {
      try {
        this.logger.info(`Connecting to ${this.config.serverUrl}`);
        
        this.socket = io(this.config.serverUrl, {
          auth: {
            apiKey: this.config.apiKey
          },
          timeout: this.config.timeout,
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: false, // Gestion manuelle
          autoConnect: false
        });

        this.setupSocketListeners();
        
        // Timeout pour la connexion
        const connectTimeout = setTimeout(() => {
          this.logger.error('Connection timeout');
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket.on('connect', () => {
          clearTimeout(connectTimeout);
          this.onConnected();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectTimeout);
          this.logger.error('Connection error:', error);
          reject(error);
        });

        this.socket.connect();
      } catch (error) {
        this.logger.error('Failed to create socket:', error);
        reject(error);
      }
    });
  }

  // Déconnexion propre
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting...');
    
    this.clearTimers();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.status.connected = false;
    this.status.authenticated = false;
    this.emit('disconnected');
  }

  // Destruction complète
  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.removeAllListeners();
  }

  // Configuration des listeners socket
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => this.onConnected());
    this.socket.on('disconnect', (reason) => this.onDisconnected(reason));
    this.socket.on('connect_error', (error) => this.onConnectionError(error));
    this.socket.on('reconnect_error', (error) => this.onReconnectError(error));
    
    // Événements d'authentification
    this.socket.on('auth:success', (data) => this.onAuthSuccess(data));
    this.socket.on('auth:failed', (error) => this.onAuthFailed(error));
    
    // Heartbeat
    this.socket.on('heartbeat', () => this.onHeartbeat());
    this.socket.on('pong', (timestamp) => this.onPong(timestamp));
    
    // Événements métier
    this.socket.on('server:info', (info) => this.onServerInfo(info));
    this.socket.on('server:notification', (notification) => this.emit('notification', notification));
    this.socket.on('server:update', (update) => this.emit('server:update', update));
  }

  // Connexion établie
  private onConnected(): void {
    this.logger.info('Connected to server');
    this.status.connected = true;
    this.status.reconnectAttempts = 0;
    
    // Authentifier l'agent
    this.authenticateAgent();
    
    // Démarrer le heartbeat
    this.startHeartbeat();
    
    this.emit('connected');
  }

  // Authentification de l'agent
  private authenticateAgent(): void {
    if (!this.socket) return;
    
    this.logger.info('Authenticating agent...');
    this.socket.emit('agent:connect', {
      agentId: this.config.agentInfo.id,
      email: this.config.agentInfo.email,
      extension: this.config.agentInfo.extension,
      version: process.env.npm_package_version || '1.0.0',
      platform: process.platform,
      capabilities: {
        audio: true,
        video: false,
        transcription: true,
        analysis: true
      }
    });
  }

  // Succès d'authentification
  private onAuthSuccess(data: any): void {
    this.logger.info('Authentication successful');
    this.status.authenticated = true;
    this.status.serverVersion = data.serverVersion;
    this.status.serverTime = new Date(data.serverTime);
    
    this.emit('authenticated', data);
  }

  // Échec d'authentification
  private onAuthFailed(error: any): void {
    this.logger.error('Authentication failed:', error);
    this.status.authenticated = false;
    this.emit('auth:failed', error);
  }

  // Déconnexion
  private onDisconnected(reason: string): void {
    this.logger.warn(`Disconnected: ${reason}`);
    this.status.connected = false;
    this.status.authenticated = false;
    
    this.clearTimers();
    this.emit('disconnected', reason);
    
    // Tentative de reconnexion automatique
    if (!this.isDestroyed && this.shouldReconnect(reason)) {
      this.scheduleReconnect();
    }
  }

  // Erreur de connexion
  private onConnectionError(error: any): void {
    this.logger.error('Connection error:', error);
    this.emit('connection:error', error);
  }

  // Erreur de reconnexion
  private onReconnectError(error: any): void {
    this.logger.error('Reconnection error:', error);
    this.emit('reconnect:error', error);
  }

  // Heartbeat reçu
  private onHeartbeat(): void {
    this.status.lastHeartbeat = new Date();
    
    // Répondre au heartbeat
    if (this.socket) {
      this.socket.emit('heartbeat:response');
    }
  }

  // Pong reçu (pour calcul de latence)
  private onPong(timestamp: number): void {
    const now = Date.now();
    this.status.latency = now - timestamp;
    this.emit('latency', this.status.latency);
  }

  // Informations serveur
  private onServerInfo(info: any): void {
    this.status.serverVersion = info.version;
    this.status.serverTime = new Date(info.time);
    this.emit('server:info', info);
  }

  // Démarrer le heartbeat
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval!);
  }

  // Envoyer heartbeat
  private sendHeartbeat(): void {
    if (this.socket && this.status.connected) {
      const timestamp = Date.now();
      this.socket.emit('ping', timestamp);
    }
  }

  // Déterminer si on doit reconnecter
  private shouldReconnect(reason: string): boolean {
    const noReconnectReasons = [
      'io server disconnect',
      'client namespace disconnect',
      'forced close'
    ];
    
    return !noReconnectReasons.includes(reason) && 
           this.status.reconnectAttempts < this.config.reconnectAttempts!;
  }

  // Programmer une reconnexion
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.status.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.status.reconnectAttempts - 1);
    
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.status.reconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.status.reconnectAttempts, delay });
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  // Reconnexion
  private async reconnect(): Promise<void> {
    if (this.isDestroyed) return;
    
    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      this.logger.error('Reconnection failed:', error);
      this.scheduleReconnect();
    }
  }

  // Nettoyer les timers
  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.latencyTimer) {
      clearTimeout(this.latencyTimer);
      this.latencyTimer = undefined;
    }
  }

  // Envoyer un événement
  emit(event: string, ...args: any[]): boolean {
    if (this.socket && this.status.connected) {
      this.socket.emit(event, ...args);
      return true;
    }
    return false;
  }

  // Getters
  get isConnected(): boolean {
    return this.status.connected;
  }

  get isAuthenticated(): boolean {
    return this.status.authenticated;
  }

  get getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  get getSocket(): Socket | null {
    return this.socket;
  }

  // Méthodes utilitaires
  async waitForConnection(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status.connected && this.status.authenticated) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        this.off('authenticated', onAuthenticated);
        reject(new Error('Connection timeout'));
      }, timeout);

      const onAuthenticated = () => {
        clearTimeout(timer);
        resolve();
      };

      this.once('authenticated', onAuthenticated);
    });
  }

  // Test de connectivité
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || !this.status.connected) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      this.socket.emit('ping', Date.now(), (response: any) => {
        clearTimeout(timeout);
        resolve(response === 'pong');
      });
    });
  }

  // Statistiques de connexion
  getConnectionStats(): any {
    return {
      status: this.status,
      config: {
        serverUrl: this.config.serverUrl,
        reconnectAttempts: this.config.reconnectAttempts,
        reconnectDelay: this.config.reconnectDelay,
        heartbeatInterval: this.config.heartbeatInterval
      },
      socket: this.socket ? {
        id: this.socket.id,
        connected: this.socket.connected,
        transport: this.socket.io.engine.transport.name
      } : null
    };
  }
}