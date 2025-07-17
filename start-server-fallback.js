#!/usr/bin/env node

// Serveur fallback minimal avec gestion des dépendances manquantes
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const SERVER_IP = process.env.SERVER_IP || 'localhost';
const API_KEY = process.env.API_KEY || 'default-key';

let express, cors, io;

// Essayer de charger les dépendances optionnelles
try {
    express = require('express');
    cors = require('cors');
} catch (e) {
    console.warn('Express ou CORS non disponible, mode HTTP basique');
}

// Créer le serveur selon les dépendances disponibles
let server;
let app;

if (express) {
    // Mode Express complet
    app = express();
    app.use(cors ? cors() : (req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
    });
    app.use(express.json());
    
    // Routes Express
    app.get('/', (req, res) => {
        res.json({
            name: '3CX-Ninja Realtime Server',
            version: '2.0.0',
            status: 'running (mode fallback)',
            port: PORT
        });
    });
    
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', mode: 'fallback' });
    });
    
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date() });
    });
    
    app.get('/api/install/discover', (req, res) => {
        res.json({
            serverUrl: `http://${SERVER_IP}:${PORT}`,
            apiKey: API_KEY,
            serverName: '3CX-Ninja-Server',
            version: '2.0.0'
        });
    });
    
    // Servir le dashboard si disponible
    const dashboardPath = path.join(__dirname, 'dashboard/dist');
    if (fs.existsSync(dashboardPath)) {
        app.use(express.static(dashboardPath));
    }
    
    server = http.createServer(app);
} else {
    // Mode HTTP basique
    server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        if (req.url === '/' || req.url === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify({
                name: '3CX-Ninja Realtime Server',
                version: '2.0.0',
                status: 'running (mode minimal)',
                port: PORT
            }));
        } else if (req.url === '/api/health') {
            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date(),
                mode: 'minimal'
            }));
        } else if (req.url === '/api/install/discover') {
            res.writeHead(200);
            res.end(JSON.stringify({
                serverUrl: `http://${SERVER_IP}:${PORT}`,
                apiKey: API_KEY,
                serverName: '3CX-Ninja-Server',
                version: '2.0.0'
            }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    });
}

// Socket.io si disponible
try {
    const { Server } = require('socket.io');
    io = new Server(server, {
        cors: { origin: '*', credentials: true }
    });
    
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
    console.log('WebSocket activé avec Socket.io');
} catch (e) {
    console.log('Socket.io non disponible, WebSocket désactivé');
}

// Découverte réseau
if (process.env.ENABLE_DISCOVERY === 'true') {
    try {
        const dgram = require('dgram');
        const socket = dgram.createSocket('udp4');
        const DISCOVERY_PORT = parseInt(process.env.DISCOVERY_PORT || '53434');
        
        socket.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                if (message.type === 'DISCOVER_3CX_NINJA_SERVER') {
                    const response = {
                        type: 'SERVER_DISCOVERY_RESPONSE',
                        server: {
                            name: '3CX-Ninja-Server',
                            ip: SERVER_IP,
                            port: PORT,
                            apiKey: API_KEY,
                            version: '2.0.0'
                        }
                    };
                    socket.send(Buffer.from(JSON.stringify(response)), rinfo.port, rinfo.address);
                }
            } catch (error) {
                console.error('Discovery message error:', error);
            }
        });
        
        socket.on('error', (err) => {
            console.error('Discovery socket error:', err);
        });
        
        socket.bind(DISCOVERY_PORT, () => {
            console.log(`Discovery service actif sur le port ${DISCOVERY_PORT}`);
        });
    } catch (e) {
        console.error('Impossible d\'activer la découverte réseau:', e.message);
    }
}

// Démarrer le serveur
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
========================================
🚀 3CX-Ninja Server (Mode Fallback)
========================================
📡 Port: ${PORT}
🔑 API Key: ${API_KEY}
📍 IP: ${SERVER_IP}
🔍 Discovery: ${process.env.ENABLE_DISCOVERY === 'true' ? 'ON' : 'OFF'}
💡 Mode: ${express ? 'Express' : 'HTTP Basique'}
========================================
    `);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// Arrêt propre
process.on('SIGTERM', () => {
    console.log('SIGTERM reçu, arrêt du serveur...');
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});