import { createClient, RedisClientType } from 'redis';
import { Agent, Call3CX, AudioChunk, Logger } from '@3cx-ninja/shared';
import config from 'config';

export class RedisService {
  public client: RedisClientType;
  private logger = new Logger('Redis');
  private prefix: string;

  constructor() {
    this.prefix = config.get('redis.prefix');
    this.client = createClient({
      url: config.get('redis.url')
    });

    this.client.on('error', (err) => this.logger.error('Redis error:', err));
    this.client.on('connect', () => this.logger.info('Redis connected'));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  // Agent management
  async setAgent(agent: Agent): Promise<void> {
    const key = `${this.prefix}agent:${agent.id}`;
    await this.client.setEx(key, 86400, JSON.stringify(agent)); // 24h TTL
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const key = `${this.prefix}agent:${agentId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getAllAgents(): Promise<Agent[]> {
    const keys = await this.client.keys(`${this.prefix}agent:*`);
    const agents: Agent[] = [];
    
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        agents.push(JSON.parse(data));
      }
    }
    
    return agents;
  }

  // Call management
  async setCall(call: Call3CX): Promise<void> {
    const key = `${this.prefix}call:${call.callId}`;
    await this.client.setEx(key, 86400, JSON.stringify(call)); // 24h TTL
    
    // Ajouter à la liste des appels actifs si en cours
    if (call.status === 'active' || call.status === 'ringing') {
      await this.client.sAdd(`${this.prefix}active-calls`, call.callId);
    } else {
      await this.client.sRem(`${this.prefix}active-calls`, call.callId);
    }
  }

  async getCall(callId: string): Promise<Call3CX | null> {
    const key = `${this.prefix}call:${callId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getActiveCalls(): Promise<Call3CX[]> {
    const callIds = await this.client.sMembers(`${this.prefix}active-calls`);
    const calls: Call3CX[] = [];
    
    for (const callId of callIds) {
      const call = await this.getCall(callId);
      if (call) {
        calls.push(call);
      }
    }
    
    return calls;
  }

  // Audio chunk management (pour buffering temporaire)
  async addAudioChunk(chunk: AudioChunk): Promise<void> {
    const key = `${this.prefix}audio:${chunk.callId}`;
    const data = {
      ...chunk,
      data: chunk.data.toString('base64') // Convertir Buffer en string
    };
    
    await this.client.rPush(key, JSON.stringify(data));
    await this.client.expire(key, 3600); // 1h TTL
  }

  async getAudioChunks(callId: string): Promise<AudioChunk[]> {
    const key = `${this.prefix}audio:${callId}`;
    const chunks = await this.client.lRange(key, 0, -1);
    
    return chunks.map(chunk => {
      const data = JSON.parse(chunk);
      return {
        ...data,
        data: Buffer.from(data.data, 'base64')
      };
    });
  }

  async clearAudioChunks(callId: string): Promise<void> {
    const key = `${this.prefix}audio:${callId}`;
    await this.client.del(key);
  }

  // Transcription cache
  async setTranscription(callId: string, transcription: any): Promise<void> {
    const key = `${this.prefix}transcription:${callId}`;
    await this.client.setEx(key, 86400, JSON.stringify(transcription)); // 24h TTL
  }

  async getTranscription(callId: string): Promise<any | null> {
    const key = `${this.prefix}transcription:${callId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Analysis cache
  async setAnalysis(callId: string, analysis: any): Promise<void> {
    const key = `${this.prefix}analysis:${callId}`;
    await this.client.setEx(key, 86400, JSON.stringify(analysis)); // 24h TTL
  }

  async getAnalysis(callId: string): Promise<any | null> {
    const key = `${this.prefix}analysis:${callId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Stats
  async incrementStat(stat: string): Promise<void> {
    const key = `${this.prefix}stats:${stat}:${new Date().toISOString().split('T')[0]}`;
    await this.client.incr(key);
    await this.client.expire(key, 604800); // 7 jours TTL
  }

  async getStat(stat: string, date?: Date): Promise<number> {
    const dateStr = (date || new Date()).toISOString().split('T')[0];
    const key = `${this.prefix}stats:${stat}:${dateStr}`;
    const value = await this.client.get(key);
    return value ? parseInt(value) : 0;
  }

  // Pub/Sub
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(
      `${this.prefix}${channel}`,
      JSON.stringify(message)
    );
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(
      `${this.prefix}${channel}`,
      (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          this.logger.error('Failed to parse message:', error);
        }
      }
    );
  }

  // Additional methods for missing functionality
  async updateAgentStatus(email: string, status: any): Promise<void> {
    await this.client.hSet(`agent:${email}`, 'status', JSON.stringify(status));
  }

  async deleteAgent(id: string): Promise<number> {
    const key = `${this.prefix}agent:${id}`;
    return await this.client.del(key);
  }

  async getQueueStats(): Promise<{ size: number; processing: number; failed: number }> {
    // This is a simplified implementation
    // In a real scenario, you might want to track these stats properly
    return {
      size: 0,
      processing: 0,
      failed: 0
    };
  }

  async getConnectedAgents(): Promise<Agent[]> {
    const pattern = `${this.prefix}agent:*`;
    const keys = await this.client.keys(pattern);
    const agents: Agent[] = [];
    
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        try {
          const agent = JSON.parse(data) as Agent;
          // Considérer un agent comme connecté s'il a été mis à jour dans les 5 dernières minutes
          if (agent.status === 'online') {
            agents.push(agent);
          }
        } catch (error) {
          this.logger.error(`Error parsing agent data for key ${key}:`, error);
        }
      }
    }
    
    return agents;
  }
}

export default RedisService;