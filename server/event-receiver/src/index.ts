import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { webhookRouter } from './routes/webhook';
import { healthRouter } from './routes/health';
import { metricsRouter } from './routes/metrics';
import { metricsMiddleware } from './middleware/metrics';
import { WebSocketManager } from './services/websocket';
import { DatabaseService } from './services/database';
import { QueueService } from './services/queue';
import { StorageService } from './services/storage';
import { WhisperConnector } from './services/whisperConnector';
import { CallStatus } from './types/database.types';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.cors.origins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware
app.use(metricsMiddleware());

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);
app.use('/metrics', metricsRouter);

// Error handling
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Initialize database
    await DatabaseService.initialize();
    logger.info('Database initialized');

    // Initialize queue
    await QueueService.initialize();
    logger.info('Queue service initialized');

    // Initialize storage
    await StorageService.initialize();
    logger.info('Storage service initialized');

    // Initialize WebSocket connection to 3CX
    await WebSocketManager.initialize();
    logger.info('WebSocket manager initialized');

    // Subscribe to transcription events
    WhisperConnector.subscribeToTranscriptionEvents(
      async (callId) => {
        logger.info('Transcription completed', { callId });
        try {
          const result = await WhisperConnector.getTranscriptionResult(callId);
          if (result && result.transcript) {
            await DatabaseService.updateCall(callId, {
              status: CallStatus.TRANSCRIBED,
              transcript: result.transcript
            });
            
            // Add to draft queue
            const call = await DatabaseService.getCall(callId);
            if (call) {
              await QueueService.addDraftJob({
                callId,
                transcript: result.transcript,
                callData: call
              });
            }
          }
        } catch (error) {
          logger.error('Failed to process transcription completion', { callId, error });
        }
      },
      async (callId, error) => {
        logger.error('Transcription failed', { callId, error });
        await DatabaseService.updateCall(callId, {
          status: CallStatus.FAILED,
          errorMessage: `Transcription failed: ${error}`
        });
      }
    );
    logger.info('Subscribed to transcription events');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Event Receiver running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      server.close(() => {
        logger.info('HTTP server closed');
      });

      await WebSocketManager.disconnect();
      await QueueService.close();
      await DatabaseService.close();
      
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();