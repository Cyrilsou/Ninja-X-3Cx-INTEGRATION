import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AgentPayload {
  extension: string;
  agentName: string;
  type: 'agent';
}

declare global {
  namespace Express {
    interface Request {
      agent?: AgentPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Pour l'instant, authentification simple basée sur l'extension
    const extension = req.headers['x-extension'] as string;
    
    if (!extension) {
      return res.status(401).json({ error: 'Extension requise' });
    }

    // Vérifier si c'est un JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AgentPayload;
        req.agent = decoded;
        return next();
      } catch (error) {
        logger.warn('Token JWT invalide', error);
      }
    }

    // Authentification basique par extension
    req.agent = {
      extension,
      agentName: `Agent ${extension}`,
      type: 'agent'
    };

    next();
  } catch (error) {
    logger.error('Erreur authentification', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}