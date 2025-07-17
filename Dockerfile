# Build stage
FROM node:18-alpine AS builder

# Installer les dépendances système pour la compilation
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY tsconfig*.json ./
COPY .npmrc* ./

# Copier les workspaces
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY dashboard/package*.json ./dashboard/

# Installer toutes les dépendances
RUN npm ci

# Copier le code source
COPY shared ./shared
COPY server ./server
COPY dashboard ./dashboard

# Compiler
RUN npm run build

# Build du dashboard
RUN npm run build --workspace=dashboard

# Production stage
FROM node:18-alpine

# Installer FFmpeg et autres dépendances runtime
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    bash

WORKDIR /app

# Copier depuis le builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/node_modules ./node_modules

# Copier les fichiers de configuration
COPY ecosystem.config.js ./
COPY server/config ./server/config

# Créer les dossiers nécessaires
RUN mkdir -p logs data temp/audio uploads models

# Installer Whisper
RUN cd server && npm run setup:whisper || echo "Whisper installation will be completed on first run"

# Installer PM2 globalement
RUN npm install -g pm2

# Exposer le port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Démarrer avec PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]