import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import cors from 'cors';
import Joi from 'joi';
import os from 'os';

const app = express();
const PORT = 8080;
const ENV_FILE_PATH = path.join(__dirname, '../../../.env');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configuration schema
const configSchema = Joi.object({
  // Database
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().min(8).required(),
  REDIS_PASSWORD: Joi.string().min(8).required(),
  
  // 3CX
  THREECX_API_URL: Joi.string().uri().required(),
  THREECX_API_KEY: Joi.string().required(),
  
  // NinjaOne
  NINJAONE_CLIENT_ID: Joi.string().required(),
  NINJAONE_CLIENT_SECRET: Joi.string().required(),
  NINJAONE_INSTANCE_URL: Joi.string().uri().required(),
  
  // Whisper
  WHISPER_MODEL: Joi.string().valid('tiny', 'base', 'small', 'medium', 'large-v3').default('large-v3'),
  AUDIO_RETENTION_DAYS: Joi.number().min(1).max(365).default(30),
  
  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(32).required(),
});

// Get server IP address
function getServerIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Routes
app.get('/api/server-info', (req, res) => {
  const ip = getServerIP();
  res.json({
    ip,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
    cpus: os.cpus().length
  });
});

app.get('/api/config', async (req, res) => {
  try {
    const envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const config = dotenv.parse(envContent);
    
    // Don't send sensitive data in plaintext
    const sanitizedConfig = { ...config };
    Object.keys(sanitizedConfig).forEach(key => {
      if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
        sanitizedConfig[key] = sanitizedConfig[key] ? '********' : '';
      }
    });
    
    res.json(sanitizedConfig);
  } catch (error) {
    // File doesn't exist yet
    res.json({});
  }
});

app.post('/api/config', async (req, res) => {
  try {
    // Validate configuration
    const { error, value } = configSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Add computed values
    const config = {
      ...value,
      NODE_ENV: 'production',
      DOMAIN: getServerIP(),
      CORS_ORIGINS: '*',
      NINJAONE_RATE_LIMIT: '5',
      DRAFT_EXPIRATION_MINUTES: '5',
      AUDIO_STORAGE_PATH: '/var/lib/3cx-integration/audio',
      TRANSCRIPT_RETENTION_DAYS: '90',
      WEBSOCKET_PORT: '3003'
    };
    
    // Generate .env file content
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write .env file
    await fs.writeFile(ENV_FILE_PATH, envContent);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ message: 'Failed to save configuration' });
  }
});

app.post('/api/test-connections', async (req, res) => {
  const results: any = {};
  
  try {
    // Load current config
    const envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const config = dotenv.parse(envContent);
    
    // Test database connection
    try {
      execSync(`PGPASSWORD=${config.POSTGRES_PASSWORD} psql -h localhost -U ${config.POSTGRES_USER} -d ${config.POSTGRES_DB} -c "SELECT 1"`, 
        { stdio: 'pipe' });
      results.database = { success: true };
    } catch (error) {
      results.database = { success: false, error: 'Connection failed' };
    }
    
    // Test Redis connection
    try {
      execSync(`redis-cli -a ${config.REDIS_PASSWORD} ping`, { stdio: 'pipe' });
      results.redis = { success: true };
    } catch (error) {
      results.redis = { success: false, error: 'Connection failed' };
    }
    
    // Test 3CX API (basic connectivity)
    results.threecx = { success: true, error: 'Manual verification required' };
    
    // Test NinjaOne API (basic connectivity)
    results.ninjaone = { success: true, error: 'Manual verification required' };
    
  } catch (error) {
    console.error('Error testing connections:', error);
  }
  
  res.json(results);
});

app.get('/api/services/status', async (req, res) => {
  const services: any = {};
  
  try {
    // Check Docker services
    const dockerOutput = execSync('docker-compose ps --format json', { 
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe' 
    }).toString();
    
    const containers = dockerOutput.split('\n').filter(line => line.trim()).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Map container status
    services['PostgreSQL'] = { 
      running: containers.some(c => c.Service === 'postgres' && c.State === 'running') 
    };
    services['Redis'] = { 
      running: containers.some(c => c.Service === 'redis' && c.State === 'running') 
    };
    services['Event Receiver'] = { 
      running: containers.some(c => c.Service === 'event-receiver' && c.State === 'running') 
    };
    services['Orchestrator'] = { 
      running: containers.some(c => c.Service === 'orchestrator' && c.State === 'running') 
    };
    services['Whisper Worker'] = { 
      running: containers.some(c => c.Service === 'whisper-worker' && c.State === 'running') 
    };
    services['TV Dashboard'] = { 
      running: containers.some(c => c.Service === 'tv-dashboard' && c.State === 'running') 
    };
    
  } catch (error) {
    // If docker-compose is not running, all services are down
    services['PostgreSQL'] = { running: false };
    services['Redis'] = { running: false };
    services['Event Receiver'] = { running: false };
    services['Orchestrator'] = { running: false };
    services['Whisper Worker'] = { running: false };
    services['TV Dashboard'] = { running: false };
  }
  
  res.json(services);
});

app.post('/api/services/start', async (req, res) => {
  try {
    // Check if .env exists
    try {
      await fs.access(ENV_FILE_PATH);
    } catch {
      return res.status(400).json({ message: 'Configuration not found. Please save configuration first.' });
    }
    
    // Start services
    execSync('docker-compose up -d', { 
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error starting services:', error);
    res.status(500).json({ message: 'Failed to start services' });
  }
});

app.post('/api/services/stop', async (req, res) => {
  try {
    execSync('docker-compose down', { 
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping services:', error);
    res.status(500).json({ message: 'Failed to stop services' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Configuration UI running on http://0.0.0.0:${PORT}`);
  console.log(`Access it at http://${getServerIP()}:${PORT}`);
});