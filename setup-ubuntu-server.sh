#!/bin/bash

# 3CX-Ninja Realtime - Script d'installation Ubuntu Server
# Optimisé pour Ubuntu 20.04/22.04 LTS

set -e

# Variables globales
INSTALL_DIR="/opt/3cx-ninja-realtime"
SERVICE_USER="3cx-ninja"
LOG_DIR="/var/log/3cx-ninja"
DATA_DIR="/var/lib/3cx-ninja"
SYSTEMD_SERVICE="3cx-ninja.service"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Header
show_header() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║        3CX-Ninja Realtime Server - Ubuntu Installation       ║"
    echo "║                    Version 2.0 - Production Ready            ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Vérifier root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Ce script doit être exécuté en tant que root"
        exit 1
    fi
}

# Détecter l'OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        log_error "OS non supporté"
        exit 1
    fi
    
    if [[ "$OS" != "ubuntu" ]]; then
        log_error "Ce script est conçu pour Ubuntu Server"
        exit 1
    fi
    
    log_success "Ubuntu $VER détecté"
}

# Mise à jour système
update_system() {
    log_info "Mise à jour du système..."
    apt-get update -qq
    apt-get upgrade -y -qq
    log_success "Système mis à jour"
}

# Installer les prérequis
install_prerequisites() {
    log_info "Installation des prérequis..."
    
    # Packages essentiels
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        ffmpeg \
        redis-server \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        net-tools \
        jq
    
    # Node.js 18
    if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 18 ]]; then
        log_info "Installation de Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    log_success "Prérequis installés"
}

# Créer l'utilisateur système
create_user() {
    log_info "Configuration de l'utilisateur système..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home /home/$SERVICE_USER --create-home $SERVICE_USER
        log_success "Utilisateur $SERVICE_USER créé"
    else
        log_info "Utilisateur $SERVICE_USER existe déjà"
    fi
    
    # Ajouter aux groupes nécessaires
    usermod -a -G audio,video $SERVICE_USER
}

# Cloner et installer l'application
install_application() {
    log_info "Installation de l'application..."
    
    # Créer les répertoires
    mkdir -p $INSTALL_DIR $LOG_DIR $DATA_DIR
    chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR $LOG_DIR $DATA_DIR
    
    # Cloner le repo
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Mise à jour du code..."
        cd $INSTALL_DIR
        sudo -u $SERVICE_USER git pull
    else
        log_info "Clonage du repository..."
        sudo -u $SERVICE_USER git clone https://github.com/your-org/3cx-ninja-realtime.git $INSTALL_DIR
        cd $INSTALL_DIR
    fi
    
    # Installer les dépendances
    log_info "Installation des dépendances npm..."
    sudo -u $SERVICE_USER npm install
    
    # Build
    log_info "Compilation..."
    sudo -u $SERVICE_USER npm run build
    
    # Installer Whisper
    log_info "Installation de Whisper..."
    sudo -u $SERVICE_USER npm run setup:whisper --workspace=server || log_warning "Whisper sera installé au premier démarrage"
    
    log_success "Application installée"
}

