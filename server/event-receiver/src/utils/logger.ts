import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'event-receiver' },
  transports: [
    new winston.transports.Console({
      format: config.NODE_ENV === 'production' 
        ? logFormat 
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    })
  ]
});

// Add file transport in production
if (config.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: '/app/logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: '/app/logs/combined.log',
    maxsize: 10485760, // 10MB
    maxFiles: 10
  }));
}