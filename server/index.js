#!/usr/bin/env node

// Fallback server pour démarrage sans build TypeScript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes basiques
app.get('/', (req, res) => {
    res.json({
        name: '3CX-Ninja Realtime Server',
        version: '2.0.0',
        status: 'running (fallback mode)',
        message: 'Server running without TypeScript build. Run npm run build for full features.'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: 'fallback' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: 'fallback' });
});

// API d'installation
app.get('/api/install/discover', (req, res) => {
    res.json({
        serverUrl: `http://${process.env.SERVER_IP || 'localhost'}:${PORT}`,
        apiKey: process.env.API_KEY,
        serverName: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
        version: '2.0.0'
    });
});

// WebSocket basique
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Service de découverte réseau basique
if (process.env.ENABLE_DISCOVERY === 'true') {
    const dgram = require('dgram');
    const discoverySocket = dgram.createSocket('udp4');
    const DISCOVERY_PORT = parseInt(process.env.DISCOVERY_PORT || '53434');
    
    discoverySocket.on('message', (msg, rinfo) => {
        try {
            const message = JSON.parse(msg.toString());
            if (message.type === 'DISCOVER_3CX_NINJA_SERVER') {
                const response = {
                    type: 'SERVER_DISCOVERY_RESPONSE',
                    server: {
                        name: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
                        ip: process.env.SERVER_IP || 'localhost',
                        port: PORT,
                        apiKey: process.env.API_KEY,
                        version: '2.0.0'
                    }
                };
                
                const responseBuffer = Buffer.from(JSON.stringify(response));
                discoverySocket.send(responseBuffer, rinfo.port, rinfo.address);
            }
        } catch (error) {
            console.error('Discovery error:', error);
        }
    });
    
    discoverySocket.bind(DISCOVERY_PORT, () => {
        console.log(`Discovery service listening on port ${DISCOVERY_PORT}`);
    });
}

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`\n🚀 3CX-Ninja Realtime Server (Fallback Mode)`);
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log(`🔑 API Key: ${process.env.API_KEY}`);
    console.log(`\n⚠️  Running in fallback mode. Run 'npm run build' for full features.\n`);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});