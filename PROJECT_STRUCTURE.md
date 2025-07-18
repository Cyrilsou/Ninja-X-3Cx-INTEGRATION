# Structure du Projet V2

## Vue d'ensemble

```
3cx-whisper-ninjaone/
├── docker-compose.yml          # Orchestration des services
├── docker-compose.config.yml   # Config UI uniquement
├── .env                        # Configuration (généré)
├── install-server.sh          # Script installation Ubuntu
├── install-agent-windows.ps1  # Script installation Windows
│
├── server/                    # Services backend
│   ├── orchestrator/         # API et coordination
│   ├── whisper-worker/       # Transcription GPU
│   ├── tv-dashboard/         # Dashboard Next.js
│   ├── nginx/                # Reverse proxy
│   ├── config-ui/            # Interface de configuration
│   └── scripts/              # Scripts SQL et utils
│
├── electron-client/          # Agent Windows
│   ├── package.json
│   ├── src/
│   │   ├── main.js          # Process principal
│   │   ├── preload.js       # Bridge sécurisé
│   │   └── services/
│   │       ├── callDetector.js     # Détection appels 3CX
│   │       ├── audioRecorder.js    # Enregistrement local
│   │       └── serverConnection.js # Upload vers serveur
│   └── renderer/            # Interface utilisateur
│       ├── index.html
│       └── renderer.js
│
└── docs/                    # Documentation
    ├── README.md
    ├── ARCHITECTURE_V2.md
    ├── QUICK_START.md
    ├── MIGRATION_V2.md
    └── NINJAONE_*.md
```

## Services Docker

### Services principaux

1. **postgres** - Base de données PostgreSQL
2. **redis** - Queue et cache
3. **orchestrator** - API centrale (port 3002/3003)
4. **whisper-worker** - Transcription GPU
5. **tv-dashboard** - Interface TV (port 3000)
6. **nginx** - Reverse proxy (ports 80/443)
7. **config-ui** - Configuration web (port 8080)

### Architecture V2
- **Pas de service event-receiver** - Les agents enregistrent localement
- **Pas de webhook 3CX** - Détection automatique des appels côté agent
- **Upload direct** - Les agents envoient directement les enregistrements

## Flux de données V2

```
1. Agent Windows détecte appel 3CX
2. Enregistre localement (WAV 16kHz)
3. Upload POST /api/upload-recording
4. Orchestrator → Queue Redis
5. Whisper Worker transcrit
6. WebSocket notification → Agent
7. Agent affiche transcription
8. Validation → Ticket NinjaOne
```

## Ports utilisés

| Service | Port | Description |
|---------|------|-------------|
| HTTP | 80 | Redirection HTTPS |
| HTTPS | 443 | Interface web sécurisée |
| Orchestrator API | 3002 | API pour agents |
| WebSocket | 3003 | Temps réel |
| Config UI | 8080 | Configuration |
| PostgreSQL | 5432 | Base de données (interne) |
| Redis | 6379 | Queue (interne) |

## Volumes Docker

- `postgres_data` - Données PostgreSQL
- `audio_storage` - Enregistrements chiffrés
- `whisper_models` - Modèles IA

## Configuration requise

### Serveur
- Ubuntu 24 LTS
- NVIDIA GPU (RTX 3060+)
- Docker + NVIDIA Container Toolkit
- 16GB RAM minimum

### Agents
- Windows 10/11
- 3CX Desktop Client
- 4GB RAM
- Accès réseau au serveur

## Sécurité

- Chiffrement AES-256 des enregistrements
- JWT pour authentification (optionnel)
- SSL/TLS auto-signé
- Rétention automatique 30 jours
- Isolation Docker

## Maintenance

### Logs
```bash
cd /opt/3cx-whisper-ninjaone
./logs.sh              # Tous les logs
docker logs <service>  # Service spécifique
```

### Backup
```bash
# Base de données
docker exec 3cx-postgres pg_dump -U threecx threecx_integration > backup.sql

# Configuration
cp .env .env.backup
```

### Mise à jour
```bash
./stop.sh
git pull  # ou copier nouveaux fichiers
./start.sh
```