# 🚀 Guide de Démarrage Rapide

## Configuration en 5 minutes (V2)

### 1️⃣ Aucune configuration 3CX requise! 🎉

L'architecture V2 fonctionne avec n'importe quelle installation 3CX sans modification.

### 2️⃣ Configuration NinjaOne (5 min)

1. **Créer l'application**
   - Administration → Apps & Integrations → API → Add
   - Type : Web Application
   - **Redirect URI** : `https://localhost` ⚠️ OBLIGATOIRE

2. **Grant Type**
   - ❌ Authorization Code
   - ✅ **Client Credentials** 
   - ❌ Tout le reste

3. **Permissions**
   - ✅ monitoring
   - ✅ management  
   - ✅ ticketing

4. **Sauvegarder les credentials**
   - **Client ID** : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Client Secret** : `[COPIEZ IMMÉDIATEMENT]` ⚠️

5. **URL de votre instance**
   - US 🇺🇸 : `https://app.ninjarmm.com`
   - EU 🇪🇺 : `https://eu.ninjarmm.com`

### 2️⃣ Configuration dans Whisper

Accédez à http://[IP-SERVEUR]:8080

#### Section NinjaOne  
- **Client ID** : [Depuis étape 2.4]
- **Client Secret** : [Depuis étape 2.4]
- **URL Instance** : [Depuis étape 2.5]

#### Sécurité
- Cliquez sur **"Générer des clés aléatoires"** 🎲

### 3️⃣ Démarrer

1. **Enregistrer la configuration** 💾
2. **Démarrer les services** ▶️
3. **Vérifier** : Tous les services doivent être "En ligne" ✅

### 4️⃣ Installer les agents Windows

#### Option 1 : Découverte automatique du serveur 🔍

```powershell
# Le script détecte automatiquement le serveur sur le réseau
.\install-agent-windows.ps1
```

#### Option 2 : Spécifier l'IP manuellement

```powershell
.\install-agent-windows.ps1 -ServerIP "[IP-SERVEUR]" -Extension "[NUMÉRO]"
```

#### Utilitaire de recherche

Pour trouver le serveur sur le réseau :
```powershell
.\find-server.ps1
```

## 🧪 Test

1. **Lancer l'agent Windows** (icône dans la barre système)
2. **Passer un appel avec 3CX Desktop**
3. **L'agent détecte et enregistre automatiquement**
4. **Terminer l'appel**
5. **Vérifier** :
   - Notification Windows de transcription
   - Logs : `docker logs 3cx-orchestrator`
   - Interface agent : historique des appels

## ❓ Problèmes fréquents

### "Invalid redirect_uri" dans NinjaOne
➡️ Utilisez exactement : `https://localhost`

### "401 Unauthorized" 
➡️ Vérifiez les clés API (3CX et NinjaOne)

### Pas de webhook reçu
➡️ Vérifiez l'URL : `https://[IP-SERVEUR]/webhook/call-end`

### "Cannot connect to 3CX"
➡️ Port 5001 accessible ? Certificat SSL ?

## 📚 Guides détaillés

- [Configuration complète 3CX](./3CX_CONFIGURATION_GUIDE.md)
- [Configuration NinjaOne étape par étape](./NINJAONE_STEP_BY_STEP.md)
- [Guide général](./CONFIGURATION_GUIDE.md)

## 🆘 Support

```bash
# Vérifier les logs
cd /opt/3cx-whisper-ninjaone
./logs.sh

# État des services
./status.sh

# Redémarrer
./stop.sh && ./start.sh
```