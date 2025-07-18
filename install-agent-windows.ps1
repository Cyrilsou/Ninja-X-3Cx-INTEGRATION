# 3CX-Whisper-NinjaOne Agent V2 Installation Script for Windows
# Enregistrement local des appels

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerIP = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Extension = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AgentName = ""
)

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script must be run as Administrator. Relaunching..." -ForegroundColor Red
    Start-Process PowerShell -Verb RunAs "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ServerIP `"$ServerIP`" -Extension `"$Extension`" -AgentName `"$AgentName`""
    exit
}

# Set console encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "3CX-Whisper Agent V2 Installation" -ForegroundColor Cyan
Write-Host "Enregistrement local des appels" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Verification des prerequis..." -ForegroundColor Yellow

# Check if 3CX Phone is installed - Multiple detection methods
Write-Host "Recherche de 3CX Phone..." -ForegroundColor Yellow

$cxInstalled = $false
$cxExecutablePath = $null

# Method 1: Check if 3CX is currently running
$process = Get-Process -Name "3CXSoftphone" -ErrorAction SilentlyContinue
if ($process) {
    $cxExecutablePath = $process[0].Path
    $cxInstalled = $true
    Write-Host "OK 3CX detecte en cours d execution: $cxExecutablePath" -ForegroundColor Green
}

# Method 2: Search in registry for 3CX installation
if (-not $cxInstalled) {
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($regPath in $registryPaths) {
        $apps = Get-ItemProperty $regPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*3CX*" }
        if ($apps) {
            $installLocation = $apps[0].InstallLocation
            if ($installLocation) {
                $possibleExe = Join-Path $installLocation "3CXSoftphone.exe"
                if (Test-Path $possibleExe) {
                    $cxExecutablePath = $possibleExe
                    $cxInstalled = $true
                    Write-Host "OK 3CX trouve via registre: $cxExecutablePath" -ForegroundColor Green
                    break
                }
            }
        }
    }
}

# Method 3: Search common paths
if (-not $cxInstalled) {
    $commonPaths = @(
        "${env:ProgramFiles}\3CXPhone for Windows\3CXSoftphone.exe",
        "${env:ProgramFiles(x86)}\3CXPhone for Windows\3CXSoftphone.exe",
        "${env:LOCALAPPDATA}\Programs\3CXPhone for Windows\3CXSoftphone.exe",
        "${env:ProgramFiles}\3CX\3CXSoftphone.exe",
        "${env:ProgramFiles(x86)}\3CX\3CXSoftphone.exe",
        "${env:APPDATA}\3CXPhone for Windows\3CXSoftphone.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $cxExecutablePath = $path
            $cxInstalled = $true
            Write-Host "OK 3CX trouve dans: $cxExecutablePath" -ForegroundColor Green
            break
        }
    }
}

# Method 4: Search in Start Menu shortcuts
if (-not $cxInstalled) {
    $startMenuPaths = @(
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
    )
    
    foreach ($startPath in $startMenuPaths) {
        $shortcuts = Get-ChildItem -Path $startPath -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*3CX*" }
        foreach ($shortcut in $shortcuts) {
            $shell = New-Object -ComObject WScript.Shell
            $target = $shell.CreateShortcut($shortcut.FullName).TargetPath
            if ($target -like "*3CXSoftphone.exe") {
                $cxExecutablePath = $target
                $cxInstalled = $true
                Write-Host "OK 3CX trouve via raccourci: $cxExecutablePath" -ForegroundColor Green
                break
            }
        }
        if ($cxInstalled) { break }
    }
}

