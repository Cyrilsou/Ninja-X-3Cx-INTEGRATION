# 3CX-Ninja Realtime Server Setup Script for Windows
# Configuration complète automatisée

# Vérifier l'exécution en tant qu'administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    Write-Host "Relancement avec privilèges administrateur..."
    Start-Process PowerShell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# Définir la politique d'exécution pour ce script
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Couleurs pour l'output
function Write-Info {
    param($Message)
    Write-Host "[INFO] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Fonction pour vérifier les prérequis
function Check-Prerequisites {
    Write-Info "Vérification des prérequis..."
    
    # Vérifier Node.js
    try {
        $nodeVersion = node -v
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 18) {
            Write-Error "Node.js version 18+ requise. Version actuelle: $nodeVersion"
            Write-Host "Téléchargez Node.js depuis: https://nodejs.org/"
            exit 1
        }
        Write-Success "Node.js $nodeVersion détecté"
    }
    catch {
        Write-Error "Node.js n'est pas installé"
        Write-Host "Téléchargez Node.js depuis: https://nodejs.org/"
        exit 1
    }
    
    # Vérifier npm
    try {
        $npmVersion = npm -v
        Write-Success "npm $npmVersion détecté"
    }
    catch {
        Write-Error "npm n'est pas installé"
        exit 1
    }
    
    # Vérifier Git
    try {
        git --version | Out-Null
        Write-Success "Git détecté"
    }
    catch {
        Write-Error "Git n'est pas installé"
        Write-Host "Téléchargez Git depuis: https://git-scm.com/download/win"
        exit 1
    }
    
    # Vérifier Python (pour node-gyp)
    try {
        python --version 2>$null | Out-Null
        Write-Success "Python détecté"
    }
    catch {
        Write-Warning "Python non détecté. Peut être nécessaire pour certains packages natifs"
        $installPython = Read-Host "Installer Python? (recommandé) [O/n]"
        if ($installPython -eq "" -or $installPython -match "^[Oo]$") {
            Write-Info "Installation de Python via npm..."
            npm install --global windows-build-tools
        }
    }
}

# Fonction pour installer Redis
function Install-Redis {
    Write-Info "Vérification de Redis..."
    
    # Vérifier si Redis est installé
    $redisPath = Get-Command redis-server -ErrorAction SilentlyContinue
    
    if ($redisPath) {
        Write-Success "Redis est déjà installé"
        return
    }
    
    $installRedis = Read-Host "Redis n'est pas installé. Voulez-vous l'installer? (recommandé) [O/n]"
    if ($installRedis -eq "" -or $installRedis -match "^[Oo]$") {
        Write-Info "Téléchargement de Redis pour Windows..."
        
        # Créer le dossier Redis
        $redisDir = "C:\Redis"
        if (!(Test-Path $redisDir)) {
            New-Item -ItemType Directory -Path $redisDir | Out-Null
        }
        
        # Télécharger Redis
        $redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.zip"
        $redisZip = "$env:TEMP\redis.zip"
        
        Write-Info "Téléchargement en cours..."
        Invoke-WebRequest -Uri $redisUrl -OutFile $redisZip
        
        # Extraire Redis
        Write-Info "Extraction..."
        Expand-Archive -Path $redisZip -DestinationPath $redisDir -Force
        
        # Ajouter au PATH
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$redisDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$redisDir", "Machine")
            $env:Path = "$env:Path;$redisDir"
        }
        
        # Créer un service Windows
        Write-Info "Configuration du service Redis..."
        & "$redisDir\redis-server.exe" --service-install "$redisDir\redis.windows.conf" --service-name Redis
        
        # Démarrer le service
        Start-Service -Name Redis
        Set-Service -Name Redis -StartupType Automatic
        
        Write-Success "Redis installé et démarré"
        
        # Nettoyer
        Remove-Item $redisZip -Force
    }
}

