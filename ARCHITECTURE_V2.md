# Architecture V2 - Enregistrement Local sur PC Agent

## Vue d'ensemble

La nouvelle architecture déplace l'enregistrement des appels du serveur 3CX vers les PC agents. Chaque agent Windows exécute une application Electron qui :

1. **Détecte** automatiquement les appels 3CX
2. **Enregistre** localement l'audio pendant l'appel
3. **Envoie** l'enregistrement au serveur après l'appel
4. **Reçoit** la transcription et permet la validation

## Avantages

- ✅ **Pas de modification 3CX** : Fonctionne avec n'importe quelle installation 3CX
- ✅ **Enregistrement complet** : Capture l'audio système et microphone
- ✅ **Résilience** : Les enregistrements sont conservés localement en cas de panne réseau
- ✅ **Scalabilité** : La charge est distribuée sur les PC agents
- ✅ **Confidentialité** : Les enregistrements sont chiffrés avant envoi

## Composants

### 1. Agent Windows (Electron)

**Responsabilités :**
- Détection des appels 3CX (fenêtres actives, logs, processus)
- Enregistrement audio local (WAV 16kHz mono)
- Upload sécurisé vers le serveur
- Interface utilisateur pour configuration et monitoring
- Gestion de la file d'attente en cas d'échec

**Technologies :**
- Electron pour l'application desktop
- Node.js pour la logique métier
- Sox/PowerShell pour l'enregistrement audio
- Socket.io pour communication temps réel

### 2. Serveur Orchestrator (Modifié)

**Nouvelles routes :**
- `POST /api/upload-recording` : Réception des enregistrements
- `GET /api/transcription-status/:callId` : Statut de transcription

**Modifications :**
- Support upload multipart (jusqu'à 100MB)
- Authentification simplifiée par extension
- Chiffrement des enregistrements stockés

### 3. Flux de données

```
1. Agent détecte appel 3CX
   ↓
2. Démarre enregistrement local
   ↓
3. Appel terminé → Arrêt enregistrement
   ↓
4. Upload vers serveur (avec retry)
   ↓
5. Serveur → Queue transcription
   ↓
6. Whisper transcrit
   ↓
7. Notification agent via WebSocket
   ↓
8. Agent affiche pour validation
   ↓
9. Création ticket NinjaOne
```

## Installation

### Serveur (inchangé)

```bash
sudo ./install-server.sh
```

### Agent Windows

1. **Télécharger** : `3CX-Whisper-Agent-Setup.exe`
2. **Installer** : Double-clic et suivre l'assistant
3. **Configurer** :
   - URL serveur : `http://192.168.1.100:3002`
   - Extension : Votre numéro 3CX
   - Nom : Votre nom

## Configuration Agent

### Détection d'appels

L'agent utilise plusieurs méthodes :

1. **Surveillance des fenêtres** : Détecte les titres contenant "Call with", "Appel avec", etc.
2. **Logs 3CX** : Parse les fichiers de log si accessibles
3. **Processus** : Vérifie que 3CXPhone.exe est actif

### Enregistrement audio

Méthodes par ordre de préférence :

1. **Sox** : Outil professionnel d'enregistrement
2. **PowerShell + NAudio** : API Windows native
3. **Windows Media Foundation** : Fallback système

### Gestion des échecs

- Retry automatique toutes les 5 minutes
- Conservation locale jusqu'à 7 jours
- File d'attente persistante (JSON)

## Sécurité

### Chiffrement

- **Transport** : HTTPS/WSS recommandé
- **Stockage** : AES-256-CBC
- **Authentification** : Par extension + JWT optionnel

### Permissions Windows

L'agent nécessite :
- Accès microphone
- Lecture des processus
- Écriture dans AppData

## Monitoring

### Côté Agent

- Icône système avec statut
- Statistiques en temps réel
- Historique des appels locaux

### Côté Serveur

- Logs détaillés des uploads
- Métriques Prometheus
- Dashboard Grafana

## Limitations

1. **Windows uniquement** : L'agent nécessite Windows 10/11
2. **3CX Desktop** : Nécessite le client 3CX desktop (pas web)
3. **Ressources** : ~100MB RAM, espace disque pour enregistrements

## Dépannage

### L'agent ne détecte pas les appels

1. Vérifier que 3CX Desktop est installé
2. Lancer l'agent en tant qu'administrateur
3. Vérifier les logs : `%APPDATA%\3cx-whisper-agent\logs`

### Enregistrement échoue

1. Installer Sox : `choco install sox`
2. Vérifier les permissions microphone
3. Tester avec l'enregistreur Windows

### Upload échoue

1. Vérifier la connectivité réseau
2. Vérifier l'URL du serveur
3. Consulter la file d'attente : `%APPDATA%\3cx-whisper-agent\recordings`

## Roadmap

- [ ] Support macOS/Linux
- [ ] Intégration 3CX Web Client
- [ ] Compression audio avant upload
- [ ] Mode hors-ligne complet
- [ ] Multi-compte 3CX