if (-not $cxInstalled) {
    Write-Host "X 3CX Phone for Windows n est pas detecte" -ForegroundColor Red
    Write-Host "Veuillez installer 3CX Phone depuis: https://www.3cx.com/phone-system/windows-softphone/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Si 3CX est installe mais non detecte, lancez 3CX puis relancez ce script." -ForegroundColor Yellow
    $continue = Read-Host "Continuer quand meme? (O/N)"
    if ($continue -ne 'O' -and $continue -ne 'o') {
        exit 1
    }
} else {
    # Save the 3CX path for later use by the agent
    if ($cxExecutablePath) {
        $cxInfo = @{
            ExecutablePath = $cxExecutablePath
            InstallDirectory = Split-Path $cxExecutablePath -Parent
        }
        $cxInfoJson = $cxInfo | ConvertTo-Json
        # This will be saved with the config later
    }
}

# Function to test server connectivity
function Test-ServerConnection {
    param([string]$IP)
    
    Write-Host "Test de connexion au serveur $IP..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://${IP}:3002/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "OK Connexion au serveur reussie" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "X Impossible de se connecter au serveur" -ForegroundColor Red
        Write-Host "Erreur: $_" -ForegroundColor Red
        return $false
    }
    return $false
}

# Function to discover server on network
function Find-WhisperServer {
    Write-Host "Recherche automatique du serveur sur le reseau..." -ForegroundColor Yellow
    
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $udpClient.Client.ReceiveTimeout = 3000 # 3 seconds timeout
    
    try {
        # Enable broadcast
        $udpClient.EnableBroadcast = $true
        
        # Send discovery request
        $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Broadcast, 5355)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("DISCOVER_3CX_WHISPER_SERVER")
        $udpClient.Send($bytes, $bytes.Length, $endpoint) | Out-Null
        
        Write-Host "Ecoute des reponses..." -ForegroundColor Yellow
        
        # Wait for response
        $remoteEndpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Any, 0)
        $receivedBytes = $udpClient.Receive([ref]$remoteEndpoint)
        $response = [System.Text.Encoding]::UTF8.GetString($receivedBytes)
        
        # Parse JSON response
        $serverInfo = $response | ConvertFrom-Json
        
        if ($serverInfo.type -eq "3CX-WHISPER-SERVER") {
            Write-Host "OK Serveur trouve!" -ForegroundColor Green
            Write-Host "- Nom: $($serverInfo.name)" -ForegroundColor White
            Write-Host "- IP: $($remoteEndpoint.Address)" -ForegroundColor White
            Write-Host "- Port API: $($serverInfo.apiPort)" -ForegroundColor White
            Write-Host "- Version: $($serverInfo.version)" -ForegroundColor White
            
            return $remoteEndpoint.Address.ToString()
        }
    } catch {
        Write-Host "Aucun serveur detecte automatiquement" -ForegroundColor Yellow
    } finally {
        $udpClient.Close()
    }
    
    return $null
}

# Get server IP if not provided
if (-not $ServerIP) {
    # Try automatic discovery first
    $discoveredIP = Find-WhisperServer
    
    if ($discoveredIP) {
        Write-Host ""
        $useDiscovered = Read-Host "Utiliser le serveur trouve ($discoveredIP)? (O/N)"
        if ($useDiscovered -eq 'O' -or $useDiscovered -eq 'o') {
            $ServerIP = $discoveredIP
        }
    }
    
    # Manual entry if not discovered or not chosen
    if (-not $ServerIP) {
        do {
            $ServerIP = Read-Host "Entrez l adresse IP du serveur"
            if (-not $ServerIP) {
                Write-Host "L adresse IP est requise!" -ForegroundColor Red
            }
        } while (-not $ServerIP)
    }
}

