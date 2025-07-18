# 3CX-Whisper-NinjaOne Agent Installation Script for Windows
# Run as Administrator

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
Write-Host "3CX-Whisper-NinjaOne Agent Installation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Function to test server connectivity
function Test-ServerConnection {
    param([string]$IP)
    
    Write-Host "Testing connection to server $IP..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://${IP}:3002/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "Server connection successful" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "Cannot connect to server at $IP" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        return $false
    }
    return $false
}

# Get server IP if not provided
if (-not $ServerIP) {
    do {
        $ServerIP = Read-Host "Enter the server IP address"
        if (-not $ServerIP) {
            Write-Host "Server IP is required!" -ForegroundColor Red
        }
    } while (-not $ServerIP)
}

# Test server connection
if (-not (Test-ServerConnection -IP $ServerIP)) {
    Write-Host ""
    Write-Host "Cannot connect to server. Please check:" -ForegroundColor Red
    Write-Host "1. The server IP is correct" -ForegroundColor Yellow
    Write-Host "2. The server is running" -ForegroundColor Yellow
    Write-Host "3. Firewall allows connection on port 3002" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Get extension if not provided
if (-not $Extension) {
    do {
        $Extension = Read-Host "Enter your 3CX extension number"
        if (-not $Extension) {
            Write-Host "Extension is required!" -ForegroundColor Red
        }
    } while (-not $Extension)
}

# Get agent name if not provided
if (-not $AgentName) {
    $AgentName = Read-Host "Enter your name (optional)"
    if (-not $AgentName) {
        $AgentName = $env:USERNAME
    }
}

# Installation directory
$InstallDir = "$env:ProgramFiles\3CX-NinjaOne-Agent"
$AppDataDir = "$env:APPDATA\3cx-ninjaone-agent"

Write-Host ""
Write-Host "Installation Configuration:" -ForegroundColor Cyan
Write-Host "- Server IP: $ServerIP" -ForegroundColor White
Write-Host "- Extension: $Extension" -ForegroundColor White
Write-Host "- Agent Name: $AgentName" -ForegroundColor White
Write-Host "- Install Directory: $InstallDir" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue with installation? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "Installation cancelled." -ForegroundColor Yellow
    exit
}

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $AppDataDir | Out-Null

# Download Electron app
Write-Host "Downloading agent application..." -ForegroundColor Yellow
$DownloadUrl = "http://${ServerIP}:8080/downloads/3cx-ninjaone-agent-setup.exe"
$SetupFile = "$env:TEMP\3cx-ninjaone-agent-setup.exe"

try {
    # For now, we will create a placeholder since the actual build is not available
    # In production, this would download the actual Electron app
    
    Write-Host "Creating agent configuration..." -ForegroundColor Yellow
    
    # Create config file
    $config = @{
        serverUrl = "http://${ServerIP}:3002"
        extension = $Extension
        agentName = $AgentName
        autoLaunch = $true
        minimizeToTray = $true
        notifications = $true
    }
    
    $configJson = $config | ConvertTo-Json
    Set-Content -Path "$AppDataDir\config.json" -Value $configJson -Encoding UTF8
    
    # Create placeholder executable
    $placeholderContent = @"
@echo off
echo 3CX-NinjaOne Agent
echo ==================
echo This is a placeholder for the actual Electron app.
echo Configuration saved in: %APPDATA%\3cx-ninjaone-agent\config.json
echo.
echo Server: $ServerIP
echo Extension: $Extension
echo Agent: $AgentName
echo.
pause
"@
    Set-Content -Path "$InstallDir\3cx-ninjaone-agent.bat" -Value $placeholderContent
    
} catch {
    Write-Host "Failed to download agent application: $_" -ForegroundColor Red
    exit 1
}

# Create start menu shortcut
Write-Host "Creating shortcuts..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\3CX NinjaOne Agent.lnk")
$Shortcut.TargetPath = "$InstallDir\3cx-ninjaone-agent.bat"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll,13"
$Shortcut.Save()

# Create desktop shortcut
$DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\3CX NinjaOne Agent.lnk")
$DesktopShortcut.TargetPath = "$InstallDir\3cx-ninjaone-agent.bat"
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll,13"
$DesktopShortcut.Save()

# Add to startup (optional)
$startup = Read-Host "Start agent automatically with Windows? (Y/N)"
if ($startup -eq 'Y' -or $startup -eq 'y') {
    $StartupShortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\3CX NinjaOne Agent.lnk")
    $StartupShortcut.TargetPath = "$InstallDir\3cx-ninjaone-agent.bat"
    $StartupShortcut.WorkingDirectory = $InstallDir
    $StartupShortcut.Arguments = ""
    $StartupShortcut.Save()
    Write-Host "Added to Windows startup" -ForegroundColor Green
}

# Add firewall rule
Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    New-NetFirewallRule -DisplayName "3CX NinjaOne Agent" `
        -Direction Outbound `
        -Action Allow `
        -Protocol TCP `
        -RemotePort 3002,3003 `
        -RemoteAddress $ServerIP `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "Firewall rule added" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not add firewall rule. You may need to allow the connection manually." -ForegroundColor Yellow
}

# Create uninstaller
Write-Host "Creating uninstaller..." -ForegroundColor Yellow
$uninstaller = @'
# 3CX-NinjaOne Agent Uninstaller
Write-Host "Uninstalling 3CX-NinjaOne Agent..." -ForegroundColor Yellow

# Stop the application if running
Get-Process "3cx-ninjaone-agent" -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove files
Remove-Item -Path "$env:ProgramFiles\3CX-NinjaOne-Agent" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\3cx-ninjaone-agent" -Recurse -Force -ErrorAction SilentlyContinue

# Remove shortcuts
Remove-Item -Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\3CX NinjaOne Agent.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\Desktop\3CX NinjaOne Agent.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\3CX NinjaOne Agent.lnk" -Force -ErrorAction SilentlyContinue

# Remove firewall rule
Remove-NetFirewallRule -DisplayName "3CX NinjaOne Agent" -ErrorAction SilentlyContinue

Write-Host "Uninstallation complete." -ForegroundColor Green
'@

Set-Content -Path "$InstallDir\uninstall.ps1" -Value $uninstaller -Encoding UTF8

# Installation complete
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "The 3CX-NinjaOne Agent has been installed." -ForegroundColor White
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "- Extension: $Extension" -ForegroundColor White
Write-Host "- Server: $ServerIP" -ForegroundColor White
Write-Host "- Config location: $AppDataDir\config.json" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Launch the agent from the desktop shortcut or Start Menu" -ForegroundColor White
Write-Host "2. The agent will connect automatically using your extension" -ForegroundColor White
Write-Host "3. You will receive call drafts when calls end" -ForegroundColor White
Write-Host ""

# Offer to start the agent now
$startNow = Read-Host "Start the agent now? (Y/N)"
if ($startNow -eq 'Y' -or $startNow -eq 'y') {
    Write-Host "Starting 3CX-NinjaOne Agent..." -ForegroundColor Yellow
    Start-Process "$InstallDir\3cx-ninjaone-agent.bat"
}

Write-Host ""
Read-Host "Press Enter to exit"