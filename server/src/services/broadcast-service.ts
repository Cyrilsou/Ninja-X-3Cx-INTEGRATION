import dgram from 'dgram';
import { Logger } from '@3cx-ninja/shared';
import config from 'config';

const logger = new Logger('BroadcastService');

export class BroadcastService {
  private socket: dgram.Socket;
  private port: number;
  private interval: number;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.socket = dgram.createSocket('udp4');
    this.port = parseInt(process.env.DISCOVERY_PORT || '53434');
    this.interval = parseInt(process.env.BROADCAST_INTERVAL || '30000');
  }

  start() {
    this.socket.bind(this.port, () => {
      this.socket.setBroadcast(true);
      logger.info(`Service de broadcast UDP démarré sur le port ${this.port}`);
    });

    // Écouter les demandes de découverte
    this.socket.on('message', (msg, rinfo) => {
      try {
        const message = JSON.parse(msg.toString());
        if (message.type === 'DISCOVER_3CX_NINJA_SERVER') {
          logger.info(`Demande de découverte reçue de ${rinfo.address}:${rinfo.port}`);
          this.sendServerInfo(rinfo.address, rinfo.port);
        }
      } catch (error) {
        logger.error('Erreur parsing message UDP:', error);
      }
    });

    // Broadcast périodique
    if (process.env.ENABLE_BROADCAST === 'true') {
      this.startBroadcast();
    }
  }

  private sendServerInfo(address: string, port: number) {
    const serverInfo = {
      type: 'SERVER_INFO',
      serverInfo: {
        name: '3CX-Ninja-Server',
        ip: process.env.SERVER_IP || 'localhost',
        port: parseInt(process.env.PORT || '3000'),
        apiKey: process.env.API_KEY,
        version: '2.0.0',
        serverUrl: `http://${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || '3000'}`
      }
    };

    const message = Buffer.from(JSON.stringify(serverInfo));
    this.socket.send(message, port, address, (error) => {
      if (error) {
        logger.error('Erreur envoi info serveur:', error);
      } else {
        logger.info(`Info serveur envoyée à ${address}:${port}`);
      }
    });
  }

  private startBroadcast() {
    const broadcast = () => {
      const serverInfo = {
        type: 'SERVER_BROADCAST',
        serverInfo: {
          name: '3CX-Ninja-Server',
          ip: process.env.SERVER_IP || 'localhost',
          port: parseInt(process.env.PORT || '3000'),
          apiKey: process.env.API_KEY,
          version: '2.0.0'
        }
      };

      const message = Buffer.from(JSON.stringify(serverInfo));
      
      // Broadcast sur 255.255.255.255
      this.socket.send(message, this.port, '255.255.255.255', (error) => {
        if (error) {
          logger.error('Erreur broadcast:', error);
        }
      });
    };

    // Premier broadcast après 5 secondes
    setTimeout(broadcast, 5000);
    
    // Broadcasts périodiques
    this.intervalId = setInterval(broadcast, this.interval);
    logger.info(`Broadcast UDP activé toutes les ${this.interval/1000} secondes`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.socket.close();
  }
}

export default BroadcastService;