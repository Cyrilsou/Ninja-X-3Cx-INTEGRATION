# Guide d'Installation 3CX-Ninja Realtime

## 🖥️ Installation Agent Windows

### Prérequis Windows
- Windows 10/11
- Node.js 18+ ([télécharger](https://nodejs.org))
- Droits administrateur (pour SoX)

### Installation automatique

1. **Télécharger le projet**
```powershell
git clone [repo-url]
cd 3cx-ninja-realtime/agent
```

2. **Exécuter l'installateur** (en tant qu'administrateur)
```batch
install-windows.bat
```

L'installateur va :
- ✅ Vérifier Node.js
- ✅ Installer les dépendances
- ✅ Télécharger et installer SoX automatiquement
- ✅ Créer un raccourci sur le bureau
- ✅ Configurer le démarrage automatique (optionnel)
- ✅ Créer les règles firewall nécessaires

3. **Configuration**
- Lancez l'agent via le raccourci bureau
- À la première ouverture, configurez :
  - URL du serveur : `http://serveur-ip:3000`
  - Clé API : (fournie par l'admin)
  - Extension 3CX : votre numéro d'extension

### Vérification
- L'icône apparaît dans la barre système
- Status : "En ligne" en vert
- Test : faites un appel test

---

## 🐧 Installation Serveur Linux

### Prérequis Linux
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Node.js 18+
- Python 3.8+
- 4GB RAM minimum

### Installation automatique

1. **Télécharger et préparer**
```bash
git clone [repo-url]
cd 3cx-ninja-realtime/server
chmod +x scripts/install-server.sh
```

2. **Lancer l'installation**
```bash
sudo ./scripts/install-server.sh
```

Le script va automatiquement :
- ✅ Installer les dépendances système (ffmpeg, redis, cmake)
- ✅ Configurer Redis
- ✅ Compiler Whisper.cpp
- ✅ Télécharger le modèle Whisper
- ✅ Créer le service systemd
- ✅ Configurer les logs

3. **Configuration**
```bash
# Éditer les credentials NinjaOne
nano .env

# Ajouter :
NINJA_CLIENT_ID=votre-client-id
NINJA_CLIENT_SECRET=votre-secret
NINJA_REFRESH_TOKEN=votre-token
API_KEY=une-cle-securisee
```

4. **Démarrage**
```bash
# Option 1 : Service systemd
sudo systemctl start 3cx-ninja-server
sudo systemctl enable 3cx-ninja-server

# Option 2 : Manuel
./start-server.sh
```

### Vérification
```bash
# Vérifier le service
sudo systemctl status 3cx-ninja-server

# Vérifier l'API
curl http://localhost:3000/health

# Voir les logs
journalctl -u 3cx-ninja-server -f
```

---

## 🍎 Installation Serveur macOS

### Prérequis macOS
- macOS 11+
- Homebrew
- Node.js 18+

### Installation

1. **Installer Homebrew** (si nécessaire)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Lancer le script d'installation**
```bash
cd 3cx-ninja-realtime/server
chmod +x scripts/install-server.sh
./scripts/install-server.sh
```

3. **Configuration** (même que Linux)

4. **Démarrage**
```bash
./start-server.sh
```

---

## 📺 Installation Dashboard TV

Le dashboard peut être installé sur n'importe quel système.

### Option 1 : Sur le serveur
```bash
cd 3cx-ninja-realtime/dashboard
npm install
npm run build

# Servir avec le serveur principal (automatique en production)
```

### Option 2 : Machine dédiée
```bash
cd 3cx-ninja-realtime/dashboard
npm install
npm run build
npm run preview -- --host 0.0.0.0
```

Accès : `http://ip-serveur:4173`

### Configuration TV
1. Ouvrir en plein écran (F11)
2. Désactiver la veille
3. Configuration réseau stable

---

## 🔧 Configuration 3CX

### Webhooks HTTP
Dans l'interface 3CX Admin :

1. **Parameters → Call Control API**
   - Activer l'API
   - Noter l'URL et le port

2. **CRM Integration → HTTP Actions**
   
   **Action "Call Start":**
   ```
   URL: http://serveur:3000/webhook/call-start
   Method: POST
   Body Template:
   {
     "callId": "[CallID]",
     "caller": "[CallerNumber]",
     "extension": "[AgentNumber]",
     "agentEmail": "[AgentEmail]",
     "direction": "[CallDirection]"
   }
   ```

   **Action "Call End":**
   ```
   URL: http://serveur:3000/webhook/call-end
   Method: POST
   Body Template:
   {
     "callId": "[CallID]",
     "duration": "[Duration]",
     "recording": "[RecordingURL]"
   }
   ```

3. **Assign to Users**
   - Sélectionner les extensions à monitorer

---

## 🚀 Démarrage Rapide

### Sur le serveur Linux :
```bash
# Terminal 1 - Serveur
sudo systemctl start 3cx-ninja-server

# Terminal 2 - Dashboard (optionnel)
cd dashboard && npm run preview
```

### Sur chaque PC Windows :
1. Double-clic sur "3CX Ninja Agent" (bureau)
2. L'agent se connecte automatiquement

### Vérifications :
- Serveur : http://serveur:3000/health ✅
- Dashboard : http://serveur:4173 ✅
- Agent : Icône système verte ✅

---

## ❓ Dépannage

### Windows : "SoX n'est pas reconnu"
```batch
# Réinstaller SoX manuellement
cd agent
powershell -ExecutionPolicy Bypass -File scripts\install-sox.ps1
```

### Linux : "Whisper compilation failed"
```bash
# Installer les dépendances build
sudo apt-get install build-essential cmake

# Recompiler
cd server/models/whisper/whisper.cpp
make clean && make
```

### "Unauthorized" sur l'agent
- Vérifier l'API_KEY dans server/.env
- Redémarrer le serveur après modification

### Performance lente
- Utiliser un modèle Whisper plus petit : `tiny` ou `base`
- Ajouter plus de RAM
- Utiliser GPU si disponible

---

## 📞 Support

- Logs serveur : `/var/log/3cx-ninja/`
- Logs agent : `%APPDATA%\3cx-ninja-agent\logs\`
- Documentation : voir README.md