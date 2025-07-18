import Bull from 'bull';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface TranscriptionJob {
  callId: string;
  audioPath: string;
  priority?: number;
}

export interface TicketDraftJob {
  callId: string;
  transcript: string;
  callData: any;
}

export class QueueService {
  private static transcriptionQueue: Bull.Queue<TranscriptionJob>;
  private static draftQueue: Bull.Queue<TicketDraftJob>;
  static redis: Redis;

  static async initialize(): Promise<void> {
    const redisOpts = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    this.redis = new Redis(config.REDIS_URL, redisOpts);

    // Create queues
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

    // Monitor queue events
    this.setupQueueMonitoring();
  }

  static async close(): Promise<void> {
    await this.transcriptionQueue.close();
    await this.draftQueue.close();
    await this.redis.quit();
  }

  static async addTranscriptionJob(
    job: TranscriptionJob,
    options?: Bull.JobOptions
  ): Promise<Bull.Job<TranscriptionJob>> {
    logger.info('Adding transcription job', { callId: job.callId });
    return this.transcriptionQueue.add(job, {
      priority: job.priority || 0,
      ...options,
    });
  }

  static async addDraftJob(
    job: TicketDraftJob,
    options?: Bull.JobOptions
  ): Promise<Bull.Job<TicketDraftJob>> {
    logger.info('Adding draft job', { callId: job.callId });
    return this.draftQueue.add(job, options);
  }

  static getTranscriptionQueue(): Bull.Queue<TranscriptionJob> {
    return this.transcriptionQueue;
  }

  static getDraftQueue(): Bull.Queue<TicketDraftJob> {
    return this.draftQueue;
  }

  private static setupQueueMonitoring(): void {
    // Transcription queue monitoring
    this.transcriptionQueue.on('completed', (job) => {
      logger.info('Transcription job completed', {
        jobId: job.id,
        callId: job.data.callId,
      });
    });

    this.transcriptionQueue.on('failed', (job, err) => {
      logger.error('Transcription job failed', {
        jobId: job.id,
        callId: job.data.callId,
        error: err.message,
      });
    });

    this.transcriptionQueue.on('stalled', (job) => {
      logger.warn('Transcription job stalled', {
        jobId: job.id,
        callId: job.data.callId,
      });
    });

    // Draft queue monitoring
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
      });
    });
  }

  // Utility methods for queue management
  static async getQueueStats() {
    const [
      transcriptionWaiting,
      transcriptionActive,
      transcriptionCompleted,
      transcriptionFailed,
      draftWaiting,
      draftActive,
      draftCompleted,
      draftFailed,
    ] = await Promise.all([
      this.transcriptionQueue.getWaitingCount(),
      this.transcriptionQueue.getActiveCount(),
      this.transcriptionQueue.getCompletedCount(),
      this.transcriptionQueue.getFailedCount(),
      this.draftQueue.getWaitingCount(),
      this.draftQueue.getActiveCount(),
      this.draftQueue.getCompletedCount(),
      this.draftQueue.getFailedCount(),
    ]);

    return {
      transcription: {
        waiting: transcriptionWaiting,
        active: transcriptionActive,
        completed: transcriptionCompleted,
        failed: transcriptionFailed,
      },
      draft: {
        waiting: draftWaiting,
        active: draftActive,
        completed: draftCompleted,
        failed: draftFailed,
      },
    };
  }
}