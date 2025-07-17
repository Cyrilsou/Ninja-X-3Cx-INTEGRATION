#!/bin/bash

# Script de setup automatique complet pour 3CX-Ninja Realtime Server
# Ce script configure tout le nécessaire pour faire fonctionner le serveur

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Bannière
clear
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           3CX-NINJA REALTIME - SETUP AUTOMATIQUE          ║"
echo "║                    Configuration Serveur                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet 3cx-ninja-realtime"
    exit 1
fi

# 1. Vérifier les prérequis système
log_info "Vérification des prérequis système..."

# Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé. Veuillez installer Node.js 18+"
    exit 1
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION détectée. Version 18+ requise."
        exit 1
    fi
    log_success "Node.js $(node -v) détecté"
fi

# npm
if ! command -v npm &> /dev/null; then
    log_error "npm n'est pas installé"
    exit 1
else
    log_success "npm $(npm -v) détecté"
fi

# FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    log_warning "FFmpeg n'est pas installé. Installation recommandée pour le traitement audio."
    echo "Installer avec: sudo apt-get install ffmpeg (Linux) ou brew install ffmpeg (macOS)"
else
    log_success "FFmpeg détecté"
fi

# Redis (optionnel)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        log_success "Redis est installé et actif"
        REDIS_AVAILABLE=true
    else
        log_warning "Redis est installé mais non actif"
        REDIS_AVAILABLE=false
    fi
else
    log_warning "Redis n'est pas installé (optionnel)"
    REDIS_AVAILABLE=false
fi

# 2. Installation des dépendances
log_info "Installation des dépendances npm..."
npm install --silent
log_success "Dépendances installées"

# 3. Compilation des projets
log_info "Compilation des projets..."

# Shared
log_info "Compilation du package shared..."
cd shared && npm run build && cd ..
log_success "Package shared compilé"

# Server
log_info "Compilation du serveur..."
cd server && npm run build && cd ..
log_success "Serveur compilé"

# 4. Configuration de l'environnement
log_info "Configuration de l'environnement..."

ENV_FILE="server/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_info "Création du fichier .env..."
    
    # Demander les informations essentielles
    echo ""
    echo -e "${YELLOW}Configuration requise:${NC}"
    echo ""
    
    # 3CX
    read -p "URL du serveur 3CX (ex: http://192.168.1.100:5000): " THREECX_URL
    read -p "3CX Client ID: " THREECX_CLIENT_ID
    read -p "3CX Client Secret: " THREECX_CLIENT_SECRET
    
    echo ""
    
    # NinjaOne
    read -p "NinjaOne Client ID: " NINJA_CLIENT_ID
    read -p "NinjaOne Client Secret: " NINJA_CLIENT_SECRET
    read -p "NinjaOne Refresh Token: " NINJA_REFRESH_TOKEN
    
    echo ""
    
    # API Key
    read -p "Clé API pour sécuriser l'accès (laisser vide pour générer): " API_KEY
    if [ -z "$API_KEY" ]; then
        API_KEY=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
        log_info "Clé API générée: $API_KEY"
    fi
    
    # Créer le fichier .env
    cat > "$ENV_FILE" << EOF
# Configuration 3CX
THREECX_PBX_URL=$THREECX_URL
THREECX_CLIENT_ID=$THREECX_CLIENT_ID
THREECX_CLIENT_SECRET=$THREECX_CLIENT_SECRET

# Configuration NinjaOne
NINJA_CLIENT_ID=$NINJA_CLIENT_ID
NINJA_CLIENT_SECRET=$NINJA_CLIENT_SECRET
NINJA_REFRESH_TOKEN=$NINJA_REFRESH_TOKEN

# Sécurité
API_KEY=$API_KEY

# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_URL=redis://localhost:6379

# Discovery
ENABLE_BROADCAST=true
DISCOVERY_PORT=53434
EOF
    
    log_success "Fichier .env créé"
else
    log_warning "Fichier .env déjà existant, conservation de la configuration actuelle"
fi

# 5. Configuration Redis
if [ "$REDIS_AVAILABLE" = true ]; then
    log_info "Configuration de Redis activée"
    sed -i 's/"enabled": false/"enabled": true/g' server/config/default.json 2>/dev/null || \
    sed -i '' 's/"enabled": false/"enabled": true/g' server/config/default.json
