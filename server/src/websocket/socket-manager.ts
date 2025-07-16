import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { 
  WSEvents, 
  Agent, 
  Call3CX, 
  AudioChunk, 
  RealtimeTranscription,
  Logger 
} from '@3cx-ninja/shared';
import { RedisService } from '../services/redis-service';
import { TranscriptionQueue } from '../services/transcription-queue';
import config from 'config';

export class SocketManager {
  private io: SocketServer;
  private agents: Map<string, Agent> = new Map();
  private logger = new Logger('SocketManager');
  private redis: RedisService;
  private transcriptionQueue: TranscriptionQueue;

  constructor(
    httpServer: HttpServer,
    redis: RedisService,
    transcriptionQueue: TranscriptionQueue
  ) {
    this.redis = redis;
    this.transcriptionQueue = transcriptionQueue;
    
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: config.get('security.corsOrigins'),
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentification
    this.io.use((socket, next) => {
      const apiKey = socket.handshake.auth.apiKey;
      const expectedKey = config.get('security.apiKey');
      
      if (apiKey !== expectedKey) {
        return next(new Error('Authentication failed'));
      }
      
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      // Agent connection
      socket.on('agent:connect', async (data: WSEvents['agent:connect']) => {
        const agent: Agent = {
          id: data.agentId,
          email: data.email,
          extension: data.extension,
          name: data.email.split('@')[0],
          status: 'online'
        };

        this.agents.set(data.agentId, agent);
        socket.join(`agent:${data.agentId}`);
        socket.data.agentId = data.agentId;

        // Sauvegarder dans Redis
        await this.redis.setAgent(agent);

        // Notifier tous les clients
        this.broadcastAgentStatus();
        
        this.logger.info(`Agent connected: ${data.email}`);
      });

      // Call start
      socket.on('call:start', async (data: WSEvents['call:start']) => {
        const { call } = data;
        const agent = this.agents.get(socket.data.agentId);
        
        if (agent) {
          agent.currentCall = call;
          agent.status = 'busy';
          await this.redis.setAgent(agent);
        }

        // Sauvegarder l'appel
        await this.redis.setCall(call);

        // Créer une room pour cet appel
        socket.join(`call:${call.callId}`);

        // Notifier les dashboards
        this.io.to('dashboard').emit('call:update', call);
        this.broadcastAgentStatus();

        this.logger.info(`Call started: ${call.callId}`);
      });

      // Audio streaming
      socket.on('audio:chunk', async (chunk: WSEvents['audio:chunk']) => {
        // Ajouter à la queue de transcription
        await this.transcriptionQueue.addAudioChunk(chunk);

        // Optionnel: sauvegarder temporairement dans Redis
        await this.redis.addAudioChunk(chunk);
      });

      // Call end
      socket.on('call:end', async (data: WSEvents['call:end']) => {
        const { callId } = data;
        const agent = this.agents.get(socket.data.agentId);
        
        if (agent && agent.currentCall?.callId === callId) {
          agent.currentCall = undefined;
          agent.status = 'online';
          await this.redis.setAgent(agent);
        }

        // Mettre à jour l'appel
        const call = await this.redis.getCall(callId);
        if (call) {
          call.status = 'completed';
          call.endTime = new Date();
          await this.redis.setCall(call);
        }

        // Déclencher la transcription finale
        await this.transcriptionQueue.finalizeCall(callId);

        // Nettoyer
        socket.leave(`call:${callId}`);

        // Notifier
        this.io.to('dashboard').emit('call:update', call);
        this.broadcastAgentStatus();

        this.logger.info(`Call ended: ${callId}`);
      });

      // Dashboard connection
      socket.on('dashboard:connect', () => {
        socket.join('dashboard');
        this.logger.info('Dashboard connected');
        
        // Envoyer l'état actuel
        this.sendDashboardState(socket);
      });

      // Disconnection
      socket.on('disconnect', async () => {
        if (socket.data.agentId) {
          const agent = this.agents.get(socket.data.agentId);
          if (agent) {
            agent.status = 'offline';
            await this.redis.setAgent(agent);
            this.agents.delete(socket.data.agentId);
            this.broadcastAgentStatus();
          }
        }
        
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Méthodes publiques pour émettre des événements

  emitTranscriptionPartial(agentId: string, transcription: RealtimeTranscription) {
    this.io.to(`agent:${agentId}`).emit('transcription:partial', transcription);
    this.io.to(`call:${transcription.callId}`).emit('transcription:partial', transcription);
  }

  emitTranscriptionFinal(callId: string, transcription: WSEvents['transcription:final']) {
    this.io.to(`call:${callId}`).emit('transcription:final', transcription);
    
    // Envoyer aussi à l'agent concerné
    const agent = Array.from(this.agents.values()).find(
      a => a.currentCall?.callId === callId
    );
    if (agent) {
      this.io.to(`agent:${agent.id}`).emit('transcription:final', transcription);
    }
  }

  emitAnalysisComplete(callId: string, analysis: WSEvents['analysis:complete']) {
    this.io.to(`call:${callId}`).emit('analysis:complete', analysis);
    
    // Envoyer à l'agent
    const agent = Array.from(this.agents.values()).find(
      a => a.currentCall?.callId === callId
    );
    if (agent) {
      this.io.to(`agent:${agent.id}`).emit('analysis:complete', analysis);
    }
  }

  emitNotification(target: string, notification: WSEvents['notification']) {
    if (target === 'all') {
      this.io.emit('notification', notification);
    } else if (target.startsWith('agent:')) {
      this.io.to(target).emit('notification', notification);
    } else {
      this.io.to('dashboard').emit('notification', notification);
    }
  }

  emitCallUpdate(call: Call3CX) {
    // Émettre à tous les dashboards
    this.io.to('dashboard').emit('call:update', call);
    
    // Émettre à l'agent concerné
    this.io.to(`agent:${call.agentEmail}`).emit('call:update', call);
    
    // Émettre dans la room de l'appel
    this.io.to(`call:${call.callId}`).emit('call:update', call);
    
    this.logger.debug(`Call update emitted for ${call.callId}`);
  }

  // Méthodes privées

  private broadcastAgentStatus() {
    const agentList = Array.from(this.agents.values());
    this.io.emit('agent:status', { agents: agentList });
  }

  private async sendDashboardState(socket: Socket) {
    // Envoyer l'état des agents
    this.broadcastAgentStatus();

    // Envoyer les appels actifs
    const activeCalls = await this.redis.getActiveCalls();
    activeCalls.forEach(call => {
      socket.emit('call:update', call);
    });

    // Envoyer la santé du système
    const health = await this.getSystemHealth();
    socket.emit('system:health', health);
  }

  private async getSystemHealth(): Promise<WSEvents['system:health']> {
    const queueStats = await this.transcriptionQueue.getStats();
    
    return {
      service: 'main-server',
      status: 'healthy',
      cpu: process.cpuUsage().user / 1000000,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      uptime: process.uptime(),
      activeConnections: this.io.sockets.sockets.size,
      transcriptionQueue: queueStats.waiting + queueStats.active,
      timestamp: new Date()
    };
  }

  getIO(): SocketServer {
    return this.io;
  }
}

export default SocketManager;