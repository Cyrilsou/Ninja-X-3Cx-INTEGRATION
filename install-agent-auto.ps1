# 3CX-Ninja Agent - Installation automatique Windows avec découverte serveur
# PowerShell script avec auto-discovery du serveur sur le réseau local

param(
    [string]$ServerUrl = "",
    [string]$ApiKey = "",
    [int]$DiscoveryPort = 53434,
    [int]$DiscoveryTimeout = 30,
    [switch]$Silent = $false,
    [switch]$Force = $false
)

# Configuration
$AgentDir = "$env:APPDATA\3cx-ninja-agent"
$ConfigFile = "$AgentDir\config.json"
$TempDir = "$env:TEMP\3cx-ninja-install"
$LogFile = "$AgentDir\install.log"

# Couleurs pour l'affichage
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    
    Write-Host $logMessage -ForegroundColor $Color
    
    # Écrire dans le fichier de log
    if (!(Test-Path $AgentDir)) {
        New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null
    }
    Add-Content -Path $LogFile -Value $logMessage
}

function Write-Error-Log {
    param([string]$Message)
    Write-Log "ERROR: $Message" $Red
    exit 1
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Log "WARNING: $Message" $Yellow
}

function Write-Success-Log {
    param([string]$Message)
    Write-Log $Message $Green
}

function Write-Info-Log {
    param([string]$Message)
    Write-Log $Message $Blue
}

# Vérifier les privilèges administrateur
function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Détecter l'architecture
function Get-Architecture {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "x64" }
        "ARM64" { return "arm64" }
        "x86" { return "x86" }
        default { 
            Write-Warning-Log "Architecture non reconnue: $arch, utilisation de x64 par défaut"
            return "x64" 
        }
    }
}

# Obtenir l'IP locale
function Get-LocalIP {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.InterfaceAlias -notlike "*Loopback*" -and 
            $_.IPAddress -notlike "169.254.*" -and
            $_.IPAddress -notlike "127.*"
        } | Select-Object -First 1).IPAddress
        
        if ($ip) {
            Write-Log "IP locale détectée: $ip"
            return $ip
        } else {
            Write-Warning-Log "Impossible de détecter l'IP locale, utilisation de 192.168.1.100"
            return "192.168.1.100"
        }
    } catch {
        Write-Warning-Log "Erreur lors de la détection de l'IP: $_"
        return "192.168.1.100"
    }
}

# Obtenir le réseau local
function Get-NetworkRange {
    param([string]$LocalIP)
    
    try {
        $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Where-Object { $_.NextHop -ne "::" } | Select-Object -First 1
        $interface = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq $LocalIP }
        
        if ($interface) {
            $prefixLength = $interface.PrefixLength
            $networkBase = $LocalIP -replace '\d+$', '0'
            return "$networkBase/$prefixLength"
        }
    } catch {
        Write-Warning-Log "Erreur lors de la détection du réseau: $_"
    }
    
    return "192.168.1.0/24"
}

# Découvrir le serveur via UDP broadcast
function Discover-ServerBroadcast {
    Write-Log "Recherche du serveur via broadcast UDP..."
    
    try {
        # Créer le socket UDP
        $udpClient = New-Object System.Net.Sockets.UdpClient
        $udpClient.EnableBroadcast = $true
        
        # Message de découverte
        $discoveryMessage = @{
            type = "DISCOVER_3CX_NINJA_SERVER"
            client = "agent-installer-windows"
            timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Compress
        
        $messageBytes = [System.Text.Encoding]::UTF8.GetBytes($discoveryMessage)
        
        # Adresses de broadcast à essayer
        $broadcastAddresses = @(
            "255.255.255.255",
            "192.168.1.255",
            "192.168.0.255",
            "10.0.0.255",
            "172.16.0.255"
        )
        
        # Écouter les réponses
        $listener = New-Object System.Net.Sockets.UdpClient($DiscoveryPort + 1)
        $listener.Client.ReceiveTimeout = $DiscoveryTimeout * 1000
        
        # Envoyer les requêtes de découverte
        foreach ($addr in $broadcastAddresses) {
            try {
                $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($addr), $DiscoveryPort)
                $udpClient.Send($messageBytes, $messageBytes.Length, $endpoint) | Out-Null
                Write-Log "Broadcast envoyé vers $addr:$DiscoveryPort"
            } catch {
                Write-Warning-Log "Échec broadcast vers $addr : $_"
            }
        }
        
        # Attendre les réponses
        $timeout = (Get-Date).AddSeconds($DiscoveryTimeout)
        while ((Get-Date) -lt $timeout) {
            try {
                $remoteEndpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
                $responseBytes = $listener.Receive([ref]$remoteEndpoint)
                $response = [System.Text.Encoding]::UTF8.GetString($responseBytes)
                
                Write-Log "Réponse reçue de $($remoteEndpoint.Address):$($remoteEndpoint.Port)"
                
                # Parser la réponse JSON
                $serverInfo = $response | ConvertFrom-Json
                
                if ($serverInfo.type -eq "SERVER_DISCOVERY_RESPONSE" -and $serverInfo.server) {
                    $script:ServerIP = $serverInfo.server.ip
                    $script:ServerPort = $serverInfo.server.port
                    $script:ApiKey = $serverInfo.server.apiKey
                    $script:ServerName = $serverInfo.server.name
                    
                    Write-Success-Log "Serveur découvert: $script:ServerName à $script:ServerIP:$script:ServerPort"
                    
                    $udpClient.Close()
                    $listener.Close()
                    return $true
                }
            } catch [System.Net.Sockets.SocketException] {
                # Timeout normal, continuer
            } catch {
                Write-Warning-Log "Erreur lors de la réception: $_"
            }
        }
        
        $udpClient.Close()
        $listener.Close()
        
    } catch {
        Write-Warning-Log "Erreur lors du broadcast UDP: $_"
    }
    
    return $false
}

