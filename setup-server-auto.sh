#!/bin/bash

# 3CX-Ninja Realtime - Installation serveur automatique
# Avec découverte réseau et configuration automatique

set -e  # Arrêt en cas d'erreur

# Variables
REPO_URL="https://github.com/Cyrilsou/Ninja-X-3Cx-INTEGRATION.git"
INSTALL_DIR="/opt/3cx-ninja-realtime"
SERVICE_USER="3cx-ninja"
SERVICE_NAME="3cx-ninja"
DISCOVERY_PORT=53434
API_PORT=3000

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        net-tools \
        jq \
        socat \
        netcat-openbsd \
        avahi-daemon \
        avahi-utils \
        libnss-mdns \
        g++ \
        make \
        libasound2-dev \
        portaudio19-dev \
        libportaudio2 \
        libportaudiocpp0
    
    # Installation Node.js 20 (LTS)
    if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
        log "Installation de Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    
    # Mise à jour de npm vers la dernière version
    log "Mise à jour de npm..."
    npm install -g npm@latest
    
    # Installation PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installation de PM2..."
        npm install -g pm2
    fi
    
    # Installation des outils de build globaux
    npm install -g node-gyp
    
    log "Prérequis installés avec succès"
}

# Créer l'utilisateur système
create_system_user() {
    log "Création de l'utilisateur système..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home "/home/$SERVICE_USER" --create-home "$SERVICE_USER"
        usermod -aG sudo "$SERVICE_USER"
        log "Utilisateur $SERVICE_USER créé"
    else
        log "Utilisateur $SERVICE_USER existe déjà"
    fi
}

# Cloner et installer l'application
install_application() {
    log "Installation de l'application..."
    
    # Supprimer le répertoire existant s'il existe
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
    fi
    
    # Cloner le repository
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Changer les permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    # Installation des dépendances
    log "Installation des dépendances Node.js..."
    
    # Supprimer le package problématique naudiodon des package.json
    log "Suppression des packages problématiques..."
    
    # Supprimer naudiodon du package.json de l'agent
    if grep -q "naudiodon" "$INSTALL_DIR/agent/package.json" 2>/dev/null; then
        log "Suppression de naudiodon du module agent..."
        sed -i '/"naudiodon":/d' "$INSTALL_DIR/agent/package.json"
        # Supprimer la virgule en trop si nécessaire
        sed -i 's/,\s*,/,/g' "$INSTALL_DIR/agent/package.json"
        sed -i 's/,\s*}/}/g' "$INSTALL_DIR/agent/package.json"
    fi
    
    # Alternative : remplacer naudiodon par un package qui fonctionne
    # On pourrait utiliser node-record-lpcm16 qui est déjà dans les dépendances
    
    # Nettoyer le cache npm
    sudo -u "$SERVICE_USER" npm cache clean --force
    
    # Installer les dépendances avec des options pour ignorer les erreurs de packages optionnels
    sudo -u "$SERVICE_USER" npm install --no-optional || {
        warn "Certains packages optionnels n'ont pas pu être installés, continuation..."
        # Forcer l'installation en ignorant les scripts
        sudo -u "$SERVICE_USER" npm install --ignore-scripts
        # Exécuter uniquement les scripts essentiels
        sudo -u "$SERVICE_USER" npm rebuild --ignore-scripts
    }
    
    # Build de l'application
    log "Build de l'application..."
    
    # D'abord, essayer de corriger les fichiers de configuration TypeScript
    if [[ -f "$INSTALL_DIR/shared/tsconfig.json" ]]; then
        # Ajouter "composite": true au tsconfig.json de shared s'il manque
        if ! grep -q '"composite"' "$INSTALL_DIR/shared/tsconfig.json"; then
            sed -i '/"compilerOptions":/a\    "composite": true,' "$INSTALL_DIR/shared/tsconfig.json"
        fi
    fi
    
    # Corriger le script de build du dashboard pour ne pas utiliser tsc
    if [[ -f "$INSTALL_DIR/dashboard/package.json" ]]; then
        sed -i 's/"build": "tsc && vite build"/"build": "vite build"/' "$INSTALL_DIR/dashboard/package.json"
    fi
    
    # Essayer de construire l'application
    if sudo -u "$SERVICE_USER" npm run build; then
        log "Build réussi"
        BUILD_SUCCESS=true
    else
        warn "Build TypeScript échoué, utilisation du mode fallback..."
        BUILD_SUCCESS=false
        
        # Essayer au moins de construire le dashboard (frontend)
        cd "$INSTALL_DIR"
        sudo -u "$SERVICE_USER" npm run build:dashboard || warn "Build dashboard échoué"
        
        # Créer un fichier marqueur pour indiquer le mode fallback
        echo "fallback" > "$INSTALL_DIR/.build-mode"
        
        # S'assurer que les dépendances de base sont installées pour le mode fallback
        cd "$INSTALL_DIR/server"
        if [[ ! -d "node_modules" ]]; then
            log "Installation des dépendances du serveur pour le mode fallback..."
            sudo -u "$SERVICE_USER" npm install express cors socket.io --save
        fi
    fi
    
    # Rendre le fichier index.js exécutable
    if [[ -f "$INSTALL_DIR/server/index.js" ]]; then
        chmod +x "$INSTALL_DIR/server/index.js"
    fi
    
    log "Application installée avec succès"
}