else
    log_info "Configuration de Redis désactivée"
    sed -i 's/"enabled": true/"enabled": false/g' server/config/default.json 2>/dev/null || \
    sed -i '' 's/"enabled": true/"enabled": false/g' server/config/default.json
fi

# 6. Création des dossiers nécessaires
log_info "Création des dossiers nécessaires..."
mkdir -p server/data/temp
mkdir -p server/logs
mkdir -p server/models/whisper
log_success "Dossiers créés"

# 7. Tentative d'installation de Whisper
log_info "Configuration de Whisper pour la transcription..."
if command -v cmake &> /dev/null; then
    log_info "cmake détecté, tentative d'installation du modèle Whisper..."
    cd server && npm run setup:whisper || log_warning "Installation Whisper échouée, transcription en mode simulé"
    cd ..
else
    log_warning "cmake non installé, Whisper fonctionnera en mode simulé"
    echo "Pour activer la vraie transcription: sudo apt-get install cmake && cd server && npm run setup:whisper"
fi

# 8. Création du service systemd (Linux uniquement)
if [[ "$OSTYPE" == "linux-gnu"* ]] && [ "$EUID" -eq 0 ]; then
    log_info "Création du service systemd..."
    
    SERVICE_FILE="/etc/systemd/system/3cx-ninja-realtime.service"
    CURRENT_DIR=$(pwd)
    CURRENT_USER=$(logname)
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=3CX-Ninja Realtime Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR/server
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/3cx-ninja-realtime.log
StandardError=append:/var/log/3cx-ninja-realtime.error.log

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable 3cx-ninja-realtime
    log_success "Service systemd créé et activé"
else
    log_info "Service systemd non créé (nécessite les droits root sur Linux)"
fi

# 9. Configuration Nginx (si installé)
if command -v nginx &> /dev/null && [ "$EUID" -eq 0 ]; then
    log_info "Configuration Nginx détectée..."
    
    NGINX_CONF="/etc/nginx/sites-available/3cx-ninja-realtime"
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _;  # Remplacer par votre domaine

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    log_success "Configuration Nginx appliquée"
fi

# 10. Résumé de l'installation
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              INSTALLATION TERMINÉE AVEC SUCCÈS            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
log_success "Configuration terminée!"
echo ""
echo -e "${YELLOW}Prochaines étapes:${NC}"
echo ""

if [ -f "/etc/systemd/system/3cx-ninja-realtime.service" ]; then
    echo "1. Démarrer le service:"
    echo "   sudo systemctl start 3cx-ninja-realtime"
    echo "   sudo systemctl status 3cx-ninja-realtime"
    echo ""
else
    echo "1. Démarrer le serveur:"
    echo "   cd server && npm start"
    echo ""
fi

echo "2. Accéder aux interfaces:"
echo "   - Dashboard principal: http://localhost:3000"
echo "   - Dashboard TV: http://localhost:3000/tv"
echo "   - API Health: http://localhost:3000/health"
echo ""

if [ ! -f "server/models/whisper/ggml-base.bin" ]; then
    echo "3. (Optionnel) Installer Whisper pour la transcription:"
    echo "   sudo apt-get install cmake"
    echo "   cd server && npm run setup:whisper"
    echo ""
fi

echo "4. Configurer le webhook dans 3CX:"
echo "   URL: http://votre-serveur:3000/webhook/3cx"
echo ""

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Configuration sauvegardée dans: $ENV_FILE${NC}"
    echo -e "${YELLOW}IMPORTANT: Gardez votre clé API en sécurité!${NC}"
fi

echo ""
echo -e "${BLUE}Documentation complète: voir README.md${NC}"
echo -e "${BLUE}Support: https://github.com/votre-repo/issues${NC}"
echo ""

# Demander si on démarre le serveur maintenant
read -p "Voulez-vous démarrer le serveur maintenant? (o/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    if [ -f "/etc/systemd/system/3cx-ninja-realtime.service" ]; then
        sudo systemctl start 3cx-ninja-realtime
        sleep 2
        sudo systemctl status 3cx-ninja-realtime --no-pager
    else
        cd server && npm start
    fi
fi