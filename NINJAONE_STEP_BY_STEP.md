# Guide Étape par Étape - Configuration API NinjaOne

## 📋 Résumé rapide

Pour l'intégration, vous devez créer une application OAuth2 de type **Client Credentials** dans NinjaOne.

**Redirect URI à utiliser** : `https://localhost` (obligatoire mais non utilisée)

## 🔧 Étapes détaillées

### Étape 1 : Accéder à la gestion des API

1. Connectez-vous à votre instance NinjaOne
2. Cliquez sur **Administration** (icône engrenage en haut à droite)
3. Dans le menu de gauche, trouvez **Apps & Integrations**
4. Cliquez sur **API**

### Étape 2 : Créer une nouvelle application

1. Cliquez sur le bouton **+ Add** ou **Create Application**

### Étape 3 : Informations de base

Remplissez les champs suivants :

```
Application Name: 3CX-Whisper-Integration
Description: Automated ticket creation from 3CX call transcriptions
```

### Étape 4 : Configuration de la plateforme

⚠️ **ATTENTION** : Cette étape est cruciale

1. **Application Platform** : Sélectionnez `Web Application`
   - ❌ NE PAS choisir "Service Application"
   - ❌ NE PAS choisir "Native Application"

2. **Redirect URIs** : 
   ```
   https://localhost
   ```
   - ℹ️ Cette URI est obligatoire même si elle ne sera pas utilisée
   - NinjaOne la demande pour tous les types d'applications

### Étape 5 : Grant Types (TRÈS IMPORTANT)

Dans la section **OAuth 2.0 Settings** :

1. **Décochez** ❌ Authorization Code
2. **Décochez** ❌ Implicit
3. **Cochez** ✅ **Client Credentials**
4. **Décochez** ❌ Device Code
5. **Décochez** ❌ Refresh Token

### Étape 6 : Scopes (Permissions)

Cochez les scopes suivants :

**Scopes essentiels** :
- ✅ `monitoring` - Lecture des données
- ✅ `management` - Gestion générale
- ✅ `ticketing` - Création et gestion des tickets

**Scopes optionnels mais recommandés** :
- ✅ `documentation` - Pour attacher des transcriptions
- ✅ `activities` - Pour l'historique

### Étape 7 : Permissions détaillées

Si une section **API Permissions** apparaît, configurez :

| Ressource | Read | Write | Create | Delete |
|-----------|------|-------|--------|--------|
| Organizations | ✅ | ❌ | ❌ | ❌ |
| Devices | ✅ | ❌ | ❌ | ❌ |
| Locations | ✅ | ❌ | ❌ | ❌ |
| Tickets | ✅ | ✅ | ✅ | ❌ |
| Activities | ✅ | ✅ | ✅ | ❌ |
| Documents | ✅ | ✅ | ✅ | ❌ |

### Étape 8 : Créer l'application

1. Cliquez sur **Save** ou **Create Application**

### Étape 9 : Récupérer les credentials

⚠️ **TRÈS IMPORTANT** : Cette étape n'apparaît qu'une fois !

Après la création, NinjaOne affichera :

```
Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**ACTIONS CRITIQUES** :
1. 📋 Copiez immédiatement le **Client ID**
2. 📋 Copiez immédiatement le **Client Secret**
3. 💾 Sauvegardez-les dans un endroit sécurisé
4. ⚠️ Le Client Secret ne sera **JAMAIS** réaffiché

### Étape 10 : Identifier votre instance

Votre URL d'instance dépend de votre région :

| Région | URL |
|--------|-----|
| 🇺🇸 États-Unis | `https://app.ninjarmm.com` |
| 🇪🇺 Europe | `https://eu.ninjarmm.com` |
| 🇨🇦 Canada | `https://ca.ninjarmm.com` |
| 🇦🇺 Océanie | `https://oc.ninjarmm.com` |
| 🏢 Personnalisée | `https://[votre-nom].ninjarmm.com` |

Pour vérifier, regardez l'URL dans votre navigateur quand vous êtes connecté.

## ✅ Configuration dans Whisper

Dans l'interface http://[IP-SERVEUR]:8080 :

1. **Client ID** : Collez la valeur copiée
2. **Client Secret** : Collez la valeur copiée
3. **URL Instance** : 
   - Exemple : `https://app.ninjarmm.com`
   - ⚠️ PAS de `/` à la fin
   - ⚠️ PAS de `/api/v2`

## 🧪 Test de connexion

Après avoir sauvegardé dans l'interface Whisper :

```bash
# Sur le serveur Whisper
docker logs 3cx-orchestrator | grep -i ninja
```

Vous devriez voir :
```
[INFO] Successfully authenticated with NinjaOne API
[INFO] NinjaOne token obtained, expires in 3600 seconds
```

## ❗ Erreurs communes

### "Invalid redirect_uri"
- ✅ Solution : Utilisez exactement `https://localhost`

### "Invalid grant type"
- ✅ Solution : Assurez-vous que seul "Client Credentials" est coché

### "Unauthorized"
- ✅ Vérifiez le Client ID et Secret
- ✅ Vérifiez que l'app n'est pas désactivée

### "Invalid scope"
- ✅ Vérifiez que les scopes demandés sont bien cochés

## 📝 Notes finales

1. **Sécurité** : Le Client Secret est comme un mot de passe
   - Ne le partagez jamais
   - Ne le commitez pas dans Git
   - Renouvelez-le si compromis

2. **Renouvellement** : Si vous perdez le Client Secret
   - Vous devrez recréer l'application
   - Impossible de récupérer l'ancien secret

3. **Limites** : 
   - Rate limit : 600 requêtes/minute par défaut
   - Token valide : 1 heure (renouvellement automatique)