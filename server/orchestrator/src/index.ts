import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { config, derivedConfig } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import uploadRouter from './routes/upload';
import { DatabaseService } from './services/database';
import { QueueService } from './services/queue';
import { WebSocketService } from './services/websocket';
import { NinjaOneService } from './services/ninjaone';
import { DraftProcessor } from './services/draftProcessor';
import { DiscoveryService } from './services/discovery';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: derivedConfig.cors.origins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logging
app.use((req, _res, next) => {
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
app.use('/auth', authRouter);
app.use('/', uploadRouter);

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

    // Initialize NinjaOne service (singleton will handle initialization)
    NinjaOneService.getInstance();
    logger.info('NinjaOne service initialized');

    // Initialize WebSocket service (starts on its own port)
    WebSocketService.getInstance();
    logger.info('WebSocket service initialized');

    // Initialize Draft Processor
    DraftProcessor.getInstance();
    logger.info('Draft processor initialized');

    // Initialize Discovery Service
    const discoveryService = new DiscoveryService();
    discoveryService.start();
    logger.info('Discovery service started');

    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`Orchestrator running on port ${config.PORT}`);
      logger.info(`WebSocket server running on port ${config.WEBSOCKET_PORT}`);
      logger.info('UDP Discovery broadcasting on port 5355');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      server.close(() => {
        logger.info('HTTP server closed');
      });

      await QueueService.close();
      await DatabaseService.close();
      discoveryService.stop();
      
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();