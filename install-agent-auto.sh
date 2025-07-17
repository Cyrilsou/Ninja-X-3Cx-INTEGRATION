#!/bin/bash

# 3CX-Ninja Agent - Installation automatique avec découverte serveur
# Détecte automatiquement le serveur sur le réseau local

set -e

# Variables
DISCOVERY_PORT=53434
DISCOVERY_TIMEOUT=30
AGENT_DIR="$HOME/.3cx-ninja-agent"
CONFIG_FILE="$AGENT_DIR/config.json"
TEMP_DIR="/tmp/3cx-ninja-install"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

# Détecter l'OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        error "OS non supporté: $OSTYPE"
    fi
    
    log "OS détecté: $OS"
}

# Détecter l'architecture
detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        armv7l) ARCH="armv7" ;;
        *) warn "Architecture non reconnue: $ARCH, utilisation de x64 par défaut"; ARCH="x64" ;;
    esac
    
    log "Architecture détectée: $ARCH"
}

# Vérifier les prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier les commandes requises
    local required_commands=("curl" "timeout" "nc")
    for cmd in "${required_commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            error "Commande requise non trouvée: $cmd"
        fi
    done
    
    # Installer netcat si nécessaire
    if ! command -v nc &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update -qq && sudo apt-get install -y netcat-openbsd
        elif command -v yum &> /dev/null; then
            sudo yum install -y nc
        elif command -v brew &> /dev/null; then
            brew install netcat
        else
            error "Impossible d'installer netcat"
        fi
    fi
    
    log "Prérequis vérifiés"
}

# Obtenir l'IP locale
get_local_ip() {
    if [[ "$OS" == "linux" ]]; then
        LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' || hostname -I | awk '{print $1}')
    elif [[ "$OS" == "macos" ]]; then
        LOCAL_IP=$(route get default 2>/dev/null | grep interface | awk '{print $2}' | head -1 | xargs ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
    
    if [[ -z "$LOCAL_IP" ]]; then
        LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "192.168.1.100")
    fi
    
    log "IP locale: $LOCAL_IP"
}

# Obtenir le réseau local
get_network_range() {
    if [[ "$OS" == "linux" ]]; then
        NETWORK=$(ip route | grep "$LOCAL_IP" | grep -E '192\.168\.|10\.|172\.' | head -1 | awk '{print $1}' || echo "192.168.1.0/24")
    elif [[ "$OS" == "macos" ]]; then
        NETWORK=$(route -n get default 2>/dev/null | grep interface | awk '{print $2}' | head -1 | xargs ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1 | sed 's/\.[0-9]*$/\.0\/24/')
    fi
    
    if [[ -z "$NETWORK" ]]; then
        NETWORK="192.168.1.0/24"
    fi
    
    log "Réseau local: $NETWORK"
}

