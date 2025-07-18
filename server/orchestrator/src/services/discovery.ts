import * as dgram from 'dgram';
import * as os from 'os';
import { logger } from '../utils/logger';

const DISCOVERY_PORT = 5355; // Port pour la découverte
const BROADCAST_INTERVAL = 5000; // Broadcast toutes les 5 secondes
const DISCOVERY_MESSAGE_PREFIX = '3CX-WHISPER-SERVER';

export class DiscoveryService {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private serverInfo: any;

  constructor() {
    this.serverInfo = this.getServerInfo();
  }

  private getServerInfo() {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    // Récupérer toutes les adresses IP v4 non-loopback
    Object.values(interfaces).forEach((iface) => {
      if (iface) {
        iface.forEach((addr) => {
          if (addr.family === 'IPv4' && !addr.internal) {
            addresses.push(addr.address);
          }
        });
      }
    });

    return {
      name: os.hostname(),
      version: '2.0.0',
      apiPort: process.env.PORT || 3002,
      wsPort: process.env.WS_PORT || 3003,
      addresses: addresses,
      timestamp: Date.now()
    };
  }

  start() {
    try {
      this.socket = dgram.createSocket('udp4');
      
      this.socket.on('error', (err) => {
        logger.error('Discovery socket error:', err);
        this.socket?.close();
      });

      this.socket.on('message', (msg, rinfo) => {
        const message = msg.toString();
        
        // Répondre aux requêtes de découverte des agents
        if (message === 'DISCOVER_3CX_WHISPER_SERVER') {
          logger.info(`Discovery request from ${rinfo.address}:${rinfo.port}`);
          this.sendDiscoveryResponse(rinfo.address, rinfo.port);
        }
      });

      this.socket.bind(DISCOVERY_PORT, () => {
        const address = this.socket!.address();
        logger.info(`Discovery service listening on ${address.address}:${address.port}`);
        
        // Activer le broadcast
        this.socket!.setBroadcast(true);
        
        // Démarrer le broadcast périodique
        this.startBroadcast();
      });

    } catch (error) {
      logger.error('Failed to start discovery service:', error);
    }
  }

  private startBroadcast() {
    // Envoyer immédiatement
    this.broadcastServerInfo();
    
    // Puis périodiquement
    this.broadcastInterval = setInterval(() => {
      this.broadcastServerInfo();
    }, BROADCAST_INTERVAL);
  }

  private broadcastServerInfo() {
    if (!this.socket) return;

    const message = JSON.stringify({
      type: DISCOVERY_MESSAGE_PREFIX,
      ...this.serverInfo,
      timestamp: Date.now()
    });

    const buffer = Buffer.from(message);
    
    // Broadcast sur toutes les interfaces
    this.serverInfo.addresses.forEach((address: string) => {
      const broadcastAddress = this.getBroadcastAddress(address);
      
      this.socket!.send(buffer, 0, buffer.length, DISCOVERY_PORT, broadcastAddress, (err) => {
        if (err) {
          logger.error(`Broadcast error to ${broadcastAddress}:`, err);
        }
      });
    });

    // Broadcast sur 255.255.255.255
    this.socket!.send(buffer, 0, buffer.length, DISCOVERY_PORT, '255.255.255.255');
  }

  private sendDiscoveryResponse(address: string, port: number) {
    if (!this.socket) return;

    const message = JSON.stringify({
      type: DISCOVERY_MESSAGE_PREFIX,
      ...this.serverInfo,
      timestamp: Date.now()
    });

    const buffer = Buffer.from(message);
    
    this.socket.send(buffer, 0, buffer.length, port, address, (err) => {
      if (err) {
        logger.error(`Failed to send discovery response to ${address}:${port}:`, err);
      } else {
        logger.info(`Discovery response sent to ${address}:${port}`);
      }
    });
  }

  private getBroadcastAddress(ipAddress: string): string {
    // Calculer l'adresse de broadcast pour un réseau /24
    const parts = ipAddress.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  }

  stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    logger.info('Discovery service stopped');
  }
}