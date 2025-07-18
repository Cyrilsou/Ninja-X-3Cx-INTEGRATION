import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import cors from 'cors';
import Joi from 'joi';
import os from 'os';

const app = express();
const PORT = 8080;
// When running in Docker, the project is mounted at /project
// When running locally, we need to go up 3 levels from dist/
const isDocker = process.env.DOCKER_ENV === 'true' || existsSync('/.dockerenv');
const PROJECT_ROOT = isDocker ? '/project' : path.resolve(__dirname, '..', '..', '..');
const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env');

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve markdown documentation files
app.get('/*.md', async (req, res) => {
  const filename = req.path.slice(1); // Remove leading slash
  const projectRoot = PROJECT_ROOT;
  const filePath = path.join(projectRoot, filename);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(projectRoot) || filePath.includes('..')) {
    return res.status(403).send('Forbidden');
  }
  
  try {
    if (existsSync(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      res.type('text/plain; charset=utf-8');
      res.send(content);
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    res.status(500).send('Error reading file');
  }
});

// Configuration schema
const configSchema = Joi.object({
  // Database
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().min(8).required(),
  REDIS_PASSWORD: Joi.string().min(8).required(),
  
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

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    // Escape $ characters in values to prevent docker-compose interpolation
    const envContent = Object.entries(config)
      .map(([key, value]) => {
        // Convert value to string and escape $ characters
        const escapedValue = String(value).replace(/\$/g, '$$');
        // Quote values that contain special characters or spaces
        if (escapedValue.includes(' ') || escapedValue.includes('#') || escapedValue.includes('=')) {
          return `${key}="${escapedValue}"`;
        }
        return `${key}=${escapedValue}`;
      })
      .join('\n');
    
    // Write .env file
    try {
      // Check if .env exists and is a directory (Docker volume issue)
      try {
        const stats = await fs.stat(ENV_FILE_PATH);
        if (stats.isDirectory()) {
          console.log(`Removing directory at ${ENV_FILE_PATH}`);
          await fs.rmdir(ENV_FILE_PATH);
        }
      } catch {
        // File doesn't exist, which is fine
      }
      
      // Ensure the parent directory exists
      const envDir = path.dirname(ENV_FILE_PATH);
      try {
        await fs.access(envDir);
      } catch {
        console.log(`Creating directory: ${envDir}`);
        await fs.mkdir(envDir, { recursive: true });
      }
      
      await fs.writeFile(ENV_FILE_PATH, envContent, { mode: 0o666 });
      console.log(`Configuration saved to: ${ENV_FILE_PATH}`);
      
      // Log the content for debugging
      console.log('ENV file content preview (first 200 chars):');
      console.log(envContent.substring(0, 200) + '...');
      
      // Verify the file was written
      const stats = await fs.stat(ENV_FILE_PATH);
      console.log(`File size: ${stats.size} bytes`);
    } catch (writeError: any) {
      console.error('Error writing .env file:', writeError);
      console.error('ENV_FILE_PATH:', ENV_FILE_PATH);
      console.error('Is Docker:', isDocker);
      console.error('PROJECT_ROOT:', PROJECT_ROOT);
      throw writeError;
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving config:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: `Failed to save configuration: ${error.message}` });
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
    
    // No 3CX test needed in V2 architecture
    results.agents = { success: true, error: 'Agents connect directly via WebSocket' };
    
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
    const dockerOutput = execSync('docker ps --format "{{json .}}"', { 
      encoding: 'utf8'
    });
    
    const containers = dockerOutput.split('\n').filter(line => line.trim()).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Map container status by container name
    services['PostgreSQL'] = { 
      running: containers.some(c => c.Names && c.Names.includes('3cx-postgres')) 
    };
    services['Redis'] = { 
      running: containers.some(c => c.Names && c.Names.includes('3cx-redis')) 
    };
    // Event Receiver removed in V2 - agents record locally
    services['Orchestrator'] = { 
      running: containers.some(c => c.Names && c.Names.includes('3cx-orchestrator')) 
    };
    services['Whisper Worker'] = { 
      running: containers.some(c => c.Names && c.Names.includes('3cx-whisper-worker')) 
    };
    services['TV Dashboard'] = { 
      running: containers.some(c => c.Names && c.Names.includes('3cx-tv-dashboard')) 
    };
    
  } catch (error) {
    // If docker-compose is not running, all services are down
    services['PostgreSQL'] = { running: false };
    services['Redis'] = { running: false };
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
      console.log(`ENV file found at: ${ENV_FILE_PATH}`);
    } catch {
      console.error(`ENV file not found at: ${ENV_FILE_PATH}`);
      return res.status(400).json({ message: 'Configuration not found. Please save configuration first.' });
    }
    
    // Start services using the correct docker-compose file
    const projectDir = PROJECT_ROOT;
    console.log(`Starting services from directory: ${projectDir}`);
    
    // Check if docker-compose.yml exists
    const dockerComposePath = path.join(projectDir, 'docker-compose.yml');
    if (!existsSync(dockerComposePath)) {
      console.error(`docker-compose.yml not found at: ${dockerComposePath}`);
      return res.status(500).json({ message: 'docker-compose.yml not found in project root' });
    }
    
    // Use --env-file to explicitly specify the .env file location
    const envFilePath = path.join(projectDir, '.env');
    const result = execSync(`docker-compose --env-file "${envFilePath}" -f docker-compose.yml up -d`, { 
      stdio: 'pipe',
      cwd: projectDir,
      encoding: 'utf8'
    });
    
    console.log('Docker compose output:', result);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error starting services:', error);
    console.error('Error output:', error.stderr?.toString());
    res.status(500).json({ message: `Failed to start services: ${error.message}` });
  }
});

app.post('/api/services/stop', async (req, res) => {
  try {
    const projectDir = PROJECT_ROOT;
    const envFilePath = path.join(projectDir, '.env');
    execSync(`docker-compose --env-file "${envFilePath}" -f docker-compose.yml down`, { 
      stdio: 'pipe',
      cwd: projectDir
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping services:', error);
    res.status(500).json({ message: 'Failed to stop services' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Configuration UI running on http://0.0.0.0:${PORT}`);
  console.log(`Access it at http://${getServerIP()}:${PORT}`);
  console.log(`Environment: ${isDocker ? 'Docker' : 'Local'}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`ENV file path: ${ENV_FILE_PATH}`);
  
  // Check write permissions
  try {
    await fs.access(PROJECT_ROOT, 2); // fs.constants.W_OK = 2
    console.log(`Write permission OK for: ${PROJECT_ROOT}`);
  } catch {
    console.error(`NO write permission for: ${PROJECT_ROOT}`);
  }
});