# Découvrir le serveur via scan réseau
function Discover-ServerScan {
    Write-Log "Recherche du serveur via scan réseau..."
    
    $localIP = Get-LocalIP
    $networkRange = Get-NetworkRange $localIP
    
    # Générer la liste des IPs à scanner
    $baseIP = $networkRange -replace '/\d+$', '' -replace '\d+$', ''
    $ips = @()
    
    # IPs communes en premier
    $commonIPs = @(
        "$baseIP" + "1",
        "$baseIP" + "100",
        "$baseIP" + "10",
        "$baseIP" + "50",
        "192.168.1.1",
        "192.168.1.100",
        "192.168.0.1",
        "10.0.0.1"
    )
    
    $ips += $commonIPs
    
    # Ajouter toutes les autres IPs
    for ($i = 2; $i -le 254; $i++) {
        $ip = "$baseIP$i"
        if ($ip -notin $commonIPs) {
            $ips += $ip
        }
    }
    
    # Scanner en parallèle
    $jobs = @()
    $maxJobs = 20
    
    foreach ($ip in $ips) {
        # Limiter le nombre de jobs parallèles
        while ($jobs.Count -ge $maxJobs) {
            $jobs = $jobs | Where-Object { $_.State -eq "Running" }
            Start-Sleep -Milliseconds 100
        }
        
        $job = Start-Job -ScriptBlock {
            param($ip)
            
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $tcp.ReceiveTimeout = 2000
                $tcp.SendTimeout = 2000
                
                $result = $tcp.BeginConnect($ip, 3000, $null, $null)
                $success = $result.AsyncWaitHandle.WaitOne(2000, $true)
                
                if ($success -and $tcp.Connected) {
                    $tcp.Close()
                    
                    # Tester l'API
                    try {
                        $response = Invoke-RestMethod -Uri "http://$ip:3000/api/install/discover" -TimeoutSec 5 -ErrorAction Stop
                        if ($response) {
                            return @{
                                IP = $ip
                                Response = $response
                            }
                        }
                    } catch {
                        # Pas un serveur 3CX-Ninja
                    }
                }
                
                $tcp.Close()
            } catch {
                # Connexion échouée
            }
            
            return $null
        } -ArgumentList $ip
        
        $jobs += $job
    }
    
    # Attendre les résultats
    $timeout = (Get-Date).AddSeconds(60)
    while ($jobs.Count -gt 0 -and (Get-Date) -lt $timeout) {
        $completedJobs = $jobs | Where-Object { $_.State -eq "Completed" }
        
        foreach ($job in $completedJobs) {
            $result = Receive-Job $job
            Remove-Job $job
            
            if ($result -and $result.Response) {
                $script:ServerIP = $result.Response.serverUrl -replace 'http://|https://', '' -replace ':\d+$', ''
                $script:ServerPort = ($result.Response.serverUrl -replace '.*:', '') -as [int]
                $script:ApiKey = $result.Response.apiKey
                $script:ServerName = $result.Response.serverName
                
                Write-Success-Log "Serveur découvert via scan: $script:ServerName à $script:ServerIP:$script:ServerPort"
                
                # Nettoyer les jobs restants
                $jobs | Remove-Job -Force
                return $true
            }
        }
        
        $jobs = $jobs | Where-Object { $_.State -eq "Running" }
        Start-Sleep -Milliseconds 500
    }
    
    # Nettoyer les jobs restants
    $jobs | Remove-Job -Force
    
    return $false
}

