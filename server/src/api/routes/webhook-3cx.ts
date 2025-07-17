import { Router, Request, Response } from 'express';
import { SocketManager } from '../../websocket/socket-manager';
import { RedisService } from '../../services/redis-service';
import { CallModel } from '../../database';
import { Call3CX, Logger } from '@3cx-ninja/shared';
import { v4 as uuidv4 } from 'uuid';
import retryService from '../../services/retry-service';

const logger = new Logger('3CX-Webhook');

interface Webhook3CXPayload {
  callId?: string;
  caller: string;
  callee: string;
  agentExt: string;
  agentMail: string;
  direction: string;
  duration?: string;
  wav?: string;
  endUtc?: string;
  // Additional fields from 3CX template
  status?: string;
  startTime?: string;
}

export function create3CXWebhookRouter(redis: RedisService, socketManager: SocketManager): Router {
  const router = Router();

  // Webhook endpoint for 3CX call events
  router.post('/call-event', async (req: Request, res: Response) => {
    try {
      const payload: Webhook3CXPayload = req.body;
      
      logger.info('Received 3CX webhook:', payload);

      // Generate call ID if not provided
      const callId = payload.callId || `3cx-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // Determine call status
      const isCallEnd = !!payload.duration || !!payload.endUtc;
      const status = isCallEnd ? 'completed' : 'active';

      // Parse duration (format: hh:mm:ss to seconds)
      let durationSeconds = 0;
      if (payload.duration) {
        const parts = payload.duration.split(':');
        durationSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      }

      // Create Call3CX object
      const call: Call3CX = {
        id: callId,
        callId: callId,
        extension: payload.agentExt,
        agentEmail: payload.agentMail,
        caller: payload.caller,
        callee: payload.callee,
        direction: payload.direction === 'Outbound' ? 'outbound' : 'inbound',
        startTime: payload.startTime ? new Date(payload.startTime) : new Date(),
        endTime: payload.endUtc ? new Date(payload.endUtc) : undefined,
        duration: durationSeconds || undefined,
        status: status,
        recordingUrl: payload.wav
      };

      // Store or update call in database with retry
      if (isCallEnd) {
        // Update existing call with retry
        await retryService.withRetry(async () => {
          await CallModel.update({
            endTime: call.endTime,
            duration: call.duration,
            status: 'completed',
            recordingUrl: call.recordingUrl
          }, {
            where: { callId }
          });
        }, {
          maxRetries: 3,
          onRetry: (error, attempt) => {
            logger.warn(`Retry ${attempt} for call update ${callId}: ${error.message}`);
          }
        });

        // Emit call end event
        socketManager.emitCallUpdate(call);
        
        // Trigger analysis if transcription exists
        const existingCall = await CallModel.findByPk(callId);
        if (existingCall && (existingCall as any).transcriptionId) {
          socketManager.emitNotification('all', {
            type: 'call_ready_for_analysis',
            message: 'Appel terminé, prêt pour analyse',
            data: { callId, recordingUrl: call.recordingUrl }
          });
        }
      } else {
        // New call started with retry
        await retryService.withRetry(async () => {
          await CallModel.create({
            callId: call.callId,
            extension: call.extension,
            agentEmail: call.agentEmail,
            caller: call.caller,
            callee: call.callee,
            direction: call.direction,
            startTime: call.startTime,
            status: call.status
          });
        }, {
          maxRetries: 3,
          onRetry: (error, attempt) => {
            logger.warn(`Retry ${attempt} for call creation ${callId}: ${error.message}`);
          }
        });

        // Update agent status with retry
        await retryService.withRetry(async () => {
          await redis.updateAgentStatus(call.agentEmail, {
            status: 'busy',
            currentCall: call
          });
        });

        // Emit call start event
        socketManager.emitCallUpdate(call);
      }

      res.json({ 
        success: true, 
        callId,
        status: call.status,
        message: `Call ${status} processed successfully`
      });

    } catch (error) {
      logger.error('Error processing 3CX webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process webhook' 
      });
    }
  });

  // Health check endpoint for 3CX webhook configuration
  router.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      service: '3CX Webhook Handler',
      timestamp: new Date().toISOString()
    });
  });

  // Test endpoint for webhook configuration
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const testCall: Webhook3CXPayload = {
        callId: `test-${Date.now()}`,
        caller: '+41225550123',
        callee: '+41225550456',
        agentExt: '201',
        agentMail: 'test.agent@company.com',
        direction: 'Inbound',
        status: 'active'
      };

      logger.info('Processing test webhook call');
      
      // Emit test event
      socketManager.emitNotification('all', {
        type: 'webhook_test',
        message: 'Test webhook received',
        data: testCall
      });

      res.json({ 
        success: true, 
        message: 'Test webhook processed',
        data: testCall
      });
    } catch (error) {
      logger.error('Error in test webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Test webhook failed' 
      });
    }
  });

  return router;
}