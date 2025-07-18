import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  connect(): void {
    if (this.ws || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.emit('connected');
      
      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Start ping interval
      this.startPing();
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('close', (code, reason) => {
      console.log('WebSocket disconnected', { code, reason: reason.toString() });
      this.isConnecting = false;
      this.ws = null;
      
      // Stop ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      this.emit('disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('pong', () => {
      // Connection is alive
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket handshake completed', message.data);
        break;

      case 'newDraft':
        this.emit('newDraft', message.data);
        break;

      case 'ticketCreated':
        this.emit('ticketCreated', message.data);
        break;

      case 'confirmationReceived':
        this.emit('confirmationReceived', message.data);
        break;

      case 'cancellationReceived':
        this.emit('cancellationReceived', message.data);
        break;

      case 'error':
        this.emit('error', new Error(message.data.error));
        break;

      case 'pong':
        // Server ponged our ping
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
        this.ws.ping();
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    console.log(`Scheduling reconnect in ${this.reconnectInterval}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  confirmDraft(draftId: string, modifiedData?: any): void {
    this.send({
      type: 'confirmDraft',
      data: {
        draftId,
        action: 'confirm',
        modifiedData
      }
    });
  }

  cancelDraft(draftId: string): void {
    this.send({
      type: 'cancelDraft',
      data: { draftId }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}