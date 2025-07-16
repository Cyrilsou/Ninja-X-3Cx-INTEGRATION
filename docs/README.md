# 3CX-Ninja Realtime - Documentation complète

## 🚀 Vue d'ensemble

3CX-Ninja Realtime est une solution complète d'intégration temps réel entre 3CX (système téléphonique) et NinjaOne (plateforme RMM/PSA) avec transcription locale des appels et création automatique de tickets.

### Fonctionnalités principales

- **Transcription en temps réel** des appels avec Whisper (100% local)
- **Création automatique de tickets** NinjaOne post-appel
- **Dashboard en temps réel** pour monitoring
- **Interface d'administration** complète
- **Agents desktop** multi-plateformes
- **Gestion hors ligne** et synchronisation automatique
- **Webhooks 3CX** pour notifications temps réel

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Installation du serveur](#installation-du-serveur)
3. [Configuration 3CX](#configuration-3cx)
4. [Configuration NinjaOne](#configuration-ninjaone)
5. [Déploiement des agents](#déploiement-des-agents)
6. [Interface d'administration](#interface-dadministration)
7. [Utilisation quotidienne](#utilisation-quotidienne)
8. [Maintenance et monitoring](#maintenance-et-monitoring)
9. [Dépannage](#dépannage)
10. [FAQ](#faq)

---

## 📦 Prérequis

### Serveur Ubuntu (recommandé)
- **OS** : Ubuntu 20.04+ LTS
- **RAM** : 8GB minimum (16GB recommandé)
- **CPU** : 4 cores minimum
- **Stockage** : 100GB minimum (SSD recommandé)
- **Réseau** : Connexion Internet stable

### Logiciels requis
- **Node.js** 18+
- **Redis** (optionnel mais recommandé)
- **Nginx** (reverse proxy)
- **PM2** (gestion des processus)
- **FFmpeg** (traitement audio)

### Accès requis
- **3CX** : Accès administrateur pour configuration webhooks
- **NinjaOne** : Accès API avec tokens OAuth2
- **Postes agents** : Accès réseau au serveur

---

## 🖥️ Installation du serveur

### Option 1 : Installation automatique (recommandée)

```bash
# Télécharger et exécuter le script d'installation
wget https://raw.githubusercontent.com/your-org/3cx-ninja-realtime/main/setup-ubuntu-server.sh
chmod +x setup-ubuntu-server.sh
sudo ./setup-ubuntu-server.sh
```

Le script configure automatiquement :
- ✅ Tous les prérequis système
- ✅ Utilisateur système sécurisé
- ✅ Base de données SQLite
- ✅ Redis pour le cache
- ✅ Nginx avec SSL
- ✅ Firewall UFW
- ✅ Service systemd
- ✅ Monitoring Netdata

### Option 2 : Installation manuelle

#### 1. Prérequis système

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
sudo apt install -y curl wget git build-essential python3 python3-pip \
    ffmpeg redis-server nginx certbot python3-certbot-nginx ufw \
    htop net-tools jq

# Installation Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installation PM2
sudo npm install -g pm2
```

#### 2. Clonage et installation

```bash
# Créer l'utilisateur système
sudo useradd --system --shell /bin/bash --home /home/3cx-ninja --create-home 3cx-ninja

# Cloner le projet
sudo git clone https://github.com/your-org/3cx-ninja-realtime.git /opt/3cx-ninja-realtime
cd /opt/3cx-ninja-realtime

# Installer les dépendances
sudo npm install

# Compiler le projet
sudo npm run build

# Installer Whisper
sudo npm run setup:whisper --workspace=server
```

#### 3. Configuration

```bash
# Copier et configurer l'environnement
sudo cp .env.example .env
sudo nano .env
```

Configurer les variables :
```env
# Serveur
NODE_ENV=production
PORT=3000
API_KEY=your-secure-api-key-here

# 3CX
PBX_URL=https://your-3cx-server.com
CX_CLIENT_ID=your-3cx-client-id
CX_CLIENT_SECRET=your-3cx-client-secret

# NinjaOne
NINJA_CLIENT_ID=your-ninja-client-id
NINJA_CLIENT_SECRET=your-ninja-client-secret
NINJA_REFRESH_TOKEN=your-ninja-refresh-token
```

#### 4. Service systemd

```bash
# Créer le service
sudo cp scripts/3cx-ninja.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable 3cx-ninja
sudo systemctl start 3cx-ninja
```

#### 5. Nginx et SSL

```bash
# Configurer Nginx
sudo cp scripts/nginx.conf /etc/nginx/sites-available/3cx-ninja
sudo ln -sf /etc/nginx/sites-available/3cx-ninja /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL avec Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### Option 3 : Installation Docker

```bash
# Cloner le projet
git clone https://github.com/your-org/3cx-ninja-realtime.git
cd 3cx-ninja-realtime

# Configurer l'environnement
cp .env.example .env
nano .env

# Démarrer avec Docker
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

---

## 📞 Configuration 3CX

### 1. Création du client OAuth2

1. **Connectez-vous** à l'interface d'administration 3CX
2. **Allez dans** `Paramètres` → `Intégrations` → `OAuth2`
3. **Créez** un nouveau client :
   - **Nom** : `3CX-Ninja Integration`
   - **Redirect URI** : `https://your-server.com/auth/callback`
   - **Scopes** : `calls`, `recordings`
4. **Notez** le `Client ID` et `Client Secret`

### 2. Configuration des webhooks

1. **Allez dans** `Paramètres` → `CRM` → `Générique HTTP`
2. **Créez** un nouveau template :
   - **Nom** : `3CX-Ninja Webhook`
   - **URL** : `https://your-server.com/webhook/3cx/call-event`
   - **Méthode** : `POST`
   - **Content-Type** : `application/json`

3. **Template JSON** :
```json
{
  "callId": "[CallID]",
  "caller": "[CallerNumber]",
  "callee": "[CalledNumber]",
  "agentExt": "[AgentNumber]",
  "agentMail": "[AgentEmail]",
  "direction": "[CallDirection]",
  "duration": "[Duration]",
  "wav": "[RecordingURL]",
  "endUtc": "[CallEndTimeUTC]",
  "startTime": "[CallStartTimeUTC]"
}
```

4. **Déclencheurs** :
   - ✅ `Appel établi` (Call Established)
   - ✅ `Appel terminé` (Call Released)

### 3. Test de la configuration

```bash
# Depuis votre serveur, testez le webhook
curl -X POST https://your-server.com/webhook/3cx/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 🥷 Configuration NinjaOne

### 1. Création de l'application OAuth2

1. **Connectez-vous** à NinjaOne
2. **Allez dans** `Administration` → `Apps` → `API`
3. **Créez** une nouvelle application :
   - **Nom** : `3CX-Ninja Integration`
   - **Type** : `Server Application`
   - **Redirect URI** : `https://your-server.com/auth/ninja/callback`

4. **Scopes requis** :
   - `ticketing:read`
   - `ticketing:write`
   - `contacts:read`
   - `users:read`

### 2. Génération du refresh token

```bash
# Utilisez le script fourni
cd /opt/3cx-ninja-realtime
node scripts/generate-ninja-token.js
```

Suivez le processus d'autorisation et copiez le refresh token.

### 3. Configuration des boards

1. **Identifiez** l'ID du board de destination
2. **Configurez** dans `.env` :
```env
NINJA_BOARD_ID=5
NINJA_STATUS_NEW=1
NINJA_PRIORITY_NORMAL=2
```

### 4. Test de la configuration

```bash
# Test de l'API NinjaOne
curl -X GET https://your-server.com/api/admin/ninja/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 💻 Déploiement des agents

### Installation automatique

#### Windows
```powershell
# Exécuter en tant qu'administrateur
powershell -c "irm https://your-server.com/install-agent.ps1 | iex" `
  -ServerUrl "https://your-server.com" `
  -ApiKey "YOUR_API_KEY"
```

#### Linux/Mac
```bash
curl -sSL https://your-server.com/install-agent.sh | bash -s -- \
  --server https://your-server.com \
  --key YOUR_API_KEY
```

### Installation manuelle

#### 1. Téléchargement

Accédez à `https://your-server.com/admin` → `Téléchargement agent`

Téléchargez la version correspondante :
- **Windows** : `3cx-ninja-agent-setup.exe`
- **macOS** : `3cx-ninja-agent.dmg`
- **Linux** : `3cx-ninja-agent.AppImage`

#### 2. Installation

**Windows :**
1. Exécutez l'installateur
2. Suivez l'assistant d'installation
3. Configurez au premier démarrage

**macOS :**
1. Montez le DMG
2. Glissez l'application dans Applications
3. Accordez les permissions micro

**Linux :**
1. Rendez le fichier exécutable : `chmod +x 3cx-ninja-agent.AppImage`
2. Exécutez : `./3cx-ninja-agent.AppImage`

#### 3. Configuration de l'agent

Au premier démarrage, configurez :
- **URL serveur** : `https://your-server.com`
- **Clé API** : `YOUR_API_KEY`
- **Email agent** : Email de l'agent 3CX
- **Extension** : Extension téléphonique
- **Nom** : Nom d'affichage

### Déploiement en masse

#### Via GPO (Windows)

1. **Créez** un script de déploiement :
```batch
@echo off
powershell -ExecutionPolicy Bypass -File "\\server\share\install-agent.ps1" ^
  -ServerUrl "https://your-server.com" ^
  -ApiKey "YOUR_API_KEY" ^
  -Silent
```

2. **Déployez** via GPO `Computer Configuration` → `Scripts`

#### Via script réseau

```bash
# Pour plusieurs machines
#!/bin/bash
SERVERS=("agent1.local" "agent2.local" "agent3.local")
for server in "${SERVERS[@]}"; do
  ssh user@$server "curl -sSL https://your-server.com/install-agent.sh | bash -s -- --server https://your-server.com --key YOUR_API_KEY"
done
```

---

## 🎛️ Interface d'administration

### Accès au dashboard

1. **Ouvrez** votre navigateur
2. **Allez à** `https://your-server.com/admin`
3. **Connectez-vous** avec :
   - **Email** : `admin@3cx-ninja.local`
   - **Mot de passe** : `admin123` (changez-le !)

### Sections principales

#### 1. Vue d'ensemble
- **Métriques système** : CPU, RAM, connexions
- **Statut des services** : Redis, Whisper, Queue
- **Graphiques temps réel** : Performance réseau
- **Alertes système** : Problèmes détectés

#### 2. Gestion des agents
- **Liste des agents** connectés
- **Statut en temps réel** : En ligne/Occupé/Hors ligne
- **Ajout/modification** d'agents
- **Statistiques** par agent

#### 3. Configuration système
- **Paramètres serveur** : Port, domaine, SSL
- **Configuration Redis** : Cache et performance
- **Paramètres Whisper** : Modèle, langue
- **Intégrations** : 3CX et NinjaOne

#### 4. Webhooks 3CX
- **URL de configuration** : Template à copier
- **Test des webhooks** : Validation en direct
- **Historique** des événements
- **Diagnostic** de connexion

#### 5. Téléchargement agent
- **Liens de téléchargement** : Toutes plateformes
- **Configuration automatique** : Scripts d'installation
- **Déploiement en masse** : GPO et scripts

#### 6. Sécurité
- **Gestion des clés API** : Génération et rotation
- **Certificats SSL** : Renouvellement automatique
- **Logs d'audit** : Accès et modifications
- **Firewall** : Règles et exceptions

#### 7. Monitoring
- **Logs en temps réel** : Filtrage par niveau
- **Métriques détaillées** : Graphiques avancés
- **Alertes** : Configuration des notifications
- **Santé système** : Indicateurs de performance

---

## 📱 Utilisation quotidienne

### Pour les agents

#### 1. Démarrage de l'agent
L'agent démarre automatiquement avec Windows/macOS/Linux et se connecte au serveur.

#### 2. Interface principale
- **Statut de connexion** : Indicateur en temps réel
- **Appels en cours** : Transcription live
- **Historique** : Derniers appels traités
- **Paramètres** : Configuration locale

#### 3. Gestion des appels

**Appel entrant/sortant :**
1. L'agent **détecte automatiquement** l'appel
2. **Transcription en temps réel** s'affiche
3. **Création automatique** du ticket post-appel
4. **Popup de confirmation** avec possibilité d'éditer

**Édition du ticket :**
1. **Pause** le compte à rebours (10s)
2. **Modifiez** le titre et la description
3. **Validez** ou laissez créer automatiquement

#### 4. Mode hors ligne
- **Sauvegarde automatique** des appels
- **Synchronisation** au retour de connexion
- **Indicateur visuel** du statut offline

### Pour les administrateurs

#### 1. Monitoring quotidien
- **Vérifier** le dashboard principal
- **Contrôler** les agents connectés
- **Surveiller** les métriques système

#### 2. Gestion des incidents
- **Diagnostic** automatique des problèmes
- **Redémarrage** des services si nécessaire
- **Vérification** des logs d'erreur

#### 3. Maintenance
- **Mise à jour** des agents
- **Nettoyage** des fichiers temporaires
- **Sauvegarde** de la configuration

---

## 🔧 Maintenance et monitoring

### Maintenance automatique

#### Nettoyage automatique
```bash
# Configuré automatiquement
- Fichiers audio > 24h
- Logs > 30 jours
- Cache Redis > 7 jours
- Transcriptions > 90 jours
```

#### Mises à jour
```bash
# Mise à jour du serveur
cd /opt/3cx-ninja-realtime
sudo -u 3cx-ninja git pull
sudo -u 3cx-ninja npm run build
sudo systemctl restart 3cx-ninja

# Mise à jour des agents (automatique)
Les agents se mettent à jour automatiquement
```

### Monitoring avec Netdata

#### Installation
```bash
# Installé automatiquement avec le script
# Accès : https://your-server.com:19999
```

#### Métriques surveillées
- **CPU et RAM** : Utilisation serveur
- **Réseau** : Bande passante et latence
- **Disque** : Espace et I/O
- **Services** : 3CX-Ninja, Redis, Nginx

### Sauvegarde

#### Sauvegarde automatique
```bash
# Script de sauvegarde quotidienne
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/3cx-ninja/$DATE"

mkdir -p $BACKUP_DIR
cp -r /opt/3cx-ninja-realtime/.env $BACKUP_DIR/
cp -r /var/lib/3cx-ninja/database.sqlite $BACKUP_DIR/
tar -czf $BACKUP_DIR/config.tar.gz /opt/3cx-ninja-realtime/server/config/
```

#### Restauration
```bash
# Restaurer depuis sauvegarde
DATE="20250716"
BACKUP_DIR="/backup/3cx-ninja/$DATE"

sudo systemctl stop 3cx-ninja
sudo cp $BACKUP_DIR/.env /opt/3cx-ninja-realtime/
sudo cp $BACKUP_DIR/database.sqlite /var/lib/3cx-ninja/
sudo systemctl start 3cx-ninja
```

---

## 🚨 Dépannage

### Problèmes fréquents

#### 1. Serveur ne démarre pas

**Symptômes :**
- Service systemd en erreur
- Port 3000 non accessible

**Solutions :**
```bash
# Vérifier les logs
sudo journalctl -u 3cx-ninja -f

# Vérifier les ports
sudo netstat -tulpn | grep :3000

# Redémarrer les services
sudo systemctl restart redis
sudo systemctl restart 3cx-ninja
```

#### 2. Agents ne se connectent pas

**Symptômes :**
- Agent affiché "Hors ligne"
- Erreur d'authentification

**Solutions :**
```bash
# Vérifier l'API Key
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-server.com/api/health

# Vérifier le firewall
sudo ufw status
sudo ufw allow 3000/tcp

# Tester la connectivité
curl -v https://your-server.com/health
```

#### 3. Webhooks 3CX ne fonctionnent pas

**Symptômes :**
- Pas d'événements d'appel
- Erreurs 404/500 dans 3CX

**Solutions :**
```bash
# Tester l'endpoint
curl -X POST https://your-server.com/webhook/3cx/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier la configuration 3CX
- URL correcte
- Certificat SSL valide
- Template JSON correct
```

#### 4. Transcription ne fonctionne pas

**Symptômes :**
- Pas de transcription générée
- Erreurs Whisper

**Solutions :**
```bash
# Vérifier Whisper
python3 -c "import whisper; print('OK')"

# Vérifier FFmpeg
ffmpeg -version

# Réinstaller Whisper
cd /opt/3cx-ninja-realtime
sudo npm run setup:whisper --workspace=server
```

#### 5. Tickets NinjaOne non créés

**Symptômes :**
- Pas de tickets générés
- Erreurs OAuth2

**Solutions :**
```bash
# Tester l'API NinjaOne
curl -X GET https://your-server.com/api/admin/ninja/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Vérifier les tokens
- Refresh token valide
- Scopes corrects
- Client ID/Secret corrects
```

### Diagnostic automatique

#### Depuis l'agent
1. **Ouvrez** l'agent
2. **Cliquez** sur l'icône d'outils
3. **Lancez** le diagnostic complet
4. **Suivez** les recommandations

#### Depuis le serveur
```bash
# Script de diagnostic
cd /opt/3cx-ninja-realtime
node scripts/diagnostic.js
```

#### Logs détaillés
```bash
# Logs du serveur
sudo journalctl -u 3cx-ninja -f

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs Redis
sudo tail -f /var/log/redis/redis-server.log
```

---

## ❓ FAQ

### Questions générales

**Q : Combien d'agents peuvent être connectés simultanément ?**
R : Pas de limite théorique. Testé avec 50+ agents. Dépend des ressources serveur.

**Q : La transcription fonctionne-t-elle en français ?**
R : Oui, configuré pour le français par défaut. Multilingue supporté.

**Q : Peut-on installer sans Docker ?**
R : Oui, installation native recommandée pour les performances.

### Questions techniques

**Q : Whisper utilise-t-il des services cloud ?**
R : Non, transcription 100% locale pour la confidentialité.

**Q : Comment sauvegarder la configuration ?**
R : Fichier `.env` et base SQLite dans `/var/lib/3cx-ninja/`.

**Q : Peut-on utiliser une base PostgreSQL ?**
R : Oui, configurez `DATABASE_URL` dans `.env`.

### Questions sécurité

**Q : Les enregistrements sont-ils stockés ?**
R : Non, seules les transcriptions sont conservées. Enregistrements supprimés après traitement.

**Q : Comment changer les mots de passe admin ?**
R : Via l'interface admin ou variables d'environnement.

**Q : Le trafic est-il chiffré ?**
R : Oui, HTTPS obligatoire et WebSocket sécurisé.

### Performances

**Q : Ressources serveur recommandées ?**
R : 8GB RAM, 4 CPU cores pour 20 agents. Scalable selon usage.

**Q : Latence de transcription ?**
R : 2-5 secondes selon longueur audio et modèle Whisper.

**Q : Impact sur 3CX ?**
R : Minimal, webhooks légers sans impact performance.

---

## 📞 Support

### Documentation
- **Wiki** : https://github.com/your-org/3cx-ninja-realtime/wiki
- **Issues** : https://github.com/your-org/3cx-ninja-realtime/issues
- **Discussions** : https://github.com/your-org/3cx-ninja-realtime/discussions

### Contact
- **Email** : support@3cx-ninja.com
- **Discord** : https://discord.gg/3cx-ninja
- **Support** : https://support.3cx-ninja.com

---

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 🎯 Roadmap

### Version 2.1
- [ ] Interface web pour agents
- [ ] Intégration Teams/Slack
- [ ] Analytics avancées
- [ ] Multi-tenant

### Version 2.2
- [ ] IA conversationnelle
- [ ] Intégrations CRM tierces
- [ ] API REST publique
- [ ] Mobile apps

---

**Dernière mise à jour : 16 juillet 2025**  
**Version : 2.0.0**