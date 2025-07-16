# Guide d'installation simplifié - 3CX-Ninja Realtime

## Prérequis

- **Serveur local** : PC Windows/Linux avec 8GB RAM minimum
- **Node.js 18+** : [Télécharger](https://nodejs.org/)
- **Redis** : [Télécharger](https://redis.io/download/) (optionnel mais recommandé)
- **3CX PBX** : Accès admin pour configurer les webhooks
- **NinjaOne** : Accès API avec OAuth2

## Installation en 5 étapes

### 1. Cloner et installer

```bash
# Cloner le projet
git clone https://github.com/your-org/3cx-ninja-realtime.git
cd 3cx-ninja-realtime

# Installer les dépendances
npm install

# Installer Whisper pour la transcription locale
npm run setup:whisper --workspace=server
```

### 2. Configuration simple

Copier le fichier `.env.example` en `.env` et remplir :

```env
# === MINIMUM REQUIS ===
NODE_ENV=production
API_KEY=votre-cle-api-securisee

# 3CX
PBX_URL=https://votre-serveur-3cx.com
CX_CLIENT_ID=votre-client-id
CX_CLIENT_SECRET=votre-client-secret

# NinjaOne
NINJA_CLIENT_ID=votre-ninja-client-id
NINJA_CLIENT_SECRET=votre-ninja-client-secret
NINJA_REFRESH_TOKEN=votre-refresh-token
```

### 3. Configurer les webhooks 3CX

Dans l'interface admin 3CX :

1. **Intégration** > **CRM** > **Ajouter HTTP Generic**
2. **URL** : `http://votre-serveur:3000/webhook/3cx/call-event`
3. **Méthode** : POST
4. **Content-Type** : application/json
5. **Body** :
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
  "endUtc": "[CallEndTimeUTC]"
}
```

### 4. Démarrer le serveur

```bash
# Build le projet
npm run build

# Démarrer en production
npm run start:prod

# Ou en développement
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### 5. Installer l'agent sur les postes

Sur chaque poste agent :

```bash
# Dans le dossier agent
cd agent
npm run build
npm run dist

# Installer le .exe généré
```

Ou télécharger depuis : `http://votre-serveur:3000/download/agent`

## Configuration agent

Au premier lancement, l'agent demande :

- **URL serveur** : `http://votre-serveur:3000`
- **API Key** : La même que dans .env
- **Email agent** : Email de l'agent 3CX

## Test rapide

1. **Vérifier le serveur** :
```bash
curl http://localhost:3000/health
```

2. **Tester les webhooks** :
```bash
curl -X POST http://localhost:3000/webhook/3cx/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

3. **Accéder au dashboard** :
Ouvrir `http://localhost:3000` dans un navigateur

## Dépannage

### Le serveur ne démarre pas
- Vérifier les ports 3000 et 6379 (Redis)
- Vérifier les logs : `tail -f logs/server.log`

### Les webhooks ne fonctionnent pas
- Vérifier le firewall (port 3000 ouvert)
- Tester avec l'endpoint `/webhook/3cx/health`
- Vérifier les logs 3CX

### L'agent ne se connecte pas
- Vérifier l'API Key
- Ping le serveur depuis le poste agent
- Vérifier l'antivirus/firewall

### La transcription ne fonctionne pas
- Vérifier l'installation de Whisper : `npm run setup:whisper`
- Vérifier la RAM disponible (4GB minimum pour Whisper)
- Essayer un modèle plus petit : `WHISPER_MODEL=tiny`

## Mode production

Pour un déploiement en production :

1. **Utiliser PM2** :
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

2. **Activer Redis** pour les performances
3. **Configurer HTTPS** avec un reverse proxy (nginx)
4. **Sauvegardes** : La DB SQLite est dans `./data/database.sqlite`

## Support

- **Logs** : `./logs/`
- **Documentation complète** : `./docs/`
- **Issues** : GitHub Issues