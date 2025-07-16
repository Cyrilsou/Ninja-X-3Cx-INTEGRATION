#!/bin/bash

# Script d'installation automatique de l'agent 3CX-Ninja
# Usage: curl -sSL https://server.com/install-agent.sh | bash -s -- --server https://server.com --key YOUR_KEY

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
SERVER_URL=""
API_KEY=""
INSTALL_DIR="$HOME/.3cx-ninja-agent"
DESKTOP_FILE="$HOME/.local/share/applications/3cx-ninja-agent.desktop"

# Fonctions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Aide
show_help() {
    echo "Usage: $0 --server SERVER_URL --key API_KEY [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --server URL    URL du serveur 3CX-Ninja (requis)"
    echo "  --key KEY       Clé API (requis)"
    echo "  --dir DIR       Répertoire d'installation (défaut: ~/.3cx-ninja-agent)"
    echo "  --no-desktop    Ne pas créer de raccourci bureau"
    echo "  --help          Afficher cette aide"
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --key)
            API_KEY="$2"
            shift 2
            ;;
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --no-desktop)
            NO_DESKTOP=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# Vérifier les paramètres requis
if [[ -z "$SERVER_URL" || -z "$API_KEY" ]]; then
    log_error "URL du serveur et clé API requis"
    show_help
    exit 1
fi

# Détecter l'OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "OS non supporté: $OSTYPE"
        exit 1
    fi
    log_info "OS détecté: $OS"
}

# Télécharger l'agent
download_agent() {
    log_info "Téléchargement de l'agent..."
    
    # Créer le répertoire d'installation
    mkdir -p "$INSTALL_DIR"
    
    # Déterminer le nom du fichier selon l'OS
    if [[ "$OS" == "linux" ]]; then
        AGENT_FILE="3cx-ninja-agent.AppImage"
    elif [[ "$OS" == "macos" ]]; then
        AGENT_FILE="3cx-ninja-agent-macos.zip"
    fi
    
    # Télécharger
    if command -v curl &> /dev/null; then
        curl -fsSL "$SERVER_URL/download/agent/$AGENT_FILE" -o "$INSTALL_DIR/$AGENT_FILE"
    elif command -v wget &> /dev/null; then
        wget -q "$SERVER_URL/download/agent/$AGENT_FILE" -O "$INSTALL_DIR/$AGENT_FILE"
    else
        log_error "curl ou wget requis"
        exit 1
    fi
    
    log_success "Agent téléchargé"
}

# Installer l'agent
install_agent() {
    log_info "Installation de l'agent..."
    
    cd "$INSTALL_DIR"
    
    if [[ "$OS" == "linux" ]]; then
        # Rendre exécutable
        chmod +x "$AGENT_FILE"
        
        # Créer un lien symbolique
        ln -sf "$INSTALL_DIR/$AGENT_FILE" "$INSTALL_DIR/3cx-ninja-agent"
        
    elif [[ "$OS" == "macos" ]]; then
        # Extraire l'archive
        unzip -q "$AGENT_FILE"
        rm "$AGENT_FILE"
        
        # Rendre exécutable
        chmod +x "3CX-Ninja Agent.app/Contents/MacOS/3cx-ninja-agent"
    fi
    
    log_success "Agent installé"
}

# Créer la configuration
create_config() {
    log_info "Création de la configuration..."
    
    cat > "$INSTALL_DIR/config.json" << EOF
{
  "serverUrl": "$SERVER_URL",
  "apiKey": "$API_KEY",
  "autoStart": true,
  "minimizeToTray": true,
  "language": "fr",
  "updateChannel": "stable"
}
EOF
    
    log_success "Configuration créée"
}

# Créer le raccourci bureau
create_desktop_entry() {
    if [[ "$NO_DESKTOP" == "true" || "$OS" == "macos" ]]; then
        return
    fi
    
    log_info "Création du raccourci bureau..."
    
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=3CX-Ninja Agent
Comment=Agent de transcription temps réel pour 3CX
Exec=$INSTALL_DIR/3cx-ninja-agent
Icon=$INSTALL_DIR/icon.png
Type=Application
Categories=Office;Communication;
StartupNotify=true
EOF
    
    # Télécharger l'icône
    if command -v curl &> /dev/null; then
        curl -fsSL "$SERVER_URL/assets/icon.png" -o "$INSTALL_DIR/icon.png" || true
    fi
    
    log_success "Raccourci bureau créé"
}

# Configurer le démarrage automatique
setup_autostart() {
    log_info "Configuration du démarrage automatique..."
    
    if [[ "$OS" == "linux" ]]; then
        # Créer le fichier autostart
        mkdir -p "$HOME/.config/autostart"
        
        cat > "$HOME/.config/autostart/3cx-ninja-agent.desktop" << EOF
[Desktop Entry]
Type=Application
Name=3CX-Ninja Agent
Comment=Agent de transcription temps réel pour 3CX
Exec=$INSTALL_DIR/3cx-ninja-agent --minimized
Icon=$INSTALL_DIR/icon.png
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
        
    elif [[ "$OS" == "macos" ]]; then
        # Créer le plist pour launchd
        mkdir -p "$HOME/Library/LaunchAgents"
        
        cat > "$HOME/Library/LaunchAgents/com.3cx-ninja.agent.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.3cx-ninja.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/3CX-Ninja Agent.app/Contents/MacOS/3cx-ninja-agent</string>
        <string>--minimized</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
        
        # Charger le service
        launchctl load "$HOME/Library/LaunchAgents/com.3cx-ninja.agent.plist"
    fi
    
    log_success "Démarrage automatique configuré"
}

# Test de connexion
test_connection() {
    log_info "Test de connexion au serveur..."
    
    if command -v curl &> /dev/null; then
        if curl -fsSL "$SERVER_URL/health" > /dev/null; then
            log_success "Connexion au serveur réussie"
        else
            log_warning "Impossible de se connecter au serveur"
        fi
    fi
}

# Démarrer l'agent
start_agent() {
    log_info "Démarrage de l'agent..."
    
    if [[ "$OS" == "linux" ]]; then
        # Démarrer en arrière-plan
        nohup "$INSTALL_DIR/3cx-ninja-agent" --minimized > /dev/null 2>&1 &
    elif [[ "$OS" == "macos" ]]; then
        # Démarrer l'application
        open "$INSTALL_DIR/3CX-Ninja Agent.app" --args --minimized
    fi
    
    log_success "Agent démarré"
}

# Fonction principale
main() {
    echo -e "${BLUE}3CX-Ninja Agent - Installation automatique${NC}"
    echo "============================================="
    echo
    
    detect_os
    download_agent
    install_agent
    create_config
    create_desktop_entry
    setup_autostart
    test_connection
    start_agent
    
    echo
    echo -e "${GREEN}Installation terminée avec succès!${NC}"
    echo
    echo "L'agent 3CX-Ninja est maintenant installé et configuré."
    echo "Il démarrera automatiquement au démarrage du système."
    echo
    echo "Configuration:"
    echo "  - Répertoire: $INSTALL_DIR"
    echo "  - Serveur: $SERVER_URL"
    echo "  - Démarrage auto: Activé"
    echo
    echo "Commandes utiles:"
    echo "  - Démarrer: $INSTALL_DIR/3cx-ninja-agent"
    echo "  - Configurer: $INSTALL_DIR/config.json"
    echo "  - Désinstaller: rm -rf $INSTALL_DIR"
    echo
}

# Exécuter
main "$@"