# Fonction pour configurer l'environnement
function Setup-Environment {
    Write-Info "Configuration de l'environnement..."
    
    if (Test-Path ".env") {
        Write-Warning "Le fichier .env existe déjà"
        $reconfigure = Read-Host "Voulez-vous le reconfigurer? [o/N]"
        if ($reconfigure -notmatch "^[Oo]$") {
            return
        }
        $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item ".env" $backupName
        Write-Info "Sauvegarde créée: $backupName"
    }
    
    # Copier le template
    Copy-Item ".env.example" ".env"
    
    Write-Info "Configuration des variables d'environnement..."
    Write-Host ""
    Write-Host "=== Configuration du serveur ===" -ForegroundColor Cyan
    
    # API Key
    $defaultApiKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $apiKey = Read-Host "API Key pour sécuriser l'accès [$defaultApiKey]"
    if ($apiKey -eq "") { $apiKey = $defaultApiKey }
    
    # Port
    $port = Read-Host "Port du serveur [3000]"
    if ($port -eq "") { $port = "3000" }
    
    Write-Host ""
    Write-Host "=== Configuration 3CX ===" -ForegroundColor Cyan
    $pbxUrl = Read-Host "URL du serveur 3CX (https://...)"
    $cxClientId = Read-Host "3CX Client ID"
    $cxClientSecret = Read-Host "3CX Client Secret"
    $cxWebhookSecret = Read-Host "3CX Webhook Secret (optionnel)"
    
    Write-Host ""
    Write-Host "=== Configuration NinjaOne ===" -ForegroundColor Cyan
    $ninjaClientId = Read-Host "NinjaOne Client ID"
    $ninjaClientSecret = Read-Host "NinjaOne Client Secret"
    $ninjaRefreshToken = Read-Host "NinjaOne Refresh Token"
    $ninjaBoardId = Read-Host "NinjaOne Board ID par défaut [5]"
    if ($ninjaBoardId -eq "") { $ninjaBoardId = "5" }
    
    Write-Host ""
    Write-Host "=== Configuration Whisper ===" -ForegroundColor Cyan
    Write-Host "Modèles disponibles: tiny, base, small, medium, large"
    $whisperModel = Read-Host "Modèle Whisper à utiliser [base]"
    if ($whisperModel -eq "") { $whisperModel = "base" }
    
    # Mettre à jour le fichier .env
    $envContent = Get-Content ".env"
    $envContent = $envContent -replace "your-secure-api-key-here", $apiKey
    $envContent = $envContent -replace "PORT=3000", "PORT=$port"
    $envContent = $envContent -replace "https://your-3cx-server.com", $pbxUrl
    $envContent = $envContent -replace "your-3cx-client-id", $cxClientId
    $envContent = $envContent -replace "your-3cx-client-secret", $cxClientSecret
    $envContent = $envContent -replace "your-webhook-secret", $cxWebhookSecret
    $envContent = $envContent -replace "your-ninja-client-id", $ninjaClientId
    $envContent = $envContent -replace "your-ninja-client-secret", $ninjaClientSecret
    $envContent = $envContent -replace "your-ninja-refresh-token", $ninjaRefreshToken
    $envContent = $envContent -replace "WHISPER_MODEL=base", "WHISPER_MODEL=$whisperModel"
    
    Set-Content ".env" $envContent
    
    # Sauvegarder l'API Key dans un fichier séparé
    Set-Content "API_KEY.txt" "API Key: $apiKey`nConservez cette clé en sécurité!"
    
    Write-Success "Configuration sauvegardée dans .env"
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Info "Installation des dépendances npm..."
    npm install
    
    Write-Info "Installation de Whisper..."
    try {
        npm run setup:whisper --workspace=server
    }
    catch {
        Write-Warning "L'installation de Whisper a échoué. Vous devrez peut-être l'installer manuellement"
    }
    
    Write-Success "Dépendances installées"
}

# Fonction pour créer les dossiers nécessaires
function Create-Directories {
    Write-Info "Création des dossiers nécessaires..."
    
    $dirs = @("logs", "data", "temp\audio", "uploads")
    foreach ($dir in $dirs) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Success "Dossiers créés"
}

# Fonction pour compiler le projet
function Build-Project {
    Write-Info "Compilation du projet..."
    npm run build
    Write-Success "Projet compilé"
}

# Fonction pour configurer PM2
function Setup-PM2 {
    Write-Info "Configuration de PM2 pour la production..."
    
    try {
        pm2 --version | Out-Null
    }
    catch {
        $installPM2 = Read-Host "PM2 n'est pas installé. Voulez-vous l'installer? (recommandé pour la production) [O/n]"
        if ($installPM2 -eq "" -or $installPM2 -match "^[Oo]$") {
            npm install -g pm2
            npm install -g pm2-windows-startup
            Write-Success "PM2 installé"
        }
        else {
            return
        }
    }
    
    # Démarrer avec PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Configurer le démarrage automatique
    $autoStart = Read-Host "Configurer PM2 pour démarrer au boot? [O/n]"
    if ($autoStart -eq "" -or $autoStart -match "^[Oo]$") {
        pm2-startup install
        Write-Success "PM2 configuré pour le démarrage automatique"
    }
    
    Write-Success "PM2 configuré"
}

