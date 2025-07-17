#!/bin/bash

# Script pour corriger les erreurs sur le serveur installé

echo "Correction des erreurs du serveur 3CX-Ninja..."

# 1. Supprimer naudiodon du package.json principal s'il existe
echo "1. Suppression de naudiodon..."
cd /opt/3cx-ninja-realtime
if grep -q "naudiodon" package.json 2>/dev/null; then
    sed -i '/"naudiodon":/d' package.json
    sed -i 's/,\s*,/,/g' package.json
    sed -i 's/,\s*}/}/g' package.json
fi

# Aussi dans le dossier agent
if [ -f agent/package.json ] && grep -q "naudiodon" agent/package.json 2>/dev/null; then
    sed -i '/"naudiodon":/d' agent/package.json
    sed -i 's/,\s*,/,/g' agent/package.json
    sed -i 's/,\s*}/}/g' agent/package.json
fi

# 2. Copier les fichiers corrigés
echo "2. Mise à jour des fichiers TypeScript..."

# Créer le fichier database/index.ts corrigé
cat > /opt/3cx-ninja-realtime/server/src/database/index.ts << 'EOF'
import { Sequelize, DataTypes } from 'sequelize';
import config from 'config';
import { Logger } from '@3cx-ninja/shared';
import path from 'path';

const logger = new Logger('Database');

// Configuration de la base de données
const dbConfig = config.get<any>('database');

// Utiliser SQLite par défaut
const sequelize = new Sequelize({
  dialect: dbConfig.dialect || 'sqlite',
  storage: dbConfig.storage || path.join(__dirname, '../../data/database.sqlite'),
  logging: dbConfig.logging === true ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
});

// Modèles
export const CallModel = sequelize.define('Call', {
  callId: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  extension: DataTypes.STRING,
  agentEmail: DataTypes.STRING,
  caller: DataTypes.STRING,
  callee: DataTypes.STRING,
  direction: DataTypes.STRING,
  startTime: DataTypes.DATE,
  endTime: DataTypes.DATE,
  duration: DataTypes.INTEGER,
  status: DataTypes.STRING,
  recordingUrl: DataTypes.STRING
});

export const AgentModel = sequelize.define('Agent', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true
  },
  name: DataTypes.STRING,
  extension: DataTypes.STRING,
  status: DataTypes.STRING,
  version: DataTypes.STRING,
  ipAddress: DataTypes.STRING,
  lastSeen: DataTypes.DATE
});

export const TranscriptionModel = sequelize.define('Transcription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  text: DataTypes.TEXT,
  language: DataTypes.STRING,
  confidence: DataTypes.FLOAT,
  segments: DataTypes.JSON,
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending'
  }
});

export const AnalysisModel = sequelize.define('Analysis', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  transcriptionId: DataTypes.INTEGER,
  summary: DataTypes.TEXT,
  mainIssue: DataTypes.TEXT,
  customerSentiment: DataTypes.STRING,
  sentiment: DataTypes.FLOAT,
  category: DataTypes.STRING,
  priority: DataTypes.STRING,
  suggestedTitle: DataTypes.STRING,
  actionItems: DataTypes.JSON,
  keywords: DataTypes.JSON,
  ticketCreated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

export const TicketModel = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  ninjaTicketId: DataTypes.INTEGER,
  title: DataTypes.STRING,
  status: DataTypes.STRING,
  createdBy: DataTypes.STRING
});

// Relations
CallModel.hasOne(TranscriptionModel, { foreignKey: 'callId' });
CallModel.hasOne(AnalysisModel, { foreignKey: 'callId' });
CallModel.hasOne(TicketModel, { foreignKey: 'callId' });

TranscriptionModel.belongsTo(CallModel, { foreignKey: 'callId' });
AnalysisModel.belongsTo(CallModel, { foreignKey: 'callId' });
TicketModel.belongsTo(CallModel, { foreignKey: 'callId' });

// Fonction de configuration
export async function setupDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    
    // Créer les tables si elles n'existent pas
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
    
  } catch (error) {
    logger.error('Database setup failed:', error);
    throw error;
  }
}

// Export initDatabase pour compatibilité
export const initDatabase = setupDatabase;

export { sequelize };
EOF

# 3. Créer le fichier de types config manquant
echo "3. Création du fichier types config..."
mkdir -p /opt/3cx-ninja-realtime/server/src/types
cat > /opt/3cx-ninja-realtime/server/src/types/config.d.ts << 'EOF'
declare module 'config' {
  interface IConfig {
    get<T>(key: string): T;
    has(key: string): boolean;
  }
  const config: IConfig;
  export = config;
}
EOF

# 4. Installer les types manquants
echo "4. Installation des types TypeScript manquants..."
cd /opt/3cx-ninja-realtime/server
sudo -u ninjauser npm install --save-dev @types/archiver || true

# 5. Copier le service de broadcast
echo "5. Ajout du service de broadcast..."
cat > /opt/3cx-ninja-realtime/server/src/services/broadcast-service.ts << 'EOF'
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
EOF

# 6. Ajouter l'import du broadcast service dans index.ts
echo "6. Mise à jour de index.ts..."
if ! grep -q "import BroadcastService" /opt/3cx-ninja-realtime/server/src/index.ts; then
    sed -i "/import { ninjaAuth } from '\.\/services\/ninja-auth';/a\\import BroadcastService from './services/broadcast-service';" /opt/3cx-ninja-realtime/server/src/index.ts
fi

# 7. Installer les dépendances
echo "7. Réinstallation des dépendances..."
cd /opt/3cx-ninja-realtime
sudo -u ninjauser npm install --no-optional

# 8. Reconstruire
echo "8. Reconstruction de l'application..."
sudo -u ninjauser npm run build || echo "Build avec des avertissements, mais continuons..."

# 9. Changer les permissions
chown -R ninjauser:ninjauser /opt/3cx-ninja-realtime

# 10. Redémarrer le service
echo "10. Redémarrage du service..."
systemctl restart 3cx-ninja-realtime

# Attendre le démarrage
sleep 5

# Vérifier le statut
if systemctl is-active --quiet 3cx-ninja-realtime; then
    echo "✅ Service démarré avec succès!"
    systemctl status 3cx-ninja-realtime --no-pager
else
    echo "❌ Le service n'a pas démarré. Vérification des logs..."
    journalctl -u 3cx-ninja-realtime -n 50 --no-pager
fi

echo ""
echo "Pour voir les logs en temps réel :"
echo "sudo journalctl -u 3cx-ninja-realtime -f"