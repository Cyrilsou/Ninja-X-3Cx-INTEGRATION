# Script de setup automatique complet pour 3CX-Ninja Realtime Server (Windows)
# Ce script configure tout le nécessaire pour faire fonctionner le serveur sur Windows

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

# Couleurs pour l'affichage
function Write-Info($message) {
    Write-Host "[INFO] " -ForegroundColor Blue -NoNewline
    Write-Host $message
}

function Write-Success($message) {
    Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline
    Write-Host $message
}

function Write-Warning($message) {
    Write-Host "[WARNING] " -ForegroundColor Yellow -NoNewline
    Write-Host $message
}

function Write-Error($message) {
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $message
}

# Bannière
Clear-Host
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║           3CX-NINJA REALTIME - SETUP AUTOMATIQUE          ║" -ForegroundColor Blue
Write-Host "║                 Configuration Serveur Windows             ║" -ForegroundColor Blue
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "package.json") -or -not (Test-Path "server")) {
    Write-Error "Ce script doit être exécuté depuis la racine du projet 3cx-ninja-realtime"
    exit 1
}

# 1. Vérifier les prérequis système
Write-Info "Vérification des prérequis système..."

# Node.js
try {
    $nodeVersion = node -v
    $nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajorVersion -lt 18) {
        Write-Error "Node.js version $nodeVersion détectée. Version 18+ requise."
        Write-Host "Télécharger Node.js: https://nodejs.org/"
        exit 1
    }
    Write-Success "Node.js $nodeVersion détecté"
} catch {
    Write-Error "Node.js n'est pas installé. Veuillez installer Node.js 18+"
    Write-Host "Télécharger: https://nodejs.org/"
    exit 1
}

# npm
try {
    $npmVersion = npm -v
    Write-Success "npm $npmVersion détecté"
} catch {
    Write-Error "npm n'est pas installé"
    exit 1
}

# FFmpeg
try {
    ffmpeg -version | Out-Null
    Write-Success "FFmpeg détecté"
} catch {
    Write-Warning "FFmpeg n'est pas installé. Installation recommandée pour le traitement audio."
    Write-Host "Télécharger: https://ffmpeg.org/download.html"
    Write-Host "Ou avec Chocolatey: choco install ffmpeg"
}

# 2. Installation des dépendances
Write-Info "Installation des dépendances npm..."
npm install --silent
Write-Success "Dépendances installées"

# 3. Compilation des projets
Write-Info "Compilation des projets..."

# Shared
Write-Info "Compilation du package shared..."
Set-Location shared
npm run build
Set-Location ..
Write-Success "Package shared compilé"

# Server
Write-Info "Compilation du serveur..."
Set-Location server
npm run build
Set-Location ..
Write-Success "Serveur compilé"

# 4. Configuration de l'environnement
Write-Info "Configuration de l'environnement..."

$envFile = "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Info "Création du fichier .env..."
    
    Write-Host ""
    Write-Host "Configuration requise:" -ForegroundColor Yellow
    Write-Host ""
    
    # 3CX
    $threecxUrl = Read-Host "URL du serveur 3CX (ex: http://192.168.1.100:5000)"
    $threecxClientId = Read-Host "3CX Client ID"
    $threecxClientSecret = Read-Host "3CX Client Secret"
    
    Write-Host ""
    
    # NinjaOne
    $ninjaClientId = Read-Host "NinjaOne Client ID"
    $ninjaClientSecret = Read-Host "NinjaOne Client Secret"
    $ninjaRefreshToken = Read-Host "NinjaOne Refresh Token"
    
    Write-Host ""
    
    # API Key
    $apiKey = Read-Host "Clé API pour sécuriser l'accès (laisser vide pour générer)"
    if ([string]::IsNullOrEmpty($apiKey)) {
        $apiKey = [System.Guid]::NewGuid().ToString("N")
        Write-Info "Clé API générée: $apiKey"
    }
    
    # Créer le fichier .env
    $envContent = @"
# Configuration 3CX
THREECX_PBX_URL=$threecxUrl
THREECX_CLIENT_ID=$threecxClientId
THREECX_CLIENT_SECRET=$threecxClientSecret

# Configuration NinjaOne
NINJA_CLIENT_ID=$ninjaClientId
NINJA_CLIENT_SECRET=$ninjaClientSecret
NINJA_REFRESH_TOKEN=$ninjaRefreshToken

