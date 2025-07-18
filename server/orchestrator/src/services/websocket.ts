import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseService } from './database';
import { DraftTicketData, DraftConfirmation } from '../types/draft.types';

interface AuthenticatedWebSocket extends WebSocket {
  id: string;
  extension?: string;
  connectionType: 'agent' | 'tv';
  isAlive: boolean;
}

interface WebSocketMessage {
  type: string;
  data: any;
  id?: string;
  timestamp?: string;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private extensionClients: Map<string, Set<string>> = new Map();

  private constructor() {
    this.wss = new WebSocketServer({
      port: config.WEBSOCKET_PORT,
      perMessageDeflate: false
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  static getInstance(): WebSocketService {
    if (!this.instance) {
      this.instance = new WebSocketService();
    }
    return this.instance;
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, request) => {
      const client = ws as AuthenticatedWebSocket;
      client.id = uuidv4();
      client.isAlive = true;

      try {
        // Authenticate connection
        const token = this.extractToken(request.url || '');
        const connectionType = this.getConnectionType(request.url || '');
        
        if (connectionType === 'agent' && token) {
          const decoded = jwt.verify(token, config.JWT_SECRET) as any;
          client.extension = decoded.extension;
          
          // Update agent activity
          const agent = await DatabaseService.getAgentByExtension(decoded.extension);
          if (agent) {
            await DatabaseService.updateAgentActivity(agent.id);
          }
        }

        client.connectionType = connectionType;
        this.clients.set(client.id, client);

        // Track extension-based connections
        if (client.extension) {
          if (!this.extensionClients.has(client.extension)) {
            this.extensionClients.set(client.extension, new Set());
          }
          this.extensionClients.get(client.extension)!.add(client.id);
        }

        // Save connection to database
        await DatabaseService.saveWebSocketConnection(
          connectionType,
          client.id,
          client.extension
        );

        logger.info('WebSocket client connected', {
          id: client.id,
          type: connectionType,
          extension: client.extension
        });

        // Send welcome message
        this.sendToClient(client, {
          type: 'connected',
          data: {
            connectionId: client.id,
            connectionType,
            extension: client.extension
          }
        });

        // Setup client handlers
        this.setupClientHandlers(client);

      } catch (error) {
        logger.error('WebSocket authentication failed', error);
        client.close(1008, 'Authentication failed');
      }
    });
  }

  private setupClientHandlers(client: AuthenticatedWebSocket): void {
    client.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        await this.handleClientMessage(client, message);
      } catch (error) {
        logger.error('Failed to handle WebSocket message', error);
        this.sendError(client, 'Invalid message format');
      }
    });

    client.on('pong', () => {
      client.isAlive = true;
    });

    client.on('error', (error) => {
      logger.error('WebSocket client error', {
        id: client.id,
        error: error.message
      });
    });

    client.on('close', async () => {
      logger.info('WebSocket client disconnected', {
        id: client.id,
        extension: client.extension
      });

      // Remove from tracking
      this.clients.delete(client.id);
      
      if (client.extension && this.extensionClients.has(client.extension)) {
        this.extensionClients.get(client.extension)!.delete(client.id);
        if (this.extensionClients.get(client.extension)!.size === 0) {
          this.extensionClients.delete(client.extension);
        }
      }

      // Remove from database
      await DatabaseService.removeWebSocketConnection(client.id);
    });
  }

  private async handleClientMessage(
    client: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    logger.debug('Received WebSocket message', {
      clientId: client.id,
      type: message.type
    });

    switch (message.type) {
      case 'ping':
        this.sendToClient(client, { type: 'pong', data: {} });
        break;

      case 'confirmDraft':
        if (client.connectionType === 'agent') {
          await this.handleDraftConfirmation(client, message.data as DraftConfirmation);
        }
        break;

      case 'cancelDraft':
        if (client.connectionType === 'agent') {
          await this.handleDraftCancellation(client, message.data);
        }
        break;

      case 'getActiveConnections':
        if (client.connectionType === 'tv') {
          const connections = await DatabaseService.getActiveConnections();
          this.sendToClient(client, {
            type: 'activeConnections',
            data: connections
          });
        }
        break;

      default:
        logger.warn('Unknown message type', { type: message.type });
        this.sendError(client, 'Unknown message type');
    }
  }

  private async handleDraftConfirmation(
    client: AuthenticatedWebSocket,
    confirmation: DraftConfirmation
  ): Promise<void> {
    try {
      // Emit event for orchestrator to handle
      this.emit('draftConfirmed', {
        ...confirmation,
        extension: client.extension
      });

      this.sendToClient(client, {
        type: 'confirmationReceived',
        data: { draftId: confirmation.draftId }
      });
    } catch (error) {
      logger.error('Failed to handle draft confirmation', error);
      this.sendError(client, 'Failed to process confirmation');
    }
  }

  private async handleDraftCancellation(
    client: AuthenticatedWebSocket,
    data: { draftId: string }
  ): Promise<void> {
    try {
      // Emit event for orchestrator to handle
      this.emit('draftCancelled', {
        draftId: data.draftId,
        extension: client.extension
      });

      this.sendToClient(client, {
        type: 'cancellationReceived',
        data: { draftId: data.draftId }
      });
    } catch (error) {
      logger.error('Failed to handle draft cancellation', error);
      this.sendError(client, 'Failed to process cancellation');
    }
  }

  // Public methods for sending messages

  sendDraftToAgents(extensions: string[], draft: DraftTicketData): void {
    const message: WebSocketMessage = {
      type: 'newDraft',
      data: draft,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };

    extensions.forEach(extension => {
      const clientIds = this.extensionClients.get(extension);
      if (clientIds) {
        clientIds.forEach(clientId => {
          const client = this.clients.get(clientId);
          if (client && client.readyState === WebSocket.OPEN) {
            this.sendToClient(client, message);
          }
        });
      }
    });
  }

  broadcastToTVs(data: any): void {
    const message: WebSocketMessage = {
      type: 'tvUpdate',
      data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.connectionType === 'tv' && client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      }
    });
  }

  sendTicketCreated(extensions: string[], ticketData: any): void {
    const message: WebSocketMessage = {
      type: 'ticketCreated',
      data: ticketData,
      timestamp: new Date().toISOString()
    };

    extensions.forEach(extension => {
      const clientIds = this.extensionClients.get(extension);
      if (clientIds) {
        clientIds.forEach(clientId => {
          const client = this.clients.get(clientId);
          if (client && client.readyState === WebSocket.OPEN) {
            this.sendToClient(client, message);
          }
        });
      }
    });

    // Also broadcast to TVs
    this.broadcastToTVs(ticketData);
  }

  private sendToClient(client: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private sendError(client: AuthenticatedWebSocket, error: string): void {
    this.sendToClient(client, {
      type: 'error',
      data: { error },
      timestamp: new Date().toISOString()
    });
  }

  private extractToken(url: string): string | null {
    const match = url.match(/token=([^&]+)/);
    return match ? match[1] : null;
  }

  private getConnectionType(url: string): 'agent' | 'tv' {
    return url.includes('/tv') ? 'tv' : 'agent';
  }

  private startHeartbeat(): void {
    const interval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          logger.warn('Terminating inactive WebSocket client', { id: client.id });
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  // Event emitter functionality
  private eventHandlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}