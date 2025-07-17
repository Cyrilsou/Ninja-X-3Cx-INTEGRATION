#!/bin/bash

# Script de setup automatique avec Docker pour 3CX-Ninja Realtime
# Installation complète en une commande avec Docker Compose

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Bannière
clear
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         3CX-NINJA REALTIME - SETUP DOCKER COMPLET         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker n'est pas installé"
    echo "Installer Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose n'est pas installé"
    exit 1
fi

# Configuration
log_info "Configuration de l'environnement..."

if [ ! -f ".env" ]; then
    echo ""
    echo -e "${YELLOW}Configuration requise:${NC}"
    echo ""
    
    read -p "URL du serveur 3CX: " THREECX_URL
    read -p "3CX Client ID: " THREECX_CLIENT_ID
    read -s -p "3CX Client Secret: " THREECX_CLIENT_SECRET
    echo ""
    
    read -p "NinjaOne Client ID: " NINJA_CLIENT_ID
    read -s -p "NinjaOne Client Secret: " NINJA_CLIENT_SECRET
    echo ""
    read -p "NinjaOne Refresh Token: " NINJA_REFRESH_TOKEN
    
    # Générer une clé API
    API_KEY=$(openssl rand -hex 32)
    
    cat > .env << EOF
# 3CX Configuration
THREECX_PBX_URL=$THREECX_URL
THREECX_CLIENT_ID=$THREECX_CLIENT_ID
THREECX_CLIENT_SECRET=$THREECX_CLIENT_SECRET

# NinjaOne Configuration
NINJA_CLIENT_ID=$NINJA_CLIENT_ID
NINJA_CLIENT_SECRET=$NINJA_CLIENT_SECRET
NINJA_REFRESH_TOKEN=$NINJA_REFRESH_TOKEN

# Security
API_KEY=$API_KEY

# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_URL=redis://redis:6379

# Whisper
WHISPER_MODEL=base
EOF
    
    log_success "Configuration créée"
fi

# Créer docker-compose.yml optimisé
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./server/data:/app/data
      - ./server/logs:/app/logs
      - whisper_models:/app/models
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - server

volumes:
  redis_data:
  whisper_models:
EOF

# Créer Dockerfile optimisé pour le serveur
cat > Dockerfile.server << 'EOF'
# Build stage
FROM node:18-alpine AS builder

WORKDIR /build

# Copier les fichiers de dépendances
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY shared ./shared
COPY server ./server

# Compiler
WORKDIR /build/shared
RUN npm run build

WORKDIR /build/server
RUN npm run build

# Runtime stage
FROM node:18-alpine

# Installer les dépendances système
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    git \
    build-base \
    cmake

WORKDIR /app

# Copier depuis le build stage
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/shared ./shared
COPY --from=builder /build/server ./server

# Installer Whisper
RUN cd server && \
    git clone https://github.com/ggerganov/whisper.cpp.git models/whisper && \
    cd models/whisper && \
    make && \
    ./models/download-ggml-model.sh base

# Créer les dossiers nécessaires
RUN mkdir -p /app/data/temp /app/logs

# Exposer le port
EXPOSE 3000

# Démarrer le serveur
CMD ["node", "server/dist/index.js"]
EOF

# Créer la configuration Nginx
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server server:3000;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 100M;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

# Compiler les projets avant Docker
log_info "Compilation des projets..."
npm install
npm run build

# Démarrer avec Docker Compose
log_info "Démarrage des conteneurs Docker..."
docker-compose up -d --build

# Attendre que les services soient prêts
log_info "Attente du démarrage des services..."
sleep 10

# Vérifier l'état
if curl -f http://localhost:3000/health &> /dev/null; then
    log_success "Serveur démarré avec succès!"
else
    log_error "Le serveur ne répond pas"
    docker-compose logs server
    exit 1
fi

# Afficher les informations
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    INSTALLATION RÉUSSIE                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Accès:"
echo "- Dashboard: http://localhost"
echo "- Dashboard TV: http://localhost/tv"
echo "- API Health: http://localhost/health"
echo ""
echo "Commandes utiles:"
echo "- Logs: docker-compose logs -f"
echo "- Arrêt: docker-compose down"
echo "- Redémarrage: docker-compose restart"
echo ""
echo -e "${YELLOW}Clé API: $(grep API_KEY .env | cut -d= -f2)${NC}"
echo ""
echo "Webhook 3CX: http://votre-ip/webhook/3cx"