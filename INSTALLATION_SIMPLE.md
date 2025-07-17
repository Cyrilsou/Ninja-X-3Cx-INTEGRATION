# 🚀 Installation Rapide - 3CX-Ninja Realtime

## 📋 Installation serveur en 1 commande

### Ubuntu/Debian
```bash
wget -qO- https://raw.githubusercontent.com/Cyrilsou/Ninja-X-3Cx-INTEGRATION/main/setup-server-auto.sh | sudo bash
```

### Ou avec curl
```bash
curl -sSL https://raw.githubusercontent.com/Cyrilsou/Ninja-X-3Cx-INTEGRATION/main/setup-server-auto.sh | sudo bash
```

## 🖥️ Installation agent automatique

### Windows (PowerShell Admin)
```powershell
# L'agent trouvera automatiquement le serveur sur le réseau
powershell -c "irm https://raw.githubusercontent.com/Cyrilsou/Ninja-X-3Cx-INTEGRATION/main/install-agent-auto.ps1 | iex"
```

### Linux/macOS
```bash
# L'agent trouvera automatiquement le serveur sur le réseau
curl -sSL https://raw.githubusercontent.com/Cyrilsou/Ninja-X-3Cx-INTEGRATION/main/install-agent-auto.sh | bash
```

## 🎯 Ce que fait l'installation

### Serveur
✅ Clone le repository GitHub  
✅ Installe tous les prérequis (Node.js, Redis, Nginx)  
✅ Configure Whisper pour la transcription  
✅ Génère une clé API sécurisée  
✅ Active la découverte réseau automatique  
✅ Configure le firewall et SSL  
✅ Démarre tous les services  

### Agent
✅ Découvre automatiquement le serveur  
✅ S'installe et se configure  
✅ Démarre automatiquement  
✅ Se connecte au serveur  

## 📡 Découverte réseau automatique

Le système utilise 3 méthodes pour trouver automatiquement le serveur :

1. **Broadcast UDP** sur le port 53434
2. **Scan réseau** des IPs locales
3. **mDNS/Bonjour** pour la découverte de services

## 🔧 Configuration post-installation

### 1. Accès à l'interface admin
```
http://IP-DU-SERVEUR/admin
Login: admin@3cx-ninja.local
Pass: admin123 (à changer!)
```

### 2. Configuration 3CX
Dans l'admin, allez dans "Webhooks 3CX" et suivez les instructions

### 3. Configuration NinjaOne
Dans l'admin, allez dans "Configuration système" > "NinjaOne"

## 🆘 Dépannage

### Le serveur ne démarre pas
```bash
sudo systemctl status 3cx-ninja
sudo journalctl -u 3cx-ninja -f
```

### L'agent ne trouve pas le serveur
```bash
# Vérifier que le serveur écoute
sudo netstat -tulpn | grep 53434

# Tester manuellement
nc -u IP-SERVEUR 53434
```

### Logs
- Serveur: `/var/log/3cx-ninja/`
- Agent Windows: `%APPDATA%\3cx-ninja-agent\`
- Agent Linux/Mac: `~/.3cx-ninja-agent/`

## 📊 Vérification

### État du système
```bash
# Sur le serveur
curl http://localhost:3000/api/health

# Voir les agents connectés
curl http://localhost:3000/api/agents
```

## 🎉 C'est tout !

Votre système est maintenant opérationnel. Les agents se connecteront automatiquement au serveur.