# Sécurité
API_KEY=$apiKey

# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_URL=redis://localhost:6379

# Discovery
ENABLE_BROADCAST=true
DISCOVERY_PORT=53434
"@
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Success "Fichier .env créé"
} else {
    Write-Warning "Fichier .env déjà existant, conservation de la configuration actuelle"
}

# 5. Création des dossiers nécessaires
Write-Info "Création des dossiers nécessaires..."
New-Item -ItemType Directory -Force -Path "server\data\temp" | Out-Null
New-Item -ItemType Directory -Force -Path "server\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "server\models\whisper" | Out-Null
Write-Success "Dossiers créés"

# 6. Configuration Redis (désactivé par défaut sur Windows)
Write-Info "Configuration de Redis désactivée (installation manuelle requise sur Windows)"
$configPath = "server\config\default.json"
$config = Get-Content $configPath -Raw
$config = $config -replace '"enabled": true', '"enabled": false'
$config | Out-File -FilePath $configPath -Encoding UTF8

# 7. Création d'un raccourci de démarrage
Write-Info "Création du raccourci de démarrage..."
$startScript = @'
@echo off
title 3CX-Ninja Realtime Server
cd /d "%~dp0server"
echo Démarrage du serveur 3CX-Ninja Realtime...
node dist\index.js
pause
'@
$startScript | Out-File -FilePath "start-server.bat" -Encoding ASCII
Write-Success "Fichier start-server.bat créé"

# 8. Création d'un service Windows (optionnel, nécessite node-windows)
if ($isAdmin) {
    $createService = Read-Host "Voulez-vous créer un service Windows? (nécessite les droits admin) (o/N)"
    if ($createService -eq 'o') {
        Write-Info "Installation du service Windows..."
        
        # Créer le script d'installation du service
        $serviceScript = @'
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: '3CX-Ninja Realtime',
  description: 'Service de transcription et intégration 3CX-NinjaOne',
  script: path.join(__dirname, 'dist', 'index.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: {
    name: 'NODE_ENV',
    value: 'production'
  }
});

svc.on('install', function() {
  console.log('Service installé avec succès');
  svc.start();
});

svc.on('error', function(error) {
  console.error('Erreur:', error);
});

svc.install();
'@
        
        Set-Location server
        npm install node-windows --save-dev
        $serviceScript | Out-File -FilePath "install-service.js" -Encoding UTF8
        node install-service.js
        Set-Location ..
        
        Write-Success "Service Windows créé"
    }
}

# 9. Création du fichier de configuration IIS (optionnel)
$iisConfig = @'
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server/dist/index.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server\/dist\/index.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}" />
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="server/dist/index.js" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <add segment="node_modules" />
        </hiddenSegments>
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
    <iisnode node_env="production" />
  </system.webServer>
</configuration>
'@
$iisConfig | Out-File -FilePath "web.config" -Encoding UTF8

# 10. Résumé de l'installation
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              INSTALLATION TERMINÉE AVEC SUCCÈS            ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Success "Configuration terminée!"
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Démarrer le serveur:"
Write-Host "   - Double-cliquer sur start-server.bat"
Write-Host "   - OU dans PowerShell: cd server && npm start"
Write-Host ""

Write-Host "2. Accéder aux interfaces:"
Write-Host "   - Dashboard principal: http://localhost:3000"
Write-Host "   - Dashboard TV: http://localhost:3000/tv"
Write-Host "   - API Health: http://localhost:3000/health"
Write-Host ""

Write-Host "3. (Optionnel) Installer les outils supplémentaires:"
Write-Host "   - Redis pour Windows: https://github.com/microsoftarchive/redis/releases"
Write-Host "   - FFmpeg: https://ffmpeg.org/download.html"
Write-Host ""

Write-Host "4. Configurer le webhook dans 3CX:"
Write-Host "   URL: http://votre-serveur:3000/webhook/3cx"
Write-Host ""

if (Test-Path $envFile) {
    Write-Host "Configuration sauvegardée dans: $envFile" -ForegroundColor Green
    Write-Host "IMPORTANT: Gardez votre clé API en sécurité!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Documentation complète: voir README.md" -ForegroundColor Blue
Write-Host ""

# Demander si on démarre le serveur maintenant
$start = Read-Host "Voulez-vous démarrer le serveur maintenant? (o/N)"
if ($start -eq 'o') {
    Start-Process "start-server.bat"
}