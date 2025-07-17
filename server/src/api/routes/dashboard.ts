import { Router } from 'express';
import { Logger } from '@3cx-ninja/shared';
import { getDashboardStats } from '../../services/dashboard-service';

const logger = new Logger('DashboardAPI');
const router = Router();

// Route SSE pour les mises à jour en temps réel
router.get('/stream', (req, res) => {
  logger.info('Client connected to dashboard stream');
  
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Pour nginx
  });

  // Envoyer les stats initiales
  getDashboardStats().then(stats => {
    res.write(`data: ${JSON.stringify(stats)}\n\n`);
  });

  // Heartbeat pour garder la connexion active
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Envoyer les mises à jour périodiques
  const updates = setInterval(async () => {
    try {
      const stats = await getDashboardStats();
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
    } catch (error) {
      logger.error('Error sending dashboard update:', error);
    }
  }, 5000); // Mise à jour toutes les 5 secondes

  // Nettoyage à la déconnexion
  req.on('close', () => {
    logger.info('Client disconnected from dashboard stream');
    clearInterval(heartbeat);
    clearInterval(updates);
  });
});

// Route pour les stats instantanées
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

export function createDashboardRouter() {
  return router;
}