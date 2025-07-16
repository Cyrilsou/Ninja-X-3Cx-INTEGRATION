# 🚀 Guide de démarrage rapide - 3CX-Ninja Realtime

## ⏱️ Installation en 15 minutes

### 📋 Checklist avant de commencer

- [ ] **Serveur Ubuntu** 20.04+ avec accès root
- [ ] **3CX** - Accès administrateur
- [ ] **NinjaOne** - Compte avec accès API
- [ ] **Nom de domaine** pointant vers votre serveur (optionnel)

---

## 🖥️ Étape 1 : Installation du serveur (5 min)

### Option A : Installation automatique ⚡

```bash
# Connectez-vous en SSH à votre serveur Ubuntu
ssh root@votre-serveur.com

# Téléchargez et exécutez le script d'installation
wget -qO- https://raw.githubusercontent.com/your-org/3cx-ninja-realtime/main/setup-ubuntu-server.sh | bash
```

**Le script va :**
- ✅ Installer tous les prérequis
- ✅ Configurer Nginx + SSL automatique
- ✅ Créer le service systemd
- ✅ Configurer le firewall
- ✅ Installer Whisper pour la transcription

### Option B : Installation Docker 🐳

```bash
# Cloner le projet
git clone https://github.com/your-org/3cx-ninja-realtime.git
cd 3cx-ninja-realtime

# Configuration rapide
cp .env.example .env
nano .env  # Éditez les variables de base

# Démarrage
docker-compose up -d
```

---

## ⚙️ Étape 2 : Configuration de base (3 min)

### 1. Accès à l'interface admin

Ouvrez votre navigateur : `https://votre-serveur.com/admin`

**Identifiants par défaut :**
- Email : `admin@3cx-ninja.local`
- Mot de passe : `admin123`

> ⚠️ **Changez immédiatement le mot de passe par défaut !**

### 2. Récupération de la clé API

Dans l'interface admin :
1. Allez dans **Sécurité** → **Clés API**
2. **Copiez** la clé générée (format : `sk-...`)
3. **Conservez-la** précieusement

---

## 📞 Étape 3 : Configuration 3CX (4 min)

### 1. Création du webhook

1. **Connectez-vous** à votre administration 3CX
2. **Allez dans** `Paramètres` → `CRM` → `Générique HTTP`
3. **Créez** un nouveau template :

**Configuration :**
```
Nom: 3CX-Ninja Webhook
URL: https://votre-serveur.com/webhook/3cx/call-event
Méthode: POST
Content-Type: application/json
```

**Body JSON :**
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
  "endUtc": "[CallEndTimeUTC]"
}
```

### 2. Activation des déclencheurs

**Cochez :**
- ✅ `Appel établi`
- ✅ `Appel terminé`

### 3. Test du webhook

Dans l'interface admin 3CX-Ninja :
1. **Allez dans** `Webhooks 3CX`
2. **Cliquez** sur `Tester le webhook`
3. **Vérifiez** que le test réussit ✅

---

## 🥷 Étape 4 : Configuration NinjaOne (3 min)

### 1. Création de l'application OAuth2

1. **Connectez-vous** à NinjaOne
2. **Allez dans** `Administration` → `Apps` → `API`
3. **Créez** une application :
   - Nom : `3CX-Ninja Integration`
   - Type : `Server Application`

### 2. Configuration des scopes

**Sélectionnez :**
- ✅ `ticketing:read`
- ✅ `ticketing:write`
- ✅ `contacts:read`
- ✅ `users:read`

### 3. Récupération des identifiants

**Copiez :**
- `Client ID`
- `Client Secret`

### 4. Génération du refresh token

Dans l'interface admin 3CX-Ninja :
1. **Allez dans** `Configuration système` → `NinjaOne`
2. **Saisissez** Client ID et Secret
3. **Cliquez** sur `Générer le token`
4. **Suivez** le processus d'autorisation
5. **Le token** est automatiquement sauvegardé

---

## 💻 Étape 5 : Installation des agents (1 min par poste)

### Installation automatique

#### Windows (Administrateur)
```powershell
powershell -c "irm https://votre-serveur.com/install-agent.ps1 | iex" `
  -ServerUrl "https://votre-serveur.com" `
  -ApiKey "sk-your-api-key"
