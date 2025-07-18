import { Router, Request, Response } from 'express';
import { register } from '../middleware/metrics';

const router = Router();

// Prometheus metrics endpoint
router.get('/', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
});

export const metricsRouter = router;