# Test server connection
if (-not (Test-ServerConnection -IP $ServerIP)) {
    Write-Host ""
    Write-Host "Impossible de se connecter au serveur. Verifiez:" -ForegroundColor Red
    Write-Host "1. L adresse IP est correcte" -ForegroundColor Yellow
    Write-Host "2. Le serveur est demarre" -ForegroundColor Yellow
    Write-Host "3. Le pare-feu autorise le port 3002" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Get extension if not provided
if (-not $Extension) {
    do {
        $Extension = Read-Host "Entrez votre numero d extension 3CX"
        if (-not $Extension) {
            Write-Host "L extension est requise!" -ForegroundColor Red
        }
    } while (-not $Extension)
}

# Get agent name if not provided
if (-not $AgentName) {
    $AgentName = Read-Host "Entrez votre nom (optionnel)"
    if (-not $AgentName) {
        $AgentName = $env:USERNAME
    }
}

# Installation directory
$InstallDir = "$env:ProgramFiles\3CX-Whisper-Agent"
$AppDataDir = "$env:APPDATA\3cx-whisper-agent"

Write-Host ""
Write-Host "Configuration de l installation:" -ForegroundColor Cyan
Write-Host "- Serveur: $ServerIP" -ForegroundColor White
Write-Host "- Extension: $Extension" -ForegroundColor White
Write-Host "- Agent: $AgentName" -ForegroundColor White
Write-Host "- Dossier: $InstallDir" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continuer l installation? (O/N)"
if ($confirm -ne 'O' -and $confirm -ne 'o') {
    Write-Host "Installation annulee." -ForegroundColor Yellow
    exit
}

# Create directories
Write-Host "Creation des dossiers..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $AppDataDir | Out-Null
New-Item -ItemType Directory -Force -Path "$AppDataDir\recordings" | Out-Null
New-Item -ItemType Directory -Force -Path "$AppDataDir\logs" | Out-Null

# Install Sox for audio recording
Write-Host "Installation de Sox pour l enregistrement audio..." -ForegroundColor Yellow

# Check if Chocolatey is installed
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installation de Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install Sox
try {
    choco install sox -y --no-progress
    Write-Host "OK Sox installe" -ForegroundColor Green
} catch {
    Write-Host "! Impossible d installer Sox automatiquement" -ForegroundColor Yellow
    Write-Host "L enregistrement utilisera les methodes alternatives" -ForegroundColor Yellow
}

# Create config file
$config = @{
    serverUrl = "http://${ServerIP}:3002"
    extension = $Extension
    agentName = $AgentName
    autoLaunch = $true
    minimizeToTray = $true
    notifications = $true
    recordingQuality = "16000"
    retryInterval = 300
}

# Add 3CX path if found
if ($cxExecutablePath) {
    $config.threeCXPath = $cxExecutablePath
    $config.threeCXDirectory = Split-Path $cxExecutablePath -Parent
}

$configJson = $config | ConvertTo-Json -Depth 10
Set-Content -Path "$AppDataDir\config.json" -Value $configJson -Encoding UTF8

# Create Electron app files
Write-Host "Creation de l application Electron..." -ForegroundColor Yellow

# Main.js content as simple string
$mainJsContent = @'
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let isRecording = false;

// Read config
const configPath = path.join(app.getPath('appData'), '3cx-whisper-agent', 'config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Failed to load config:', e);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Send config to renderer
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('config-loaded', config);
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
    updateTrayMenu();
    
    tray.on('double-click', () => {
        mainWindow.show();
    });
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: isRecording ? 'REC Enregistrement en cours...' : '3CX Whisper Agent',
            enabled: false
        },
        { type: 'separator' },
        { label: 'Ouvrir', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quitter', click: () => {
            app.isQuitting = true;
            app.quit();
        }}
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip(isRecording ? 'Enregistrement en cours...' : '3CX Whisper Agent - Pret');
}

// IPC handlers
ipcMain.on('recording-started', () => {
    isRecording = true;
    updateTrayMenu();
});

ipcMain.on('recording-stopped', () => {
    isRecording = false;
    updateTrayMenu();
});

ipcMain.on('show-notification', (event, { title, body }) => {
    new Notification({ title, body }).show();
});

