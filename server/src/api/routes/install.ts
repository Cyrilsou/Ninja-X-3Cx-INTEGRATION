import { Router } from 'express';
import { Logger } from '@3cx-ninja/shared';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import os from 'os';

const logger = new Logger('InstallAPI');
const router = Router();

// Obtenir la configuration du serveur
function getServerConfig() {
  const interfaces = os.networkInterfaces();
  let serverIp = 'localhost';
  
  // Trouver l'IP locale
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal && config.address !== '127.0.0.1') {
        serverIp = config.address;
        break;
      }
    }
  }
  
  return {
    serverIp,
    serverPort: process.env.PORT || '3000',
    apiKey: process.env.API_KEY || 'sk-default-key',
    discoveryPort: process.env.DISCOVERY_PORT || '53434'
  };
}

// Script PowerShell pour Windows
router.get('/install-agent.ps1', async (req, res) => {
  try {
    const config = getServerConfig();
    const templatePath = path.join(__dirname, '../../public/install/install-agent.ps1');
    
    // Lire le template
    let script = await fs.readFile(templatePath, 'utf-8');
    
    // Remplacer les variables
    script = script
      .replace(/{{SERVER_IP}}/g, config.serverIp)
      .replace(/{{SERVER_PORT}}/g, config.serverPort)
      .replace(/{{API_KEY}}/g, config.apiKey)
      .replace(/{{DISCOVERY_PORT}}/g, config.discoveryPort);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="install-agent.ps1"');
    res.send(script);
    
    logger.info(`Script PowerShell servi à ${req.ip}`);
  } catch (error) {
    logger.error('Erreur lors du service du script PowerShell:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Script Bash pour Linux/Mac
router.get('/install-agent.sh', async (req, res) => {
  try {
    const config = getServerConfig();
    
    const script = `#!/bin/bash
# 3CX-Ninja Agent - Installation automatique Linux/Mac

SERVER_URL="http://${config.serverIp}:${config.serverPort}"
API_KEY="${config.apiKey}"
DISCOVERY_PORT="${config.discoveryPort}"

echo "========================================="
echo "3CX-Ninja Agent - Installation Linux/Mac"
echo "========================================="
echo ""
echo "Serveur: $SERVER_URL"
echo ""

# Vérifier les privilèges
if [ "$EUID" -ne 0 ]; then 
  echo "Ce script doit être exécuté avec sudo"
  exit 1
fi

# Détecter la distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Distribution non supportée"
    exit 1
fi

# Installer Node.js si nécessaire
if ! command -v node &> /dev/null; then
    echo "Installation de Node.js..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    else
        echo "Installation manuelle de Node.js requise"
        exit 1
    fi
fi

# Collecter les informations
read -p "Email de l'agent: " AGENT_EMAIL
read -p "Nom de l'agent: " AGENT_NAME
read -p "Extension 3CX: " AGENT_EXTENSION

# Créer les dossiers
INSTALL_DIR="/opt/3cx-ninja-agent"
DATA_DIR="/etc/3cx-ninja-agent"
mkdir -p "$INSTALL_DIR" "$DATA_DIR"

# Télécharger l'agent
echo "Téléchargement de l'agent..."
curl -sSL -H "Authorization: Bearer $API_KEY" "$SERVER_URL/api/install/agent.tar.gz" | tar -xz -C "$INSTALL_DIR"

# Installer les dépendances
cd "$INSTALL_DIR"
npm install --production

# Créer la configuration
cat > "$DATA_DIR/config.json" << EOF
{
  "serverUrl": "$SERVER_URL",
  "apiKey": "$API_KEY",
  "agent": {
    "email": "$AGENT_EMAIL",
    "name": "$AGENT_NAME",
    "extension": "$AGENT_EXTENSION"
  }
}
EOF

# Créer le service systemd
cat > /etc/systemd/system/3cx-ninja-agent.service << EOF
[Unit]
Description=3CX-Ninja Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CONFIG_PATH=$DATA_DIR/config.json

[Install]
WantedBy=multi-user.target
EOF

# Démarrer le service
systemctl daemon-reload
systemctl enable 3cx-ninja-agent
systemctl start 3cx-ninja-agent

echo ""
echo "Installation terminée!"
echo "L'agent est démarré et configuré pour démarrer automatiquement."
echo ""
echo "Commandes utiles:"
echo "  systemctl status 3cx-ninja-agent"
echo "  journalctl -u 3cx-ninja-agent -f"
`;
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="install-agent.sh"');
    res.send(script);
    
    logger.info(`Script Bash servi à ${req.ip}`);
  } catch (error) {
    logger.error('Erreur lors du service du script Bash:', error);
    res.status(500).send('Erreur serveur');
  }
});

// ZIP de l'agent pour Windows
router.get('/agent.zip', async (req, res) => {
  try {
    // Vérifier l'autorisation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Autorisation requise' });
    }
    
    const apiKey = authHeader.substring(7);
    if (apiKey !== process.env.API_KEY) {
      return res.status(403).json({ error: 'Clé API invalide' });
    }
    
    // Créer l'archive ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="3cx-ninja-agent.zip"');
    
    archive.pipe(res);
    
    // Ajouter les fichiers de l'agent
    const agentPath = path.join(__dirname, '../../../agent');
    archive.directory(agentPath, 'agent');
    
    // Ajouter le module shared si présent
    const sharedPath = path.join(__dirname, '../../../shared');
    try {
      await fs.access(sharedPath);
      archive.directory(sharedPath, 'shared');
    } catch {}
    
    await archive.finalize();
    
    logger.info(`Archive ZIP de l'agent servie à ${req.ip}`);
  } catch (error) {
    logger.error('Erreur lors de la création du ZIP:', error);
    res.status(500).send('Erreur serveur');
  }
});

// TAR.GZ de l'agent pour Linux
router.get('/agent.tar.gz', async (req, res) => {
  try {
    // Vérifier l'autorisation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Autorisation requise' });
    }
    
    const apiKey = authHeader.substring(7);
    if (apiKey !== process.env.API_KEY) {
      return res.status(403).json({ error: 'Clé API invalide' });
    }
    
    // Créer l'archive TAR.GZ
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 9 }
    });
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="3cx-ninja-agent.tar.gz"');
    
    archive.pipe(res);
    
    // Ajouter les fichiers de l'agent
    const agentPath = path.join(__dirname, '../../../agent');
    archive.directory(agentPath, 'agent');
    
    // Ajouter le module shared si présent
    const sharedPath = path.join(__dirname, '../../../shared');
    try {
      await fs.access(sharedPath);
      archive.directory(sharedPath, 'shared');
    } catch {}
    
    await archive.finalize();
    
    logger.info(`Archive TAR.GZ de l'agent servie à ${req.ip}`);
  } catch (error) {
    logger.error('Erreur lors de la création du TAR.GZ:', error);
    res.status(500).send('Erreur serveur');
  }
});

export function createInstallRouter() {
  return router;
}