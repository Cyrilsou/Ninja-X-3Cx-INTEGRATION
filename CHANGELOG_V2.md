# Changelog - Migration vers l'Architecture V2

## 🎯 Résumé des changements

L'architecture V2 élimine la dépendance aux webhooks 3CX et implémente un système d'enregistrement local sur les agents Windows.

## 🗑️ Fichiers supprimés/modifiés

### Fichiers supprimés
- `install-agent-windows-old.ps1` - Ancienne version du script d'installation

### Modifications de la base de données
- **Table `integration.calls`** : Commenté la colonne `recording_url` (obsolète en V2)
- Les enregistrements sont maintenant uploadés directement par les agents

### Modifications du code

#### `docker-compose.yml`
- Suppression des références à l'event-receiver
- Service event-receiver complètement retiré

#### `server/config-ui/src/index.ts`
- Suppression de la vérification du statut "Event Receiver"
- Retrait du service des listes de monitoring

#### `server/config-ui/public/index.html`
- Interface simplifiée (sections 3CX déjà retirées dans les versions précédentes)

#### `PROJECT_STRUCTURE.md`
- Mise à jour pour refléter l'architecture V2
- Clarification sur l'absence d'event-receiver et de webhooks

## ✨ Nouvelles fonctionnalités

### Script d'installation Windows amélioré (`install-agent-windows.ps1`)
- **Détection avancée de 3CX** via 4 méthodes :
  1. Processus actif (`Get-Process`)
  2. Registre Windows
  3. Chemins d'installation communs
  4. Raccourcis du menu Démarrer
- Sauvegarde automatique du chemin 3CX dans la configuration
- Support des caractères non-ASCII corrigé

### Script de nettoyage (`cleanup.sh`)
- Suppression des logs
- Nettoyage des fichiers temporaires
- Option pour supprimer node_modules
- Option pour nettoyer les volumes Docker

## 🏗️ Architecture V2 - Points clés

1. **Pas de webhook 3CX** - Plus besoin de configurer 3CX
2. **Enregistrement local** - Les agents Windows enregistrent directement
3. **Upload direct** - Les agents envoient les fichiers au serveur
4. **Détection automatique** - Les agents détectent les appels sans configuration
5. **Installation simplifiée** - Un seul script PowerShell pour les agents

## 📋 Prochaines étapes

Pour déployer l'architecture V2 :

1. **Sur le serveur Ubuntu** :
   ```bash
   ./install-server.sh
   ./start.sh
   ```

2. **Sur les postes Windows** :
   ```powershell
   .\install-agent-windows.ps1 -ServerIP "192.168.x.x" -Extension "100"
   ```

3. **Configuration** :
   - Accéder à http://[IP-SERVEUR]:8080
   - Configurer uniquement NinjaOne et les clés de sécurité
   - Plus besoin de configurer 3CX !

## 🔒 Sécurité

- Chiffrement AES-256 des enregistrements
- JWT pour l'authentification (optionnel)
- Communications agent-serveur sécurisées
- Pas d'exposition de l'API 3CX