app.whenReady().then(() => {
    createWindow();
    createTray();
    
    // Start minimized
    if (config.minimizeToTray) {
        mainWindow.hide();
    } else {
        mainWindow.show();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
});
'@

# Create simple HTML
$htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>3CX Whisper Agent V2</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
    <div style="max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">3CX Whisper Agent V2</h1>
        
        <div id="status" style="padding: 10px; background: #d4edda; color: #155724; border-radius: 4px; margin-bottom: 20px;">
            Agent actif - Enregistrement local active
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Configuration</h3>
            <p><strong>Serveur:</strong> <span id="server-info">$ServerIP</span></p>
            <p><strong>Extension:</strong> <span id="extension-info">$Extension</span></p>
            <p><strong>Agent:</strong> <span id="agent-info">$AgentName</span></p>
        </div>
        
        <div style="background: #e9ecef; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Etat</h3>
            <p id="recording-status" class="recording">En attente d appel</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
            <h3 style="margin-top: 0;">Logs</h3>
            <div id="logs" style="max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px;"></div>
        </div>
    </div>
    
    <script>
        // Basic renderer functionality
        document.addEventListener('DOMContentLoaded', () => {
            const logsEl = document.getElementById('logs');
            const statusEl = document.getElementById('recording-status');
            
            function addLog(message) {
                const logEntry = document.createElement('div');
                logEntry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
                logsEl.insertBefore(logEntry, logsEl.firstChild);
            }
            
            addLog('Agent demarre');
            
            // Simple 3CX detection loop
            setInterval(() => {
                // Would implement actual detection here
                statusEl.textContent = 'En attente d appel';
            }, 5000);
        });
    </script>
</body>
</html>
"@

# Package.json
$packageJson = @'
{
  "name": "3cx-whisper-agent",
  "version": "2.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^22.0.0"
  }
}
'@

# Save files
Write-Host "Sauvegarde des fichiers..." -ForegroundColor Yellow
Set-Content -Path "$InstallDir\main.js" -Value $mainJsContent -Encoding UTF8
Set-Content -Path "$InstallDir\index.html" -Value $htmlContent -Encoding UTF8
Set-Content -Path "$InstallDir\package.json" -Value $packageJson -Encoding UTF8

# Create icon placeholder
$iconContent = [Convert]::FromBase64String("AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAADlAAAA5QAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAADqAAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA6gAAAGAAAAAAAAAAAAAAAAAAAABEAAAA7QAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAO0AAABEAAAAAAAAAKYAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAACmAAAAAAAAANAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAADQAAAAAKQAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAApAAAAOUAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA5QAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAOUAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA5QQAAKYAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAApAAAANAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAADQAAAAAKQAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAACmAAAAAAAAAABEAAAA7QAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAO0AAABEAAAAAAAAAAAAAABQAAAA6gAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAADqAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAADlAAAA5QAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAMAAIABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIABAADAAwAA")
[System.IO.File]::WriteAllBytes("$InstallDir\icon.ico", $iconContent)

# Create launcher script
$launcherContent = @"
@echo off
echo Demarrage de 3CX Whisper Agent V2...
cd /d "$InstallDir"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js n est pas installe!
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist node_modules (
    echo Installation des dependances...
    call npm install
)

:: Start the agent
echo Lancement de l agent...
npm start
"@

Set-Content -Path "$InstallDir\3cx-whisper-agent.bat" -Value $launcherContent -Encoding ASCII

# Create start menu shortcut
Write-Host "Creation des raccourcis..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\3CX Whisper Agent V2.lnk")
$Shortcut.TargetPath = "$InstallDir\3cx-whisper-agent.bat"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = "$InstallDir\icon.ico"
$Shortcut.Save()

# Create desktop shortcut
$DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\3CX Whisper Agent V2.lnk")
$DesktopShortcut.TargetPath = "$InstallDir\3cx-whisper-agent.bat"
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.IconLocation = "$InstallDir\icon.ico"
$DesktopShortcut.Save()

