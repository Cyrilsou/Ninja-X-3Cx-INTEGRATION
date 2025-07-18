import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';
import { WebSocketManager } from '../services/websocket';
import { logger } from '../utils/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    websocket: ServiceStatus;
    storage: ServiceStatus;
  };
  queues?: any;
}

interface ServiceStatus {
  status: 'up' | 'down';
  message?: string;
}

router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: 'down' },
      redis: { status: 'down' },
      websocket: { status: 'down' },
      storage: { status: 'up' } // Assume storage is up if the app is running
    }
  };

  try {
    // Check database
    try {
      await DatabaseService.getCall('health-check');
      health.services.database.status = 'up';
    } catch (error) {
      health.services.database.message = 'Database connection failed';
      health.status = 'unhealthy';
    }

    // Check Redis/Queue
    try {
      const queueStats = await QueueService.getQueueStats();
      health.services.redis.status = 'up';
      health.queues = queueStats;
    } catch (error) {
      health.services.redis.message = 'Redis connection failed';
      health.status = 'unhealthy';
    }

    // Check WebSocket
    if (WebSocketManager.isConnected()) {
      health.services.websocket.status = 'up';
    } else {
      health.services.websocket.message = 'WebSocket disconnected';
      health.status = health.status === 'healthy' ? 'degraded' : health.status;
    }

    const responseTime = Date.now() - startTime;
    logger.debug('Health check completed', { responseTime, status: health.status });

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check failed', error);
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Quick check if main services are ready
    await DatabaseService.getCall('ready-check');
    const stats = await QueueService.getQueueStats();
    
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

export const healthRouter = router;