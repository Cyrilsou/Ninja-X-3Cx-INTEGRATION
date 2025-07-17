import { EventEmitter } from 'events';
import dgram from 'dgram';
import os from 'os';
import { logger } from '../utils/logger';

interface ServerInfo {
    name: string;
    ip: string;
    port: number;
    discoveryPort: number;
    apiKey: string;
    version: string;
    timestamp: number;
    capabilities: string[];
}

interface DiscoveryRequest {
    type: 'DISCOVER_3CX_NINJA_SERVER';
    client: string;
    timestamp: number;
    requestId?: string;
}

interface DiscoveryResponse {
    type: 'SERVER_DISCOVERY_RESPONSE';
    server: ServerInfo;
    respondedAt: number;
    requestId?: string;
}

interface BroadcastMessage {
    type: 'SERVER_BROADCAST';
    server: ServerInfo;
    broadcastAt: number;
}

export class NetworkDiscovery extends EventEmitter {
    private socket: dgram.Socket;
    private serverInfo: ServerInfo;
    private broadcastInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    constructor() {
        super();
        
        this.socket = dgram.createSocket('udp4');
        this.serverInfo = {
            name: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
            ip: process.env.SERVER_IP || this.getLocalIP(),
            port: parseInt(process.env.PORT || '3000'),
            discoveryPort: parseInt(process.env.DISCOVERY_PORT || '53434'),
            apiKey: process.env.API_KEY || '',
            version: '2.0.0',
            timestamp: Date.now(),
            capabilities: [
                'transcription',
                'ticketing',
                'realtime',
                'offline',
                'auto-install'
            ]
        };
        
        this.setupSocket();
    }

    private getLocalIP(): string {
        const interfaces = os.networkInterfaces();
        
        // Priorité aux interfaces réseau
        const priorities = ['eth0', 'en0', 'wlan0', 'wifi0'];
        
        for (const priority of priorities) {
            const iface = interfaces[priority];
            if (iface) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
        }
        
        // Fallback sur toutes les interfaces
        for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (iface) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
        }
        