# Découvrir le serveur via DNS-SD/Bonjour
function Discover-ServerDNS {
    Write-Log "Recherche du serveur via DNS-SD..."
    
    try {
        # Utiliser nslookup pour rechercher les services
        $dnsResult = nslookup -type=PTR _3cx-ninja._tcp.local 2>$null
        
        if ($dnsResult) {
            # Parser les résultats DNS-SD
            foreach ($line in $dnsResult) {
                if ($line -match "(\d+\.\d+\.\d+\.\d+)") {
                    $ip = $matches[1]
                    
                    # Tester la connexion
                    try {
                        $response = Invoke-RestMethod -Uri "http://$ip:3000/api/install/discover" -TimeoutSec 5 -ErrorAction Stop
                        if ($response) {
                            $script:ServerIP = $ip
                            $script:ServerPort = 3000
                            $script:ApiKey = $response.apiKey
                            $script:ServerName = $response.serverName
                            
                            Write-Success-Log "Serveur découvert via DNS-SD: $script:ServerName à $script:ServerIP"
                            return $true
                        }
                    } catch {
                        # Pas le bon serveur
                    }
                }
            }
        }
    } catch {
        Write-Warning-Log "Erreur lors de la recherche DNS-SD: $_"
    }
    
    return $false
}

# Découvrir le serveur (méthode principale)
function Discover-Server {
    Write-Log "Découverte automatique du serveur 3CX-Ninja..."
    
    # Si les paramètres sont fournis, les utiliser
    if ($ServerUrl -and $ApiKey) {
        $script:ServerIP = $ServerUrl -replace 'http://|https://', '' -replace ':\d+$', ''
        $script:ServerPort = if ($ServerUrl -match ':(\d+)') { $matches[1] } else { 3000 }
        $script:ApiKey = $ApiKey
        $script:ServerName = "Manuel"
        
        Write-Success-Log "Configuration manuelle: $script:ServerIP:$script:ServerPort"
        return $true
    }
    
    # Méthode 1: Broadcast UDP
    if (Discover-ServerBroadcast) {
        return $true
    }
    
    Write-Warning-Log "Broadcast UDP échoué, tentative de scan réseau..."
    
    # Méthode 2: Scan réseau
    if (Discover-ServerScan) {
        return $true
    }
    
    Write-Warning-Log "Scan réseau échoué, tentative DNS-SD..."
    
    # Méthode 3: DNS-SD
    if (Discover-ServerDNS) {
        return $true
    }
    
    Write-Error-Log "Aucun serveur 3CX-Ninja trouvé sur le réseau local"
}

# Valider la connexion serveur
function Test-ServerConnection {
    Write-Log "Validation de la connexion au serveur..."
    
    $serverUrl = "http://$script:ServerIP:$script:ServerPort"
    
    try {
        # Tester la connexion générale
        $healthCheck = Invoke-RestMethod -Uri "$serverUrl/api/install/discover" -TimeoutSec 10 -ErrorAction Stop
        
        if (!$healthCheck) {
            Write-Error-Log "Serveur non accessible: $serverUrl"
        }
        
        # Tester l'API Key
        $headers = @{
            "Authorization" = "Bearer $script:ApiKey"
        }
        
        $apiTest = Invoke-RestMethod -Uri "$serverUrl/api/health" -Headers $headers -TimeoutSec 10 -ErrorAction Stop
        
        if (!$apiTest) {
            Write-Error-Log "Clé API invalide"
        }
        
        Write-Success-Log "Connexion serveur validée"
        return $true
        
    } catch {
        Write-Error-Log "Erreur de connexion au serveur: $_"
    }
}

