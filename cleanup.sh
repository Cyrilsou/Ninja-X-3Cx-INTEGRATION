#!/bin/bash
# Script de nettoyage du projet 3CX-Whisper-NinjaOne V2

echo "🧹 Nettoyage du projet..."

# Supprimer les fichiers de logs
echo "Suppression des logs..."
find . -name "*.log" -type f -delete 2>/dev/null
find . -name "npm-debug.log*" -type f -delete 2>/dev/null
find . -name "yarn-error.log*" -type f -delete 2>/dev/null

# Supprimer les dossiers node_modules (si nécessaire)
echo "Suppression des node_modules (optionnel)..."
read -p "Voulez-vous supprimer tous les dossiers node_modules? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null
    echo "✓ node_modules supprimés"
fi

# Supprimer les fichiers de build
echo "Suppression des fichiers de build..."
find . -name "dist" -type d -prune -exec rm -rf '{}' + 2>/dev/null
find . -name "build" -type d -prune -exec rm -rf '{}' + 2>/dev/null
find . -name "*.js.map" -type f -delete 2>/dev/null

# Supprimer les fichiers temporaires
echo "Suppression des fichiers temporaires..."
find . -name ".DS_Store" -type f -delete 2>/dev/null
find . -name "Thumbs.db" -type f -delete 2>/dev/null
find . -name "*~" -type f -delete 2>/dev/null
find . -name "*.swp" -type f -delete 2>/dev/null
find . -name "*.swo" -type f -delete 2>/dev/null

# Nettoyer les volumes Docker (optionnel)
echo ""
read -p "Voulez-vous nettoyer les volumes Docker? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose down -v
    echo "✓ Volumes Docker supprimés"
fi

# Résumé
echo ""
echo "✅ Nettoyage terminé!"
echo ""
echo "Pour reconstruire le projet:"
echo "1. ./install-server.sh    # Sur le serveur Ubuntu"
echo "2. ./start.sh             # Pour démarrer les services"
echo "3. Installer les agents Windows avec install-agent-windows.ps1"