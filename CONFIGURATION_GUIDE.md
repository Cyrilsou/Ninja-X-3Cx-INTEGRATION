# Guide de Configuration 3CX-Whisper-NinjaOne

## Vue d'ensemble

Ce guide vous aidera à configurer correctement tous les paramètres nécessaires pour l'intégration.

## 1. Base de données

Ces paramètres sont généralement pré-remplis lors de l'installation :

- **Nom de la base** : `threecx_integration` (par défaut)
- **Utilisateur** : `threecx` (par défaut)
- **Mot de passe** : Généré automatiquement lors de l'installation
- **Mot de passe Redis** : Généré automatiquement lors de l'installation

⚠️ **Note** : Ne modifiez ces paramètres que si vous utilisez une base de données externe.

## 2. Configuration 3CX

### URL API 3CX
Format : `https://[IP-ou-domaine]:5001`

Exemples :
- Local : `https://192.168.1.100:5001`
- Cloud : `https://monentreprise.3cx.fr:5001`
- On-premise : `https://pbx.monentreprise.com:5001`

### Clé API 3CX
Pour obtenir la clé API :
1. Connectez-vous à 3CX Management Console
2. Allez dans **Settings** → **Integrations** → **API**
3. Cliquez sur **Generate New Key**
4. Copiez la clé générée

### URL du webhook
Cette URL est générée automatiquement : `https://[IP-SERVEUR]/webhook/call-end`
- Copiez cette URL dans 3CX sous **Integrations** → **Webhooks**
- Event Type : `Call End`

## 3. Configuration NinjaOne

### Client ID & Client Secret
Voir le fichier [NINJAONE_API_SETUP.md](./NINJAONE_API_SETUP.md) pour les instructions détaillées.

### URL Instance NinjaOne
Selon votre région :
- 🇺🇸 US : `https://app.ninjarmm.com`
- 🇪🇺 EU : `https://eu.ninjarmm.com`
- 🇨🇦 CA : `https://ca.ninjarmm.com`
- 🇦🇺 OC : `https://oc.ninjarmm.com`

## 4. Configuration Whisper

### Modèle Whisper
Choisissez selon vos besoins :

| Modèle | Précision | Vitesse | VRAM requise |
|--------|-----------|---------|--------------|
| tiny | ⭐ | ⚡⚡⚡⚡⚡ | 1 GB |
| base | ⭐⭐ | ⚡⚡⚡⚡ | 1 GB |
| small | ⭐⭐⭐ | ⚡⚡⚡ | 2 GB |
| medium | ⭐⭐⭐⭐ | ⚡⚡ | 5 GB |
| large-v3 | ⭐⭐⭐⭐⭐ | ⚡ | 10 GB |

**Recommandé** : `large-v3` pour RTX 3060 (12GB VRAM)

### Rétention audio
- **Par défaut** : 30 jours
- **Minimum** : 7 jours
- **Maximum** : 90 jours

## 5. Sécurité

### Secret JWT
- Utilisé pour sécuriser les communications entre services
- **Minimum** : 32 caractères
- Cliquez sur "Générer des clés aléatoires" pour créer automatiquement

### Clé de chiffrement
- Utilisée pour chiffrer les enregistrements audio
- **Exactement** : 32 caractères
- Cliquez sur "Générer des clés aléatoires" pour créer automatiquement

## 6. Validation et démarrage

1. **Enregistrer la configuration**
   - Cliquez sur "Enregistrer la configuration"
   - Un fichier `.env` sera créé

2. **Vérifier les services**
   - L'état des services s'affichera en bas
   - Tous doivent être "En ligne" (vert)

3. **Démarrer les services**
   - Si pas démarrés, cliquez sur "Démarrer tous les services"
   - Attendez 30-60 secondes

## 7. Test de l'intégration

### Test 3CX
1. Passez un appel test via 3CX
2. Terminez l'appel
3. Vérifiez les logs : `docker logs 3cx-event-receiver`

### Test NinjaOne
1. Les tickets devraient apparaître après transcription
2. Vérifiez dans NinjaOne sous **Tickets**

### Test Agent
1. Installez l'agent Windows sur un poste
2. L'agent devrait se connecter automatiquement
3. Une notification apparaîtra après chaque appel

## Dépannage

### Services ne démarrent pas
```bash
cd /opt/3cx-whisper-ninjaone
./logs.sh
```

### Erreur de connexion NinjaOne
- Vérifiez Client ID/Secret
- Vérifiez l'URL de l'instance
- Testez avec : `curl -X POST [URL]/v2/auth/token`

### Pas de transcription
- Vérifiez que le GPU est détecté : `nvidia-smi`
- Vérifiez les logs Whisper : `docker logs 3cx-whisper-worker`

### Agents ne se connectent pas
- Vérifiez le pare-feu : ports 3002 et 3003
- Testez : `http://[IP-SERVEUR]:3002/health`

## Support

Pour toute question :
1. Consultez les logs : `./logs.sh`
2. Vérifiez l'état : `./status.sh`
3. Redémarrez si nécessaire : `./stop.sh && ./start.sh`