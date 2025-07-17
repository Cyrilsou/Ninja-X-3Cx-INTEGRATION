import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Créer le répertoire de logs s'il n'existe pas
const logDir = process.env.LOG_DIR || '/var/log/3cx-ninja';
if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
        console.warn('Unable to create log directory, using console only:', error);
    }
}

// Configuration des formats
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `[${timestamp}] ${level}: ${message}`;
        
        // Ajouter les métadonnées si présentes
        if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta)}`;
        }
        
        return logMessage;
    })
);

// Configuration des transports
const transports: winston.transport[] = [
    // Console (toujours actif)
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info'
    })
];

// Fichier de logs (si le répertoire existe)
if (fs.existsSync(logDir)) {
    // Logs généraux
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            format: logFormat,
            level: process.env.LOG_LEVEL || 'info',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );
    
    // Logs d'erreurs
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            format: logFormat,
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );
}

// Créer le logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    // Ne pas sortir sur la console si on est en production (déjà géré par le transport console)
    silent: false,
    // Gérer les exceptions non capturées
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log'),
            format: logFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3
        })
    ],
    // Gérer les rejections de promesses
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log'),
            format: logFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3
        })
    ]
});

// Logger spécialisé pour les événements de découverte réseau
export const discoveryLogger = logger.child({
    component: 'network-discovery'
});

// Logger spécialisé pour les webhooks 3CX
export const webhookLogger = logger.child({
    component: 'webhook-3cx'
});

// Logger spécialisé pour l'intégration NinjaOne
export const ninjaLogger = logger.child({
    component: 'ninja-integration'
});

// Logger spécialisé pour la transcription
export const transcriptionLogger = logger.child({
    component: 'transcription'
});

// Logger spécialisé pour les agents
export const agentLogger = logger.child({
    component: 'agent-management'
});

// Fonctions utilitaires
export const logRequest = (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
        };
        
        if (res.statusCode >= 400) {
            logger.warn('HTTP Request', logData);
        } else {
            logger.info('HTTP Request', logData);
        }
    });
    
    next();
};

export const logError = (error: Error, context?: any) => {
    logger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        context
    });
};

export const logWebhookEvent = (event: string, data: any) => {
    webhookLogger.info(`Webhook ${event}`, data);
};

export const logAgentEvent = (event: string, agentId: string, data?: any) => {
    agentLogger.info(`Agent ${event}`, {
        agentId,
        ...data
    });
};

export const logTranscriptionEvent = (event: string, callId: string, data?: any) => {
    transcriptionLogger.info(`Transcription ${event}`, {
        callId,
        ...data
    });
};

export const logNinjaEvent = (event: string, data?: any) => {
    ninjaLogger.info(`Ninja ${event}`, data);
};

export const logDiscoveryEvent = (event: string, data?: any) => {
    discoveryLogger.info(`Discovery ${event}`, data);
};

// Gestion des logs de performance
export const createPerformanceLogger = (operation: string) => {
    const start = Date.now();
    
    return {
        log: (message: string, data?: any) => {
            logger.debug(`[${operation}] ${message}`, data);
        },
        
        finish: (data?: any) => {
            const duration = Date.now() - start;
            logger.info(`[${operation}] Completed in ${duration}ms`, data);
        },
        
        error: (error: Error, data?: any) => {
            const duration = Date.now() - start;
            logger.error(`[${operation}] Failed after ${duration}ms`, {
                error: error.message,
                stack: error.stack,
                ...data
            });
        }
    };
};

// Configuration des niveaux pour le développement
if (process.env.NODE_ENV === 'development') {
    logger.level = 'debug';
    
    // Ajouter plus de détails en développement
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        level: 'debug'
    }));
}

// Exporter également winston pour les cas spéciaux
export { winston };

export default logger;