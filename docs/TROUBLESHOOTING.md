# 🔧 Guide de dépannage - 3CX-Ninja Realtime

## 🎯 Diagnostic rapide

### Commande de diagnostic général

```bash
# Script de diagnostic automatique
cd /opt/3cx-ninja-realtime
./scripts/diagnostic.sh
```

### Vérification de l'état global

```bash
# Statut des services
sudo systemctl status 3cx-ninja redis nginx

# Santé générale
curl https://localhost:3000/health
```

---

## 🖥️ Problèmes serveur

### 1. Le serveur ne démarre pas

#### Symptômes
- Service `3cx-ninja` en erreur
- Port 3000 inaccessible
- Erreur au démarrage

#### Diagnostic
```bash
# Vérifier les logs
sudo journalctl -u 3cx-ninja -f

# Vérifier les ports
sudo netstat -tulpn | grep :3000
sudo lsof -i :3000

# Vérifier les permissions
sudo ls -la /opt/3cx-ninja-realtime/
sudo ls -la /var/lib/3cx-ninja/
```

#### Solutions
```bash
# 1. Redémarrer les services dépendants
sudo systemctl restart redis
sudo systemctl restart nginx

# 2. Vérifier la configuration
sudo -u 3cx-ninja node -e "console.log(require('./server/config/default.json'))"

# 3. Réinstaller les dépendances
cd /opt/3cx-ninja-realtime
sudo -u 3cx-ninja npm install
sudo -u 3cx-ninja npm run build

# 4. Redémarrer le service
sudo systemctl restart 3cx-ninja
```

### 2. Erreurs de permissions

#### Symptômes
- `EACCES` dans les logs
- Impossible d'écrire les fichiers

#### Solutions
```bash
# Corriger les permissions
sudo chown -R 3cx-ninja:3cx-ninja /opt/3cx-ninja-realtime/
sudo chown -R 3cx-ninja:3cx-ninja /var/lib/3cx-ninja/
sudo chown -R 3cx-ninja:3cx-ninja /var/log/3cx-ninja/

# Permissions des dossiers
sudo chmod 755 /opt/3cx-ninja-realtime/
sudo chmod 755 /var/lib/3cx-ninja/
sudo chmod 755 /var/log/3cx-ninja/

# Permissions des fichiers
sudo chmod 644 /opt/3cx-ninja-realtime/.env
sudo chmod 600 /opt/3cx-ninja-realtime/.env  # Sécurité
```

### 3. Problèmes de mémoire

#### Symptômes
- Serveur qui plante
- `Out of memory` dans les logs
- Performance dégradée

#### Diagnostic
```bash
# Utilisation mémoire
free -h
ps aux | grep node
top -p $(pgrep -f "3cx-ninja")

# Logs mémoire
dmesg | grep -i "killed process"
```

#### Solutions
```bash
# 1. Augmenter la mémoire Node.js
sudo systemctl edit 3cx-ninja
```

Ajouter :
```ini
[Service]
Environment=NODE_OPTIONS="--max-old-space-size=4096"
```

```bash
# 2. Nettoyer le cache
sudo -u 3cx-ninja npm cache clean --force
redis-cli FLUSHDB

# 3. Redémarrer
sudo systemctl daemon-reload
sudo systemctl restart 3cx-ninja
```

---

## 📞 Problèmes 3CX

### 1. Webhooks ne fonctionnent pas

#### Symptômes
- Pas d'événements d'appel dans le dashboard
- Erreurs HTTP dans les logs 3CX

#### Diagnostic
```bash
# Test direct du webhook
curl -X POST https://votre-serveur.com/webhook/3cx/call-event \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "TEST-123",
    "caller": "+33123456789",
    "callee": "+33987654321",
    "agentExt": "201",
    "agentMail": "agent@company.com",
    "direction": "Inbound",
    "duration": "00:02:30",
    "endUtc": "2025-07-16T14:30:00Z"
  }'

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Vérifier les logs du serveur
sudo journalctl -u 3cx-ninja -f | grep webhook
```

#### Solutions courantes

**1. Problème SSL/HTTPS**
```bash
# Vérifier le certificat
curl -I https://votre-serveur.com/webhook/3cx/call-event

# Renouveler SSL si nécessaire
sudo certbot renew
sudo nginx -s reload
```

**2. Problème de firewall**
```bash
# Vérifier UFW
sudo ufw status

# Ouvrir les ports nécessaires
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
```

**3. Configuration 3CX incorrecte**

Vérifiez dans 3CX :
- ✅ URL exacte : `https://votre-serveur.com/webhook/3cx/call-event`
- ✅ Méthode : `POST`
- ✅ Content-Type : `application/json`
- ✅ Template JSON correct
- ✅ Déclencheurs activés

### 2. Variables 3CX manquantes

#### Symptômes
- Données partielles dans les événements
- Champs vides dans les tickets

#### Solutions
```bash
# Template JSON complet pour 3CX
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
  "startTime": "[CallStartTimeUTC]",
  "status": "[CallStatus]"
}
```