# Télécharger et installer l'agent
function Install-Agent {
    Write-Log "Installation de l'agent 3CX-Ninja..."
    
    $architecture = Get-Architecture
    $serverUrl = "http://$script:ServerIP:$script:ServerPort"
    
    # Créer les répertoires
    if (!(Test-Path $AgentDir)) {
        New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null
    }
    
    if (!(Test-Path $TempDir)) {
        New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    }
    
    # URL de téléchargement
    $downloadUrl = "$serverUrl/api/install/agent/windows/$architecture"
    $agentFile = "$AgentDir\3cx-ninja-agent.exe"
    
    Write-Log "Téléchargement depuis $downloadUrl..."
    
    try {
        # Télécharger l'agent
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($downloadUrl, $agentFile)
        
        # Vérifier le fichier
        if (!(Test-Path $agentFile) -or (Get-Item $agentFile).Length -eq 0) {
            throw "Fichier agent non valide"
        }
        
        Write-Success-Log "Agent téléchargé et installé"
        
    } catch {
        Write-Warning-Log "Téléchargement direct échoué: $_"
        
        # Fallback: utiliser le script PowerShell du serveur
        try {
            $installScript = Invoke-RestMethod -Uri "$serverUrl/api/install/install-agent.ps1" -TimeoutSec 30
            
            # Sauvegarder et exécuter le script
            $scriptPath = "$TempDir\install-fallback.ps1"
            $installScript | Out-File -FilePath $scriptPath -Encoding UTF8
            
            & powershell.exe -ExecutionPolicy Bypass -File $scriptPath -ServerUrl $serverUrl -ApiKey $script:ApiKey -Silent
            
            Write-Success-Log "Installation via script fallback réussie"
            
        } catch {
            Write-Error-Log "Installation échouée: $_"
        }
    }
}

# Configurer l'agent
function Set-AgentConfiguration {
    Write-Log "Configuration de l'agent..."
    
    $config = @{
        serverUrl = "http://$script:ServerIP:$script:ServerPort"
        apiKey = $script:ApiKey
        serverName = $script:ServerName
        autoDiscovered = $true
        installedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        agentInfo = @{
            id = "agent-$env:COMPUTERNAME-$((Get-Date).Ticks)"
            name = "$env:USERNAME@$env:COMPUTERNAME"
            email = ""
            extension = ""
            platform = "windows"
            architecture = Get-Architecture
            version = "2.0.0"
            computerName = $env:COMPUTERNAME
            userName = $env:USERNAME
        }
        connection = @{
            reconnectInterval = 5000
            maxReconnectAttempts = 10
            heartbeatInterval = 30000
        }
        features = @{
            audioCapture = $true
            realTimeTranscription = $true
            offlineMode = $true
            autoTicketCreation = $true
        }
        audio = @{
            sampleRate = 16000
            channels = 1
            bitDepth = 16
            bufferSize = 4096
        }
    }
    
    # Sauvegarder la configuration
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigFile -Encoding UTF8
    
    Write-Success-Log "Configuration créée"
}

