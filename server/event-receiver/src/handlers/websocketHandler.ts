import { WebSocketCallEvent } from '../types/3cx.types';
import { DatabaseService } from '../services/database';
import { CallStatus } from '../types/database.types';
import { logger } from '../utils/logger';
import { downloadRecording } from './recordingHandler';

export async function handleWebSocketEvent(event: WebSocketCallEvent): Promise<void> {
  try {
    switch (event.eventType) {
      case 'CallEstablished':
        await handleCallEstablished(event);
        break;
      
      case 'CallEnded':
        await handleCallEnded(event);
        break;
      
      case 'CallUpdated':
        await handleCallUpdated(event);
        break;
      
      default:
        logger.warn('Unknown WebSocket event type', { eventType: event.eventType });
    }
  } catch (error) {
    logger.error('Failed to handle WebSocket event', {
      eventType: event.eventType,
      callId: event.callId,
      error
    });
  }
}

async function handleCallEstablished(event: WebSocketCallEvent): Promise<void> {
  logger.info('Call established', {
    callId: event.callId,
    from: event.data.from,
    to: event.data.to,
    extension: event.data.extension
  });

  // We could create a preliminary call record here if needed
  // For now, we'll wait for the CallEnded event
}

async function handleCallEnded(event: WebSocketCallEvent): Promise<void> {
  logger.info('Call ended via WebSocket', {
    callId: event.callId,
    duration: event.data.duration,
    recordingAvailable: event.data.recordingAvailable
  });

  // Check if we already have this call from webhook
  const existingCall = await DatabaseService.getCall(event.callId);
  
  if (existingCall) {
    logger.debug('Call already exists from webhook', { callId: event.callId });
    return;
  }

  // Create call record from WebSocket event
  const call = await DatabaseService.createCall({
    callId: event.callId,
    extension: event.data.extension || '',
    agentName: event.data.agentName,
    callerNumber: event.data.direction === 'Inbound' ? event.data.from : event.data.to,
    duration: event.data.duration || 0,
    startTime: new Date(new Date(event.timestamp).getTime() - (event.data.duration || 0) * 1000),
    endTime: new Date(event.timestamp),
    status: CallStatus.RECEIVED
  });

  logger.info('Call created from WebSocket event', { callId: call.callId });

  // If recording is available, we'll need to fetch it via API
  if (event.data.recordingAvailable) {
    // This would require an additional API call to 3CX to get the recording URL
    // For now, we'll rely on the webhook to provide the recording URL
    logger.info('Recording available, waiting for webhook with URL', { callId: event.callId });
  }
}

async function handleCallUpdated(event: WebSocketCallEvent): Promise<void> {
  logger.debug('Call updated', {
    callId: event.callId,
    status: event.data.status
  });

  // Update call status if needed
  const call = await DatabaseService.getCall(event.callId);
  if (call && event.data.status) {
    // Map 3CX status to our internal status if needed
    logger.debug('Call status updated', { callId: event.callId, status: event.data.status });
  }
}