Variables alternatives si certaines ne fonctionnent pas :
- `[CallerNumber]` → `[CallerDisplayName]`
- `[AgentEmail]` → `[AgentLogin]`
- `[RecordingURL]` → Vérifier l'activation des enregistrements

---

## 🥷 Problèmes NinjaOne

### 1. Authentification OAuth2 échoue

#### Symptômes
- Erreur `401 Unauthorized`
- Tokens expirés
- Pas de tickets créés

#### Diagnostic
```bash
# Test API NinjaOne
curl -X GET "https://app.ninjarmm.com/api/v2/ticketing/contacts" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Vérifier les variables d'environnement
sudo cat /opt/3cx-ninja-realtime/.env | grep NINJA
```

#### Solutions
```bash
# 1. Régénérer le refresh token
cd /opt/3cx-ninja-realtime
node scripts/generate-ninja-token.js

# 2. Vérifier les scopes
# Dans NinjaOne, vérifiez que l'application a les scopes :
# - ticketing:read
# - ticketing:write  
# - contacts:read
# - users:read

# 3. Tester l'API
curl -X POST "https://app.ninjarmm.com/ws/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### 2. Tickets non créés

#### Symptômes
- Transcription OK mais pas de ticket
- Erreurs dans les logs

#### Diagnostic
```bash
# Vérifier les logs de création de tickets
sudo journalctl -u 3cx-ninja -f | grep -i ninja

# Test de création manuelle
curl -X POST https://votre-serveur.com/api/tickets \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": 5,
    "title": "Test ticket",
    "description": "Test de création",
    "priorityId": 2,
    "statusId": 1
  }'
```

#### Solutions
```bash
# 1. Vérifier les IDs de board
curl -X GET "https://app.ninjarmm.com/api/v2/ticketing/boards" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 2. Corriger la configuration
sudo nano /opt/3cx-ninja-realtime/.env
```

Ajustez :
```env
NINJA_BOARD_ID=5  # ID correct du board
NINJA_STATUS_ID=1 # ID correct du statut "New"
NINJA_PRIORITY_ID=2 # ID correct de la priorité "Normal"
```

---

## 💻 Problèmes agents

### 1. Agent ne se connecte pas

#### Symptômes
- Agent affiché "Hors ligne"
- Erreur d'authentification
- Connexion impossible

#### Diagnostic depuis l'agent
1. **Ouvrir** l'agent
2. **Cliquer** sur l'icône d'outils 🔧
3. **Lancer** le diagnostic complet

#### Diagnostic depuis le serveur
```bash
# Vérifier la connectivité
curl https://votre-serveur.com/health

# Tester l'API Key
curl -H "Authorization: Bearer sk-your-api-key" \
     https://votre-serveur.com/api/health

# Vérifier les connexions WebSocket
sudo netstat -an | grep :3000
```

#### Solutions
```bash
# 1. Vérifier l'API Key
# Dans l'interface admin → Sécurité → Clés API

# 2. Vérifier le firewall serveur
sudo ufw allow 3000/tcp

# 3. Vérifier le proxy/antivirus sur le poste agent
# Configurer l'exception pour :
# - https://votre-serveur.com
# - WebSocket sur port 3000

# 4. Réinstaller l'agent
curl -sSL https://votre-serveur.com/install-agent.sh | bash -s -- \
  --server https://votre-serveur.com \
  --key sk-your-api-key
```

### 2. Détection d'appels ne fonctionne pas

#### Symptômes
- Appels 3CX non détectés par l'agent
- Pas de transcription

#### Solutions
```bash
# 1. Vérifier l'extension configurée
# Dans l'agent → Paramètres → Extension 3CX

# 2. Vérifier les permissions 3CX
# L'agent doit avoir accès à l'API CallStatus

# 3. Test manuel de l'API 3CX
curl "http://3cx-server:5001/api/CallStatus/201" \
  -u "username:password"

# 4. Vérifier les logs de l'agent
# Windows : %APPDATA%\3cx-ninja-agent\logs\
# macOS : ~/Library/Logs/3cx-ninja-agent/
# Linux : ~/.config/3cx-ninja-agent/logs/
```

### 3. Transcription ne s'affiche pas

#### Symptômes
- Appel détecté mais pas de transcription
- Interface vide pendant l'appel

#### Solutions
```bash
# 1. Vérifier Whisper sur le serveur
sudo systemctl status 3cx-ninja
sudo journalctl -u 3cx-ninja -f | grep -i whisper

# 2. Tester Whisper manuellement
cd /opt/3cx-ninja-realtime
sudo -u 3cx-ninja python3 -c "import whisper; print('Whisper OK')"

# 3. Vérifier FFmpeg
ffmpeg -version

# 4. Réinstaller Whisper
sudo -u 3cx-ninja npm run setup:whisper --workspace=server
```

---

## 🔊 Problèmes audio

### 1. Pas de capture audio

#### Symptômes
- Appel détecté mais pas d'audio capturé
- Erreurs de permissions micro

#### Solutions Windows
```batch
# Vérifier les permissions microphone
# Paramètres → Confidentialité → Microphone
# Autoriser l'agent 3CX-Ninja

