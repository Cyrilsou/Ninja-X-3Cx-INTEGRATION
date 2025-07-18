import dotenv from 'dotenv';
import { cleanEnv, str, num, url } from 'envalid';

dotenv.config();

export const config = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'production' }),
  PORT: num({ default: 3001 }),
  DATABASE_URL: url(),
  REDIS_URL: url(),
  JWT_SECRET: str(),
  ENCRYPTION_KEY: str({ desc: '32 character encryption key' }),
  STORAGE_PATH: str({ default: '/app/storage' }),
  
  // 3CX Configuration
  THREECX_API_URL: url(),
  THREECX_API_KEY: str(),
  
  // CORS
  CORS_ORIGINS: str({ default: '*' }),
  
  // File limits
  MAX_FILE_SIZE: num({ default: 100 * 1024 * 1024 }), // 100MB
  
  // Retention
  AUDIO_RETENTION_DAYS: num({ default: 30 }),
});

// Additional derived config
export const derivedConfig = {
  cors: {
    origins: config.CORS_ORIGINS.split(',').map(origin => origin.trim())
  },
  storage: {
    audioPath: `${config.STORAGE_PATH}/audio`,
    tempPath: `${config.STORAGE_PATH}/temp`
  }
};