```

#### macOS/Linux
```bash
curl -sSL https://votre-serveur.com/install-agent.sh | bash -s -- \
  --server https://votre-serveur.com \
  --key sk-your-api-key
```

### Configuration de l'agent

Au premier démarrage, l'agent demande :
- **Email** : Email de l'agent dans 3CX
- **Extension** : Numéro d'extension 3CX
- **Nom** : Nom d'affichage

L'agent se connecte automatiquement et apparaît dans l'interface admin.

---

## ✅ Étape 6 : Test complet (1 min)

### 1. Vérification des connexions

Dans l'interface admin :
1. **Tableau de bord** → Vérifiez que tous les services sont ✅
2. **Gestion agents** → Vérifiez que les agents sont connectés
3. **Webhooks 3CX** → Test de connexion ✅

### 2. Test d'appel

1. **Passez** un appel test depuis un poste configuré
2. **Vérifiez** que l'appel apparaît dans le dashboard
3. **Attendez** la fin d'appel
4. **Vérifiez** qu'un ticket est créé dans NinjaOne

---

## 🎯 Configuration avancée (optionnel)

### Personnalisation des tickets

Dans l'interface admin :
1. **Configuration système** → **NinjaOne**
2. **Configurez** :
   - Board de destination
   - Statut par défaut
   - Priorité par défaut
   - Template de description

### Monitoring avancé

**Netdata** (installé automatiquement) :
- Accès : `https://votre-serveur.com:19999`
- Monitoring système en temps réel

### SSL automatique

Si vous avez un nom de domaine :
```bash
# SSL automatique avec Let's Encrypt (déjà configuré)
sudo certbot --nginx -d votre-domaine.com
```

---

## 🚨 Dépannage express

### Problème : Agent ne se connecte pas
```bash
# Vérifiez la connectivité
curl https://votre-serveur.com/health

# Vérifiez l'API Key
curl -H "Authorization: Bearer sk-your-key" https://votre-serveur.com/api/health
```

### Problème : Webhooks 3CX ne marchent pas
```bash
# Test direct
curl -X POST https://votre-serveur.com/webhook/3cx/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Problème : Transcription ne fonctionne pas
```bash
# Vérification Whisper
sudo systemctl status 3cx-ninja
sudo journalctl -u 3cx-ninja -f
```

---

## 📞 Support rapide

### Diagnostic automatique

Dans l'agent desktop :
1. **Cliquez** sur l'icône d'outils 🔧
2. **Lancez** le diagnostic complet
3. **Suivez** les recommandations

### Logs en temps réel

```bash
# Logs du serveur
sudo journalctl -u 3cx-ninja -f

# Statut global
sudo systemctl status 3cx-ninja redis nginx
```

### Redémarrage d'urgence

```bash
# Redémarrage complet
sudo systemctl restart 3cx-ninja redis nginx
```

---

## 🎉 Félicitations !

Votre installation 3CX-Ninja Realtime est maintenant **opérationnelle** !

### Prochaines étapes :

1. **Formez** vos agents à l'utilisation
2. **Personnalisez** les templates de tickets
3. **Configurez** les alertes et notifications
4. **Explorez** l'interface d'administration

### Ressources utiles :

- 📚 **Documentation complète** : `docs/README.md`
- 🎥 **Tutoriels vidéo** : https://youtube.com/3cx-ninja
- 💬 **Support communauté** : https://discord.gg/3cx-ninja
- 🐛 **Signaler un bug** : https://github.com/your-org/3cx-ninja-realtime/issues

---

**🚀 Votre système de transcription et ticketing automatique est prêt !**

---

*Temps total d'installation : ~15 minutes*  
*Dernière mise à jour : 16 juillet 2025*