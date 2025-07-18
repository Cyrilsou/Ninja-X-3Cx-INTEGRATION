# Script de découverte du serveur 3CX-Whisper sur le réseau
# Utilise le broadcast UDP pour trouver automatiquement le serveur

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Recherche du serveur 3CX-Whisper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to discover server on network
function Find-WhisperServer {
    Write-Host "Envoi de la requete de decouverte..." -ForegroundColor Yellow
    
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $udpClient.Client.ReceiveTimeout = 5000 # 5 seconds timeout
    
    $serversFound = @()
    
    try {
        # Enable broadcast
        $udpClient.EnableBroadcast = $true
        
        # Send discovery request
        $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Broadcast, 5355)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("DISCOVER_3CX_WHISPER_SERVER")
        $udpClient.Send($bytes, $bytes.Length, $endpoint) | Out-Null
        
        Write-Host "Ecoute des reponses pendant 5 secondes..." -ForegroundColor Yellow
        Write-Host ""
        
        # Listen for multiple responses
        $startTime = Get-Date
        while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds(5)) {
            try {
                $remoteEndpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Any, 0)
                $receivedBytes = $udpClient.Receive([ref]$remoteEndpoint)
                $response = [System.Text.Encoding]::UTF8.GetString($receivedBytes)
                
                # Parse JSON response
                $serverInfo = $response | ConvertFrom-Json
                
                if ($serverInfo.type -eq "3CX-WHISPER-SERVER") {
                    $serverData = @{
                        IP = $remoteEndpoint.Address.ToString()
                        Name = $serverInfo.name
                        Version = $serverInfo.version
                        ApiPort = $serverInfo.apiPort
                        WsPort = $serverInfo.wsPort
                        Addresses = $serverInfo.addresses
                    }
                    
                    # Check if not already found
                    $alreadyFound = $serversFound | Where-Object { $_.IP -eq $serverData.IP }
                    if (-not $alreadyFound) {
                        $serversFound += $serverData
                        
                        Write-Host "✓ Serveur trouve!" -ForegroundColor Green
                        Write-Host "  - Nom: $($serverData.Name)" -ForegroundColor White
                        Write-Host "  - IP: $($serverData.IP)" -ForegroundColor White
                        Write-Host "  - Version: $($serverData.Version)" -ForegroundColor White
                        Write-Host "  - Port API: $($serverData.ApiPort)" -ForegroundColor White
                        Write-Host "  - Port WebSocket: $($serverData.WsPort)" -ForegroundColor White
                        Write-Host ""
                    }
                }
            } catch [System.Net.Sockets.SocketException] {
                # Timeout - continue
            }
        }
    } catch {
        Write-Host "Erreur lors de la recherche: $_" -ForegroundColor Red
    } finally {
        $udpClient.Close()
    }
    
    return $serversFound
}

# Search for servers
$servers = Find-WhisperServer

if ($servers.Count -eq 0) {
    Write-Host "Aucun serveur 3CX-Whisper trouve sur le reseau" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verifiez que:" -ForegroundColor Yellow
    Write-Host "1. Le serveur est demarre" -ForegroundColor White
    Write-Host "2. Le pare-feu autorise le port UDP 5355" -ForegroundColor White
    Write-Host "3. Vous etes sur le meme reseau que le serveur" -ForegroundColor White
} else {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Recherche terminee" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    if ($servers.Count -eq 1) {
        Write-Host "1 serveur trouve:" -ForegroundColor White
        Write-Host ""
        Write-Host "Pour installer l'agent, executez:" -ForegroundColor Cyan
        Write-Host ".\install-agent-windows.ps1 -ServerIP `"$($servers[0].IP)`"" -ForegroundColor White
    } else {
        Write-Host "$($servers.Count) serveurs trouves" -ForegroundColor White
        Write-Host ""
        Write-Host "Choisissez le serveur a utiliser pour l'installation:" -ForegroundColor Cyan
        for ($i = 0; $i -lt $servers.Count; $i++) {
            Write-Host "$($i + 1). $($servers[$i].Name) - $($servers[$i].IP)" -ForegroundColor White
        }
    }
}

Write-Host ""
Read-Host "Appuyez sur Entree pour terminer"