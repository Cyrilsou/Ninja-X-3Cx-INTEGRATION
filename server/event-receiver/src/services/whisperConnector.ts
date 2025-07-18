import { QueueService } from './queue';
import { logger } from '../utils/logger';

export class WhisperConnector {
  static async submitTranscriptionJob(callId: string, audioPath: string): Promise<void> {
    try {
      // Add job to Redis queue for Whisper worker
      const jobData = {
        callId,
        audioPath,
        priority: 0
      };

      // Push to Redis list that Whisper worker is monitoring
      const redis = QueueService['redis']; // Access Redis client from QueueService
      await redis.lpush('transcription:queue', JSON.stringify(jobData));
      
      // Update queue size metric
      const queueLength = await redis.llen('transcription:queue');
      logger.info('Transcription job submitted', { 
        callId, 
        audioPath,
        queueLength 
      });

    } catch (error) {
      logger.error('Failed to submit transcription job', {
        callId,
        error
      });
      throw error;
    }
  }

  static async getTranscriptionResult(callId: string): Promise<any> {
    try {
      const redis = QueueService['redis'];
      const result = await redis.get(`transcription:result:${callId}`);
      
      if (result) {
        return JSON.parse(result);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get transcription result', {
        callId,
        error
      });
      throw error;
    }
  }

  static subscribeToTranscriptionEvents(
    onCompleted: (callId: string) => void,
    onFailed: (callId: string, error: string) => void
  ): void {
    const redis = QueueService['redis'].duplicate();
    
    redis.subscribe('transcription:completed', 'transcription:failed');
    
    redis.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (channel === 'transcription:completed') {
          onCompleted(data.callId);
        } else if (channel === 'transcription:failed') {
          onFailed(data.callId, data.error);
        }
      } catch (error) {
        logger.error('Failed to process transcription event', {
          channel,
          error
        });
      }
    });
  }
}