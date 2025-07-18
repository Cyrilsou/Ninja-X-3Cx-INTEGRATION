# 3CX ↔ Whisper GPU ↔ NinjaOne Integration V2

Système d'intégration automatique avec enregistrement local des appels. Les agents Windows capturent directement l'audio, l'envoient au serveur pour transcription avec Whisper AI (accéléré GPU), puis créent des tickets dans NinjaOne après validation.

## 🚀 Caractéristiques

- **Enregistrement local** : Les agents Windows capturent l'audio directement sur leur PC
- **Aucune modification 3CX** : Compatible avec toute installation 3CX existante
- **Détection automatique** : Détecte les appels via le client 3CX Desktop
- **Transcription GPU** : Utilise Whisper large-v3 avec RTX 3060 pour des transcriptions rapides
- **Interface de configuration Web** : Configuration simple via navigateur
- **Validation humaine** : Les agents valident les transcriptions avant création des tickets
- **Upload résilient** : File d'attente avec retry automatique en cas d'échec
- **Sécurité** : Chiffrement AES-256, SSL auto-signé, rétention automatique

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
2. Remplir les champs de configuration :
   - Identifiants base de données (pré-remplis)
   - API NinjaOne (Client ID et Secret)
   - Modèle Whisper
3. Cliquer sur "Générer des clés aléatoires" pour la sécurité
4. Enregistrer et démarrer les services

### 3. Aucune configuration 3CX requise

L'architecture V2 fonctionne sans modification de 3CX. Les agents détectent automatiquement les appels.

### 3. Installation des agents Windows

Sur chaque poste agent :

```powershell
# Exécuter en tant qu'administrateur
.\install-agent-windows.ps1 -ServerIP "192.168.1.100" -Extension "101" -AgentName "Jean Dupont"
```

L'agent :
- Vérifie la présence de 3CX Desktop
- Installe Sox pour l'enregistrement audio
- Configure la connexion au serveur
- S'ajoute au démarrage Windows (optionnel)

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