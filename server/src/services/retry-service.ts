import { Logger } from '@3cx-ninja/shared';
import PQueue from 'p-queue';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryService {
  private logger = new Logger('RetryService');
  private queue: PQueue;
  
  constructor() {
    this.queue = new PQueue({ 
      concurrency: 10,
      interval: 1000,
      intervalCap: 20
    });
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      factor = 2,
      onRetry
    } = options;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.logger.error(`Operation failed after ${maxRetries} attempts:`, error);
          throw error;
        }
        
        const delay = Math.min(
          initialDelay * Math.pow(factor, attempt - 1),
          maxDelay
        );
        
        this.logger.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms:`,
          error.message
        );
        
        if (onRetry) {
          onRetry(error as Error, attempt);
        }
        
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }

  async enqueue<T>(
    operation: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.queue.add(() => this.withRetry(operation, retryOptions));
  }

  async bulkRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions & { concurrency?: number } = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const { concurrency = 5, ...retryOptions } = options;
    
    const results = await Promise.allSettled(
      operations.map(op => 
        this.queue.add(() => this.withRetry(op, retryOptions))
      )
    );
    
    return results.map(result => {
      if (result.status === 'fulfilled') {
        return { success: true, result: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    };
  }

  async clear() {
    await this.queue.clear();
  }

  pause() {
    this.queue.pause();
  }

  resume() {
    this.queue.start();
  }
}

export default new RetryService();