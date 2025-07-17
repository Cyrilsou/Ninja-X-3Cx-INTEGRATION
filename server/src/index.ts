import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import config from 'config';
import path from 'path';

import { Logger } from '@3cx-ninja/shared';
import { RedisService } from './services/redis-service';
import { SocketManager } from './websocket/socket-manager';
import { TranscriptionQueue } from './services/transcription-queue';
import WhisperLocalService from './services/whisper-local';
import AudioProcessingService from './services/audio-processing';
import { initDatabase } from './database';
import { createApiRouter } from './api/routes';
import { create3CXWebhookRouter } from './api/routes/webhook-3cx';
import { createAdminRouter } from './api/routes/admin';
import { createDashboardRouter } from './api/routes/dashboard';
import { createInstallRouter } from './api/routes/install';
import { setRedisService } from './services/dashboard-service';
import authRoutes from './routes/auth';
import { ninjaAuth } from './services/ninja-auth';

// Charger les variables d'environnement
dotenv.config();

const logger = new Logger('Server');
const app = express();
const httpServer = createServer(app);

// Services
const redis = new RedisService();
const transcriptionQueue = new TranscriptionQueue();
const socketManager = new SocketManager(httpServer, redis, transcriptionQueue);

// Injecter le socket manager dans la queue
transcriptionQueue.setSocketManager(socketManager);

// Injecter Redis dans le service dashboard
setRedisService(redis);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Pour permettre WebSocket
}));

app.use(cors({
  origin: config.get('security.corsOrigins'),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques publics (scripts d'installation, etc.)
app.use('/public', express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.get('security.rateLimit.windowMs'),
  max: config.get('security.rateLimit.max'),
  message: 'Trop de requêtes, veuillez réessayer plus tard'
});

app.use('/api', limiter);

// Routes d'authentification (sans auth middleware)
app.use('/api/auth', authRoutes);

// Auth middleware pour l'API (sauf /api/auth)
app.use('/api', (req, res, next) => {
  // Skip auth pour les routes /api/auth/*
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const expectedKey = process.env.API_KEY || config.get('security.apiKey');
  
  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
});

// Routes API protégées
app.use('/api', createApiRouter(redis, socketManager));

// Routes admin (avec authentification séparée)
app.use('/api/admin', createAdminRouter(redis, socketManager));

// Routes dashboard (sans auth pour l'affichage TV)
app.use('/api/dashboard', createDashboardRouter());

// Routes webhook 3CX (sans authentification pour permettre à 3CX de poster)
app.use('/webhook/3cx', create3CXWebhookRouter(redis, socketManager));

// Routes d'installation (publiques pour permettre l'installation automatique)
app.use('/api/install', createInstallRouter());

// Health check
app.get('/health', async (req, res) => {
  try {
    const stats = await transcriptionQueue.getStats();
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        redis: 'connected',
        whisper: 'ready',
        queue: stats
      }
    };
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
});

// Servir le dashboard TV en production
if (process.env.NODE_ENV === 'production') {
  const dashboardTVPath = path.join(__dirname, '../../dashboard-tv/dist');
  app.use('/tv', express.static(dashboardTVPath));
  
  // Route pour le dashboard TV
  app.get('/tv*', (req, res) => {
    res.sendFile(path.join(dashboardTVPath, 'index.html'));
  });
}

// Servir les fichiers statiques du dashboard admin en production
if (process.env.NODE_ENV === 'production') {
  const dashboardPath = path.join(__dirname, '../../dashboard/dist');
  app.use(express.static(dashboardPath));
  
  // Catch-all pour le routing SPA (sauf /tv et /api)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/tv') && !req.path.startsWith('/api')) {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    }
  });
}

// Gestion des erreurs
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    // Initialiser Redis
    logger.info('Connecting to Redis...');
    await redis.connect();
    
    // Initialiser la base de données
    logger.info('Setting up database...');
    await initDatabase();
    
    // Initialiser Whisper
    logger.info('Initializing Whisper...');
    await WhisperLocalService.initialize();
    
    // Initialiser NinjaOne si refresh token disponible
    if (process.env.NINJA_REFRESH_TOKEN) {
      logger.info('Initializing NinjaOne authentication...');
      try {
        await ninjaAuth.initializeWithRefreshToken(process.env.NINJA_REFRESH_TOKEN);
        logger.info('NinjaOne authentication initialized');
      } catch (error) {
        logger.error('Failed to initialize NinjaOne:', error);
      }
    }
    
    // Nettoyer les anciens fichiers au démarrage
    await AudioProcessingService.cleanupOldFiles();
    
    // Programmer le nettoyage périodique
    if (config.get('cleanup.enabled')) {
      setInterval(() => {
        AudioProcessingService.cleanupOldFiles();
        transcriptionQueue.clean();
      }, config.get('cleanup.interval'));
    }
    
    // Démarrer le serveur
    const port = process.env.PORT || config.get('server.port');
    const host = config.get('server.host');
    
    httpServer.listen(Number(port), host as string, () => {
      logger.info(`Server running on http://${host}:${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Whisper model: ${config.get('whisper.model')}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  await redis.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Démarrer le serveur
startServer();