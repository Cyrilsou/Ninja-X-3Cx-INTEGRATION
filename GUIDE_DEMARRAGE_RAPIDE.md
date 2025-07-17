# Guide de Démarrage Rapide - 3CX-Ninja Realtime

## 🚀 Démarrage en 5 minutes

### 1. Prérequis
- Node.js 18+ installé
- FFmpeg installé (pour le traitement audio)
- Redis (optionnel, désactivé par défaut)

### 2. Installation

```bash
# Cloner le projet
git clone [votre-repo]
cd 3cx-ninja-realtime

# Installer toutes les dépendances
npm install
```

### 3. Configuration minimale

Créer/modifier le fichier `server/.env` :

```env
# Configuration 3CX (OBLIGATOIRE)
THREECX_PBX_URL=http://votre-serveur-3cx:5000
THREECX_CLIENT_ID=votre-client-id
THREECX_CLIENT_SECRET=votre-client-secret

# Configuration NinjaOne (OBLIGATOIRE pour les tickets)
NINJA_CLIENT_ID=votre-ninja-client-id
NINJA_CLIENT_SECRET=votre-ninja-client-secret
NINJA_REFRESH_TOKEN=votre-refresh-token

# Sécurité (changer cette clé!)
API_KEY=votre-cle-api-securisee

# Port du serveur
PORT=3000
```

### 4. Compilation

```bash
# Compiler tous les projets
npm run build
```

### 5. Démarrage du serveur

```bash
# Démarrer le serveur
cd server
npm start
```

Le serveur démarre sur http://localhost:3000

### 6. Accès aux interfaces

- **Dashboard principal** : http://localhost:3000
- **Dashboard TV** : http://localhost:3000/tv
- **API Health** : http://localhost:3000/health

### 7. Installation de l'agent (Windows)

```powershell
# Sur le poste agent
cd agent
npm run build
npm start
```

Ou créer un installateur :
```bash
npm run package
```

## 🔧 Configuration avancée

### Redis (pour la scalabilité)

Si vous avez Redis installé, activez-le dans `server/config/default.json` :

```json
{
  "redis": {
    "enabled": true,
    "url": "redis://localhost:6379"
  }
}
```

### Whisper (transcription locale)

Pour installer le modèle Whisper (nécessite cmake) :

```bash
# Installer cmake d'abord
sudo apt-get install cmake  # Linux
brew install cmake          # macOS

# Puis installer Whisper
cd server
npm run setup:whisper
```

### Configuration 3CX Webhook

Dans l'interface 3CX :
1. Aller dans **Paramètres système** > **Webhooks**
2. Ajouter un nouveau webhook
3. URL : `http://votre-serveur:3000/webhook/3cx`
4. Événements : Sélectionner les événements d'appel

## 📝 Vérification du fonctionnement

1. **Vérifier le serveur** :
   ```bash
   curl http://localhost:3000/health
   ```

2. **Logs du serveur** :
   Les logs apparaissent dans la console

3. **Test avec un appel** :
   - Faire un appel via 3CX
   - Vérifier le dashboard pour voir l'appel en temps réel

## 🚨 Dépannage rapide

### Erreur "Redis not running"
→ Redis est désactivé par défaut, ignorez ce message

### Erreur "Whisper model not found"
→ La transcription fonctionnera en mode simulé, installez Whisper pour la vraie transcription

### Dashboard vide
→ Vérifiez que l'API key est correcte dans `.env`

### Erreur 502 Bad Gateway
→ Le serveur n'est pas démarré, lancez `npm start` dans le dossier server

## 🎯 Prochaines étapes

1. **Configurer les agents** sur chaque poste
2. **Personnaliser les catégories** de tickets dans la config
3. **Ajuster les seuils** d'analyse automatique
4. **Configurer le dashboard TV** sur un écran dédié

## 📞 Support

- Documentation complète : voir README.md
- Logs : `server/logs/`
- Configuration : `server/config/`