# Correction de l'erreur 502 Bad Gateway

## Cause de l'erreur
L'erreur 502 Bad Gateway indique que Nginx ne peut pas communiquer avec le serveur backend (Node.js). Cela peut être dû à :

1. Le serveur Node.js n'est pas en cours d'exécution
2. Le serveur Node.js a planté à cause d'erreurs de configuration
3. Nginx n'est pas correctement configuré

## Solution

### 1. Vérifier le statut du serveur

```bash
sudo systemctl status 3cx-ninja-realtime
```

### 2. Si le serveur est arrêté ou en erreur

```bash
# Arrêter le service
sudo systemctl stop 3cx-ninja-realtime

# Vérifier les logs
sudo journalctl -u 3cx-ninja-realtime -n 100

# Redémarrer le service
sudo systemctl start 3cx-ninja-realtime
```

### 3. Configurer Nginx

```bash
# Exécuter le script de configuration Nginx
sudo ./setup-nginx.sh
```

### 4. Vérifier la configuration

Assurez-vous que :
- Le fichier `/etc/3cx-ninja-realtime/production.json` existe et contient toutes les configurations nécessaires
- Les variables d'environnement sont définies dans `/etc/3cx-ninja-realtime/.env`
- Redis est en cours d'exécution : `sudo systemctl status redis`

### 5. Démarrage manuel pour debug

Si le service ne démarre pas, essayez de démarrer manuellement pour voir les erreurs :

```bash
cd /opt/3cx-ninja-realtime/server
sudo -u ninjauser NODE_ENV=production node dist/index.js
```

### 6. Reconstruire si nécessaire

Si des erreurs TypeScript persistent :

```bash
cd /opt/3cx-ninja-realtime
# Installer les dépendances
npm install
# Construire tous les projets
npm run build
# Redémarrer le service
sudo systemctl restart 3cx-ninja-realtime
```

### 7. Vérifier les ports

Assurez-vous que le port 3000 est utilisé par Node.js :

```bash
sudo ss -tlnp | grep 3000
```

### 8. Dashboard TV

Pour accéder au dashboard TV après correction :
- URL : http://votre-serveur/dashboard-tv/
- Le dashboard se met à jour automatiquement toutes les 30 secondes

## Configuration complète requise

Le serveur nécessite les configurations suivantes dans `/etc/3cx-ninja-realtime/production.json` :

- Configuration Whisper pour la transcription
- Configuration Redis pour le cache
- Configuration 3CX pour les webhooks
- Configuration NinjaOne pour les tickets
- Clé API pour la sécurité

Toutes ces configurations ont été ajoutées dans le fichier production.json fourni.