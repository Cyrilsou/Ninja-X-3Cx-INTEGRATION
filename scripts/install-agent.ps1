# Script d'installation automatique de l'agent 3CX-Ninja pour Windows
# Usage: powershell -c "irm https://server.com/install-agent.ps1 | iex"

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [string]$InstallDir = "$env:LOCALAPPDATA\3cx-ninja-agent",
    
    [switch]$NoDesktop
)

# Couleurs
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White",
        [string]$Prefix = ""
    )
    
    $colors = @{
        "Red" = "Red"
        "Green" = "Green"
        "Yellow" = "Yellow"
        "Blue" = "Blue"
        "White" = "White"
    }
    
    Write-Host "$Prefix$Message" -ForegroundColor $colors[$Color]
}

function Write-Info { param([string]$Message) Write-ColorOutput -Message $Message -Color "Blue" -Prefix "[INFO] " }
function Write-Success { param([string]$Message) Write-ColorOutput -Message $Message -Color "Green" -Prefix "[✓] " }
function Write-Warning { param([string]$Message) Write-ColorOutput -Message $Message -Color "Yellow" -Prefix "[!] " }
function Write-Error { param([string]$Message) Write-ColorOutput -Message $Message -Color "Red" -Prefix "[✗] " }

# Fonction pour télécharger l'agent
function Download-Agent {
    Write-Info "Téléchargement de l'agent..."
    
    # Créer le répertoire d'installation
    if (!(Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    # URL de l'agent Windows
    $agentUrl = "$ServerUrl/download/agent/3cx-ninja-agent-setup.exe"
    $agentPath = "$InstallDir\3cx-ninja-agent-setup.exe"
    
    try {
        # Télécharger avec progress
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($agentUrl, $agentPath)
        Write-Success "Agent téléchargé"
        return $agentPath
    }
    catch {
        Write-Error "Échec du téléchargement: $($_.Exception.Message)"
        exit 1
    }
}

# Fonction pour installer l'agent
function Install-Agent {
    param([string]$InstallerPath)
    
    Write-Info "Installation de l'agent..."
    
    try {
        # Exécuter l'installateur en mode silencieux
        $process = Start-Process -FilePath $InstallerPath -ArgumentList "/S", "/D=$InstallDir" -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Success "Agent installé avec succès"
        } else {
            Write-Error "Échec de l'installation (code: $($process.ExitCode))"
            exit 1
        }
    }
    catch {
        Write-Error "Erreur lors de l'installation: $($_.Exception.Message)"
        exit 1
    }
}

# Fonction pour créer la configuration
function Create-Config {
    Write-Info "Création de la configuration..."
    
    $config = @{
        serverUrl = $ServerUrl
        apiKey = $ApiKey
        autoStart = $true
        minimizeToTray = $true
        language = "fr"
        updateChannel = "stable"
    } | ConvertTo-Json -Depth 3
    
    $configPath = "$InstallDir\config.json"
    Set-Content -Path $configPath -Value $config -Encoding UTF8
    
    Write-Success "Configuration créée"
}

# Fonction pour créer le raccourci bureau
function Create-DesktopShortcut {
    if ($NoDesktop) {
        return
    }
    
    Write-Info "Création du raccourci bureau..."
    
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = "$desktopPath\3CX-Ninja Agent.lnk"
    $targetPath = "$InstallDir\3cx-ninja-agent.exe"
    
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetPath
        $shortcut.WorkingDirectory = $InstallDir
        $shortcut.Description = "Agent de transcription temps réel pour 3CX"
        $shortcut.Save()
        
        Write-Success "Raccourci bureau créé"
    }
    catch {
        Write-Warning "Impossible de créer le raccourci bureau: $($_.Exception.Message)"
    }
}

# Fonction pour configurer le démarrage automatique
function Setup-AutoStart {
    Write-Info "Configuration du démarrage automatique..."
    
    $startupPath = [Environment]::GetFolderPath("Startup")
    $shortcutPath = "$startupPath\3CX-Ninja Agent.lnk"
    $targetPath = "$InstallDir\3cx-ninja-agent.exe"
    
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetPath
        $shortcut.Arguments = "--minimized"
        $shortcut.WorkingDirectory = $InstallDir
        $shortcut.WindowStyle = 7  # Minimized
        $shortcut.Save()
        
        Write-Success "Démarrage automatique configuré"
    }
    catch {
        Write-Warning "Impossible de configurer le démarrage automatique: $($_.Exception.Message)"
    }
}

