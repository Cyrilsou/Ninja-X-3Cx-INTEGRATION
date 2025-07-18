import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { WebSocketCallEvent } from '../types/3cx.types';
import { handleWebSocketEvent } from '../handlers/websocketHandler';

export class WebSocketManager {
  private static ws: WebSocket | null = null;
  private static reconnectTimeout: NodeJS.Timeout | null = null;
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 10;
  private static reconnectDelay = 5000;

  static async initialize(): Promise<void> {
    await this.connect();
  }

  static async connect(): Promise<void> {
    try {
      const wsUrl = `${config.THREECX_API_URL.replace(/^https?/, 'wss')}/ws/v20/calls`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${config.THREECX_API_KEY}`,
          'User-Agent': '3CX-Integration/1.0'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.setupEventHandlers();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 15000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      logger.info('WebSocket connected to 3CX');
      this.reconnectAttempts = 0;

    } catch (error) {
      logger.error('WebSocket connection failed', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  private static setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const event = JSON.parse(data.toString()) as WebSocketCallEvent;
        logger.debug('WebSocket event received', { eventType: event.eventType, callId: event.callId });
        
        await handleWebSocketEvent(event);
      } catch (error) {
        logger.error('Failed to process WebSocket message', error);
      }
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error', error);
    });

    this.ws.on('close', (code, reason) => {
      logger.warn('WebSocket closed', { code, reason: reason.toString() });
      this.ws = null;
      this.scheduleReconnect();
    });

    this.ws.on('ping', () => {
      logger.debug('WebSocket ping received');
      this.ws?.pong();
    });

    // Send periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  private static scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection attempt failed', error);
      }
    }, delay);
  }

  static async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    logger.info('WebSocket disconnected');
  }

  static isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  static send(data: any): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    this.ws!.send(JSON.stringify(data));
  }
}