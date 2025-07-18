# Guide de Migration vers V2

## Changements majeurs

### Architecture
- **AVANT** : 3CX envoyait des webhooks au serveur
- **MAINTENANT** : Les agents Windows enregistrent localement

### Avantages de la V2
✅ **Aucune configuration 3CX** nécessaire  
✅ **Compatible** avec toutes les versions 3CX  
✅ **Enregistrement complet** (système + microphone)  
✅ **Plus fiable** (stockage local avec retry)  

## Étapes de migration

### 1. Côté Serveur

```bash
# Arrêter l'ancienne version
cd /opt/3cx-whisper-ninjaone
./stop.sh

# Sauvegarder la configuration
cp .env .env.backup

# Mettre à jour les fichiers
git pull # ou copier les nouveaux fichiers

# Relancer l'installation
sudo ./install-server.sh
```

### 2. Configuration

Dans l'interface web (http://IP:8080) :
- Les champs 3CX ont été **supprimés**
- Seuls NinjaOne et Whisper restent à configurer
- La base de données est conservée

### 3. Côté Agents

**IMPORTANT** : Installer la nouvelle version sur TOUS les PC agents

```powershell
# Désinstaller l'ancienne version (si existante)
# Puis installer la V2
.\install-agent-windows.ps1 -ServerIP "192.168.1.100" -Extension "101"
```

### 4. Nettoyage 3CX

Vous pouvez supprimer dans 3CX :
- Les webhooks vers le serveur Whisper
- Les clés API non utilisées

## Données existantes

### Base de données
- Les appels existants sont **conservés**
- Les transcriptions restent accessibles
- Aucune perte de données

### Nouveaux champs
La V2 ajoute :
- `upload_method` : 'webhook' ou 'agent'
- `agent_name` : Nom de l'agent qui a uploadé
- `recording_quality` : Qualité de l'enregistrement

## Dépannage

### "Agent ne détecte pas les appels"
1. Vérifier que 3CX Desktop est installé
2. Lancer l'agent en admin
3. Vérifier les logs : `%APPDATA%\3cx-whisper-agent\logs`

### "Upload échoue"
1. Vérifier la connectivité : http://IP:3002/health
2. Vérifier les logs serveur : `docker logs 3cx-orchestrator`
3. Les fichiers sont en attente dans : `%APPDATA%\3cx-whisper-agent\recordings`

### "Services ne démarrent pas"
Le service `event-receiver` a été supprimé. C'est normal qu'il n'apparaisse plus.

## Rollback si nécessaire

Pour revenir à la V1 :
```bash
cd /opt/3cx-whisper-ninjaone
git checkout v1  # ou restaurer l'ancienne version
cp .env.backup .env
./start.sh
```

## Support

Pour toute question :
1. Consultez `ARCHITECTURE_V2.md`
2. Vérifiez les logs : `./logs.sh`
3. Interface : http://IP:8080