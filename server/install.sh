#!/bin/bash

echo "========================================="
echo "Installation du serveur 3CX-Ninja"
echo "========================================="
echo

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé"
    echo "Installez Node.js 18+ depuis https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js détecté: $(node --version)"

# Vérifier Redis
if ! command -v redis-cli &> /dev/null; then
    echo "[ATTENTION] Redis n'est pas installé"
    echo "Installation de Redis..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update
        sudo apt-get install -y redis-server
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install redis
        brew services start redis
    else
        echo "Installez Redis manuellement depuis https://redis.io"
        exit 1
    fi
fi

echo "[OK] Redis détecté"

# Installer les dépendances
echo
echo "Installation des dépendances..."
npm install

# Compiler TypeScript
echo
echo "Compilation..."
npm run build

# Créer le fichier .env
if [ ! -f .env ]; then
    echo
    echo "Configuration du serveur..."
    
    read -p "Port du serveur [3000]: " PORT
    PORT=${PORT:-3000}
    
    read -p "Clé API du serveur (laissez vide pour générer): " API_KEY
    if [ -z "$API_KEY" ]; then
        API_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    fi
    
    echo
    echo "Configuration 3CX:"
    read -p "URL du PBX 3CX (ex: https://pbx.company.com:5001): " PBX_URL
    read -p "Client ID 3CX: " CX_CLIENT_ID
    read -p "Client Secret 3CX: " CX_CLIENT_SECRET
    
    echo
    echo "Configuration NinjaOne:"
    read -p "Client ID NinjaOne: " NINJA_CLIENT_ID
    read -p "Client Secret NinjaOne: " NINJA_CLIENT_SECRET
    
    echo
    echo "Configuration Whisper (optionnel):"
    read -p "Modèle Whisper [base]: " WHISPER_MODEL
    WHISPER_MODEL=${WHISPER_MODEL:-base}
    
    cat > .env << EOF
# Server Configuration
PORT=$PORT
API_KEY=$API_KEY
NODE_ENV=production

# 3CX Configuration
PBX_URL=$PBX_URL
CX_CLIENT_ID=$CX_CLIENT_ID
CX_CLIENT_SECRET=$CX_CLIENT_SECRET

# NinjaOne Configuration  
NINJA_CLIENT_ID=$NINJA_CLIENT_ID
NINJA_CLIENT_SECRET=$NINJA_CLIENT_SECRET
NINJA_API_URL=https://api.ninjarmm.com

# Whisper Configuration
WHISPER_MODEL=$WHISPER_MODEL
WHISPER_THREADS=4

# Redis Configuration
REDIS_URL=redis://localhost:6379
EOF

    echo
    echo "[OK] Configuration créée dans .env"
fi

# Télécharger le modèle Whisper
echo
echo "Téléchargement du modèle Whisper..."
./download-whisper-model.sh

# Créer le service systemd (Linux seulement)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo
    echo "Création du service systemd..."
    
    sudo tee /etc/systemd/system/3cx-ninja.service > /dev/null << EOF
[Unit]
Description=3CX Ninja Server
After=network.target redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable 3cx-ninja
    
    echo "[OK] Service systemd créé"
fi

echo
echo "========================================="
echo "Installation terminée!"
echo "========================================="
echo
echo "Informations importantes:"
echo "- Clé API du serveur: $API_KEY"
echo "- Port: $PORT"
echo
echo "Pour démarrer le serveur:"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "  sudo systemctl start 3cx-ninja"
    echo "  sudo systemctl status 3cx-ninja"
else
    echo "  npm start"
fi
echo
echo "Les agents doivent utiliser:"
echo "- URL: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "- Clé API: $API_KEY"
echo