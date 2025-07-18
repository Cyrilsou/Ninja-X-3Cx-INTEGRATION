# 3CX ↔ Whisper GPU ↔ NinjaOne Integration

Système d'intégration automatique qui transcrit les appels 3CX avec Whisper AI (accéléré GPU) et crée des brouillons de tickets dans NinjaOne pour validation par les agents.

## 🚀 Caractéristiques

- **Transcription GPU** : Utilise Whisper large-v3 avec RTX 3060 pour des transcriptions rapides et précises
- **Interface de configuration Web** : Configuration complète via navigateur (plus besoin d'éditer .env)
- **Validation humaine** : Les agents reçoivent et valident les brouillons avant création
- **Dashboard TV temps réel** : Affichage des appels actifs et tickets récents
- **Installation simplifiée** : Scripts automatisés pour serveur et agents
- **Sécurité** : Chiffrement, SSL auto-signé, rétention automatique

## 📋 Prérequis

### Serveur
- Ubuntu 24 LTS
- NVIDIA RTX 3060 (ou supérieure)
- 16 GB RAM minimum
- 100 GB stockage

### Agents
- Windows 10/11
- Connexion réseau au serveur

## 🔧 Installation

### 1. Installation du serveur

```bash
# Télécharger le script d'installation
wget https://votre-repo.com/install-server.sh
chmod +x install-server.sh

# Exécuter en tant que root
sudo ./install-server.sh
```

Le script va :
- Installer Docker et NVIDIA Container Toolkit
- Configurer les certificats SSL
- Créer la structure nécessaire
- Démarrer l'interface de configuration

### 2. Configuration via interface web

1. Accéder à `http://IP_SERVEUR:8080`
2. Remplir tous les champs de configuration :
   - Identifiants base de données
   - API 3CX (URL et clé)
   - API NinjaOne (OAuth)
   - Modèle Whisper
3. Cliquer sur "Générer des clés aléatoires" pour la sécurité
4. Enregistrer et démarrer les services

### 3. Configuration 3CX

Dans l'interface 3CX :
1. **Integrations** → **API**
2. Ajouter webhook : `https://IP_SERVEUR/webhook/call-end`
3. Utiliser la clé API configurée

### 4. Installation des agents

Sur chaque poste Windows :

```powershell
# Méthode 1 : Double-clic sur install-agent-windows.bat

# Méthode 2 : PowerShell avec paramètres
.\install-agent-windows.ps1 -ServerIP "192.168.1.100" -Extension "101" -AgentName "Jean Dupont"
```

## 💻 Utilisation

### Pour les agents

1. L'application se lance automatiquement
2. Icône dans la barre système
3. Notifications à chaque fin d'appel
4. Fenêtre de validation avec :
   - Transcription complète
   - Possibilité de modifier titre/description
   - Boutons Confirmer/Annuler

### Dashboard TV

Accéder à `https://IP_SERVEUR/tv` pour afficher :
- Appels en cours (temps réel)
- Tickets créés récemment
- Statistiques du jour
- Graphiques d'activité

## 🔐 Sécurité

- Certificats SSL auto-signés (remplacer en production)
- Chiffrement AES des enregistrements
- JWT pour authentification agents
- Rétention automatique (30 jours par défaut)
- Audit trail complet

## 🛠️ Administration

### Commandes utiles

```bash
# État des services
cd /opt/3cx-whisper-ninjaone
./status.sh

# Logs en temps réel
./logs.sh

# Arrêter tous les services
./stop.sh

# Redémarrer
./start.sh
```

### Accès aux données

- PostgreSQL : Port 5432 (interne)
- Redis : Port 6379 (interne)
- Métriques : `http://IP_SERVEUR:3001/metrics`

## 📊 Monitoring (optionnel)

Pour activer Prometheus/Grafana :

```bash
cd /opt/3cx-whisper-ninjaone
docker-compose -f docker-compose.monitoring.yml up -d
```

Accès :
- Grafana : `http://IP_SERVEUR:3001` (admin/admin)
- Prometheus : `http://IP_SERVEUR:9090`

## 🔧 Dépannage

### GPU non détecté
```bash
# Vérifier NVIDIA
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

### Agent ne se connecte pas
1. Vérifier le pare-feu Windows
2. Tester : `http://IP_SERVEUR:3002/health`
3. Vérifier la configuration dans `%APPDATA%\3cx-ninjaone-agent\config.json`

### Transcriptions lentes
- Vérifier utilisation GPU : `nvidia-smi`
- Considérer modèle plus petit dans config

## 📝 Notes

- Les enregistrements sont supprimés après 30 jours
- Les brouillons expirent après 5 minutes sans action
- Maximum 5 requêtes/seconde vers NinjaOne
- Le dashboard TV a une protection anti burn-in

## 🤝 Support

Pour toute question ou problème :
1. Vérifier les logs : `./logs.sh`
2. Interface de config : `http://IP_SERVEUR:8080`
3. Documentation API : [Wiki du projet]

## 📄 Licence

MIT License - Voir fichier LICENSE