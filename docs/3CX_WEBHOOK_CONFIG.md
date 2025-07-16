# Configuration des Webhooks 3CX

## Vue d'ensemble

Le système utilise désormais des webhooks 3CX pour une détection en temps réel des appels, remplaçant l'ancien système de polling qui vérifiait l'état toutes les secondes.

## Avantages des webhooks

- **Temps réel** : Notification instantanée des événements d'appel
- **Performance** : Pas de requêtes inutiles, économie de ressources
- **Fiabilité** : Pas de risque de manquer un appel entre deux polls
- **Scalabilité** : Supporte un grand nombre d'agents sans impact

## Configuration dans 3CX

### 1. Créer un Template CRM HTTP

1. Connectez-vous à l'interface d'administration 3CX
2. Allez dans **Intégration** > **CRM**
3. Cliquez sur **Ajouter** > **HTTP Generic**
4. Configurez comme suit :

```
Nom : 3CX-Ninja Webhook
URL : https://votre-serveur.com/webhook/3cx/call-event
Méthode : POST
Content-Type : application/json
```

### 2. Variables du Template

Configurez le body JSON avec ces variables 3CX :

```json
{
  "callId": "[CallID]",
  "caller": "[CallerNumber]",
  "callee": "[CalledNumber]",
  "agentExt": "[AgentNumber]",
  "agentMail": "[AgentEmail]",
  "direction": "[CallDirection]",
  "duration": "[Duration]",
  "wav": "[RecordingURL]",
  "endUtc": "[CallEndTimeUTC]",
  "startTime": "[CallStartTimeUTC]"
}
```

### 3. Déclencheurs

Configurez les déclencheurs pour envoyer les webhooks :

- **Début d'appel** : Quand l'appel passe en état "Established"
- **Fin d'appel** : Quand l'appel passe en état "Released"

### 4. Test de configuration

Utilisez l'endpoint de test pour vérifier la configuration :

```bash
curl -X POST https://votre-serveur.com/webhook/3cx/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Format des données

### Webhook début d'appel
```json
{
  "caller": "+41225551234",
  "callee": "+41225555678",
  "agentExt": "201",
  "agentMail": "agent@company.com",
  "direction": "Inbound",
  "startTime": "2025-07-16T14:30:00Z"
}
```

### Webhook fin d'appel
```json
{
  "callId": "12345",
  "caller": "+41225551234",
  "callee": "+41225555678",
  "agentExt": "201",
  "agentMail": "agent@company.com",
  "direction": "Inbound",
  "duration": "00:04:32",
  "wav": "https://pbx.company.com/recordings/12345.wav",
  "endUtc": "2025-07-16T14:34:32Z"
}
```

## Sécurité

### 1. HTTPS obligatoire
3CX nécessite une connexion HTTPS valide avec certificat SSL.

### 2. Authentification (optionnel)
Ajoutez un secret dans les headers :

```
Headers personnalisés dans 3CX :
X-Webhook-Secret: votre-secret-securise
```

### 3. IP Whitelist
Limitez l'accès aux IPs du serveur 3CX dans votre firewall.

## Troubleshooting

### Le webhook n'est pas reçu
1. Vérifiez les logs 3CX dans **Rapports** > **Logs système**
2. Testez avec l'endpoint `/webhook/3cx/health`
3. Vérifiez le certificat SSL et le firewall

### Données manquantes
Certaines variables peuvent être vides selon la configuration 3CX :
- `[RecordingURL]` : Nécessite l'activation de l'enregistrement
- `[AgentEmail]` : Nécessite la configuration des emails agents

### Performance
- Les webhooks sont traités de manière asynchrone
- Un système de retry est en place en cas d'échec
- Les événements sont mis en queue si le serveur est surchargé

## Migration depuis le polling

1. Configurez les webhooks dans 3CX
2. Testez en parallèle pendant 24h
3. Désactivez le polling dans l'agent :
   ```json
   {
     "polling": {
       "enabled": false
     }
   }
   ```
4. Surveillez les logs pour confirmer la réception des webhooks