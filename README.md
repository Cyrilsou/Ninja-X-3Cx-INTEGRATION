# 3CX-NinjaOne Realtime System

Solution complète et réorganisée pour l'intégration temps réel entre 3CX et NinjaOne avec transcription locale et analyse automatique.

## 🏗️ Architecture

```
3cx-ninja-realtime/
├── server/          # Serveur central avec transcription locale
├── agent/           # Application agent avec UI temps réel
├── dashboard/       # Dashboard TV pour monitoring
└── shared/          # Types et utilitaires partagés
```

## 🚀 Fonctionnalités

### Serveur Central
- **Transcription locale** avec Whisper (pas de cloud)
- **Analyse automatique** des appels (sentiment, catégorie, actions)
- **WebSocket temps réel** pour tous les clients
- **Queue de traitement** pour gérer plusieurs agents
- **Base de données locale** SQLite pour l'historique

### Agent Local
- **Interface Electron** moderne et réactive
- **Capture audio automatique** depuis 3CX
- **Transcription en temps réel** affichée pendant l'appel
- **Création automatique de tickets** avec compte à rebours
- **Popup intelligent** avec analyse et suggestions

### Dashboard TV
- **Vue d'ensemble temps réel** de tous les appels
- **Statut des agents** en direct
- **Transcriptions live** pour supervision
- **Métriques et statistiques** visuelles
- **Optimisé pour grands écrans**

## 📦 Installation

### 1. Prérequis
- Node.js 18+
- Python 3.8+ (pour Whisper)
- Redis (optionnel, pour scaling)
- FFmpeg

### 2. Installation globale

```bash
# Cloner le projet
git clone [repo-url]
cd 3cx-ninja-realtime

# Installer les dépendances
npm install

# Télécharger le modèle Whisper
npm run install:whisper
```

### 3. Configuration

#### Serveur (`server/config/default.json`)
```json
{
  "server": {
    "port": 3000
  },
  "whisper": {
    "model": "base",      // tiny, base, small, medium, large
    "language": "fr"
  },
  "ninja": {
    "apiUrl": "https://app.ninjarmm.com/api/v2",
    "boardId": 5
  }
}
```

#### Variables d'environnement (`server/.env`)
```env
# NinjaOne API
NINJA_CLIENT_ID=your-client-id
NINJA_CLIENT_SECRET=your-client-secret
NINJA_REFRESH_TOKEN=your-refresh-token

# Security
API_KEY=your-secure-api-key
```

## 🖥️ Utilisation

### Démarrage du serveur

```bash
cd server
npm run build
npm start
```

### Lancement de l'agent

```bash
cd agent
npm run build
npm start

# Ou créer l'installateur
npm run package
```

### Dashboard TV

```bash
cd dashboard
npm run build
npm run preview

# Ouvrir http://localhost:4173 en plein écran
```

## 🔄 Flux de travail

1. **Appel entrant** → L'agent local détecte via 3CX
2. **Capture audio** → Streaming vers le serveur
3. **Transcription temps réel** → Affichage immédiat côté agent
4. **Fin d'appel** → Analyse automatique
5. **Ticket suggéré** → Popup avec compte à rebours
6. **Validation agent** → Création dans NinjaOne

## 🎯 Particularités

### Transcription 100% locale
- Aucune donnée envoyée vers le cloud
- Modèles Whisper optimisés (CPU ou GPU)
- Support multilingue

### Interface agent automatique
- Popup intelligent après chaque appel
- Compte à rebours configurable (défaut: 15s)
- Édition possible avant envoi
- Actions suggérées cliquables

### Dashboard temps réel
- Vue unifiée serveur + TV
- WebSocket pour latence minimale
- Adaptatif selon la taille d'écran

## 🛠️ Développement

```bash
# Mode développement (tous les modules)
npm run dev

# Tests
npm test

# Linting
npm run lint
```

## 📊 Performance

- **Latence transcription**: 1-3 secondes
- **Charge serveur**: ~25% CPU par appel actif (modèle base)
- **RAM**: 2GB minimum, 4GB recommandé
- **Concurrent calls**: 4-8 selon hardware

## 🔒 Sécurité

- API Key pour toutes les communications
- Données stockées localement
- Chiffrement TLS disponible
- Nettoyage automatique des fichiers audio

## 📝 Logs et Monitoring

Les logs sont disponibles dans:
- Serveur: `server/logs/`
- Agent: `%APPDATA%/3cx-ninja-agent/logs/` (Windows)
- Dashboard: Console navigateur

## 🚨 Dépannage

### Erreur Whisper
```bash
# Vérifier l'installation
cd server
npm run setup:whisper

# Tester manuellement
./models/whisper/main -m models/whisper/ggml-base.bin -f test.wav
```

### Agent ne détecte pas les appels
- Vérifier l'URL du PBX 3CX
- Confirmer l'extension dans la config
- Tester avec: `curl http://3cx-server/api/SystemStatus`

### Dashboard ne se connecte pas
- Vérifier l'API Key
- Confirmer les CORS origins
- Tester: `http://server:3000/health`