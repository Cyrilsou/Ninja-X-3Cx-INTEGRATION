# Configuration API NinjaOne

## Prérequis
- Compte NinjaOne avec accès administrateur
- Accès à la console d'administration NinjaOne

## Méthodes d'authentification

NinjaOne supporte plusieurs méthodes d'authentification. Pour cette intégration, nous utilisons **OAuth 2.0 Client Credentials**.

## Étapes pour obtenir les clés API

### 1. Connexion à NinjaOne
Connectez-vous à votre instance NinjaOne avec un compte administrateur.

### 2. Accéder aux paramètres API

#### Option A : Via Administration
1. Cliquez sur **Administration** dans le menu principal
2. Allez dans **Apps & Integrations** → **API**
3. Cliquez sur **Add** ou **New Application**

#### Option B : Via Settings
1. Cliquez sur l'icône engrenage (Settings)
2. Naviguez vers **General** → **API Management**
3. Cliquez sur **Create New App**

### 3. Créer une nouvelle application

1. **Application Name** : `3CX-Whisper-Integration`

2. **Application Platform** : 
   - Sélectionnez **Web Application**
   - ⚠️ NE PAS sélectionner "Client Credentials" directement

3. **Grant Type** :
   - Décochez ❌ **Authorization Code**
   - Décochez ❌ **Implicit**
   - Cochez ✅ **Client Credentials**

4. **Redirect URI** : 
   - Pour Client Credentials, mettez : `https://localhost`
   - ℹ️ Cette URI ne sera pas utilisée mais est requise par l'interface

5. **Allowed Scopes** : Sélectionnez les permissions suivantes :
   - ✅ `monitoring` - Pour lire les données des appareils
   - ✅ `management` - Pour créer/modifier des tickets  
   - ✅ `ticketing` - Pour la gestion complète des tickets
   - ✅ `documentation` - Pour attacher des documents aux tickets

6. **API Permissions** (si section séparée) :
   ```
   Organizations     : Read
   Devices          : Read
   Locations        : Read
   Tickets          : Read, Write, Create
   Activities       : Read, Write
   Documentation    : Read, Write
   ```

### 4. Générer les credentials

Après la création, NinjaOne affichera :
- **Client ID** : Une chaîne unique (ex: `ab12cd34-ef56-78gh-90ij-klmnopqrstuv`)
- **Client Secret** : Une chaîne secrète (IMPORTANT : copiez-la immédiatement, elle ne sera plus visible)

### 5. Noter l'URL de votre instance

L'URL de votre instance NinjaOne suit généralement ce format :
- US : `https://app.ninjarmm.com`
- EU : `https://eu.ninjarmm.com`
- CA : `https://ca.ninjarmm.com`
- OC : `https://oc.ninjarmm.com`

Ou pour les instances personnalisées :
- `https://[votre-organisation].ninjarmm.com`

## Configuration dans l'interface

Dans l'interface de configuration 3CX-Whisper-NinjaOne :

1. **Client ID** : Collez le Client ID obtenu
2. **Client Secret** : Collez le Client Secret obtenu
3. **URL Instance NinjaOne** : 
   - Exemple US : `https://app.ninjarmm.com`
   - Exemple EU : `https://eu.ninjarmm.com`
   - Exemple personnalisé : `https://acme.ninjarmm.com`

⚠️ **IMPORTANT** : N'ajoutez PAS `/api/v2` à la fin de l'URL

## Exemple de configuration

```
Client ID: ab12cd34-ef56-78gh-90ij-klmnopqrstuv
Client Secret: 1234567890abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJ
URL Instance: https://app.ninjarmm.com
```

## Test de la connexion

Après avoir sauvegardé la configuration :
1. Vérifiez les logs du service orchestrator
2. Un message "Successfully authenticated with NinjaOne API" devrait apparaître
3. Si erreur, vérifiez :
   - Les credentials sont corrects
   - L'URL de l'instance est correcte
   - Les permissions (scopes) sont suffisantes

## Permissions requises

L'application nécessite au minimum :
- **Read** : Organizations, Devices, Locations
- **Write** : Tickets, Activities
- **Create** : Tickets, Ticket Comments

## Sécurité

- Le Client Secret est stocké chiffré dans la base de données
- Ne partagez jamais le Client Secret
- Renouvelez régulièrement les credentials
- Utilisez des permissions minimales nécessaires

## Dépannage

### Erreur 401 Unauthorized
- Vérifiez que le Client ID et Secret sont corrects
- Vérifiez que l'application n'a pas été désactivée dans NinjaOne

### Erreur 403 Forbidden
- Vérifiez les permissions (scopes) de l'application
- Assurez-vous que l'utilisateur a accès aux organisations/appareils

### Erreur 404 Not Found
- Vérifiez l'URL de l'instance NinjaOne
- Assurez-vous d'utiliser la bonne région (US/EU/CA/OC)

## Support

Pour plus d'informations sur l'API NinjaOne :
- Documentation : https://app.ninjarmm.com/apidocs/
- Support : Contactez votre administrateur NinjaOne