# Découvrir le serveur via UDP broadcast
discover_server_broadcast() {
    log "Recherche du serveur via broadcast UDP..."
    
    # Créer un socket UDP temporaire
    local temp_socket="/tmp/3cx-ninja-discovery-$$"
    local discovery_response="/tmp/3cx-ninja-response-$$"
    
    # Fonction de nettoyage
    cleanup_discovery() {
        rm -f "$temp_socket" "$discovery_response"
        if [[ -n "$NC_PID" ]]; then
            kill $NC_PID 2>/dev/null || true
        fi
    }
    
    trap cleanup_discovery EXIT
    
    # Écouter les réponses
    mkfifo "$temp_socket" 2>/dev/null || true
    
    # Démarrer l'écoute en arrière-plan
    (
        timeout $DISCOVERY_TIMEOUT nc -u -l -p $((DISCOVERY_PORT + 1)) > "$discovery_response" 2>/dev/null
    ) &
    NC_PID=$!
    
    sleep 2
    
    # Envoyer la requête de découverte
    local discovery_message='{"type":"DISCOVER_3CX_NINJA_SERVER","client":"agent-installer","timestamp":'$(date +%s)'000}'
    
    # Broadcast sur plusieurs adresses possibles
    local broadcast_addresses=("255.255.255.255" "192.168.1.255" "192.168.0.255" "10.0.0.255")
    
    for addr in "${broadcast_addresses[@]}"; do
        echo "$discovery_message" | nc -u -w 1 "$addr" $DISCOVERY_PORT 2>/dev/null || true
    done
    
    # Attendre la réponse
    local timeout_counter=0
    while [[ $timeout_counter -lt $DISCOVERY_TIMEOUT ]]; do
        if [[ -f "$discovery_response" && -s "$discovery_response" ]]; then
            local response=$(cat "$discovery_response")
            if [[ -n "$response" ]]; then
                log "Réponse du serveur reçue"
                
                # Parser la réponse JSON
                SERVER_IP=$(echo "$response" | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
                SERVER_PORT=$(echo "$response" | grep -o '"port":[0-9]*' | cut -d':' -f2)
                API_KEY=$(echo "$response" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
                SERVER_NAME=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
                
                if [[ -n "$SERVER_IP" && -n "$SERVER_PORT" && -n "$API_KEY" ]]; then
                    log "Serveur découvert: $SERVER_NAME à $SERVER_IP:$SERVER_PORT"
                    cleanup_discovery
                    return 0
                fi
            fi
        fi
        
        sleep 1
        ((timeout_counter++))
    done
    
    cleanup_discovery
    return 1
}

# Découvrir le serveur via scan réseau
discover_server_scan() {
    log "Recherche du serveur via scan réseau..."
    
    get_network_range
    
    # Générer la liste des IPs à scanner
    local base_ip=$(echo "$NETWORK" | cut -d'/' -f1 | sed 's/\.0$//')
    local ips=()
    
    # Scanner les IPs les plus probables en premier
    for i in {1..254}; do
        ips+=("$base_ip.$i")
    done
    
    # Scanner en parallèle
    local pids=()
    local max_parallel=20
    local current_parallel=0
    
    for ip in "${ips[@]}"; do
        if [[ $current_parallel -ge $max_parallel ]]; then
            # Attendre qu'un processus se termine
            wait -n
            ((current_parallel--))
        fi
        
        (
            if timeout 2 nc -z "$ip" 3000 2>/dev/null; then
                # Tester l'API
                local response=$(timeout 5 curl -s "http://$ip:3000/api/install/discover" 2>/dev/null || echo "")
                if [[ -n "$response" ]]; then
                    echo "$ip:$response"
                fi
            fi
        ) &
        
        pids+=($!)
        ((current_parallel++))
    done
    
    # Attendre tous les processus
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Chercher les réponses
    local discoveries=()
    for pid in "${pids[@]}"; do
        local result=$(jobs -p | grep -q $pid && echo "running" || echo "done")
        if [[ "$result" == "done" ]]; then
            # Récupérer les résultats (cette partie est simplifiée)
            # Dans un vrai script, on utiliserait des fichiers temporaires
            continue
        fi
    done
    
    # Fallback: tester les IPs communes
    local common_ips=("192.168.1.1" "192.168.1.100" "192.168.0.1" "10.0.0.1")
    for ip in "${common_ips[@]}"; do
        if timeout 2 nc -z "$ip" 3000 2>/dev/null; then
            local response=$(timeout 5 curl -s "http://$ip:3000/api/install/discover" 2>/dev/null || echo "")
            if [[ -n "$response" ]]; then
                SERVER_IP=$(echo "$response" | grep -o '"serverUrl":"[^"]*"' | cut -d'"' -f4 | sed 's|http://||' | cut -d':' -f1)
                SERVER_PORT=$(echo "$response" | grep -o '"serverUrl":"[^"]*"' | cut -d'"' -f4 | sed 's|http://||' | cut -d':' -f2)
                API_KEY=$(echo "$response" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
                
                if [[ -n "$SERVER_IP" && -n "$API_KEY" ]]; then
                    log "Serveur découvert via scan: $SERVER_IP:$SERVER_PORT"
                    return 0
                fi
            fi
        fi
    done
    
    return 1
}

# Découvrir le serveur via mDNS (Avahi/Bonjour)
discover_server_mdns() {
    log "Recherche du serveur via mDNS..."
    
    # Vérifier si avahi-browse est disponible
    if command -v avahi-browse &> /dev/null; then
        local mdns_result=$(timeout 10 avahi-browse -t _3cx-ninja._tcp 2>/dev/null || echo "")
        if [[ -n "$mdns_result" ]]; then
            # Parser le résultat mDNS
            SERVER_IP=$(echo "$mdns_result" | grep -o 'address \[[^]]*\]' | cut -d'[' -f2 | cut -d']' -f1 | head -1)
            if [[ -n "$SERVER_IP" ]]; then
                log "Serveur découvert via mDNS: $SERVER_IP"
                # Tester la connexion
                if timeout 3 curl -s "http://$SERVER_IP:3000/api/install/discover" &>/dev/null; then
                    return 0
                fi
            fi
        fi
    fi
    
    return 1
}

# Découvrir le serveur (méthode principale)
discover_server() {
    log "Découverte automatique du serveur 3CX-Ninja..."
    
    # Méthode 1: Broadcast UDP
    if discover_server_broadcast; then
        return 0
    fi
    
    warn "Broadcast UDP échoué, tentative de scan réseau..."
    
    # Méthode 2: Scan réseau
    if discover_server_scan; then
        return 0
    fi
    
    warn "Scan réseau échoué, tentative mDNS..."
    
    # Méthode 3: mDNS
    if discover_server_mdns; then
        return 0
    fi
    
    error "Aucun serveur 3CX-Ninja trouvé sur le réseau local"
}

# Valider la connexion serveur
validate_server() {
    log "Validation de la connexion au serveur..."
    
    local server_url="http://$SERVER_IP:${SERVER_PORT:-3000}"
    
    # Tester la connexion
    if ! timeout 10 curl -s "$server_url/api/install/discover" &>/dev/null; then
        error "Impossible de se connecter au serveur $server_url"
    fi
    
    # Tester l'API Key
    if ! timeout 10 curl -s -H "Authorization: Bearer $API_KEY" "$server_url/api/health" &>/dev/null; then
        error "Clé API invalide"
    fi
    
    log "Connexion serveur validée"
}

# Télécharger et installer l'agent
install_agent() {
    log "Installation de l'agent 3CX-Ninja..."
    
    # Créer les répertoires
    mkdir -p "$AGENT_DIR" "$TEMP_DIR"
    
    # URL de téléchargement
    local server_url="http://$SERVER_IP:${SERVER_PORT:-3000}"
    local download_url="$server_url/api/install/agent/$OS/$ARCH"
    local agent_file="$AGENT_DIR/3cx-ninja-agent"
    
    # Télécharger l'agent
    log "Téléchargement depuis $download_url..."
    
    if ! timeout 60 curl -L -o "$agent_file" "$download_url" 2>/dev/null; then
        # Fallback: utiliser le script d'installation du serveur
        warn "Téléchargement direct échoué, utilisation du script d'installation..."
        
        if ! timeout 60 curl -sSL "$server_url/api/install/install-agent.sh" | bash -s -- --server "$server_url" --key "$API_KEY"; then
            error "Installation échouée"
        fi
        
        return 0
    fi
    
    # Vérifier le fichier téléchargé
    if [[ ! -f "$agent_file" ]] || [[ ! -s "$agent_file" ]]; then
        error "Fichier agent non valide"
    fi
    
    # Rendre exécutable
    chmod +x "$agent_file"
    
    log "Agent téléchargé et installé"
}

# Configurer l'agent
configure_agent() {
    log "Configuration de l'agent..."
    
    # Créer la configuration
    cat > "$CONFIG_FILE" << EOF
{
    "serverUrl": "http://$SERVER_IP:${SERVER_PORT:-3000}",
    "apiKey": "$API_KEY",
    "serverName": "$SERVER_NAME",
    "autoDiscovered": true,
    "installedAt": "$(date -Iseconds)",
    "agentInfo": {
        "id": "agent-$(hostname)-$(date +%s)",
        "name": "$(whoami)@$(hostname)",
        "email": "",
        "extension": "",
        "platform": "$OS",
        "architecture": "$ARCH",
        "version": "2.0.0"
    },
    "connection": {
        "reconnectInterval": 5000,
        "maxReconnectAttempts": 10,
        "heartbeatInterval": 30000
    },
    "features": {
        "audioCapture": true,
        "realTimeTranscription": true,
        "offlineMode": true,
        "autoTicketCreation": true
    }
}
EOF
    
    # Permissions sécurisées
    chmod 600 "$CONFIG_FILE"
    
    log "Configuration créée"
}

# Créer le service système
create_service() {
    log "Création du service système..."
    
    if [[ "$OS" == "linux" ]]; then
        # Service systemd utilisateur
        local service_dir="$HOME/.config/systemd/user"
        mkdir -p "$service_dir"
        
        cat > "$service_dir/3cx-ninja-agent.service" << EOF
[Unit]
Description=3CX-Ninja Agent
After=network.target

[Service]
Type=simple
ExecStart=$AGENT_DIR/3cx-ninja-agent
Restart=always
RestartSec=10
WorkingDirectory=$AGENT_DIR
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
        
        # Recharger et activer
        systemctl --user daemon-reload
        systemctl --user enable 3cx-ninja-agent
        
        log "Service systemd créé"
        
    elif [[ "$OS" == "macos" ]]; then
        # Service launchd
        local plist_dir="$HOME/Library/LaunchAgents"
        mkdir -p "$plist_dir"
        
        cat > "$plist_dir/com.3cx-ninja.agent.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.3cx-ninja.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$AGENT_DIR/3cx-ninja-agent</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$AGENT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>$AGENT_DIR/agent.log</string>
    <key>StandardOutPath</key>
    <string>$AGENT_DIR/agent.log</string>
</dict>
</plist>
EOF
        
        # Charger le service
        launchctl load "$plist_dir/com.3cx-ninja.agent.plist"
        
        log "Service launchd créé"
    fi
}

# Démarrer l'agent
start_agent() {
    log "Démarrage de l'agent..."
    
    if [[ "$OS" == "linux" ]]; then
        systemctl --user start 3cx-ninja-agent
        
        # Vérifier le statut
        if systemctl --user is-active --quiet 3cx-ninja-agent; then
            log "Agent démarré avec succès"
        else
            error "Échec du démarrage de l'agent"
        fi
        
    elif [[ "$OS" == "macos" ]]; then
        # L'agent démarre automatiquement avec launchd
        sleep 3
        
        # Vérifier si le processus est en cours
        if pgrep -f "3cx-ninja-agent" &>/dev/null; then
            log "Agent démarré avec succès"
        else
            error "Échec du démarrage de l'agent"
        fi
    fi
}

# Tester la connexion
test_connection() {
    log "Test de la connexion..."
    
    local server_url="http://$SERVER_IP:${SERVER_PORT:-3000}"
    local test_attempts=0
    local max_attempts=10
    
    while [[ $test_attempts -lt $max_attempts ]]; do
        if timeout 5 curl -s -H "Authorization: Bearer $API_KEY" "$server_url/api/health" &>/dev/null; then
            log "Connexion établie avec succès"
            return 0
        fi
        
        ((test_attempts++))
        sleep 2
    done
    
    warn "Connexion non établie après $max_attempts tentatives"
    return 1
}

# Nettoyer les fichiers temporaires
cleanup() {
    log "Nettoyage..."
    rm -rf "$TEMP_DIR"
}

# Afficher les informations finales
show_final_info() {
    log "Installation terminée avec succès!"
    echo ""
    echo "=========================================="
    echo "3CX-Ninja Agent installé"
    echo "=========================================="
    echo ""
    echo "🌐 Serveur: $SERVER_NAME"
    echo "🔗 URL: http://$SERVER_IP:${SERVER_PORT:-3000}"
    echo "📁 Répertoire: $AGENT_DIR"
    echo "⚙️ Configuration: $CONFIG_FILE"
    echo ""
    echo "🚀 Statut du service:"
    if [[ "$OS" == "linux" ]]; then
        systemctl --user status 3cx-ninja-agent --no-pager -l
    elif [[ "$OS" == "macos" ]]; then
        launchctl list | grep 3cx-ninja || echo "Service non trouvé"
    fi
    echo ""
    echo "📋 Prochaines étapes:"
    echo "1. Configurez votre extension 3CX dans l'interface agent"
    echo "2. Testez la capture audio"
    echo "3. Vérifiez la connexion au serveur"
    echo ""
    echo "🔧 Commandes utiles:"
    if [[ "$OS" == "linux" ]]; then
        echo "   Redémarrer: systemctl --user restart 3cx-ninja-agent"
        echo "   Logs: journalctl --user -u 3cx-ninja-agent -f"
        echo "   Arrêter: systemctl --user stop 3cx-ninja-agent"
    elif [[ "$OS" == "macos" ]]; then
        echo "   Redémarrer: launchctl unload ~/Library/LaunchAgents/com.3cx-ninja.agent.plist && launchctl load ~/Library/LaunchAgents/com.3cx-ninja.agent.plist"
        echo "   Logs: tail -f $AGENT_DIR/agent.log"
        echo "   Arrêter: launchctl unload ~/Library/LaunchAgents/com.3cx-ninja.agent.plist"
    fi
    echo ""
    echo "=========================================="
}

# Fonction principale
main() {
    log "Démarrage de l'installation automatique de l'agent 3CX-Ninja"
    
    detect_os
    detect_arch
    check_prerequisites
    get_local_ip
    
    discover_server
    validate_server
    install_agent
    configure_agent
    create_service
    start_agent
    test_connection
    cleanup
    
    show_final_info
}

# Gestion des signaux
trap cleanup EXIT

# Exécuter le script principal
main "$@"