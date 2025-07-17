# Script de découverte automatique du serveur 3CX-Ninja
param(
    [int]$DiscoveryPort = 53434,
    [int]$Timeout = 5000
)

$ErrorActionPreference = "Stop"

try {
    # Créer un client UDP
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $udpClient.Client.ReceiveTimeout = $Timeout
    $udpClient.EnableBroadcast = $true
    
    # Préparer le message de découverte
    $discoveryMessage = @{
        type = "DISCOVER_3CX_NINJA_SERVER"
        clientInfo = @{
            platform = "windows"
            version = "1.0.0"
        }
    } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($discoveryMessage)
    
    # Envoyer en broadcast
    $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Broadcast, $DiscoveryPort)
    $udpClient.Send($bytes, $bytes.Length, $endpoint) | Out-Null
    
    Write-Host "Recherche du serveur 3CX-Ninja..." -ForegroundColor Yellow
    
    # Attendre la réponse
    $remoteEP = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
    $receivedBytes = $udpClient.Receive([ref]$remoteEP)
    $response = [System.Text.Encoding]::UTF8.GetString($receivedBytes)
    
    # Parser la réponse
    if ($response -match "3CX_NINJA_SERVER:(.*)") {
        $serverInfo = $Matches[1] | ConvertFrom-Json
        
        # Construire l'URL complète
        $serverUrl = "http://$($remoteEP.Address):$($serverInfo.port)"
        
        # Afficher les informations
        Write-Host "`nServeur détecté!" -ForegroundColor Green
        Write-Host "  Adresse: $($remoteEP.Address)" -ForegroundColor Cyan
        Write-Host "  Port: $($serverInfo.port)" -ForegroundColor Cyan
        Write-Host "  Nom: $($serverInfo.name)" -ForegroundColor Cyan
        Write-Host "  Version: $($serverInfo.version)" -ForegroundColor Cyan
        Write-Host "  URL: $serverUrl" -ForegroundColor Cyan
        
        # Retourner les informations en JSON
        $result = @{
            found = $true
            serverUrl = $serverUrl
            serverIp = $remoteEP.Address.ToString()
            serverPort = $serverInfo.port
            serverName = $serverInfo.name
            serverVersion = $serverInfo.version
            apiKey = $serverInfo.apiKey
        } | ConvertTo-Json -Compress
        
        Write-Output $result
    }
    else {
        Write-Host "Réponse invalide du serveur" -ForegroundColor Red
        $result = @{ found = $false } | ConvertTo-Json
        Write-Output $result
    }
    
    $udpClient.Close()
}
catch [System.Net.Sockets.SocketException] {
    Write-Host "Aucun serveur 3CX-Ninja détecté sur le réseau" -ForegroundColor Yellow
    $result = @{ found = $false } | ConvertTo-Json
    Write-Output $result
}
catch {
    Write-Host "Erreur lors de la découverte: $_" -ForegroundColor Red
    $result = @{ found = $false; error = $_.ToString() } | ConvertTo-Json
    Write-Output $result
}
finally {
    if ($udpClient) {
        $udpClient.Dispose()
    }
}