# Configuration interactive
configure_application() {
    log_info "Configuration de l'application..."
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        log_warning "Configuration existante détectée"
        read -p "Reconfigurer? (o/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Oo]$ ]]; then
            return
        fi
        cp $ENV_FILE $ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Copier le template
    cp $INSTALL_DIR/.env.example $ENV_FILE
    
    echo -e "\n${CYAN}=== Configuration du serveur ===${NC}"
    
    # Générer une API Key sécurisée
    API_KEY=$(openssl rand -hex 32)
    echo -e "${GREEN}API Key générée:${NC} $API_KEY"
    
    # Port
    read -p "Port du serveur [3000]: " PORT
    PORT=${PORT:-3000}
    
    # Domaine pour HTTPS
    read -p "Nom de domaine (pour HTTPS) [localhost]: " DOMAIN
    DOMAIN=${DOMAIN:-localhost}
    
    echo -e "\n${CYAN}=== Configuration 3CX ===${NC}"
    read -p "URL du serveur 3CX: " PBX_URL
    read -p "3CX Client ID: " CX_CLIENT_ID
    read -s -p "3CX Client Secret: " CX_CLIENT_SECRET
    echo
    
    echo -e "\n${CYAN}=== Configuration NinjaOne ===${NC}"
    read -p "NinjaOne Client ID: " NINJA_CLIENT_ID
    read -s -p "NinjaOne Client Secret: " NINJA_CLIENT_SECRET
    echo
    read -p "NinjaOne Refresh Token: " NINJA_REFRESH_TOKEN
    
    # Mettre à jour le fichier .env
    sed -i "s|your-secure-api-key-here|$API_KEY|g" $ENV_FILE
    sed -i "s|PORT=3000|PORT=$PORT|g" $ENV_FILE
    sed -i "s|https://your-3cx-server.com|$PBX_URL|g" $ENV_FILE
    sed -i "s|your-3cx-client-id|$CX_CLIENT_ID|g" $ENV_FILE
    sed -i "s|your-3cx-client-secret|$CX_CLIENT_SECRET|g" $ENV_FILE
    sed -i "s|your-ninja-client-id|$NINJA_CLIENT_ID|g" $ENV_FILE
    sed -i "s|your-ninja-client-secret|$NINJA_CLIENT_SECRET|g" $ENV_FILE
    sed -i "s|your-ninja-refresh-token|$NINJA_REFRESH_TOKEN|g" $ENV_FILE
    
    # Ajouter les chemins de production
    echo "" >> $ENV_FILE
    echo "# Production paths" >> $ENV_FILE
    echo "LOG_DIR=$LOG_DIR" >> $ENV_FILE
    echo "DATA_DIR=$DATA_DIR" >> $ENV_FILE
    
    # Sauvegarder les infos importantes
    cat > $INSTALL_DIR/server-info.txt << EOF
3CX-Ninja Realtime Server Information
=====================================
Installation Date: $(date)
Domain: $DOMAIN
Port: $PORT
API Key: $API_KEY
Service: systemctl status $SYSTEMD_SERVICE
Logs: journalctl -u $SYSTEMD_SERVICE -f
EOF
    
    chown $SERVICE_USER:$SERVICE_USER $ENV_FILE $INSTALL_DIR/server-info.txt
    chmod 600 $ENV_FILE
    
    log_success "Configuration sauvegardée"
}

# Configurer Redis
configure_redis() {
    log_info "Configuration de Redis..."
    
    # Optimisations pour production
    cat >> /etc/redis/redis.conf << EOF

# 3CX-Ninja Optimizations
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF
    
    systemctl restart redis-server
    systemctl enable redis-server
    
    log_success "Redis configuré et démarré"
}

