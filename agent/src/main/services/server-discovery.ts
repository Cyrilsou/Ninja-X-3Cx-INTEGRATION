import dgram from 'dgram';
import { Logger } from '@3cx-ninja/shared';

const logger = new Logger('ServerDiscovery');

export interface DiscoveredServer {
  name: string;
  ip: string;
  port: number;
  apiKey?: string;
  version: string;
  serverUrl: string;
}

export class ServerDiscovery {
  private discoveryPort: number;
  private timeout: number;

  constructor(discoveryPort = 53434, timeout = 5000) {
    this.discoveryPort = discoveryPort;
    this.timeout = timeout;
  }

  async discover(): Promise<DiscoveredServer | null> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      let timeoutId: NodeJS.Timeout;
      let resolved = false;

      // Message de découverte
      const discoveryMessage = JSON.stringify({
        type: 'DISCOVER_3CX_NINJA_SERVER',
        clientInfo: {
          platform: process.platform,
          version: '1.0.0'
        }
      });

      // Timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          logger.info('Aucun serveur détecté (timeout)');
          socket.close();
          resolve(null);
        }
      }, this.timeout);

      // Listener pour les réponses
      socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          
          if (data.type === 'SERVER_INFO') {
            resolved = true;
            clearTimeout(timeoutId);
            
            const server: DiscoveredServer = {
              name: data.serverInfo.name,
              ip: rinfo.address,
              port: data.serverInfo.port,
              apiKey: data.serverInfo.apiKey,
              version: data.serverInfo.version,
              serverUrl: `http://${rinfo.address}:${data.serverInfo.port}`
            };
            
            logger.info('Serveur détecté:', server);
            socket.close();
            resolve(server);
          }
        } catch (error) {
          logger.error('Erreur parsing réponse:', error);
        }
      });

      // Erreur socket
      socket.on('error', (err) => {
        logger.error('Erreur socket:', err);
        if (!resolved) {
          clearTimeout(timeoutId);
          socket.close();
          resolve(null);
        }
      });

      // Bind et broadcast
      socket.bind(() => {
        socket.setBroadcast(true);
        const message = Buffer.from(discoveryMessage);
        
        logger.info(`Envoi broadcast sur port ${this.discoveryPort}...`);
        socket.send(message, 0, message.length, this.discoveryPort, '255.255.255.255', (err) => {
          if (err) {
            logger.error('Erreur envoi broadcast:', err);
            if (!resolved) {
              clearTimeout(timeoutId);
              socket.close();
              resolve(null);
            }
          }
        });
      });
    });
  }

  // Méthode pour découvrir plusieurs serveurs
  async discoverAll(duration = 3000): Promise<DiscoveredServer[]> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const servers: DiscoveredServer[] = [];
      const foundServers = new Set<string>();

      // Message de découverte
      const discoveryMessage = JSON.stringify({
        type: 'DISCOVER_3CX_NINJA_SERVER',
        clientInfo: {
          platform: process.platform,
          version: '1.0.0'
        }
      });

      // Timeout pour arrêter la découverte
      const timeoutId = setTimeout(() => {
        socket.close();
        resolve(servers);
      }, duration);

      // Listener pour les réponses
      socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          
          if (data.type === 'SERVER_INFO') {
            const serverKey = `${rinfo.address}:${data.serverInfo.port}`;
            
            if (!foundServers.has(serverKey)) {
              foundServers.add(serverKey);
              
              const server: DiscoveredServer = {
                name: data.serverInfo.name,
                ip: rinfo.address,
                port: data.serverInfo.port,
                apiKey: data.serverInfo.apiKey,
                version: data.serverInfo.version,
                serverUrl: `http://${rinfo.address}:${data.serverInfo.port}`
              };
              
              servers.push(server);
              logger.info(`Serveur détecté #${servers.length}:`, server);
            }
          }
        } catch (error) {
          logger.error('Erreur parsing réponse:', error);
        }
      });

      // Bind et broadcast
      socket.bind(() => {
        socket.setBroadcast(true);
        const message = Buffer.from(discoveryMessage);
        
        // Envoyer plusieurs broadcasts pour augmenter les chances
        const sendBroadcast = () => {
          socket.send(message, 0, message.length, this.discoveryPort, '255.255.255.255');
        };
        
        sendBroadcast();
        setTimeout(sendBroadcast, 500);
        setTimeout(sendBroadcast, 1000);
      });
    });
  }
}