# Fonction pour configurer le firewall Windows
function Setup-Firewall {
    Write-Info "Configuration du firewall Windows..."
    
    $port = (Get-Content .env | Select-String "PORT=(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
    if ($port -eq "") { $port = "3000" }
    
    $ruleName = "3CX-Ninja-Realtime-Server"
    
    # Vérifier si la règle existe déjà
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    
    if ($existingRule) {
        Write-Warning "La règle de firewall existe déjà"
    }
    else {
        $addRule = Read-Host "Autoriser le port $port dans le firewall Windows? [O/n]"
        if ($addRule -eq "" -or $addRule -match "^[Oo]$") {
            New-NetFirewallRule -DisplayName $ruleName `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort $port `
                -Action Allow `
                -Profile Any
            
            Write-Success "Port $port ouvert dans le firewall Windows"
        }
    }
}

# Fonction pour tester l'installation
function Test-Installation {
    Write-Info "Test de l'installation..."
    
    $port = (Get-Content .env | Select-String "PORT=(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
    if ($port -eq "") { $port = "3000" }
    
    # Vérifier si PM2 gère déjà le serveur
    $pm2Running = $false
    try {
        $pm2List = pm2 list 2>$null
        if ($pm2List -match "3cx-ninja-server") {
            Write-Info "Le serveur est déjà démarré avec PM2"
            $pm2Running = $true
        }
    }
    catch {}
    
    if (!$pm2Running) {
        Write-Info "Démarrage du serveur pour le test..."
        $proc = Start-Process npm -ArgumentList "run start:prod" -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 5
    }
    
    # Test de santé
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "Le serveur répond correctement"
            
            # Test webhook
            try {
                $webhookTest = Invoke-WebRequest -Uri "http://localhost:$port/webhook/3cx/test" `
                    -Method POST `
                    -ContentType "application/json" `
                    -Body '{"test": true}' `
                    -UseBasicParsing
                    
                if ($webhookTest.StatusCode -eq 200) {
                    Write-Success "Les webhooks fonctionnent"
                }
            }
            catch {
                Write-Warning "Échec du test webhook"
            }
        }
    }
    catch {
        Write-Error "Le serveur ne répond pas"
    }
    
    # Arrêter le serveur de test si nécessaire
    if (!$pm2Running -and $proc) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

# Fonction pour afficher les instructions finales
function Show-FinalInstructions {
    $port = (Get-Content .env | Select-String "PORT=(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
    if ($port -eq "") { $port = "3000" }
    
    $apiKey = (Get-Content .env | Select-String "API_KEY=(.+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
    
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   Installation terminée avec succès!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Configurer les webhooks dans 3CX:" -ForegroundColor Yellow
    Write-Host "   URL: http://${ipAddress}:${port}/webhook/3cx/call-event"
    Write-Host ""
    Write-Host "2. Démarrer le serveur:" -ForegroundColor Yellow
    
    try {
        $pm2List = pm2 list 2>$null
        if ($pm2List -match "3cx-ninja-server") {
            Write-Host "   Le serveur est déjà démarré avec PM2"
            Write-Host "   Commandes PM2:"
            Write-Host "   - pm2 status        # Voir le statut"
            Write-Host "   - pm2 logs          # Voir les logs"
            Write-Host "   - pm2 restart all   # Redémarrer"
        }
    }
    catch {
        Write-Host "   npm run start:prod  # Mode production"
        Write-Host "   npm run dev         # Mode développement"
    }
    
    Write-Host ""
    Write-Host "3. Accéder au dashboard:" -ForegroundColor Yellow
    Write-Host "   http://localhost:$port"
    Write-Host ""
    Write-Host "4. Installer l'agent sur les postes:" -ForegroundColor Yellow
    Write-Host "   cd agent && npm run dist"
    Write-Host ""
    Write-Host "Documentation complète: .\docs\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "API Key: $apiKey" -ForegroundColor Red
    Write-Host "(Conservez cette clé en sécurité - aussi dans API_KEY.txt)" -ForegroundColor Red
    Write-Host ""
    
    # Ouvrir le navigateur
    $openBrowser = Read-Host "Ouvrir le dashboard dans le navigateur? [O/n]"
    if ($openBrowser -eq "" -or $openBrowser -match "^[Oo]$") {
        Start-Process "http://localhost:$port"
    }
}

# Menu principal
function Main {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  3CX-Ninja Realtime Server Setup" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Check-Prerequisites
    Install-Redis
    Setup-Environment
    Install-Dependencies
    Create-Directories
    Build-Project
    Setup-Firewall
    
    $setupPM2 = Read-Host "Configurer PM2 pour la production? [O/n]"
    if ($setupPM2 -eq "" -or $setupPM2 -match "^[Oo]$") {
        Setup-PM2
    }
    
    Test-Installation
    Show-FinalInstructions
    
    Read-Host "Appuyez sur Entrée pour terminer"
}

# Exécuter le script
Main