# Installation 3CX-Ninja Realtime

## Installation du serveur

Le script `setup-server-auto.sh` contient TOUTE la configuration nécessaire :
- Installation des prérequis (Node.js, Redis, Nginx, etc.)
- Configuration de l'environnement
- Build de l'application
- Configuration Nginx avec proxy inverse
- Service systemd pour démarrage automatique
- Firewall UFW
- **Service de broadcast UDP pour la découverte automatique**

### Installation simple :

```bash
# Sur le serveur Ubuntu/Debian
sudo ./setup-server-auto.sh
```

Le script va :
1. Installer tous les prérequis
2. Configurer Redis et Nginx
3. Créer le service systemd
4. **Activer le broadcast UDP sur le port 53434**
5. Afficher toutes les informations de connexion

### Après l'installation :

- Interface web : http://IP-DU-SERVEUR
- Dashboard TV : http://IP-DU-SERVEUR/dashboard-tv
- Port découverte UDP : 53434

## Installation des agents Windows

Grâce au broadcast UDP, les agents peuvent découvrir automatiquement le serveur !

### Méthode 1 : Installation avec découverte automatique

```powershell
# Le script va automatiquement découvrir le serveur sur le réseau
iex ((New-Object Net.WebClient).DownloadString('http://IP-DU-SERVEUR/api/install/install-agent.ps1'))
```

### Méthode 2 : Installation locale avec découverte

```batch
# Exécuter install-agent-windows.bat
# Le script va chercher le serveur automatiquement via UDP
install-agent-windows.bat
```

## Fonctionnement du broadcast UDP

Le serveur envoie automatiquement des messages de broadcast UDP :
- Port : 53434
- Intervalle : 30 secondes
- Message : Informations du serveur (IP, port, clé API)

Les agents écoutent ce port et peuvent :
1. Découvrir automatiquement le serveur
2. S'auto-configurer avec les bonnes informations
3. Se connecter sans configuration manuelle

## Configuration post-installation

Éditer `/etc/3cx-ninja-realtime/.env` pour configurer :
- Les clés API 3CX
- Les clés API NinjaOne
- Autres paramètres

## Vérification

```bash
# Vérifier le service
sudo systemctl status 3cx-ninja-realtime

# Vérifier les logs
sudo journalctl -u 3cx-ninja-realtime -f

# Vérifier le broadcast UDP
sudo netstat -ulnp | grep 53434
```

## Dépannage

Si le broadcast ne fonctionne pas :
1. Vérifier que le port 53434/UDP est ouvert
2. Vérifier la variable ENABLE_BROADCAST=true dans .env
3. Vérifier les logs pour les messages de broadcast

Le serveur répond aussi aux requêtes de découverte directes sur le port 53434.