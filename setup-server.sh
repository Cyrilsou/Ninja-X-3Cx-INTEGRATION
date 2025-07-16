#!/bin/bash

# 3CX-Ninja Realtime Server Setup Script
# Configuration complète automatisée

set -e

# Couleurs pour l'output
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

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé. Veuillez installer Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ requise. Version actuelle: $(node -v)"
        exit 1
    fi
    log_success "Node.js $(node -v) détecté"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé"
        exit 1
    fi
    log_success "npm $(npm -v) détecté"
    
    # Vérifier Git
    if ! command -v git &> /dev/null; then
        log_error "Git n'est pas installé"
        exit 1
    fi
    log_success "Git détecté"
    
    # Vérifier Python (pour node-gyp)
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        log_warning "Python non détecté. Peut être nécessaire pour certains packages natifs"
    fi
}

# Fonction pour installer Redis
install_redis() {
    log_info "Vérification de Redis..."
    
    if command -v redis-server &> /dev/null; then
        log_success "Redis est déjà installé"
        return
    fi
    
    read -p "Redis n'est pas installé. Voulez-vous l'installer? (recommandé) [O/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "Installation de Redis sur Linux..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y redis-server
                sudo systemctl enable redis-server
                sudo systemctl start redis-server
            elif command -v yum &> /dev/null; then
                sudo yum install -y redis
                sudo systemctl enable redis
                sudo systemctl start redis
            else
                log_error "Gestionnaire de paquets non supporté. Installez Redis manuellement"
                return
            fi
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                log_info "Installation de Redis via Homebrew..."
                brew install redis
                brew services start redis
            else
                log_error "Homebrew non installé. Installez Redis manuellement"
                return
            fi
        else
            log_error "OS non supporté pour l'installation automatique de Redis"
            return
        fi
        log_success "Redis installé et démarré"
    fi
}

# Fonction pour configurer l'environnement
setup_environment() {
    log_info "Configuration de l'environnement..."
    
    if [ -f .env ]; then
        log_warning "Le fichier .env existe déjà"
        read -p "Voulez-vous le reconfigurer? [o/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Oo]$ ]]; then
            return
        fi
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        log_info "Sauvegarde créée: .env.backup.*"
    fi
    
    # Copier le template
    cp .env.example .env
    
    log_info "Configuration des variables d'environnement..."
    echo
    echo "=== Configuration du serveur ==="
    
    # API Key
    DEFAULT_API_KEY=$(openssl rand -hex 32 2>/dev/null || echo "change-me-$(date +%s)")
    read -p "API Key pour sécuriser l'accès [$DEFAULT_API_KEY]: " API_KEY
    API_KEY=${API_KEY:-$DEFAULT_API_KEY}
    
    # Port
    read -p "Port du serveur [3000]: " PORT
    PORT=${PORT:-3000}
    
    echo
    echo "=== Configuration 3CX ==="
    read -p "URL du serveur 3CX (https://...): " PBX_URL
    read -p "3CX Client ID: " CX_CLIENT_ID
    read -p "3CX Client Secret: " CX_CLIENT_SECRET
    read -p "3CX Webhook Secret (optionnel): " CX_WEBHOOK_SECRET
    
    echo
    echo "=== Configuration NinjaOne ==="
    read -p "NinjaOne Client ID: " NINJA_CLIENT_ID
    read -p "NinjaOne Client Secret: " NINJA_CLIENT_SECRET
    read -p "NinjaOne Refresh Token: " NINJA_REFRESH_TOKEN
    read -p "NinjaOne Board ID par défaut [5]: " NINJA_BOARD_ID
    NINJA_BOARD_ID=${NINJA_BOARD_ID:-5}
    
    echo
    echo "=== Configuration Whisper ==="
    echo "Modèles disponibles: tiny, base, small, medium, large"
    read -p "Modèle Whisper à utiliser [base]: " WHISPER_MODEL
    WHISPER_MODEL=${WHISPER_MODEL:-base}
    
    # Mettre à jour le fichier .env
    sed -i.bak "s|your-secure-api-key-here|$API_KEY|g" .env
    sed -i.bak "s|PORT=3000|PORT=$PORT|g" .env
    sed -i.bak "s|https://your-3cx-server.com|$PBX_URL|g" .env
    sed -i.bak "s|your-3cx-client-id|$CX_CLIENT_ID|g" .env
    sed -i.bak "s|your-3cx-client-secret|$CX_CLIENT_SECRET|g" .env
    sed -i.bak "s|your-webhook-secret|$CX_WEBHOOK_SECRET|g" .env
    sed -i.bak "s|your-ninja-client-id|$NINJA_CLIENT_ID|g" .env
    sed -i.bak "s|your-ninja-client-secret|$NINJA_CLIENT_SECRET|g" .env
    sed -i.bak "s|your-ninja-refresh-token|$NINJA_REFRESH_TOKEN|g" .env
    sed -i.bak "s|WHISPER_MODEL=base|WHISPER_MODEL=$WHISPER_MODEL|g" .env
    
    # Nettoyer les fichiers de sauvegarde
    rm -f .env.bak
    
    log_success "Configuration sauvegardée dans .env"
}

