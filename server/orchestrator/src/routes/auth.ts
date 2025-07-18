import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { DatabaseService } from '../services/database';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();

const loginSchema = Joi.object({
  extension: Joi.string().required(),
  agentName: Joi.string().optional()
});

// Agent login endpoint
router.post('/agent/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Invalid request', details: error.details });
      return;
    }

    const { extension, agentName } = value;
    
    logger.info('Agent login attempt', { extension, agentName });

    // Generate JWT token
    const token = jwt.sign(
      {
        extension,
        agentName,
        type: 'agent'
      },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Hash token for storage
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Create session in database
    const session = await DatabaseService.createAgentSession({
      extension,
      agentName,
      jwtTokenHash: tokenHash,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    });

    // Log audit event
    await DatabaseService.logAuditEvent(
      'AGENT_LOGIN',
      'session',
      session.id,
      extension,
      req.ip,
      { agentName }
    );

    res.json({
      token,
      extension,
      agentName,
      expiresAt: session.expires_at,
      websocketUrl: `ws://${req.get('host')}/agent?token=${token}`
    });

  } catch (error) {
    logger.error('Agent login failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    
    // Check if session exists and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await DatabaseService.getAgentByExtension(decoded.extension);
    
    if (!session || session.jwt_token_hash !== tokenHash) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    // Update activity
    await DatabaseService.updateAgentActivity(session.id);

    res.json({
      valid: true,
      extension: decoded.extension,
      agentName: decoded.agentName,
      expiresAt: session.expires_at
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    logger.error('Token verification failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TV display token endpoint (simplified auth)
router.post('/tv/token', async (req: Request, res: Response) => {
  try {
    // For TV displays, we can use a simpler auth mechanism
    // In production, you might want to add IP whitelisting or a shared secret
    
    const token = jwt.sign(
      {
        type: 'tv',
        timestamp: Date.now()
      },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      websocketUrl: `ws://${req.get('host')}/tv?token=${token}`
    });

  } catch (error) {
    logger.error('TV token generation failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const authRouter = router;