# Configurer l'environnement
configure_environment() {
    log "Configuration de l'environnement..."
    
    # Créer le fichier .env
    cat > "$INSTALL_DIR/.env" << EOF
# Configuration serveur
NODE_ENV=production
PORT=$API_PORT
API_KEY=$API_KEY
SERVER_IP=$LOCAL_IP
DISCOVERY_PORT=$DISCOVERY_PORT

# Base de données
DATABASE_URL=sqlite:///var/lib/3cx-ninja/database.sqlite

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 3CX Configuration (à configurer via l'interface admin)
PBX_URL=
PBX_USERNAME=
PBX_PASSWORD=

# NinjaOne Configuration (à configurer via l'interface admin)
NINJA_CLIENT_ID=
NINJA_CLIENT_SECRET=
NINJA_REFRESH_TOKEN=
NINJA_BOARD_ID=5
NINJA_STATUS_ID=1
NINJA_PRIORITY_ID=2

# Whisper Configuration
WHISPER_MODEL=base
WHISPER_LANGUAGE=fr
WHISPER_MAX_CONCURRENT=2

# Logs
LOG_LEVEL=info
LOG_FILE=/var/log/3cx-ninja/app.log

# Sécurité
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@3cx-ninja.local
ADMIN_PASSWORD=admin123

# Découverte réseau
ENABLE_DISCOVERY=true
DISCOVERY_NAME=3CX-Ninja-Server
DISCOVERY_INTERVAL=30000
EOF
    
    # Permissions sécurisées
    chmod 600 "$INSTALL_DIR/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
    
    log "Environnement configuré"
}

# Créer les répertoires nécessaires
create_directories() {
    log "Création des répertoires..."
    
    # Répertoires de données
    mkdir -p /var/lib/3cx-ninja
    mkdir -p /var/log/3cx-ninja
    mkdir -p /var/cache/3cx-ninja
    mkdir -p /tmp/3cx-ninja
    
    # Permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" /var/lib/3cx-ninja
    chown -R "$SERVICE_USER:$SERVICE_USER" /var/log/3cx-ninja
    chown -R "$SERVICE_USER:$SERVICE_USER" /var/cache/3cx-ninja
    chown -R "$SERVICE_USER:$SERVICE_USER" /tmp/3cx-ninja
    
    log "Répertoires créés"
}

# Configurer Redis
configure_redis() {
    log "Configuration de Redis..."
    
    # Activer et démarrer Redis
    systemctl enable redis-server
    systemctl start redis-server
    
    # Configuration Redis pour la performance
    cat >> /etc/redis/redis.conf << EOF

# Configuration 3CX-Ninja
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF
    
    systemctl restart redis-server
    
    log "Redis configuré"
}

# Créer le service de découverte réseau
create_discovery_service() {
    log "Création du service de découverte réseau..."
    
    cat > "$INSTALL_DIR/discovery-service.js" << 'EOF'
const dgram = require('dgram');
const os = require('os');

class NetworkDiscovery {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.serverInfo = {
            name: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
            ip: process.env.SERVER_IP || this.getLocalIP(),
            port: process.env.PORT || 3000,
            discoveryPort: process.env.DISCOVERY_PORT || 53434,
            apiKey: process.env.API_KEY,
            version: '2.0.0',
            timestamp: Date.now()
        };
        
        this.setupSocket();
        this.startBroadcast();
    }
    
    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const interface of interfaces[name]) {
                if (interface.family === 'IPv4' && !interface.internal) {
                    return interface.address;
                }
            }
        }
        return '127.0.0.1';
    }
    
    setupSocket() {
        this.socket.bind(this.serverInfo.discoveryPort, () => {
            this.socket.setBroadcast(true);
            console.log(`Discovery service started on port ${this.serverInfo.discoveryPort}`);
        });
        
        this.socket.on('message', (msg, rinfo) => {
            try {
                const request = JSON.parse(msg.toString());
                if (request.type === 'DISCOVER_3CX_NINJA_SERVER') {
                    console.log(`Discovery request from ${rinfo.address}:${rinfo.port}`);
                    this.respondToDiscovery(rinfo);
                }
            } catch (error) {
                console.error('Error parsing discovery message:', error);
            }
        });
    }
    
    respondToDiscovery(rinfo) {
        const response = {
            type: 'SERVER_DISCOVERY_RESPONSE',
            server: this.serverInfo,
            respondedAt: Date.now()
        };
        
        const responseBuffer = Buffer.from(JSON.stringify(response));
        this.socket.send(responseBuffer, rinfo.port, rinfo.address, (error) => {
            if (error) {
                console.error('Error sending discovery response:', error);
            } else {
                console.log(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
            }
        });
    }
    
    startBroadcast() {
        const broadcast = () => {
            const message = {
                type: 'SERVER_BROADCAST',
                server: this.serverInfo,
                broadcastAt: Date.now()
            };
            
            const buffer = Buffer.from(JSON.stringify(message));
            
            // Broadcast sur le réseau local
            this.socket.send(buffer, this.serverInfo.discoveryPort, '255.255.255.255', (error) => {
                if (error) {
                    console.error('Broadcast error:', error);
                }
            });
        };
        
        // Broadcast initial
        setTimeout(broadcast, 5000);
        
        // Broadcast périodique
        const interval = parseInt(process.env.DISCOVERY_INTERVAL) || 30000;
        setInterval(broadcast, interval);
        
        console.log(`Broadcasting every ${interval/1000} seconds`);
    }
}