# Fonction pour installer les dépendances
install_dependencies() {
    log_info "Installation des dépendances npm..."
    npm install
    
    log_info "Installation de Whisper..."
    npm run setup:whisper --workspace=server || {
        log_warning "L'installation de Whisper a échoué. Vous devrez peut-être l'installer manuellement"
    }
    
    log_success "Dépendances installées"
}

# Fonction pour créer les dossiers nécessaires
create_directories() {
    log_info "Création des dossiers nécessaires..."
    
    mkdir -p logs
    mkdir -p data
    mkdir -p temp/audio
    mkdir -p uploads
    
    # Permissions appropriées
    chmod 755 logs data temp uploads
    
    log_success "Dossiers créés"
}

# Fonction pour compiler le projet
build_project() {
    log_info "Compilation du projet..."
    npm run build
    log_success "Projet compilé"
}

# Fonction pour configurer PM2
setup_pm2() {
    log_info "Configuration de PM2 pour la production..."
    
    if ! command -v pm2 &> /dev/null; then
        read -p "PM2 n'est pas installé. Voulez-vous l'installer? (recommandé pour la production) [O/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
            npm install -g pm2
            log_success "PM2 installé"
        else
            return
        fi
    fi
    
    # Démarrer avec PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Configurer le démarrage automatique
    read -p "Configurer PM2 pour démarrer au boot? [O/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
        pm2 startup
        log_info "Suivez les instructions ci-dessus pour finaliser la configuration du démarrage automatique"
    fi
    
    log_success "PM2 configuré"
}

# Fonction pour configurer le firewall
setup_firewall() {
    log_info "Configuration du firewall..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v ufw &> /dev/null; then
            read -p "Configurer UFW pour autoriser le port $PORT? [O/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
                sudo ufw allow $PORT/tcp
                sudo ufw reload
                log_success "Port $PORT ouvert dans UFW"
            fi
        elif command -v firewall-cmd &> /dev/null; then
            read -p "Configurer firewalld pour autoriser le port $PORT? [O/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
                sudo firewall-cmd --permanent --add-port=$PORT/tcp
                sudo firewall-cmd --reload
                log_success "Port $PORT ouvert dans firewalld"
            fi
        fi
    fi
}

# Fonction pour tester l'installation
test_installation() {
    log_info "Test de l'installation..."
    
    # Démarrer le serveur en arrière-plan pour le test
    if command -v pm2 &> /dev/null && pm2 list | grep -q "3cx-ninja-server"; then
        log_info "Le serveur est déjà démarré avec PM2"
    else
        log_info "Démarrage du serveur pour le test..."
        npm run start:prod &
        SERVER_PID=$!
        sleep 5
    fi
    
    # Test de santé
    if curl -f -s "http://localhost:$PORT/health" > /dev/null; then
        log_success "Le serveur répond correctement"
        
        # Test webhook
        if curl -f -s -X POST "http://localhost:$PORT/webhook/3cx/test" \
            -H "Content-Type: application/json" \
            -d '{"test": true}' > /dev/null; then
            log_success "Les webhooks fonctionnent"
        else
            log_warning "Échec du test webhook"
        fi
    else
        log_error "Le serveur ne répond pas"
    fi
    
    # Arrêter le serveur de test si nécessaire
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
}

# Fonction pour afficher les instructions finales
show_final_instructions() {
    echo
    echo "========================================"
    echo "   Installation terminée avec succès!"
    echo "========================================"
    echo
    echo "Prochaines étapes:"
    echo
    echo "1. Configurer les webhooks dans 3CX:"
    echo "   URL: http://$(hostname -I | awk '{print $1}'):$PORT/webhook/3cx/call-event"
    echo
    echo "2. Démarrer le serveur:"
    if command -v pm2 &> /dev/null && pm2 list | grep -q "3cx-ninja-server"; then
        echo "   Le serveur est déjà démarré avec PM2"
        echo "   Commandes PM2:"
        echo "   - pm2 status        # Voir le statut"
        echo "   - pm2 logs          # Voir les logs"
        echo "   - pm2 restart all   # Redémarrer"
    else
        echo "   npm run start:prod  # Mode production"
        echo "   npm run dev         # Mode développement"
    fi
    echo
    echo "3. Accéder au dashboard:"
    echo "   http://localhost:$PORT"
    echo
    echo "4. Installer l'agent sur les postes:"
    echo "   cd agent && npm run dist"
    echo
    echo "Documentation complète: ./docs/"
    echo
    echo "API Key: $API_KEY"
    echo "(Conservez cette clé en sécurité)"
    echo
}

# Menu principal
main() {
    clear
    echo "========================================"
    echo "  3CX-Ninja Realtime Server Setup"
    echo "========================================"
    echo
    
    check_prerequisites
    install_redis
    setup_environment
    install_dependencies
    create_directories
    build_project
    setup_firewall
    
    read -p "Configurer PM2 pour la production? [O/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]] || [[ -z $REPLY ]]; then
        setup_pm2
    fi
    
    test_installation
    show_final_instructions
}

# Exécuter le script
main