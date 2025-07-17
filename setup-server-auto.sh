#!/bin/bash

# 3CX-Ninja Realtime - Installation serveur automatique complète
# Avec découverte réseau UDP, Nginx et toute la configuration

set -e  # Arrêt en cas d'erreur

# Variables
INSTALL_DIR="/opt/3cx-ninja-realtime"
SERVICE_USER="ninjauser"
SERVICE_NAME="3cx-ninja-realtime"
DISCOVERY_PORT=53434
API_PORT=3000

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction d'affichage
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Vérifier les privilèges root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Ce script doit être exécuté en tant que root (sudo)"
    fi
}

# Détecter l'OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
    else
        error "Impossible de détecter l'OS"
    fi
    
    log "OS détecté: $OS $VERSION"
}

# Obtenir l'IP locale
get_local_ip() {
    LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' || hostname -I | awk '{print $1}')
    if [[ -z "$LOCAL_IP" ]]; then
        error "Impossible de détecter l'IP locale"
    fi
    log "IP locale détectée: $LOCAL_IP"
}

# Générer une clé API sécurisée
generate_api_key() {
    API_KEY="sk-$(openssl rand -hex 32)"
    log "Clé API générée: ${API_KEY:0:20}..."
}

# Installation des prérequis
install_prerequisites() {
    log "Installation des prérequis..."
    
    # Mise à jour du système
    apt-get update -qq
    
    # Installation des paquets essentiels
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        ffmpeg \
        redis-server \
        nginx \
        sqlite3 \
        ufw \
        htop \
        net-tools \
        jq
    
    # Installation Node.js 20 (LTS)
    if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
        log "Installation de Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    
    # Mise à jour de npm
    npm install -g npm@latest
    
    log "Prérequis installés avec succès"
}

# Créer l'utilisateur système
create_system_user() {
    log "Création de l'utilisateur système..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home "/home/$SERVICE_USER" --create-home "$SERVICE_USER"
        log "Utilisateur $SERVICE_USER créé"
    else
        log "Utilisateur $SERVICE_USER existe déjà"
    fi
}

# Installer l'application depuis les fichiers locaux
install_application() {
    log "Installation de l'application..."
    
    # Créer le répertoire d'installation
    mkdir -p "$INSTALL_DIR"
    
    # Copier les fichiers depuis le répertoire actuel
    log "Copie des fichiers depuis $(pwd)..."
    cp -r . "$INSTALL_DIR/"
    
    # Changer les permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    # Installation des dépendances
    cd "$INSTALL_DIR"
    log "Installation des dépendances Node.js..."
    
    # Installer les dépendances
    sudo -u "$SERVICE_USER" npm install || warn "Certaines dépendances n'ont pas pu être installées"
    
    # Build de l'application
    log "Build de l'application..."
    sudo -u "$SERVICE_USER" npm run build || warn "Build échoué, le serveur fonctionnera en mode développement"
    
    # Build du dashboard TV
    log "Build du dashboard TV..."
    cd "$INSTALL_DIR/dashboard-tv"
    sudo -u "$SERVICE_USER" npm install || warn "Dépendances dashboard-tv non installées"
    sudo -u "$SERVICE_USER" npm run build || warn "Build dashboard-tv échoué"
    
    cd "$INSTALL_DIR"
    
    log "Application installée"
}

