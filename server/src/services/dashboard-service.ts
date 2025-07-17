import { Logger } from '@3cx-ninja/shared';
import { CallModel, AgentModel, TranscriptionModel, AnalysisModel } from '../database';
import { Op } from 'sequelize';
import { RedisService } from './redis-service';

const logger = new Logger('DashboardService');

export interface DashboardStats {
  timestamp: Date;
  calls: {
    total: number;
    today: number;
    inProgress: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  agents: {
    total: number;
    online: number;
    busy: number;
    available: number;
  };
  transcriptions: {
    total: number;
    today: number;
    inQueue: number;
    processing: number;
    completed: number;
    failed: number;
  };
  analysis: {
    ticketsCreated: number;
    ticketsToday: number;
    avgSentiment: number;
    topCategories: Array<{ category: string; count: number }>;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

let redis: RedisService | null = null;

export function setRedisService(redisService: RedisService) {
  redis = redisService;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  
  try {
    // Stats des appels
    const [totalCalls, todayCalls, inProgressCalls] = await Promise.all([
      CallModel.count(),
      CallModel.count({ where: { startTime: { [Op.gte]: todayStart } } }),
      CallModel.count({ where: { status: 'active' } })
    ]);

    const completedCalls = await CallModel.count({ where: { status: 'completed' } });
    const failedCalls = await CallModel.count({ where: { status: 'failed' } });
    
    const avgDurationResult = await CallModel.findOne({
      attributes: [[CallModel.sequelize!.fn('AVG', CallModel.sequelize!.col('duration')), 'avgDuration']],
      where: { duration: { [Op.not]: null } }
    });
    const avgDuration = avgDurationResult?.get('avgDuration') as number || 0;

    // Stats des agents
    const [totalAgents, onlineAgents] = await Promise.all([
      AgentModel.count(),
      AgentModel.count({ where: { status: 'online' } })
    ]);
    
    const busyAgents = await AgentModel.count({ where: { status: 'busy' } });
    const availableAgents = onlineAgents - busyAgents;

    // Stats des transcriptions
    const [totalTranscriptions, todayTranscriptions] = await Promise.all([
      TranscriptionModel.count(),
      TranscriptionModel.count({ where: { createdAt: { [Op.gte]: todayStart } } })
    ]);

    // Stats depuis Redis pour les files d'attente
    let inQueue = 0;
    let processing = 0;
    if (redis) {
      const queueStats = await redis.getQueueStats();
      inQueue = queueStats.waiting;
      processing = queueStats.active;
    }

    const completedTranscriptions = await TranscriptionModel.count({ where: { status: 'completed' } });
    const failedTranscriptions = await TranscriptionModel.count({ where: { status: 'failed' } });

    // Stats d'analyse
    const [ticketsCreated, ticketsToday] = await Promise.all([
      AnalysisModel.count({ where: { ticketCreated: true } }),
      AnalysisModel.count({ 
        where: { 
          ticketCreated: true,
          createdAt: { [Op.gte]: todayStart }
        } 
      })
    ]);

    // Sentiment moyen
    const avgSentimentResult = await AnalysisModel.findOne({
      attributes: [[AnalysisModel.sequelize!.fn('AVG', AnalysisModel.sequelize!.col('sentiment')), 'avgSentiment']],
      where: { sentiment: { [Op.not]: null } }
    });
    const avgSentiment = avgSentimentResult?.get('avgSentiment') as number || 0;

    // Top catégories
    const categoryStats = await AnalysisModel.findAll({
      attributes: [
        'category',
        [AnalysisModel.sequelize!.fn('COUNT', AnalysisModel.sequelize!.col('category')), 'count']
      ],
      group: ['category'],
      order: [[AnalysisModel.sequelize!.fn('COUNT', AnalysisModel.sequelize!.col('category')), 'DESC']],
      limit: 5
    });

    const topCategories = categoryStats.map(stat => ({
      category: stat.get('category') as string,
      count: stat.get('count') as number
    }));

    // Stats système
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const cpuUsage = process.cpuUsage().user / 1000000; // Secondes
    
    let activeConnections = 0;
    if (redis) {
      const connectedAgents = await redis.getConnectedAgents();
      activeConnections = connectedAgents.length;
    }

    return {
      timestamp: new Date(),
      calls: {
        total: totalCalls,
        today: todayCalls,
        inProgress: inProgressCalls,
        completed: completedCalls,
        failed: failedCalls,
        avgDuration: Math.round(avgDuration)
      },
      agents: {
        total: totalAgents,
        online: onlineAgents,
        busy: busyAgents,
        available: availableAgents
      },
      transcriptions: {
        total: totalTranscriptions,
        today: todayTranscriptions,
        inQueue,
        processing,
        completed: completedTranscriptions,
        failed: failedTranscriptions
      },
      analysis: {
        ticketsCreated,
        ticketsToday,
        avgSentiment,
        topCategories
      },
      system: {
        uptime,
        memoryUsage: Math.round(memoryUsage),
        cpuUsage: Math.round(cpuUsage),
        activeConnections
      }
    };
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    throw error;
  }
}