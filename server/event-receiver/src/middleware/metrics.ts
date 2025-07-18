import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Create a Registry
export const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const webhooksReceived = new promClient.Counter({
  name: 'webhooks_received_total',
  help: 'Total number of webhooks received',
  labelNames: ['type', 'status']
});

export const callsProcessed = new promClient.Counter({
  name: 'calls_processed_total',
  help: 'Total number of calls processed',
  labelNames: ['status']
});

export const recordingDownloads = new promClient.Counter({
  name: 'recording_downloads_total',
  help: 'Total number of recording downloads',
  labelNames: ['status']
});

export const activeWebSocketConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(webhooksReceived);
register.registerMetric(callsProcessed);
register.registerMetric(recordingDownloads);
register.registerMetric(activeWebSocketConnections);

// Middleware to track HTTP metrics
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      httpRequestDuration
        .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
        .observe(duration);
    });
    
    next();
  };
}