        return '127.0.0.1';
    }

    private setupSocket(): void {
        this.socket.on('error', (error) => {
            logger.error('Network discovery socket error:', error);
            this.emit('error', error);
        });

        this.socket.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                this.handleMessage(message, rinfo);
            } catch (error) {
                logger.warn('Invalid discovery message received:', {
                    from: `${rinfo.address}:${rinfo.port}`,
                    error: (error as Error).message
                });
            }
        });

        this.socket.on('listening', () => {
            this.socket.setBroadcast(true);
            const address = this.socket.address();
            logger.info(`Network discovery listening on ${address.address}:${address.port}`);
            this.emit('listening', address);
        });
    }

    private handleMessage(message: any, rinfo: dgram.RemoteInfo): void {
        switch (message.type) {
            case 'DISCOVER_3CX_NINJA_SERVER':
                this.handleDiscoveryRequest(message as DiscoveryRequest, rinfo);
                break;
            
            case 'AGENT_ANNOUNCE':
                this.handleAgentAnnounce(message, rinfo);
                break;
            
            default:
                logger.debug('Unknown message type received:', message.type);
        }
    }

    private handleDiscoveryRequest(request: DiscoveryRequest, rinfo: dgram.RemoteInfo): void {
        logger.info(`Discovery request from ${rinfo.address}:${rinfo.port}`, {
            client: request.client,
            requestId: request.requestId
        });

        const response: DiscoveryResponse = {
            type: 'SERVER_DISCOVERY_RESPONSE',
            server: {
                ...this.serverInfo,
                timestamp: Date.now()
            },
            respondedAt: Date.now(),
            requestId: request.requestId
        };

        const responseBuffer = Buffer.from(JSON.stringify(response));
        
        this.socket.send(responseBuffer, rinfo.port, rinfo.address, (error) => {
            if (error) {
                logger.error('Error sending discovery response:', error);
            } else {
                logger.info(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
                this.emit('discovery-response-sent', {
                    address: rinfo.address,
                    port: rinfo.port,
                    requestId: request.requestId
                });
            }
        });
    }

    private handleAgentAnnounce(message: any, rinfo: dgram.RemoteInfo): void {
        logger.info(`Agent announcement from ${rinfo.address}:${rinfo.port}`, {
            agentId: message.agentId,
            platform: message.platform
        });

        this.emit('agent-discovered', {
            agentId: message.agentId,
            address: rinfo.address,
            port: rinfo.port,
            platform: message.platform,
            version: message.version,
            timestamp: Date.now()
        });
    }

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                resolve();
                return;
            }

            // Handle bind errors
            const onError = (error: Error) => {
                logger.error('Failed to bind discovery socket:', error);
                this.socket.removeListener('error', onError);
                reject(error);
            };
            
            this.socket.once('error', onError);

            this.socket.bind(this.serverInfo.discoveryPort, () => {
                // Remove the error handler since bind succeeded
                this.socket.removeListener('error', onError);
                
                this.isRunning = true;
                this.startBroadcast();
                
                logger.info('Network discovery service started', {
                    port: this.serverInfo.discoveryPort,
                    serverName: this.serverInfo.name,
                    serverIP: this.serverInfo.ip
                });

                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isRunning) {
                resolve();
                return;
            }

            this.isRunning = false;
            
            if (this.broadcastInterval) {
                clearInterval(this.broadcastInterval);
                this.broadcastInterval = null;
            }

            this.socket.close(() => {
                logger.info('Network discovery service stopped');
                resolve();
            });
        });
    }

    private startBroadcast(): void {
        const broadcastMessage = () => {
            const message: BroadcastMessage = {
                type: 'SERVER_BROADCAST',
                server: {
                    ...this.serverInfo,
                    timestamp: Date.now()
                },
                broadcastAt: Date.now()
            };

            const buffer = Buffer.from(JSON.stringify(message));
            
            // Adresses de broadcast à essayer
            const broadcastAddresses = [
                '255.255.255.255',
                '192.168.1.255',
                '192.168.0.255',
                '10.0.0.255',
                '172.16.0.255'
            ];

            broadcastAddresses.forEach(address => {
                this.socket.send(buffer, this.serverInfo.discoveryPort, address, (error) => {
                    if (error) {
                        logger.debug(`Broadcast to ${address} failed:`, error.message);
                    } else {
                        logger.debug(`Broadcast sent to ${address}`);
                    }
                });
            });

            this.emit('broadcast-sent', {
                addresses: broadcastAddresses,
                timestamp: Date.now()
            });
        };

        // Broadcast initial après 5 secondes
        setTimeout(broadcastMessage, 5000);

        // Broadcast périodique
        const interval = parseInt(process.env.DISCOVERY_INTERVAL || '30000');
        this.broadcastInterval = setInterval(broadcastMessage, interval);

        logger.info(`Broadcasting every ${interval / 1000} seconds`);
    }

    public updateServerInfo(updates: Partial<ServerInfo>): void {
        this.serverInfo = {
            ...this.serverInfo,
            ...updates,
            timestamp: Date.now()
        };

        logger.info('Server info updated', updates);
        this.emit('server-info-updated', this.serverInfo);
    }

    public getServerInfo(): ServerInfo {
        return {
            ...this.serverInfo,
            timestamp: Date.now()
        };
    }

    public sendCustomMessage(message: any, address: string, port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(JSON.stringify(message));
            
            this.socket.send(buffer, port, address, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    public isListening(): boolean {
        return this.isRunning;
    }

    public getStats() {
        return {
            isRunning: this.isRunning,
            serverInfo: this.serverInfo,
            uptime: Date.now() - this.serverInfo.timestamp,
            port: this.serverInfo.discoveryPort
        };
    }
}

// Service singleton
export const networkDiscovery = new NetworkDiscovery();

// Démarrer automatiquement si activé
if (process.env.ENABLE_DISCOVERY === 'true') {
    networkDiscovery.start().catch(error => {
        logger.error('Failed to start network discovery:', error);
    });
}

// Gérer l'arrêt propre
process.on('SIGINT', () => {
    networkDiscovery.stop().then(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    networkDiscovery.stop().then(() => {
        process.exit(0);
    });
});