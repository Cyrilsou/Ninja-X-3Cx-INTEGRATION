import dotenv from 'dotenv';
import { cleanEnv, str, num, url } from 'envalid';

dotenv.config();

export const config = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'production' }),
  PORT: num({ default: 3002 }),
  WEBSOCKET_PORT: num({ default: 3003 }),
  DATABASE_URL: url(),
  REDIS_URL: url(),
  JWT_SECRET: str(),
  
  // NinjaOne Configuration
  NINJAONE_CLIENT_ID: str(),
  NINJAONE_CLIENT_SECRET: str(),
  NINJAONE_INSTANCE_URL: url(),
  
  // CORS
  CORS_ORIGINS: str({ default: '*' }),
  
  // Rate limiting
  NINJAONE_RATE_LIMIT: num({ default: 5 }), // requests per second
  
  // Draft expiration
  DRAFT_EXPIRATION_MINUTES: num({ default: 5 }),
});

// Additional derived config
export const derivedConfig = {
  cors: {
    origins: config.CORS_ORIGINS.split(',').map(origin => origin.trim())
  },
  ninjaone: {
    tokenUrl: `${config.NINJAONE_INSTANCE_URL}/oauth/token`,
    apiUrl: `${config.NINJAONE_INSTANCE_URL}/api/v2`
  }
};