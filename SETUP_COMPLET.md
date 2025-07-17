# 🚀 Setup Serveur Automatique Complet - 3CX-Ninja Realtime

## 📋 3 Méthodes d'installation disponibles

### 1. 🐧 **Installation Linux/macOS Automatique**
```bash
# Rendre le script exécutable
chmod +x setup-server-complete.sh

# Lancer l'installation complète
./setup-server-complete.sh
```

**Ce script fait tout automatiquement :**
- ✅ Vérifie les prérequis (Node.js, npm, FFmpeg, Redis)
- ✅ Installe toutes les dépendances npm
- ✅ Compile tous les projets (shared, server, dashboard)
- ✅ Configuration interactive (.env avec vos clés API)
- ✅ Crée les dossiers nécessaires
- ✅ Tente d'installer Whisper (si cmake disponible)
- ✅ Crée le service systemd (si root)
- ✅ Configure Nginx (si installé)
- ✅ Démarre le serveur automatiquement

### 2. 🪟 **Installation Windows PowerShell**
```powershell
# Ouvrir PowerShell en tant qu'administrateur
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Lancer l'installation
.\setup-server-windows.ps1
```

**Fonctionnalités Windows :**
- ✅ Vérification des prérequis Windows
- ✅ Installation et compilation automatique
- ✅ Configuration interactive
- ✅ Crée un fichier `start-server.bat` pour démarrage facile
- ✅ Option service Windows (avec node-windows)
- ✅ Configuration IIS optionnelle
- ✅ Génération de clé API automatique

### 3. 🐳 **Installation Docker (Recommandée pour production)**
```bash
# Rendre le script exécutable
chmod +x docker-setup.sh

# Lancer l'installation Docker complète
./docker-setup.sh
```

**Avantages Docker :**
- ✅ Installation isolée et reproductible
- ✅ Redis intégré automatiquement
- ✅ Nginx reverse proxy inclus
- ✅ Whisper préinstallé avec modèle
- ✅ Redémarrage automatique
- ✅ Logs centralisés
- ✅ Scalabilité facilitée

## 🛠️ Comparaison des méthodes

| Fonctionnalité | Linux/macOS | Windows | Docker |
|---|---|---|---|
| **Facilité d'installation** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Configuration automatique** | ✅ | ✅ | ✅ |
| **Redis intégré** | ⚠️ Manuel | ⚠️ Manuel | ✅ |
| **Whisper automatique** | ⚠️ Si cmake | ❌ | ✅ |
| **Service système** | ✅ | ✅ | ✅ |
| **Reverse proxy** | ⚠️ Si nginx | ⚠️ Manuel | ✅ |
| **Isolation** | ❌ | ❌ | ✅ |
| **Portabilité** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## 📝 Configuration requise

Tous les scripts demandent interactivement :

### 🔑 **Credentials 3CX**
```
URL du serveur 3CX: http://192.168.1.100:5000
3CX Client ID: votre-client-id
3CX Client Secret: votre-client-secret
```

### 🥷 **Credentials NinjaOne**
```
NinjaOne Client ID: votre-ninja-client-id
NinjaOne Client Secret: votre-ninja-client-secret
NinjaOne Refresh Token: votre-refresh-token
```

### 🔐 **Sécurité**
- La clé API est générée automatiquement
- Fichier `.env` créé avec toutes les variables
- Configuration sauvegardée de manière sécurisée

## 🎯 Après l'installation

### **Accès aux interfaces**
- **Dashboard principal** : http://localhost:3000
- **Dashboard TV** : http://localhost:3000/tv
- **API Health** : http://localhost:3000/health

### **Configuration 3CX Webhook**
Dans l'interface 3CX :
1. Paramètres système → Webhooks
2. URL : `http://votre-serveur:3000/webhook/3cx`
3. Sélectionner les événements d'appel

### **Démarrage/Arrêt**

#### Linux/macOS
```bash
# Avec systemd (si installé)
sudo systemctl start 3cx-ninja-realtime
sudo systemctl stop 3cx-ninja-realtime
sudo systemctl status 3cx-ninja-realtime

# Manuel
cd server && npm start
```

#### Windows
```powershell
# Avec le raccourci
start-server.bat

# Ou service Windows (si installé)
net start "3CX-Ninja Realtime"
net stop "3CX-Ninja Realtime"
```

#### Docker
```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Logs
docker-compose logs -f

# Redémarrer
docker-compose restart
```

## 🔍 Vérification

### **Test de fonctionnement**
```bash
# Vérifier l'API
curl http://localhost:3000/health

# Vérifier les logs
tail -f server/logs/app.log  # Linux/macOS
# ou check Docker logs: docker-compose logs -f server
```

### **Dépannage**
- ❌ **Erreur 502** : Serveur non démarré
- ❌ **Redis error** : Redis désactivé par défaut (normal)
- ❌ **Whisper error** : Fonctionne en mode simulé
- ❌ **Port occupé** : Changer le port dans `.env`

## 📈 Monitoring

### **Logs disponibles**
- Application : `server/logs/app.log`
- Erreurs : `server/logs/error.log`
- Système : `journalctl -u 3cx-ninja-realtime` (Linux)
- Docker : `docker-compose logs -f`

### **Métriques**
- CPU/RAM : Dashboard → System Health
- Appels actifs : Dashboard principal
- Transcriptions : Dashboard TV
- Tickets : File d'attente

## 🔧 Maintenance

### **Mise à jour**
```bash
# Arrêter le service
# Récupérer les dernières modifications
git pull
npm install
npm run build

# Redémarrer le service
```

### **Sauvegarde**
```bash
# Sauvegarder la configuration
cp server/.env server/.env.backup
cp server/config/default.json server/config/default.json.backup

# Sauvegarder les données
tar -czf backup-$(date +%Y%m%d).tar.gz server/data/
```

## 🎉 Résultat final

Après l'installation, vous obtenez :
- ✅ Serveur 3CX-Ninja opérationnel
- ✅ Dashboard temps réel fonctionnel
- ✅ Dashboard TV optimisé
- ✅ Transcription automatique (simulée ou réelle)
- ✅ Création automatique de tickets
- ✅ Intégration 3CX complète
- ✅ Interface d'administration
- ✅ Monitoring et logs
- ✅ Configuration sécurisée
- ✅ Démarrage automatique

**Le système est prêt pour la production !** 🚀