# Réinstaller avec permissions admin
powershell -c "irm https://votre-serveur.com/install-agent.ps1 | iex" -AsAdmin
```

#### Solutions macOS
```bash
# Autoriser le microphone
# Préférences → Sécurité → Confidentialité → Microphone
# Cocher 3CX-Ninja Agent

# Réinstaller si nécessaire
curl -sSL https://votre-serveur.com/install-agent.sh | bash
```

### 2. Qualité audio dégradée

#### Symptômes
- Transcription de mauvaise qualité
- Mots manqués ou incorrects

#### Solutions
```bash
# 1. Vérifier la qualité d'enregistrement
# Dans l'agent → Paramètres → Audio
# Augmenter la qualité d'échantillonnage

# 2. Utiliser un meilleur modèle Whisper
sudo nano /opt/3cx-ninja-realtime/.env
```

Changer :
```env
WHISPER_MODEL=base  # → small, medium, ou large
```

```bash
# 3. Redémarrer après changement
sudo systemctl restart 3cx-ninja
```

---

## 📊 Problèmes de performance

### 1. Latence élevée

#### Symptômes
- Transcription très lente
- Interface qui rame

#### Solutions
```bash
# 1. Vérifier les ressources serveur
htop
free -h
df -h

# 2. Optimiser Redis
sudo nano /etc/redis/redis.conf
```

Ajouter :
```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

```bash
# 3. Optimiser Node.js
sudo systemctl edit 3cx-ninja
```

Ajouter :
```ini
[Service]
Environment=NODE_OPTIONS="--max-old-space-size=4096"
Environment=UV_THREADPOOL_SIZE=128
```

### 2. Serveur surchargé

#### Symptômes
- CPU > 90%
- Mémoire saturée
- Timeouts fréquents

#### Solutions
```bash
# 1. Scaling vertical (plus de ressources)
# Augmenter RAM et CPU du serveur

# 2. Scaling horizontal (Redis externe)
sudo nano /opt/3cx-ninja-realtime/.env
```

```env
REDIS_HOST=redis-server.domain.com
REDIS_PORT=6379
REDIS_PASSWORD=secure-password
```

```bash
# 3. Optimiser Whisper
sudo nano /opt/3cx-ninja-realtime/.env
```

```env
WHISPER_MODEL=tiny  # Plus rapide, moins précis
WHISPER_MAX_CONCURRENT=2  # Limiter la concurrence
```

---

## 🚨 Procédures d'urgence

### Redémarrage complet

```bash
# Arrêt ordonné
sudo systemctl stop 3cx-ninja
sudo systemctl stop redis
sudo systemctl stop nginx

# Vérification des processus
sudo pkill -f "3cx-ninja"
sudo pkill -f "node.*3cx"

# Redémarrage
sudo systemctl start redis
sudo systemctl start nginx
sudo systemctl start 3cx-ninja

# Vérification
sudo systemctl status 3cx-ninja redis nginx
```

### Restauration de sauvegarde

```bash
# Arrêter les services
sudo systemctl stop 3cx-ninja

# Restaurer la configuration
sudo cp /backup/3cx-ninja/20250716/.env /opt/3cx-ninja-realtime/
sudo cp /backup/3cx-ninja/20250716/database.sqlite /var/lib/3cx-ninja/

# Restaurer les permissions
sudo chown -R 3cx-ninja:3cx-ninja /opt/3cx-ninja-realtime/
sudo chown -R 3cx-ninja:3cx-ninja /var/lib/3cx-ninja/

# Redémarrer
sudo systemctl start 3cx-ninja
```

### Mode de maintenance

```bash
# Activer la maintenance
echo "maintenance" | sudo tee /opt/3cx-ninja-realtime/MAINTENANCE

# Page de maintenance automatique via Nginx
sudo systemctl reload nginx

# Désactiver la maintenance
sudo rm /opt/3cx-ninja-realtime/MAINTENANCE
sudo systemctl reload nginx
```

---

## 📞 Support et logs

### Collecte de logs pour support

```bash
# Script de collecte automatique
cd /opt/3cx-ninja-realtime
./scripts/collect-logs.sh

# Le fichier de logs sera dans :
# /tmp/3cx-ninja-logs-YYYYMMDD-HHMMSS.tar.gz
```

### Logs détaillés

```bash
# Logs temps réel
sudo journalctl -u 3cx-ninja -f

# Logs avec filtre
sudo journalctl -u 3cx-ninja --since "1 hour ago" | grep -i error

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs Redis
sudo tail -f /var/log/redis/redis-server.log
```

### Contact support

Si les solutions ci-dessus ne résolvent pas votre problème :

1. **Collectez les logs** avec le script
2. **Notez** les étapes qui ont mené au problème
3. **Contactez** le support :
   - 📧 Email : support@3cx-ninja.com
   - 🎫 Ticket : https://support.3cx-ninja.com
   - 💬 Discord : https://discord.gg/3cx-ninja

---

**Dernière mise à jour : 16 juillet 2025**