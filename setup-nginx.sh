#!/bin/bash

# Script de configuration Nginx pour 3CX Ninja Realtime Server

echo "Configuration de Nginx pour 3CX Ninja Realtime Server"

# Vérifier si Nginx est installé
if ! command -v nginx &> /dev/null; then
    echo "Nginx n'est pas installé. Installation..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Créer le répertoire de logs si nécessaire
sudo mkdir -p /var/log/nginx

# Copier la configuration
echo "Copie de la configuration Nginx..."
sudo cp nginx-config/3cx-ninja-realtime.conf /etc/nginx/sites-available/

# Créer le lien symbolique
echo "Activation du site..."
sudo ln -sf /etc/nginx/sites-available/3cx-ninja-realtime.conf /etc/nginx/sites-enabled/

# Désactiver le site par défaut si nécessaire
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "Désactivation du site par défaut..."
    sudo rm /etc/nginx/sites-enabled/default
fi

# Tester la configuration
echo "Test de la configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration valide. Redémarrage de Nginx..."
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "Configuration Nginx terminée avec succès!"
    echo ""
    echo "Le serveur est maintenant accessible sur le port 80"
    echo "Assurez-vous que le serveur Node.js est en cours d'exécution sur le port 3000"
else
    echo "Erreur dans la configuration Nginx. Vérifiez le fichier de configuration."
    exit 1
fi