# Créer le service Windows
function New-WindowsService {
    Write-Log "Création du service Windows..."
    
    $serviceName = "3CXNinjaAgent"
    $agentExe = "$AgentDir\3cx-ninja-agent.exe"
    
    try {
        # Vérifier si le service existe déjà
        $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        
        if ($existingService) {
            Write-Log "Service existant trouvé, suppression..."
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            & sc.exe delete $serviceName
            Start-Sleep -Seconds 2
        }
        
        # Créer le nouveau service
        & sc.exe create $serviceName binPath= "`"$agentExe`"" start= auto DisplayName= "3CX-Ninja Agent"
        & sc.exe description $serviceName "Agent de transcription temps réel 3CX-Ninja"
        
        # Configurer la récupération en cas d'échec
        & sc.exe failure $serviceName reset= 3600 actions= restart/5000/restart/10000/restart/30000
        
        Write-Success-Log "Service Windows créé"
        
    } catch {
        Write-Error-Log "Erreur lors de la création du service: $_"
    }
}

# Créer une tâche planifiée (alternative au service)
function New-ScheduledTask {
    Write-Log "Création de la tâche planifiée..."
    
    $taskName = "3CX-Ninja Agent"
    $agentExe = "$AgentDir\3cx-ninja-agent.exe"
    
    try {
        # Supprimer la tâche existante si elle existe
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        
        # Créer l'action
        $action = New-ScheduledTaskAction -Execute $agentExe -WorkingDirectory $AgentDir
        
        # Créer le déclencheur (au démarrage)
        $trigger = New-ScheduledTaskTrigger -AtStartup
        
        # Créer les paramètres
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
        
        # Créer le principal (utilisateur système)
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        
        # Enregistrer la tâche
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
        
        Write-Success-Log "Tâche planifiée créée"
        
    } catch {
        Write-Error-Log "Erreur lors de la création de la tâche planifiée: $_"
    }
}

# Démarrer l'agent
function Start-Agent {
    Write-Log "Démarrage de l'agent..."
    
    try {
        # Essayer de démarrer le service
        $service = Get-Service -Name "3CXNinjaAgent" -ErrorAction SilentlyContinue
        
        if ($service) {
            Start-Service -Name "3CXNinjaAgent"
            
            # Vérifier le statut
            Start-Sleep -Seconds 5
            $service = Get-Service -Name "3CXNinjaAgent"
            
            if ($service.Status -eq "Running") {
                Write-Success-Log "Service démarré avec succès"
                return $true
            }
        }
        
        # Fallback: démarrer la tâche planifiée
        Start-ScheduledTask -TaskName "3CX-Ninja Agent" -ErrorAction Stop
        
        Write-Success-Log "Tâche planifiée démarrée"
        return $true
        
    } catch {
        Write-Error-Log "Erreur lors du démarrage: $_"
        return $false
    }
}

# Tester la connexion
function Test-AgentConnection {
    Write-Log "Test de la connexion..."
    
    $serverUrl = "http://$script:ServerIP:$script:ServerPort"
    $maxAttempts = 10
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            $headers = @{
                "Authorization" = "Bearer $script:ApiKey"
            }
            
            $response = Invoke-RestMethod -Uri "$serverUrl/api/health" -Headers $headers -TimeoutSec 5 -ErrorAction Stop
            
            if ($response) {
                Write-Success-Log "Connexion établie avec succès"
                return $true
            }
            
        } catch {
            $attempt++
            if ($attempt -lt $maxAttempts) {
                Write-Log "Tentative $attempt/$maxAttempts échouée, nouvelle tentative dans 2 secondes..."
                Start-Sleep -Seconds 2
            }
        }
    }
    
    Write-Warning-Log "Connexion non établie après $maxAttempts tentatives"
    return $false
}

# Nettoyer les fichiers temporaires
function Remove-TempFiles {
    Write-Log "Nettoyage des fichiers temporaires..."
    
    try {
        if (Test-Path $TempDir) {
            Remove-Item -Path $TempDir -Recurse -Force
        }
    } catch {
        Write-Warning-Log "Erreur lors du nettoyage: $_"
    }
}

# Afficher les informations finales
function Show-FinalInfo {
    Write-Success-Log "Installation terminée avec succès!"
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "3CX-Ninja Agent installé" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Serveur: $script:ServerName" -ForegroundColor White
    Write-Host "🔗 URL: http://$script:ServerIP:$script:ServerPort" -ForegroundColor White
    Write-Host "📁 Répertoire: $AgentDir" -ForegroundColor White
    Write-Host "⚙️ Configuration: $ConfigFile" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Statut du service:" -ForegroundColor Yellow
    
    # Afficher le statut du service
    $service = Get-Service -Name "3CXNinjaAgent" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "   Service: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Red" })
    }
    
    # Afficher le statut de la tâche planifiée
    $task = Get-ScheduledTask -TaskName "3CX-Ninja Agent" -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "   Tâche planifiée: $($task.State)" -ForegroundColor $(if ($task.State -eq "Ready") { "Green" } else { "Red" })
    }
    
    Write-Host ""
    Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "1. Configurez votre extension 3CX dans l'interface agent" -ForegroundColor White
    Write-Host "2. Testez la capture audio" -ForegroundColor White
    Write-Host "3. Vérifiez la connexion au serveur" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Commandes utiles:" -ForegroundColor Yellow
    Write-Host "   Redémarrer le service: Restart-Service -Name '3CXNinjaAgent'" -ForegroundColor White
    Write-Host "   Voir les logs: Get-EventLog -LogName Application -Source '3CX-Ninja Agent'" -ForegroundColor White
    Write-Host "   Arrêter le service: Stop-Service -Name '3CXNinjaAgent'" -ForegroundColor White
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
}

# Fonction principale
function Main {
    Write-Log "Démarrage de l'installation automatique de l'agent 3CX-Ninja" $Green
    
    # Vérifier les privilèges administrateur
    if (!(Test-AdminPrivileges)) {
        Write-Error-Log "Ce script nécessite des privilèges administrateur. Exécutez PowerShell en tant qu'administrateur."
    }
    
    try {
        # Étapes d'installation
        if (!(Discover-Server)) {
            Write-Error-Log "Impossible de découvrir le serveur"
        }
        
        if (!(Test-ServerConnection)) {
            Write-Error-Log "Impossible de se connecter au serveur"
        }
        
        Install-Agent
        Set-AgentConfiguration
        
        # Créer le service (priorité) ou la tâche planifiée
        try {
            New-WindowsService
        } catch {
            Write-Warning-Log "Création du service échouée, utilisation d'une tâche planifiée"
            New-ScheduledTask
        }
        
        Start-Agent
        Test-AgentConnection
        Remove-TempFiles
        
        Show-FinalInfo
        
    } catch {
        Write-Error-Log "Erreur durant l'installation: $_"
    }
}

# Exécuter le script principal
Main