# Configurer l'environnement
configure_environment() {
    log "Configuration de l'environnement..."
    
    # Créer les répertoires de configuration
    mkdir -p /etc/3cx-ninja-realtime
    
    # Créer le fichier .env
    cat > /etc/3cx-ninja-realtime/.env << EOF
# Configuration serveur
NODE_ENV=production
PORT=$API_PORT
API_KEY=$API_KEY
SERVER_IP=$LOCAL_IP
DISCOVERY_PORT=$DISCOVERY_PORT

# Base de données
DATABASE_PATH=/var/lib/3cx-ninja-realtime/database.sqlite

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PREFIX=3cx-ninja:

# 3CX Configuration (à configurer)
CX_WEBHOOK_SECRET=change-me
PBX_URL=
CX_CLIENT_ID=
CX_CLIENT_SECRET=

# NinjaOne Configuration (à configurer)
NINJA_CLIENT_ID=
NINJA_CLIENT_SECRET=
NINJA_REFRESH_TOKEN=

# Dashboard URL
DASHBOARD_URL=http://$LOCAL_IP

# Whisper Configuration
WHISPER_MODEL=base
WHISPER_LANGUAGE=fr

# Broadcast UDP
ENABLE_BROADCAST=true
BROADCAST_INTERVAL=30000
EOF
    
    # Créer la configuration production
    cat > /etc/3cx-ninja-realtime/production.json << EOF
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "enabled": true,
    "url": "redis://localhost:6379",
    "prefix": "3cx-ninja:"
  },
  "whisper": {
    "model": "base",
    "modelPath": "$INSTALL_DIR/venv/lib/python3.12/site-packages/whisper/models",
    "pythonPath": "$INSTALL_DIR/venv/bin/python",
    "device": "cpu",
    "computeType": "int8",
    "threads": 4,
    "language": "fr",
    "task": "transcribe",
    "vadFilter": true,
    "wordTimestamps": true,
    "maxConcurrent": 4
  },
  "transcription": {
    "maxConcurrent": 2,
    "timeout": 300000,
    "maxRetries": 3,
    "retryDelay": 5000,
    "chunkDuration": 30
  },
  "audio": {
    "format": "wav",
    "sampleRate": 16000,
    "channels": 1,
    "bitDepth": 16,
    "maxDuration": 1800,
    "maxSize": 104857600,
    "tempDir": "/tmp/3cx-ninja"
  },
  "database": {
    "dialect": "sqlite",
    "storage": "/var/lib/3cx-ninja-realtime/database.sqlite",
    "logging": false
  },
  "ffmpeg": {
    "path": "ffmpeg",
    "timeout": 30000
  },
  "cache": {
    "ttl": 3600,
    "checkPeriod": 600,
    "maxKeys": 1000
  },
  "webhook": {
    "timeout": 10000,
    "maxRetries": 3,
    "retryDelay": 1000
  },
  "3cx": {
    "webhook": {
      "enabled": true,
      "path": "/webhook/3cx",
      "secret": "\${CX_WEBHOOK_SECRET}"
    },
    "pbxUrl": "\${PBX_URL}",
    "clientId": "\${CX_CLIENT_ID}",
    "clientSecret": "\${CX_CLIENT_SECRET}"
  },
  "ninjaone": {
    "apiUrl": "https://app.ninjarmm.com/api/v2",
    "clientId": "\${NINJA_CLIENT_ID}",
    "clientSecret": "\${NINJA_CLIENT_SECRET}",
    "refreshToken": "\${NINJA_REFRESH_TOKEN}",
    "defaultBoardId": 5,
    "defaultStatusId": 1,
    "defaultPriorityId": 2
  },
  "security": {
    "apiKey": "\${API_KEY}",
    "corsOrigins": ["http://localhost:*", "\${DASHBOARD_URL}"],
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  },
  "cleanup": {
    "enabled": true,
    "interval": 3600000,
    "maxAge": 86400000
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
EOF
    
    # Permissions sécurisées
    chmod 600 /etc/3cx-ninja-realtime/.env
    chmod 644 /etc/3cx-ninja-realtime/production.json
    chown -R "$SERVICE_USER:$SERVICE_USER" /etc/3cx-ninja-realtime
    
    log "Environnement configuré"
}

# Créer les répertoires nécessaires
create_directories() {
    log "Création des répertoires..."
    
    # Répertoires de données
    mkdir -p /var/lib/3cx-ninja-realtime
    mkdir -p /var/log/3cx-ninja-realtime
    mkdir -p /tmp/3cx-ninja
    
    # Permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" /var/lib/3cx-ninja-realtime
    chown -R "$SERVICE_USER:$SERVICE_USER" /var/log/3cx-ninja-realtime
    chown -R "$SERVICE_USER:$SERVICE_USER" /tmp/3cx-ninja
    
    log "Répertoires créés"
}

# Configurer Redis
configure_redis() {
    log "Configuration de Redis..."
    
    # Activer et démarrer Redis
    systemctl enable redis-server
    systemctl start redis-server
    
    log "Redis configuré et démarré"
}

# Créer le service de broadcast UDP
create_broadcast_service() {
    log "Création du service de broadcast UDP..."
    
    cat > "$INSTALL_DIR/server/src/services/broadcast-service.ts" << 'EOF'
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
    
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/server/src/services/broadcast-service.ts"
    
    log "Service de broadcast créé"
}

# Installer Whisper
install_whisper() {
    log "Installation de Whisper..."
    
    # Créer un environnement virtuel Python
    sudo -u "$SERVICE_USER" python3 -m venv "$INSTALL_DIR/venv"
    
    # Installer Whisper
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/pip" install --upgrade pip
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/pip" install openai-whisper
    
    log "Whisper installé"
}

# Créer le service systemd
create_systemd_service() {
    log "Création du service systemd..."
    
    cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=3CX-Ninja Realtime Server
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/server
Environment="NODE_ENV=production"
Environment="NODE_CONFIG_DIR=/etc/3cx-ninja-realtime"
EnvironmentFile=/etc/3cx-ninja-realtime/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Sécurité basique
NoNewPrivileges=true
PrivateTmp=true

# Limites de ressources
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    
    # Recharger systemd
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    
    log "Service systemd créé"
}