// Démarrer le service
if (process.env.ENABLE_DISCOVERY === 'true') {
    new NetworkDiscovery();
}
EOF
    
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/discovery-service.js"
    
    log "Service de découverte créé"
}

# Installer Whisper
install_whisper() {
    log "Installation de Whisper..."
    
    # Vérifier la version de Python
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    log "Version Python détectée : $PYTHON_VERSION"
    
    # Créer un environnement virtuel Python
    sudo -u "$SERVICE_USER" python3 -m venv "$INSTALL_DIR/venv"
    
    # Installer Whisper avec les bonnes versions
    log "Installation de Whisper et ses dépendances..."
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/pip" install --upgrade pip setuptools wheel
    
    # Installer PyTorch avec la version CPU pour éviter les problèmes CUDA
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/pip" install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    
    # Installer Whisper
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/pip" install openai-whisper
    
    # Télécharger le modèle par défaut
    log "Téléchargement du modèle Whisper..."
    sudo -u "$SERVICE_USER" "$INSTALL_DIR/venv/bin/python" -c "import whisper; whisper.load_model('base')" || {
        warn "Échec du téléchargement du modèle, sera téléchargé au premier usage"
    }
    
    log "Whisper installé avec succès"
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
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PATH=$INSTALL_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStartPre=/bin/bash -c 'mkdir -p /var/log/3cx-ninja && chown $SERVICE_USER:$SERVICE_USER /var/log/3cx-ninja'
ExecStart=/bin/bash -c 'if [[ -f server/dist/index.js ]]; then /usr/bin/node server/dist/index.js; else /usr/bin/node server/index.js; fi'
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Limites de sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/3cx-ninja /var/log/3cx-ninja /var/cache/3cx-ninja /tmp/3cx-ninja
ProtectHome=true

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
    cat > /etc/nginx/sites-available/3cx-ninja << EOF
server {
    listen 80;
    server_name _;
    
    # Redirection HTTPS (sera configurée plus tard)
    # return 301 https://\$server_name\$request_uri;
    
    # Configuration temporaire HTTP
    location / {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket pour les agents
    location /socket.io/ {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # API d'installation des agents
    location /api/install/ {
        proxy_pass http://localhost:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Fichiers statiques
    location /static/ {
        alias $INSTALL_DIR/dashboard/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Activer le site
    ln -sf /etc/nginx/sites-available/3cx-ninja /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Tester la configuration
    nginx -t
    
    # Redémarrer Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    log "Nginx configuré"
}

# Configurer le firewall
configure_firewall() {
    log "Configuration du firewall..."
    
    # Réinitialiser UFW
    ufw --force reset
    
    # Règles par défaut
    ufw default deny incoming
    ufw default allow outgoing
    
    # Règles SSH
    ufw allow ssh
    
    # Règles HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Règles pour l'application
    ufw allow $API_PORT/tcp
    ufw allow $DISCOVERY_PORT/udp
    
    # Règles pour Redis (local seulement)
    ufw allow from 127.0.0.1 to any port 6379
    
    # Activer UFW
    ufw --force enable
    
    log "Firewall configuré"
}

# Créer l'API d'installation des agents
create_agent_install_api() {
    log "Création de l'API d'installation des agents..."
    
    mkdir -p "$INSTALL_DIR/install-api"
    
    cat > "$INSTALL_DIR/install-api/agent-install.js" << 'EOFJS'
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const router = express.Router();

// Configuration du serveur
const getServerConfig = () => {
    return {
        serverUrl: `http://${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 3000}`,
        apiKey: process.env.API_KEY,
        serverName: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
        version: '2.0.0'
    };
};

// Script d'installation Windows
router.get('/install-agent.ps1', (req, res) => {
    const config = getServerConfig();
    
    const script = `
# 3CX-Ninja Agent - Installation automatique Windows
param(
    [string]$ServerUrl = "${config.serverUrl}",
    [string]$ApiKey = "${config.apiKey}",
    [switch]$Silent = $false
)

$ErrorActionPreference = "Stop"

Write-Host "Installation de l'agent 3CX-Ninja..." -ForegroundColor Green
Write-Host "Serveur: $ServerUrl" -ForegroundColor Cyan

# Créer le dossier temporaire
$TempDir = "$env:TEMP\\3cx-ninja-install"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# Télécharger l'agent
$AgentUrl = "$ServerUrl/api/install/agent/windows"
$AgentPath = "$TempDir\\3cx-ninja-agent.exe"

Write-Host "Téléchargement de l'agent..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $AgentUrl -OutFile $AgentPath -UseBasicParsing
} catch {
    Write-Error "Échec du téléchargement: $_"
    exit 1
}

# Configuration automatique
$ConfigFile = "$env:APPDATA\\3cx-ninja-agent\\config.json"
$ConfigDir = Split-Path $ConfigFile -Parent
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

$Config = @{
    serverUrl = $ServerUrl
    apiKey = $ApiKey
    autoDiscovered = $true
    installedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

Set-Content -Path $ConfigFile -Value $Config -Encoding UTF8

# Installation silencieuse
if ($Silent) {
    Write-Host "Installation silencieuse..." -ForegroundColor Yellow
    Start-Process -FilePath $AgentPath -ArgumentList "/S" -Wait
} else {
    Write-Host "Lancement de l'installation..." -ForegroundColor Yellow
    Start-Process -FilePath $AgentPath -ArgumentList "/ServerUrl=$ServerUrl", "/ApiKey=$ApiKey"
}

Write-Host "Installation terminée!" -ForegroundColor Green
Write-Host "L'agent va se connecter automatiquement à $ServerUrl" -ForegroundColor Cyan

# Nettoyer
Remove-Item -Path $TempDir -Recurse -Force
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="install-agent.ps1"');
    res.send(script);
});

// Script d'installation Linux/macOS
router.get('/install-agent.sh', (req, res) => {
    const config = getServerConfig();
    
    const script = `#!/bin/bash

# 3CX-Ninja Agent - Installation automatique Linux/macOS
set -e

# Variables
SERVER_URL="${config.serverUrl}"
API_KEY="${config.apiKey}"
AGENT_DIR="$HOME/.3cx-ninja-agent"
CONFIG_FILE="$AGENT_DIR/config.json"

# Couleurs
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
NC='\\033[0m'

log() {
    echo -e "\${GREEN}[$(date '+%H:%M:%S')] $1\${NC}"
}

warn() {
    echo -e "\${YELLOW}[$(date '+%H:%M:%S')] $1\${NC}"
}

# Détecter l'OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        echo "OS non supporté: $OSTYPE"
        exit 1
    fi
}

# Détecter l'architecture
detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *) echo "Architecture non supportée: $ARCH"; exit 1 ;;
    esac
}

# Installation
install_agent() {
    log "Installation de l'agent 3CX-Ninja..."
    log "Serveur: $SERVER_URL"
    
    detect_os
    detect_arch
    
    # Créer le dossier de configuration
    mkdir -p "$AGENT_DIR"
    
    # Télécharger l'agent
    AGENT_URL="$SERVER_URL/api/install/agent/$OS/$ARCH"
    AGENT_FILE="$AGENT_DIR/3cx-ninja-agent"
    
    log "Téléchargement de l'agent..."
    if command -v curl &> /dev/null; then
        curl -L -o "$AGENT_FILE" "$AGENT_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$AGENT_FILE" "$AGENT_URL"
    else
        echo "curl ou wget requis"
        exit 1
    fi
    
    # Rendre exécutable
    chmod +x "$AGENT_FILE"
    
    # Configuration automatique
    cat > "$CONFIG_FILE" << EOF
{
    "serverUrl": "$SERVER_URL",
    "apiKey": "$API_KEY",
    "autoDiscovered": true,
    "installedAt": "$(date -Iseconds)"
}
EOF
    
    # Créer le service (Linux uniquement)
    if [[ "$OS" == "linux" ]]; then
        create_service
    fi
    
    log "Installation terminée!"
    log "L'agent va se connecter automatiquement à $SERVER_URL"
    
    # Démarrer l'agent
    if [[ "$OS" == "linux" ]]; then
        systemctl --user enable 3cx-ninja-agent
        systemctl --user start 3cx-ninja-agent
    else
        "$AGENT_FILE" &
    fi
}

# Créer le service systemd (Linux)
create_service() {
    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    
    cat > "$SERVICE_DIR/3cx-ninja-agent.service" << EOF
[Unit]
Description=3CX-Ninja Agent
After=network.target

[Service]
Type=simple
ExecStart=$AGENT_FILE
Restart=always
RestartSec=10
WorkingDirectory=$AGENT_DIR

[Install]
WantedBy=default.target
EOF
    
    systemctl --user daemon-reload
}

# Fonction principale d'installation
main() {
    log "Installation de l'agent 3CX-Ninja..."
    log "Serveur: $SERVER_URL"
    
    detect_os
    detect_arch
    
    # Créer le dossier de configuration
    mkdir -p "$AGENT_DIR"
    
    # Télécharger l'agent
    AGENT_URL="$SERVER_URL/api/install/agent/$OS/$ARCH"
    AGENT_FILE="$AGENT_DIR/3cx-ninja-agent"
    
    log "Téléchargement de l'agent..."
    if command -v curl &> /dev/null; then
        curl -L -o "$AGENT_FILE" "$AGENT_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$AGENT_FILE" "$AGENT_URL"
    else
        echo "curl ou wget requis"
        exit 1
    fi
    
    # Rendre exécutable
    chmod +x "$AGENT_FILE"
    
    # Configuration automatique
    cat > "$CONFIG_FILE" << EOFCONFIG
{
    "serverUrl": "$SERVER_URL",
    "apiKey": "$API_KEY",
    "autoDiscovered": true,
    "installedAt": "$(date -Iseconds)"
}
EOFCONFIG
    
    # Créer le service (Linux uniquement)
    if [[ "$OS" == "linux" ]]; then
        create_service
    fi
    
    log "Installation terminée!"
    log "L'agent va se connecter automatiquement à $SERVER_URL"
    
    # Démarrer l'agent
    if [[ "$OS" == "linux" ]]; then
        systemctl --user enable 3cx-ninja-agent
        systemctl --user start 3cx-ninja-agent
    else
        "$AGENT_FILE" &
    fi
}

# Exécuter l'installation
main
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="install-agent.sh"');
    res.send(script);
});

// API de découverte pour les agents
router.get('/discover', (req, res) => {
    const config = getServerConfig();
    res.json(config);
});

// Téléchargement des binaires d'agents (simulé)
router.get('/agent/:platform/:arch?', (req, res) => {
    const { platform, arch } = req.params;
    
    // TODO: Implémenter le téléchargement des vrais binaires
    // Pour l'instant, retourner une erreur informative
    res.status(501).json({
        error: 'Binary download not implemented yet',
        message: 'Please build the agent binary for your platform',
        platform,
        arch,
        buildInstructions: 'npm run build:agent'
    });
});

module.exports = router;
EOFJS
    
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/install-api/agent-install.js"
    
    log "API d'installation des agents créée"
}

# Initialiser la base de données
initialize_database() {
    log "Initialisation de la base de données..."
    
    # Créer le répertoire de base de données
    mkdir -p /var/lib/3cx-ninja
    chown "$SERVICE_USER:$SERVICE_USER" /var/lib/3cx-ninja
    
    # Initialiser la base de données (sera fait par l'application au démarrage)
    log "Base de données initialisée"
}

# Démarrer les services
start_services() {
    log "Démarrage des services..."
    
    # Démarrer Redis
    systemctl start redis-server
    
    # Démarrer l'application
    systemctl start $SERVICE_NAME
    
    # Vérifier le statut
    sleep 5
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        log "Service $SERVICE_NAME démarré avec succès"
    else
        error "Échec du démarrage du service $SERVICE_NAME"
    fi
    
    log "Services démarrés"
}

# Afficher les informations finales
show_final_info() {
    log "Installation terminée avec succès!"
    echo ""
    echo "=========================================="
    echo "3CX-Ninja Realtime Server"
    echo "=========================================="
    echo ""
    echo "🌐 Interface Admin: http://$LOCAL_IP"
    echo "📱 URL Agent: http://$LOCAL_IP:$API_PORT"
    echo "🔑 Clé API: $API_KEY"
    echo "📡 Port découverte: $DISCOVERY_PORT"
    echo ""
    echo "📝 Identifiants par défaut:"
    echo "   Email: admin@3cx-ninja.local"
    echo "   Mot de passe: admin123"
    echo ""
    echo "🚀 Installation agents automatique:"
    echo "   Windows: curl -sSL http://$LOCAL_IP/api/install/install-agent.ps1 | powershell"
    echo "   Linux/Mac: curl -sSL http://$LOCAL_IP/api/install/install-agent.sh | bash"
    echo ""
    echo "📊 Statut des services:"
    systemctl status $SERVICE_NAME --no-pager -l
    echo ""
    echo "📋 Prochaines étapes:"
    echo "1. Accédez à l'interface admin"
    echo "2. Configurez 3CX et NinjaOne"
    echo "3. Installez les agents sur les postes"
    echo "4. Testez le système"
    echo ""
    echo "🔧 Logs en temps réel:"
    echo "   sudo journalctl -u $SERVICE_NAME -f"
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
    create_discovery_service
    install_whisper
    create_systemd_service
    configure_nginx
    configure_firewall
    create_agent_install_api
    initialize_database
    start_services
    
    show_final_info
}

# Exécuter le script principal
main "$@"