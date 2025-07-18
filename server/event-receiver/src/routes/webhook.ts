import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CallEndWebhookPayload } from '../types/3cx.types';
import { DatabaseService } from '../services/database';
import { CallStatus } from '../types/database.types';
import { processRecordingFromWebhook } from '../handlers/recordingHandler';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

// Validation schema for webhook payload
const callEndSchema = Joi.object({
  callId: Joi.string().required(),
  sessionId: Joi.string().required(),
  partyNumber: Joi.string().required(),
  otherPartyNumber: Joi.string().required(),
  direction: Joi.string().valid('Inbound', 'Outbound').required(),
  startTime: Joi.string().isoDate().required(),
  endTime: Joi.string().isoDate().required(),
  duration: Joi.number().integer().min(0).required(),
  reasonTerminated: Joi.string().required(),
  recordingUrl: Joi.string().uri().optional(),
  extension: Joi.string().optional(),
  agentName: Joi.string().optional(),
  queueName: Joi.string().optional(),
  customData: Joi.object().optional()
});

// Webhook authentication middleware
const authenticateWebhook = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-3cx-signature'];
  const apiKey = req.headers['x-api-key'];

  // Implement your webhook authentication logic here
  // For now, we'll use a simple API key check
  if (apiKey !== config.THREECX_API_KEY) {
    logger.warn('Webhook authentication failed', {
      ip: req.ip,
      headers: req.headers
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Main webhook endpoint
router.post('/call-end', authenticateWebhook, async (req: Request, res: Response) => {
  try {
    // Validate payload
    const { error, value } = callEndSchema.validate(req.body);
    if (error) {
      logger.warn('Invalid webhook payload', {
        error: error.details,
        body: req.body
      });
      return res.status(400).json({ error: 'Invalid payload', details: error.details });
    }

    const payload = value as CallEndWebhookPayload;
    logger.info('Call end webhook received', {
      callId: payload.callId,
      duration: payload.duration,
      extension: payload.extension
    });

    // Check if call already exists
    const existingCall = await DatabaseService.getCall(payload.callId);
    if (existingCall) {
      logger.debug('Call already exists', { callId: payload.callId });
      
      // Update with recording URL if not already set
      if (payload.recordingUrl && !existingCall.recordingUrl) {
        await DatabaseService.updateCall(payload.callId, {
          recordingUrl: payload.recordingUrl
        });
        await processRecordingFromWebhook(payload.callId, payload.recordingUrl);
      }
      
      return res.status(200).json({ status: 'already_processed' });
    }

    // Create new call record
    const call = await DatabaseService.createCall({
      callId: payload.callId,
      extension: payload.extension || 'unknown',
      agentName: payload.agentName,
      callerNumber: payload.direction === 'Inbound' ? payload.partyNumber : payload.otherPartyNumber,
      duration: payload.duration,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      recordingUrl: payload.recordingUrl,
      status: CallStatus.RECEIVED
    });

    // Log audit event
    await DatabaseService.logAuditEvent(
      'CALL_RECEIVED',
      'call',
      call.id,
      payload.extension,
      req.ip,
      { source: 'webhook' }
    );

    // Process recording if available
    if (payload.recordingUrl) {
      processRecordingFromWebhook(payload.callId, payload.recordingUrl)
        .catch(error => {
          logger.error('Failed to process recording', { callId: payload.callId, error });
        });
    }

    res.status(200).json({
      status: 'accepted',
      callId: call.callId,
      id: call.id
    });

  } catch (error) {
    logger.error('Webhook processing failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint
router.post('/test', authenticateWebhook, async (req: Request, res: Response) => {
  logger.info('Test webhook received', { body: req.body });
  res.status(200).json({ status: 'ok', received: req.body });
});

export const webhookRouter = router;