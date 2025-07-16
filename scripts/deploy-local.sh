#!/bin/bash

echo "🚀 Déploiement local 3CX-NinjaOne Realtime"
echo "=========================================="

# Vérifier les prérequis
check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "❌ $1 n'est pas installé"
    exit 1
  fi
}

check_command node
check_command npm
check_command redis-cli

# Fonction pour afficher les étapes
step() {
  echo -e "\n📌 $1"
}

# 1. Build shared
step "Compilation du module partagé"
cd shared
npm install
npm run build
cd ..

# 2. Setup server
step "Configuration du serveur"
cd server

if [ ! -f .env ]; then
  echo "⚠️  Création du fichier .env"
  cp .env.example .env
  echo "📝 Veuillez éditer server/.env avec vos credentials NinjaOne"
  read -p "Appuyez sur Entrée une fois terminé..."
fi

npm install
npm run build

# Télécharger Whisper si nécessaire
if [ ! -f models/whisper/ggml-base.bin ]; then
  step "Téléchargement du modèle Whisper"
  npm run setup:whisper
fi

cd ..

# 3. Build agent
step "Compilation de l'agent"
cd agent
npm install
npm run build
cd ..

# 4. Build dashboard
step "Compilation du dashboard"
cd dashboard
npm install
npm run build
cd ..

# 5. Créer les scripts de démarrage
step "Création des scripts de démarrage"

cat > start-server.sh << 'EOF'
#!/bin/bash
cd server
npm start
EOF

cat > start-agent.sh << 'EOF'
#!/bin/bash
cd agent
npm start
EOF

cat > start-dashboard.sh << 'EOF'
#!/bin/bash
cd dashboard
npm run preview -- --host
EOF

chmod +x start-*.sh

# 6. Créer le service systemd (optionnel)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  step "Création du service systemd"
  
  sudo tee /etc/systemd/system/3cx-ninja-server.service > /dev/null << EOF
[Unit]
Description=3CX-NinjaOne Realtime Server
After=network.target redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/server
ExecStart=$(which node) $(pwd)/server/dist/index.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

  echo "✓ Service créé: 3cx-ninja-server"
  echo "  Démarrer: sudo systemctl start 3cx-ninja-server"
  echo "  Auto-start: sudo systemctl enable 3cx-ninja-server"
fi

# 7. Instructions finales
echo -e "\n✅ Installation terminée!"
echo "========================"
echo
echo "Pour démarrer:"
echo "1. Terminal 1: ./start-server.sh"
echo "2. Terminal 2: ./start-agent.sh"
echo "3. Terminal 3: ./start-dashboard.sh"
echo
echo "URLs:"
echo "- Serveur API: http://localhost:3000"
echo "- Dashboard TV: http://localhost:4173"
echo "- Agent: Application Electron"
echo
echo "Configuration:"
echo "- Serveur: server/.env et server/config/default.json"
echo "- Agent: Via l'interface au premier lancement"
echo
echo "📚 Documentation: voir README.md"