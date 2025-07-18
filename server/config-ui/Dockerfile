FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci || npm install

COPY src ./src
RUN npm run build || (npm list && exit 1)

FROM node:20-alpine

RUN apk add --no-cache docker-cli docker-compose

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

COPY --from=builder /app/dist ./dist
COPY public ./public

# Create the project directory and set permissions
RUN mkdir -p /project && chmod -R 777 /project

EXPOSE 8080

# Run as root to ensure write permissions
USER root

CMD ["node", "dist/index.js"]