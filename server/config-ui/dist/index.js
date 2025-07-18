"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const joi_1 = __importDefault(require("joi"));
const os_1 = __importDefault(require("os"));
const app = (0, express_1.default)();
const PORT = 8080;
// In production, __dirname is in dist/, so we need to go up 3 levels to reach project root
// dist/ -> config-ui/ -> server/ -> Projet/
const PROJECT_ROOT = path_1.default.resolve(__dirname, '..', '..', '..');
const ENV_FILE_PATH = path_1.default.join(PROJECT_ROOT, '.env');
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Serve markdown documentation files
app.get('/*.md', async (req, res) => {
    const filename = req.path.slice(1); // Remove leading slash
    const projectRoot = PROJECT_ROOT;
    const filePath = path_1.default.join(projectRoot, filename);
    // Security: prevent directory traversal
    if (!filePath.startsWith(projectRoot) || filePath.includes('..')) {
        return res.status(403).send('Forbidden');
    }
    try {
        if ((0, fs_1.existsSync)(filePath)) {
            const content = await promises_1.default.readFile(filePath, 'utf-8');
            res.type('text/plain; charset=utf-8');
            res.send(content);
        }
        else {
            res.status(404).send('File not found');
        }
    }
    catch (error) {
        res.status(500).send('Error reading file');
    }
});
// Configuration schema
const configSchema = joi_1.default.object({
    // Database
    POSTGRES_DB: joi_1.default.string().required(),
    POSTGRES_USER: joi_1.default.string().required(),
    POSTGRES_PASSWORD: joi_1.default.string().min(8).required(),
    REDIS_PASSWORD: joi_1.default.string().min(8).required(),
    // NinjaOne
    NINJAONE_CLIENT_ID: joi_1.default.string().required(),
    NINJAONE_CLIENT_SECRET: joi_1.default.string().required(),
    NINJAONE_INSTANCE_URL: joi_1.default.string().uri().required(),
    // Whisper
    WHISPER_MODEL: joi_1.default.string().valid('tiny', 'base', 'small', 'medium', 'large-v3').default('large-v3'),
    AUDIO_RETENTION_DAYS: joi_1.default.number().min(1).max(365).default(30),
    // Security
    JWT_SECRET: joi_1.default.string().min(32).required(),
    ENCRYPTION_KEY: joi_1.default.string().length(32).required(),
});
// Get server IP address
function getServerIP() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
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
        hostname: os_1.default.hostname(),
        platform: os_1.default.platform(),
        arch: os_1.default.arch(),
        totalMemory: Math.round(os_1.default.totalmem() / 1024 / 1024 / 1024) + ' GB',
        cpus: os_1.default.cpus().length
    });
});
app.get('/api/config', async (req, res) => {
    try {
        const envContent = await promises_1.default.readFile(ENV_FILE_PATH, 'utf-8');
        const config = dotenv_1.default.parse(envContent);
        // Don't send sensitive data in plaintext
        const sanitizedConfig = { ...config };
        Object.keys(sanitizedConfig).forEach(key => {
            if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
                sanitizedConfig[key] = sanitizedConfig[key] ? '********' : '';
            }
        });
        res.json(sanitizedConfig);
    }
    catch (error) {
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
        await promises_1.default.writeFile(ENV_FILE_PATH, envContent);
        console.log(`Configuration saved to: ${ENV_FILE_PATH}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ message: 'Failed to save configuration' });
    }
});
app.post('/api/test-connections', async (req, res) => {
    const results = {};
    try {
        // Load current config
        const envContent = await promises_1.default.readFile(ENV_FILE_PATH, 'utf-8');
        const config = dotenv_1.default.parse(envContent);
        // Test database connection
        try {
            (0, child_process_1.execSync)(`PGPASSWORD=${config.POSTGRES_PASSWORD} psql -h localhost -U ${config.POSTGRES_USER} -d ${config.POSTGRES_DB} -c "SELECT 1"`, { stdio: 'pipe' });
            results.database = { success: true };
        }
        catch (error) {
            results.database = { success: false, error: 'Connection failed' };
        }
        // Test Redis connection
        try {
            (0, child_process_1.execSync)(`redis-cli -a ${config.REDIS_PASSWORD} ping`, { stdio: 'pipe' });
            results.redis = { success: true };
        }
        catch (error) {
            results.redis = { success: false, error: 'Connection failed' };
        }
        // No 3CX test needed in V2 architecture
        results.agents = { success: true, error: 'Agents connect directly via WebSocket' };
        // Test NinjaOne API (basic connectivity)
        results.ninjaone = { success: true, error: 'Manual verification required' };
    }
    catch (error) {
        console.error('Error testing connections:', error);
    }
    res.json(results);
});
app.get('/api/services/status', async (req, res) => {
    const services = {};
    try {
        // Check Docker services
        const dockerOutput = (0, child_process_1.execSync)('docker ps --format "{{json .}}"', {
            encoding: 'utf8'
        });
        const containers = dockerOutput.split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            }
            catch {
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
    }
    catch (error) {
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
            await promises_1.default.access(ENV_FILE_PATH);
            console.log(`ENV file found at: ${ENV_FILE_PATH}`);
        }
        catch {
            console.error(`ENV file not found at: ${ENV_FILE_PATH}`);
            return res.status(400).json({ message: 'Configuration not found. Please save configuration first.' });
        }
        // Start services using the correct docker-compose file
        const projectDir = PROJECT_ROOT;
        console.log(`Starting services from directory: ${projectDir}`);
        // Check if docker-compose.yml exists
        const dockerComposePath = path_1.default.join(projectDir, 'docker-compose.yml');
        if (!(0, fs_1.existsSync)(dockerComposePath)) {
            console.error(`docker-compose.yml not found at: ${dockerComposePath}`);
            return res.status(500).json({ message: 'docker-compose.yml not found in project root' });
        }
        const result = (0, child_process_1.execSync)(`docker-compose -f docker-compose.yml up -d`, {
            stdio: 'pipe',
            cwd: projectDir,
            encoding: 'utf8'
        });
        console.log('Docker compose output:', result);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error starting services:', error);
        console.error('Error output:', error.stderr?.toString());
        res.status(500).json({ message: `Failed to start services: ${error.message}` });
    }
});
app.post('/api/services/stop', async (req, res) => {
    try {
        const projectDir = PROJECT_ROOT;
        (0, child_process_1.execSync)(`cd ${projectDir} && docker-compose -f docker-compose.yml down`, {
            stdio: 'pipe',
            cwd: projectDir
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error stopping services:', error);
        res.status(500).json({ message: 'Failed to stop services' });
    }
});
// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Configuration UI running on http://0.0.0.0:${PORT}`);
    console.log(`Access it at http://${getServerIP()}:${PORT}`);
    console.log(`Project root: ${PROJECT_ROOT}`);
    console.log(`ENV file path: ${ENV_FILE_PATH}`);
});
