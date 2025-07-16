import { Router } from 'express';
import { RedisService } from '../../services/redis-service';
import { SocketManager } from '../../websocket/socket-manager';
import { CallModel, TranscriptionModel, AnalysisModel, TicketModel } from '../../database';
import { NinjaTicket, Logger } from '@3cx-ninja/shared';
import NinjaAPI from '../../services/ninja-api';

const logger = new Logger('API');

export function createApiRouter(redis: RedisService, socketManager: SocketManager): Router {
  const router = Router();

  // Get call history
  router.get('/calls', async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const calls = await CallModel.findAll({
        order: [['startTime', 'DESC']],
        limit: Number(limit),
        offset: Number(offset),
        include: [
          { model: TranscriptionModel, required: false },
          { model: AnalysisModel, required: false },
          { model: TicketModel, required: false }
        ]
      });

      res.json(calls);
    } catch (error) {
      logger.error('Error fetching calls:', error);
      res.status(500).json({ error: 'Failed to fetch calls' });
    }
  });

  // Get specific call details
  router.get('/calls/:callId', async (req, res) => {
    try {
      const call = await CallModel.findByPk(req.params.callId, {
        include: [
          { model: TranscriptionModel },
          { model: AnalysisModel },
          { model: TicketModel }
        ]
      });

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      res.json(call);
    } catch (error) {
      logger.error('Error fetching call:', error);
      res.status(500).json({ error: 'Failed to fetch call' });
    }
  });

  // Create ticket
  router.post('/tickets', async (req, res) => {
    try {
      const ticketData: NinjaTicket = req.body;
      const { callId } = req.body;

      // Créer le ticket dans NinjaOne
      const ninjaTicketId = await NinjaAPI.createTicket(ticketData);

      // Sauvegarder en base
      const ticket = await TicketModel.create({
        callId,
        ninjaTicketId,
        title: ticketData.title,
        status: 'created',
        createdBy: req.body.agentEmail || 'system'
      });

      // Notifier via WebSocket
      socketManager.emitNotification('all', {
        type: 'ticket_created',
        message: `Ticket #${ninjaTicketId} créé`,
        data: { ticketId: ninjaTicketId, callId }
      });

      res.status(201).json({
        success: true,
        ticketId: ninjaTicketId,
        ticket
      });
    } catch (error) {
      logger.error('Error creating ticket:', error);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  // Get agents status
  router.get('/agents', async (req, res) => {
    try {
      const agents = await redis.getAllAgents();
      res.json(agents);
    } catch (error) {
      logger.error('Error fetching agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

  // Get statistics
  router.get('/stats', async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalCalls, todayCalls, totalTickets] = await Promise.all([
        CallModel.count(),
        CallModel.count({
          where: {
            startTime: { $gte: today }
          }
        }),
        TicketModel.count()
      ]);

      const stats = {
        totalCalls,
        todayCalls,
        totalTickets,
        avgCallDuration: await CallModel.findOne({
          attributes: [[sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration']]
        }),
        sentimentDistribution: await AnalysisModel.findAll({
          attributes: [
            'customerSentiment',
            [sequelize.fn('COUNT', sequelize.col('customerSentiment')), 'count']
          ],
          group: ['customerSentiment']
        })
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Search calls
  router.get('/search', async (req, res) => {
    try {
      const { q, from, to } = req.query;
      
      const where: any = {};
      
      if (q) {
        where[Op.or] = [
          { caller: { [Op.like]: `%${q}%` } },
          { agentEmail: { [Op.like]: `%${q}%` } }
        ];
      }
      
      if (from || to) {
        where.startTime = {};
        if (from) where.startTime[Op.gte] = new Date(from as string);
        if (to) where.startTime[Op.lte] = new Date(to as string);
      }

      const calls = await CallModel.findAll({
        where,
        include: [TranscriptionModel, AnalysisModel, TicketModel],
        order: [['startTime', 'DESC']],
        limit: 100
      });

      res.json(calls);
    } catch (error) {
      logger.error('Error searching calls:', error);
      res.status(500).json({ error: 'Failed to search calls' });
    }
  });

  return router;
}

// Imports nécessaires pour Sequelize
import { Op } from 'sequelize';
import { sequelize } from '../../database';