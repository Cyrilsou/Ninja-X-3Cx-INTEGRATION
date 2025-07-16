#!/bin/bash
# Script de configuration rapide pour 3CX-Ninja Realtime

set -e

# Configuration rapide avec valeurs par défaut
echo "Configuration rapide de 3CX-Ninja Realtime"
echo "=========================================="
echo

# Vérifier si Docker est disponible
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "Docker détecté. Utilisation de Docker pour une installation simplifiée."
    
    # Configuration minimale
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "Fichier .env créé. Veuillez le configurer avec vos paramètres:"
        echo "  - PBX_URL"
        echo "  - CX_CLIENT_ID et CX_CLIENT_SECRET"
        echo "  - NINJA_CLIENT_ID, NINJA_CLIENT_SECRET et NINJA_REFRESH_TOKEN"
        echo
        read -p "Appuyez sur Entrée pour continuer après configuration..."
    fi
    
    # Démarrer avec Docker
    docker-compose up -d
    
    echo
    echo "✅ Installation terminée avec Docker!"
    echo "Serveur accessible sur: http://localhost:3000"
    echo "Logs: docker-compose logs -f"
    
else
    echo "Docker non détecté. Installation locale..."
    
    # Installation minimale
    npm install
    npm run build
    
    # Configuration
    if [ ! -f .env ]; then
        cp .env.example .env
        echo
        echo "⚠️  Configuration requise!"
        echo "Éditez le fichier .env avec vos paramètres avant de démarrer."
    fi
    
    # Créer les dossiers
    mkdir -p logs data temp/audio uploads
    
    echo
    echo "✅ Installation terminée!"
    echo "Démarrer le serveur: npm run start:prod"
fi

echo
echo "Documentation: ./docs/INSTALLATION_SIMPLE.md"