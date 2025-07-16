#!/bin/bash

echo "========================================"
echo "Installation Serveur 3CX-Ninja Realtime"
echo "========================================"
echo

# Détection de l'OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo "[ERREUR] OS non supporté: $OSTYPE"
    exit 1
fi

echo "[INFO] OS détecté: $OS ($DISTRO)"

# Fonction pour installer les dépendances
install_dependencies() {
    echo
    echo "Installation des dépendances système..."
    
    if [[ "$OS" == "linux" ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            sudo apt-get update
            sudo apt-get install -y \
                build-essential \
                ffmpeg \
                redis-server \
                python3 \
                python3-pip \
                git \
                cmake
        elif command -v yum &> /dev/null; then
            # RedHat/CentOS
            sudo yum install -y \
                gcc-c++ \
                make \
                ffmpeg \
                redis \
                python3 \
                python3-pip \
                git \
                cmake
        fi
    elif [[ "$OS" == "macos" ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "[INFO] Installation de Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        brew install ffmpeg redis python@3 cmake
    fi
}

# Fonction pour configurer Redis
setup_redis() {
    echo
    echo "Configuration de Redis..."
    
    if [[ "$OS" == "linux" ]]; then
        # Activer et démarrer Redis
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
        
        # Vérifier le statut
        if systemctl is-active --quiet redis-server; then
            echo "[OK] Redis est actif"
        else
            echo "[ERREUR] Redis n'a pas démarré"
            exit 1
        fi
    elif [[ "$OS" == "macos" ]]; then
        # Démarrer Redis avec brew services
        brew services start redis
        echo "[OK] Redis démarré avec brew services"
    fi
}

# Fonction pour installer Whisper
install_whisper() {
    echo
    echo "Installation de Whisper..."
    
    # Créer le répertoire des modèles
    mkdir -p models/whisper
    cd models/whisper
    
    # Cloner whisper.cpp
    if [ ! -d "whisper.cpp" ]; then
        echo "Clonage de whisper.cpp..."
        git clone https://github.com/ggerganov/whisper.cpp.git
    fi
    
    cd whisper.cpp
    
    # Compiler
    echo "Compilation de whisper.cpp..."
    make clean
    make
    
    # Copier l'exécutable
    cp main ../
    cd ..
    
    # Télécharger le modèle
    MODEL=${WHISPER_MODEL:-base}
    if [ ! -f "ggml-$MODEL.bin" ]; then
        echo "Téléchargement du modèle $MODEL..."
        bash whisper.cpp/models/download-ggml-model.sh $MODEL
    fi
    
    cd ../..
    echo "[OK] Whisper installé"
}

# Fonction pour créer le service systemd
create_service() {
    if [[ "$OS" != "linux" ]]; then
        return
    fi
    
    echo
    echo "Création du service systemd..."
    
    SERVICE_FILE="/etc/systemd/system/3cx-ninja-server.service"
    
    sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=3CX-Ninja Realtime Server
After=network.target redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$(pwd)/logs/server.log
StandardError=append:$(pwd)/logs/error.log

# Variables d'environnement
Environment="NODE_ENV=production"
Environment="PORT=3000"
EnvironmentFile=-$(pwd)/.env

# Limites
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    echo "[OK] Service créé: 3cx-ninja-server"
}

# Fonction principale d'installation
main() {
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        echo "[ERREUR] Node.js n'est pas installé"
        echo "Installez Node.js 18+ depuis: https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "[ERREUR] Node.js 18+ requis (version actuelle: $(node -v))"
        exit 1
    fi
    
    echo "[OK] Node.js $(node -v) détecté"
    
    # Installer les dépendances système
    install_dependencies
    
    # Configurer Redis
    setup_redis
    
    # Installer les packages npm
    echo
    echo "Installation des packages npm..."
    npm install
    
    # Compiler TypeScript
    echo
    echo "Compilation du serveur..."
    npm run build
    
    # Installer Whisper
    install_whisper
    
    # Créer les répertoires
    echo
    echo "Création des répertoires..."
    mkdir -p logs data/temp
    
    # Configuration
    if [ ! -f .env ]; then
        echo
        echo "Création du fichier .env..."
        cp .env.example .env
        echo "[ATTENTION] Éditez .env avec vos credentials NinjaOne"
    fi
    
    # Créer le service
    create_service
    
    # Créer les scripts de démarrage
    echo
    echo "Création des scripts..."
    
    # Script de démarrage simple
    cat > start-server.sh << 'EOF'
#!/bin/bash
export NODE_ENV=production
node dist/index.js
EOF
    chmod +x start-server.sh
    
    # Script de démarrage avec logs
    cat > start-server-debug.sh << 'EOF'
#!/bin/bash
export NODE_ENV=development
export DEBUG=*
node dist/index.js | tee -a logs/debug.log
EOF
    chmod +x start-server-debug.sh
    
    # Résumé
    echo
    echo "========================================"
    echo "Installation terminée avec succès!"
    echo "========================================"
    echo
    echo "Configuration:"
    echo "1. Éditez .env avec vos credentials NinjaOne"
    echo "2. Éditez config/default.json si nécessaire"
    echo
    echo "Démarrage:"
    echo "- Simple: ./start-server.sh"
    echo "- Debug: ./start-server-debug.sh"
    echo "- Service: sudo systemctl start 3cx-ninja-server"
    echo
    echo "Logs:"
    echo "- Application: logs/"
    echo "- Service: journalctl -u 3cx-ninja-server -f"
    echo
    echo "API disponible sur: http://localhost:3000"
}

# Exécuter l'installation
main