# Fonction pour tester la connexion
function Test-Connection {
    Write-Info "Test de connexion au serveur..."
    
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Connexion au serveur réussie"
        } else {
            Write-Warning "Réponse inattendue du serveur (code: $($response.StatusCode))"
        }
    }
    catch {
        Write-Warning "Impossible de se connecter au serveur: $($_.Exception.Message)"
    }
}

# Fonction pour démarrer l'agent
function Start-Agent {
    Write-Info "Démarrage de l'agent..."
    
    $agentPath = "$InstallDir\3cx-ninja-agent.exe"
    
    if (Test-Path $agentPath) {
        try {
            Start-Process -FilePath $agentPath -ArgumentList "--minimized" -WindowStyle Hidden
            Write-Success "Agent démarré"
        }
        catch {
            Write-Warning "Impossible de démarrer l'agent: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "Agent non trouvé à: $agentPath"
    }
}

# Fonction pour configurer le pare-feu Windows
function Configure-Firewall {
    Write-Info "Configuration du pare-feu Windows..."
    
    try {
        $agentPath = "$InstallDir\3cx-ninja-agent.exe"
        
        # Ajouter une règle pour l'agent
        New-NetFirewallRule -DisplayName "3CX-Ninja Agent" `
            -Direction Inbound `
            -Program $agentPath `
            -Action Allow `
            -Profile Any `
            -ErrorAction SilentlyContinue
            
        Write-Success "Règle de pare-feu ajoutée"
    }
    catch {
        Write-Warning "Impossible de configurer le pare-feu: $($_.Exception.Message)"
    }
}

# Fonction principale
function Main {
    Write-Host ""
    Write-ColorOutput -Message "3CX-Ninja Agent - Installation automatique" -Color "Blue"
    Write-Host "============================================="
    Write-Host ""
    
    # Vérifier les privilèges administrateur
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    
    if (-not $isAdmin) {
        Write-Warning "Exécution sans privilèges administrateur"
        Write-Info "Certaines fonctionnalités peuvent être limitées"
    }
    
    # Valider les paramètres
    if (-not $ServerUrl -or -not $ApiKey) {
        Write-Error "URL du serveur et clé API requis"
        Write-Host ""
        Write-Host "Usage: powershell -c `"irm https://server.com/install-agent.ps1 | iex`" -ServerUrl `"https://server.com`" -ApiKey `"YOUR_KEY`""
        exit 1
    }
    
    # Exécuter l'installation
    try {
        $installerPath = Download-Agent
        Install-Agent -InstallerPath $installerPath
        Create-Config
        Create-DesktopShortcut
        Setup-AutoStart
        
        if ($isAdmin) {
            Configure-Firewall
        }
        
        Test-Connection
        Start-Agent
        
        # Nettoyer
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        
        Write-Host ""
        Write-Success "Installation terminée avec succès!"
        Write-Host ""
        Write-Host "L'agent 3CX-Ninja est maintenant installé et configuré."
        Write-Host "Il démarrera automatiquement au démarrage du système."
        Write-Host ""
        Write-Host "Configuration:"
        Write-Host "  - Répertoire: $InstallDir"
        Write-Host "  - Serveur: $ServerUrl"
        Write-Host "  - Démarrage auto: Activé"
        Write-Host ""
        Write-Host "Commandes utiles:"
        Write-Host "  - Démarrer: $InstallDir\3cx-ninja-agent.exe"
        Write-Host "  - Configurer: $InstallDir\config.json"
        Write-Host "  - Désinstaller: $InstallDir\uninstall.exe"
        Write-Host ""
    }
    catch {
        Write-Error "Erreur lors de l'installation: $($_.Exception.Message)"
        exit 1
    }
}

# Exécuter si les paramètres sont fournis
if ($ServerUrl -and $ApiKey) {
    Main
} else {
    Write-Host "Ce script nécessite des paramètres. Utilisez:"
    Write-Host "powershell -c `"irm https://server.com/install-agent.ps1 | iex`" -ServerUrl `"https://server.com`" -ApiKey `"YOUR_KEY`""
}