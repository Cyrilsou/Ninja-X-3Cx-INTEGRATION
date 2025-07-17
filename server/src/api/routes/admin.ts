import { Router, Request, Response } from 'express';
import { RedisService } from '../../services/redis-service';
import { SocketManager } from '../../websocket/socket-manager';
import { CallModel, AgentModel, TranscriptionModel } from '../../database';
import { Logger } from '@3cx-ninja/shared';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import config from 'config';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = new Logger('AdminAPI');

interface AdminRequest extends Request {
  admin?: { id: string; email: string };
}

export function createAdminRouter(redis: RedisService, socketManager: SocketManager): Router {
  const router = Router();

  // Admin authentication middleware
  const adminAuth = async (req: AdminRequest, res: Response, next: Function) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.ADMIN_SECRET || 'admin-secret') as any;
      req.admin = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Admin login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check admin credentials (in production, use database)
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@3cx-ninja.local';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      if (email !== adminEmail || password !== adminPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: '1', email },
        process.env.ADMIN_SECRET || 'admin-secret',
        { expiresIn: '24h' }
      );

      res.json({ token, email });
    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Get system health
  router.get('/health', adminAuth, async (req: AdminRequest, res) => {
    try {
      // System metrics
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // OS info
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const loadAvg = os.loadavg();
      
      // Redis status
      let redisStatus: { connected: boolean; info: string | null } = { connected: false, info: null };
      try {
        await redis.client.ping();
        redisStatus.connected = true;
        redisStatus.info = (await redis.client.info()) as string;
      } catch (error) {
        logger.error('Redis health check failed:', error);
      }

      // Queue stats
      const queueStats = await redis.getQueueStats();
      
      // Active connections
      const activeConnections = socketManager.getIO().sockets.sockets.size;
      
      // Whisper status
      let whisperStatus = { ready: false, model: null };
      try {
        // Check if whisper is available
        const { stdout } = await execAsync('which whisper');
        if (stdout) {
          whisperStatus.ready = true;
          whisperStatus.model = config.get('whisper.model');
        }
      } catch (error) {
        // Whisper not found
      }

      const health = {
        server: {
          status: 'healthy',
          uptime,
          nodeVersion: process.version,
          environment: process.env.NODE_ENV
        },
        system: {
          platform: os.platform(),
          cpuUsage: cpuUsage.user / 1000000, // Convert to seconds
          memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
          totalMemory: totalMem / 1024 / 1024 / 1024, // GB
          freeMemory: freeMem / 1024 / 1024 / 1024, // GB
          loadAverage: loadAvg
        },
        redis: redisStatus,
        whisper: whisperStatus,
        queue: queueStats,
        activeConnections,
        allServicesHealthy: redisStatus.connected && whisperStatus.ready
      };

      res.json(health);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Get all agents with detailed info
  router.get('/agents', adminAuth, async (req: AdminRequest, res) => {
    try {
      const agents = await redis.getAllAgents();
      
      // Enrich with database info
      const enrichedAgents = await Promise.all(agents.map(async (agent) => {
        const callCount = await CallModel.count({
          where: { agentEmail: agent.email }
        });
        
        return {
          ...agent,
          totalCalls: callCount,
          version: agent.version || '1.0.0',
          ipAddress: agent.ipAddress || 'Unknown'
        };
      }));

      res.json(enrichedAgents);
    } catch (error) {
      logger.error('Get agents error:', error);
      res.status(500).json({ error: 'Failed to get agents' });
    }
  });

  // Create/Update agent
  router.post('/agents', adminAuth, async (req: AdminRequest, res) => {
    try {
      const { email, name, extension } = req.body;
      
      const agent = {
        id: `agent-${Date.now()}`,
        email,
        name,
        extension,
        status: 'offline' as const,
        lastSeen: new Date()
      };

      await redis.setAgent(agent);
      
      // Notify via WebSocket
      socketManager.emitNotification('all', {
        type: 'agent_added',
        message: `Agent ${name} ajouté`,
        data: agent
      });

      res.json(agent);
    } catch (error) {
      logger.error('Create agent error:', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  // Update agent
  router.put('/agents/:id', adminAuth, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const agent = await redis.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const updatedAgent = { ...agent, ...updates };
      await redis.setAgent(updatedAgent);

      res.json(updatedAgent);
    } catch (error) {
      logger.error('Update agent error:', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  // Delete agent
  router.delete('/agents/:id', adminAuth, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      
      await redis.deleteAgent(id);
      
      // Notify
      socketManager.emitNotification('all', {
        type: 'agent_removed',
        message: 'Agent supprimé',
        data: { agentId: id }
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Delete agent error:', error);
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  });

  // Get system configuration
  router.get('/config', adminAuth, async (req: AdminRequest, res) => {
    try {
      const configuration = {
        server: {
          port: config.get('server.port'),
          host: config.get('server.host')
        },
        redis: {
          enabled: config.get('redis.enabled'),
          host: config.get('redis.host'),
          port: config.get('redis.port')
        },
        whisper: {
          model: config.get('whisper.model'),
          language: config.get('whisper.language')
        },
        '3cx': {
          pbxUrl: process.env.PBX_URL,
          webhookEnabled: config.has('3cx.webhook.enabled') ? config.get('3cx.webhook.enabled') : true
        },
        ninjaone: {
          apiUrl: config.get('ninjaone.apiUrl'),
          configured: !!process.env.NINJA_CLIENT_ID
        }
      };

      res.json(configuration);
    } catch (error) {
      logger.error('Get config error:', error);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  });

  // Update configuration
  router.put('/config', adminAuth, async (req: AdminRequest, res) => {
    try {
      const updates = req.body;
      
      // In production, this would update environment variables or config files
      // For now, we'll just validate and return
      
      logger.info('Configuration update requested:', updates);
      
      // Restart services if needed
      if (updates.requiresRestart) {
        socketManager.emitNotification('all', {
          type: 'system_restart',
          message: 'Le système va redémarrer pour appliquer les changements',
          data: {}
        });
      }

      res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
      logger.error('Update config error:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  // Get webhook configuration and test
  router.get('/webhooks/3cx', adminAuth, async (req: AdminRequest, res) => {
    try {
      const webhookUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/webhook/3cx/call-event`;
      
      res.json({
        url: webhookUrl,
        method: 'POST',
        contentType: 'application/json',
        template: {
          callId: '[CallID]',
          caller: '[CallerNumber]',
          callee: '[CalledNumber]',
          agentExt: '[AgentNumber]',
          agentMail: '[AgentEmail]',
          direction: '[CallDirection]',
          duration: '[Duration]',
          wav: '[RecordingURL]',
          endUtc: '[CallEndTimeUTC]'
        }
      });
    } catch (error) {
      logger.error('Get webhook config error:', error);
      res.status(500).json({ error: 'Failed to get webhook configuration' });
    }
  });

  // Test webhook
  router.post('/webhooks/3cx/test', adminAuth, async (req: AdminRequest, res) => {
    try {
      const testPayload = {
        callId: 'TEST-' + Date.now(),
        caller: '+41225551234',
        callee: '+41225555678',
        agentExt: '201',
        agentMail: 'test@example.com',
        direction: 'Inbound',
        duration: '00:02:30',
        endUtc: new Date().toISOString()
      };

      // Send test webhook
      const response = await fetch(`http://localhost:${config.get('server.port')}/webhook/3cx/call-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      const result = await response.json();
      
      res.json({
        success: response.ok,
        statusCode: response.status,
        result,
        testPayload
      });
    } catch (error) {
      logger.error('Test webhook error:', error);
      res.status(500).json({ error: 'Webhook test failed' });
    }
  });

  // Get statistics
  router.get('/stats', adminAuth, async (req: AdminRequest, res) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalCalls,
        todayCalls,
        weekCalls,
        monthCalls,
        totalAgents,
        activeAgents,
        totalTranscriptions
      ] = await Promise.all([
        CallModel.count(),
        CallModel.count({ where: { startTime: { [Op.gte]: today } } }),
        CallModel.count({ where: { startTime: { [Op.gte]: thisWeek } } }),
        CallModel.count({ where: { startTime: { [Op.gte]: thisMonth } } }),
        redis.getAllAgents().then(agents => agents.length),
        redis.getAllAgents().then(agents => agents.filter(a => a.status === 'online').length),
        TranscriptionModel.count()
      ]);

      res.json({
        calls: {
          total: totalCalls,
          today: todayCalls,
          week: weekCalls,
          month: monthCalls
        },
        agents: {
          total: totalAgents,
          active: activeAgents
        },
        transcriptions: {
          total: totalTranscriptions
        }
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // Service control
  router.post('/services/:action', adminAuth, async (req: AdminRequest, res) => {
    try {
      const { action } = req.params;
      const { service } = req.body;

      switch (action) {
        case 'restart':
          logger.info(`Restarting service: ${service}`);
          // In production, use PM2 API or systemctl
          if (service === 'all') {
            process.exit(0); // PM2 will restart
          }
          break;
          
        case 'clear-cache':
          await redis.client.flushDb();
          logger.info('Cache cleared');
          break;
          
        case 'reload-config':
          // Reload configuration
          logger.info('Configuration reloaded');
          break;
      }

      res.json({ success: true, action, service });
    } catch (error) {
      logger.error('Service control error:', error);
      res.status(500).json({ error: 'Service control failed' });
    }
  });

  return router;
}