# Configurer Nginx
configure_nginx() {
    log_info "Configuration de Nginx..."
    
    DOMAIN=$(grep -E "^DOMAIN=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "localhost")
    PORT=$(grep -E "^PORT=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "3000")
    
    # Configuration Nginx
    cat > /etc/nginx/sites-available/3cx-ninja << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/3cx-ninja-access.log;
    error_log /var/log/nginx/3cx-ninja-error.log;

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # API and webhooks
    location /api/ {
        proxy_pass http://localhost:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
    }

    location /webhook/ {
        proxy_pass http://localhost:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 10M;
    }

    # Dashboard et fichiers statiques
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Agent download
    location /download/agent {
        alias $INSTALL_DIR/agent/dist/;
        autoindex on;
    }
}
EOF
    
    # Activer le site
    ln -sf /etc/nginx/sites-available/3cx-ninja /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    
    log_success "Nginx configuré"
    
    # Proposer HTTPS
    if [ "$DOMAIN" != "localhost" ]; then
        read -p "Configurer HTTPS avec Let's Encrypt? (O/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
            certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
            log_success "HTTPS configuré"
        fi
    fi
}

# Créer le service systemd
create_systemd_service() {
    log_info "Création du service systemd..."
    
    cat > /etc/systemd/system/$SYSTEMD_SERVICE << EOF
[Unit]
Description=3CX-Ninja Realtime Server
After=network.target redis.service

[Service]
Type=forking
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PM2_HOME=/home/$SERVICE_USER/.pm2"
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=on-failure
RestartSec=10

# Limites
LimitNOFILE=65535
LimitNPROC=4096

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LOG_DIR $DATA_DIR $INSTALL_DIR/temp $INSTALL_DIR/uploads

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable $SYSTEMD_SERVICE
    
    log_success "Service systemd créé"
}

# Configurer le firewall
configure_firewall() {
    log_info "Configuration du firewall..."
    
    PORT=$(grep -E "^PORT=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "3000")
    
    # Règles UFW
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    ufw allow $PORT/tcp comment "3CX-Ninja API"
    
    # Activer UFW
    echo "y" | ufw enable
    
    log_success "Firewall configuré"
}

# Installer les outils de monitoring
install_monitoring() {
    log_info "Installation des outils de monitoring..."
    
    # Netdata pour le monitoring système
    if ! command -v netdata &> /dev/null; then
        read -p "Installer Netdata pour le monitoring? (O/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
            bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait
            log_success "Netdata installé sur http://$(hostname -I | awk '{print $1}'):19999"
        fi
    fi
}

# Démarrer les services
start_services() {
    log_info "Démarrage des services..."
    
    # Démarrer Redis
    systemctl start redis-server
    
    # Démarrer l'application
    cd $INSTALL_DIR
    sudo -u $SERVICE_USER PM2_HOME=/home/$SERVICE_USER/.pm2 pm2 start ecosystem.config.js
    sudo -u $SERVICE_USER PM2_HOME=/home/$SERVICE_USER/.pm2 pm2 save
    
    # Démarrer le service
    systemctl start $SYSTEMD_SERVICE
    
    log_success "Services démarrés"
}

# Tests de santé
health_check() {
    log_info "Vérification de l'installation..."
    
    sleep 5
    
    PORT=$(grep -E "^PORT=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "3000")
    
    # Test API
    if curl -f -s "http://localhost:$PORT/health" > /dev/null; then
        log_success "API en ligne"
    else
        log_error "API ne répond pas"
    fi
    
    # Test Redis
    if redis-cli ping > /dev/null; then
        log_success "Redis en ligne"
    else
        log_error "Redis ne répond pas"
    fi
    
    # Test Nginx
    if systemctl is-active --quiet nginx; then
        log_success "Nginx en ligne"
    else
        log_error "Nginx ne répond pas"
    fi
}

# Afficher les informations finales
show_summary() {
    local IP=$(hostname -I | awk '{print $1}')
    local DOMAIN=$(grep -E "^DOMAIN=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "$IP")
    local PORT=$(grep -E "^PORT=" $INSTALL_DIR/.env | cut -d'=' -f2 || echo "3000")
    local API_KEY=$(grep -E "^API_KEY=" $INSTALL_DIR/.env | cut -d'=' -f2)
    
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║            Installation terminée avec succès!                ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${CYAN}URLs d'accès:${NC}"
    echo -e "  Dashboard: ${YELLOW}http://$DOMAIN${NC}"
    echo -e "  API:       ${YELLOW}http://$DOMAIN/api${NC}"
    echo -e "  Webhooks:  ${YELLOW}http://$DOMAIN/webhook/3cx/call-event${NC}"
    if command -v netdata &> /dev/null; then
        echo -e "  Monitoring: ${YELLOW}http://$IP:19999${NC}"
    fi
    echo
    echo -e "${CYAN}Commandes utiles:${NC}"
    echo -e "  Status:    ${YELLOW}systemctl status $SYSTEMD_SERVICE${NC}"
    echo -e "  Logs:      ${YELLOW}journalctl -u $SYSTEMD_SERVICE -f${NC}"
    echo -e "  PM2:       ${YELLOW}sudo -u $SERVICE_USER pm2 status${NC}"
    echo -e "  Restart:   ${YELLOW}systemctl restart $SYSTEMD_SERVICE${NC}"
    echo
    echo -e "${CYAN}Configuration:${NC}"
    echo -e "  API Key:   ${RED}$API_KEY${NC}"
    echo -e "  Config:    ${YELLOW}$INSTALL_DIR/.env${NC}"
    echo -e "  Logs:      ${YELLOW}$LOG_DIR${NC}"
    echo
    echo -e "${CYAN}Prochaines étapes:${NC}"
    echo -e "  1. Configurer les webhooks dans 3CX avec l'URL ci-dessus"
    echo -e "  2. Télécharger l'agent: ${YELLOW}http://$DOMAIN/download/agent${NC}"
    echo -e "  3. Accéder au dashboard pour la configuration"
    echo
    echo -e "${GREEN}Documentation complète: $INSTALL_DIR/docs/${NC}"
    echo
}

# Fonction principale
main() {
    show_header
    check_root
    detect_os
    
    log_info "Début de l'installation..."
    
    update_system
    install_prerequisites
    create_user
    install_application
    configure_application
    configure_redis
    configure_nginx
    create_systemd_service
    configure_firewall
    install_monitoring
    start_services
    health_check
    show_summary
    
    # Sauvegarder le résumé
    show_summary > $INSTALL_DIR/installation-summary.txt
    
    log_success "Installation complète!"
}

# Exécuter
main "$@"