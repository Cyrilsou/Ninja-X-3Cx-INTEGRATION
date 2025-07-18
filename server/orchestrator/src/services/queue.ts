import Bull from 'bull';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DraftProcessor } from './draftProcessor';

export interface TicketDraftJob {
  callId: string;
  transcript: string;
  callData: any;
}

export interface TranscriptionJob {
  callId: string;
  audioPath: string;
  callData: any;
}

export class QueueService {
  private static draftQueue: Bull.Queue<TicketDraftJob>;
  private static transcriptionQueue: Bull.Queue<TranscriptionJob>;
  private static redis: Redis;
  private static draftProcessor: DraftProcessor;

  static async initialize(): Promise<void> {
    const redisOpts = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    this.redis = new Redis(config.REDIS_URL, redisOpts);
    this.draftProcessor = DraftProcessor.getInstance();

    // Create draft queue
    this.draftQueue = new Bull('ticket-draft', config.REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Create transcription queue
    this.transcriptionQueue = new Bull('transcription', config.REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Process draft jobs
    this.draftQueue.process(async (job) => {
      logger.info('Processing draft job', { jobId: job.id, callId: job.data.callId });
      
      try {
        await this.draftProcessor.createDraftFromCall(
          job.data.callId,
          job.data.transcript,
          job.data.callData
        );
      } catch (error) {
        logger.error('Failed to process draft job', {
          jobId: job.id,
          callId: job.data.callId,
          error
        });
        throw error;
      }
    });

    // Monitor queue events
    this.setupQueueMonitoring();
  }

  static async close(): Promise<void> {
    await this.draftQueue.close();
    await this.transcriptionQueue.close();
    await this.redis.quit();
  }

  static async addTranscriptionJob(jobData: TranscriptionJob): Promise<Bull.Job<TranscriptionJob>> {
    return await this.transcriptionQueue.add(jobData);
  }

  private static setupQueueMonitoring(): void {
    this.draftQueue.on('completed', (job) => {
      logger.info('Draft job completed', {
        jobId: job.id,
        callId: job.data.callId,
      });
    });

    this.draftQueue.on('failed', (job, err) => {
      logger.error('Draft job failed', {
        jobId: job.id,
        callId: job.data.callId,
        error: err.message,
        stack: err.stack
      });
    });

    this.draftQueue.on('stalled', (job) => {
      logger.warn('Draft job stalled', {
        jobId: job.id,
        callId: job.data.callId,
      });
    });
  }

  static async getQueueStats() {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    ] = await Promise.all([
      this.draftQueue.getWaitingCount(),
      this.draftQueue.getActiveCount(),
      this.draftQueue.getCompletedCount(),
      this.draftQueue.getFailedCount(),
      this.draftQueue.getDelayedCount(),
      this.draftQueue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    };
  }
}