# Configurer Nginx
configure_nginx() {
    log "Configuration de Nginx..."
    
    # Créer la configuration Nginx
    cat > /etc/nginx/sites-available/3cx-ninja-realtime << EOF
# Configuration Nginx pour 3CX Ninja Realtime Server
server {
    listen 80;
    server_name _;
    
    # Logs
    access_log /var/log/nginx/3cx-ninja-access.log;
    error_log /var/log/nginx/3cx-ninja-error.log;
    
    # Taille max pour les uploads audio
    client_max_body_size 100M;
    
    # Proxy vers le serveur Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts longs pour WebSockets
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }
    
    # Server-Sent Events pour le dashboard
    location /api/dashboard/stream {
        proxy_pass http://localhost:3000/api/dashboard/stream;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Important pour SSE
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        
        # Headers pour SSE
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
    }
    
    # Dashboard TV
    location /dashboard-tv {
        alias $INSTALL_DIR/dashboard-tv/dist;
        try_files \$uri \$uri/ /dashboard-tv/index.html;
    }
}
EOF
    
    # Activer le site
    ln -sf /etc/nginx/sites-available/3cx-ninja-realtime /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Tester et recharger Nginx
    nginx -t
    systemctl restart nginx
    systemctl enable nginx
    
    log "Nginx configuré"
}

# Configurer le firewall
configure_firewall() {
    log "Configuration du firewall..."
    
    # Réinitialiser UFW si installé
    if command -v ufw &> /dev/null; then
        ufw --force reset
        
        # Règles par défaut
        ufw default deny incoming
        ufw default allow outgoing
        
        # Règles
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow $DISCOVERY_PORT/udp
        
        # Activer UFW
        ufw --force enable
        
        log "Firewall UFW configuré"
    else
        log "UFW non installé, configuration du firewall ignorée"
    fi
}

# Initialiser la base de données
initialize_database() {
    log "Initialisation de la base de données..."
    
    # La base sera créée automatiquement au démarrage du serveur
    touch /var/lib/3cx-ninja-realtime/database.sqlite
    chown "$SERVICE_USER:$SERVICE_USER" /var/lib/3cx-ninja-realtime/database.sqlite
    
    log "Base de données initialisée"
}

# Démarrer les services
start_services() {
    log "Démarrage des services..."
    
    # Démarrer l'application
    systemctl start $SERVICE_NAME
    
    # Attendre le démarrage
    sleep 5
    
    # Vérifier le statut
    if systemctl is-active --quiet $SERVICE_NAME; then
        log "Service $SERVICE_NAME démarré avec succès"
    else
        warn "Le service n'a pas démarré correctement"
        systemctl status $SERVICE_NAME --no-pager || true
    fi
}

# Afficher les informations finales
show_final_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}3CX-Ninja Realtime Server installé!${NC}"
    echo "=========================================="
    echo ""
    echo "🌐 Interface web: http://$LOCAL_IP"
    echo "📺 Dashboard TV: http://$LOCAL_IP/dashboard-tv"
    echo "🔑 Clé API: $API_KEY"
    echo "📡 Port découverte UDP: $DISCOVERY_PORT"
    echo ""
    echo "📝 Configuration:"
    echo "   Fichiers: /etc/3cx-ninja-realtime/"
    echo "   Logs: /var/log/3cx-ninja-realtime/"
    echo "   Base de données: /var/lib/3cx-ninja-realtime/"
    echo ""
    echo "🚀 Installation des agents:"
    echo "   Windows PowerShell:"
    echo "   iex ((New-Object Net.WebClient).DownloadString('http://$LOCAL_IP/api/install/install-agent.ps1'))"
    echo ""
    echo "   Linux/Mac:"
    echo "   curl -sSL http://$LOCAL_IP/api/install/install-agent.sh | bash"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   Statut: sudo systemctl status $SERVICE_NAME"
    echo "   Logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "   Restart: sudo systemctl restart $SERVICE_NAME"
    echo ""
    echo "⚠️  IMPORTANT: Configurez les clés API 3CX et NinjaOne dans"
    echo "   /etc/3cx-ninja-realtime/.env"
    echo ""
    echo "🔍 Broadcast UDP actif sur le port $DISCOVERY_PORT"
    echo "   Les agents peuvent découvrir automatiquement le serveur"
    echo ""
    echo "=========================================="
}

# Fonction principale
main() {
    log "Démarrage de l'installation 3CX-Ninja Realtime Server"
    
    check_root
    detect_os
    get_local_ip
    generate_api_key
    
    install_prerequisites
    create_system_user
    install_application
    configure_environment
    create_directories
    configure_redis
    create_broadcast_service
    install_whisper
    create_systemd_service
    configure_nginx
    configure_firewall
    initialize_database
    start_services
    
    show_final_info
}

# Exécuter le script principal
main "$@"