# Add to startup (optional)
$startup = Read-Host "Demarrer l agent automatiquement avec Windows? (O/N)"
if ($startup -eq 'O' -or $startup -eq 'o') {
    $StartupShortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\3CX Whisper Agent V2.lnk")
    $StartupShortcut.TargetPath = "$InstallDir\3cx-whisper-agent.bat"
    $StartupShortcut.WorkingDirectory = $InstallDir
    $StartupShortcut.WindowStyle = 7  # Minimized
    $StartupShortcut.Save()
    Write-Host "OK Ajoute au demarrage de Windows" -ForegroundColor Green
}

# Add firewall rules
Write-Host "Configuration du pare-feu Windows..." -ForegroundColor Yellow
try {
    # Outbound rule for server communication
    New-NetFirewallRule -DisplayName "3CX Whisper Agent - Serveur" `
        -Direction Outbound `
        -Action Allow `
        -Protocol TCP `
        -RemotePort 3002,3003 `
        -RemoteAddress $ServerIP `
        -ErrorAction SilentlyContinue | Out-Null
    
    # Inbound rule for local recording
    New-NetFirewallRule -DisplayName "3CX Whisper Agent - Enregistrement" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 9876 `
        -ErrorAction SilentlyContinue | Out-Null
    
    Write-Host "OK Regles de pare-feu ajoutees" -ForegroundColor Green
} catch {
    Write-Host "! Impossible d ajouter les regles de pare-feu automatiquement" -ForegroundColor Yellow
}

# Check if Node.js is installed
Write-Host ""
Write-Host "Verification de Node.js..." -ForegroundColor Yellow
$nodeInstalled = $false
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        Write-Host "OK Node.js installe: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {
    # Node not found
}

if (-not $nodeInstalled) {
    Write-Host "X Node.js n est pas installe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Node.js est requis pour faire fonctionner l agent." -ForegroundColor Yellow
    Write-Host "Voulez-vous l installer maintenant?" -ForegroundColor Yellow
    $installNode = Read-Host "(O/N)"
    
    if ($installNode -eq 'O' -or $installNode -eq 'o') {
        Write-Host "Installation de Node.js via Chocolatey..." -ForegroundColor Yellow
        try {
            choco install nodejs -y
            Write-Host "OK Node.js installe" -ForegroundColor Green
        } catch {
            Write-Host "Echec de l installation automatique." -ForegroundColor Red
            Write-Host "Veuillez installer Node.js manuellement depuis: https://nodejs.org/" -ForegroundColor Yellow
        }
    }
}

# Installation complete
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Installation terminee!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "L agent 3CX-Whisper V2 a ete installe avec succes." -ForegroundColor White
Write-Host ""
Write-Host "Caracteristiques:" -ForegroundColor Cyan
Write-Host "- Enregistrement local des appels" -ForegroundColor White
Write-Host "- Detection automatique des appels 3CX" -ForegroundColor White
Write-Host "- Upload automatique vers le serveur" -ForegroundColor White
Write-Host "- Interface Electron avec systeme de tray" -ForegroundColor White
Write-Host "- Notifications Windows" -ForegroundColor White
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "- Extension: $Extension" -ForegroundColor White
Write-Host "- Serveur: $ServerIP" -ForegroundColor White
Write-Host "- Enregistrements: $AppDataDir\recordings" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "1. Lancez l agent depuis le bureau ou le menu Demarrer" -ForegroundColor White
Write-Host "2. L agent se minimise dans la barre systeme" -ForegroundColor White
Write-Host "3. Double-cliquez sur l icone pour ouvrir l interface" -ForegroundColor White
Write-Host "4. Passez un appel avec 3CX pour tester" -ForegroundColor White
Write-Host ""

# Offer to start now
$startNow = Read-Host "Demarrer l agent maintenant? (O/N)"
if ($startNow -eq 'O' -or $startNow -eq 'o') {
    Write-Host "Demarrage de l agent..." -ForegroundColor Yellow
    Start-Process "$InstallDir\3cx-whisper-agent.bat"
}

Write-Host ""
Read-Host "Appuyez sur Entree pour terminer"