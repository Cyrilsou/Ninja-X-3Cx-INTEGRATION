@echo off
REM Script de lancement rapide de l'agent 3CX-Ninja

echo ============================================================
echo           3CX-NINJA AGENT - LANCEMENT RAPIDE
echo ============================================================
echo.

REM Verifier si on est dans le bon dossier
if not exist "agent\package.json" (
    echo ERREUR: Ce script doit etre execute depuis la racine du projet!
    echo Dossier actuel: %CD%
    pause
    exit /b 1
)

REM Variables de configuration rapide
set "CONFIG_FILE=%APPDATA%\3CX-Ninja-Agent\config.json"

REM Verifier si la configuration existe
if not exist "%CONFIG_FILE%" (
    echo Configuration non trouvee. Creation d'une configuration rapide...
    echo.
    
    REM Essayer la decouverte automatique
    echo Recherche automatique du serveur...
    for /f "delims=" %%i in ('powershell -ExecutionPolicy Bypass -File "agent\scripts\discover-server.ps1" 2^>nul') do set "DISCOVERY_RESULT=%%i"
    
    REM Parser le resultat
    for /f "delims=" %%i in ('powershell -Command "$json = '%DISCOVERY_RESULT%' | ConvertFrom-Json; if ($json.found) { $json.serverUrl } else { 'NOT_FOUND' }"') do set "SERVER_URL=%%i"
    for /f "delims=" %%i in ('powershell -Command "$json = '%DISCOVERY_RESULT%' | ConvertFrom-Json; if ($json.found) { $json.apiKey } else { '' }"') do set "API_KEY=%%i"
    
    if "%SERVER_URL%"=="NOT_FOUND" set "SERVER_URL="
    
    if not "%SERVER_URL%"=="" (
        echo Serveur trouve: %SERVER_URL%
        echo.
    )
    
    if "%SERVER_URL%"=="" set /p "SERVER_URL=URL du serveur (ex: http://192.168.1.100:3000): "
    if "%API_KEY%"=="" set /p "API_KEY=Cle API: "
    set /p "AGENT_EMAIL=Email: "
    set /p "AGENT_EXTENSION=Extension 3CX: "
    
    mkdir "%APPDATA%\3CX-Ninja-Agent" 2>nul
    
    (
    echo {
    echo   "serverUrl": "!SERVER_URL!",
    echo   "apiKey": "!API_KEY!",
    echo   "agent": {
    echo     "email": "!AGENT_EMAIL!",
    echo     "name": "Agent Test",
    echo     "extension": "!AGENT_EXTENSION!"
    echo   },
    echo   "audio": {
    echo     "sampleRate": 16000,
    echo     "channels": 1,
    echo     "chunkDuration": 5000
    echo   },
    echo   "autoStart": true,
    echo   "minimizeToTray": true,
    echo   "startWithWindows": false
    echo }
    ) > "%CONFIG_FILE%"
)

echo Configuration: %CONFIG_FILE%
echo.

REM Installer les dependances si necessaire
if not exist "agent\node_modules" (
    echo Installation des dependances...
    cd agent
    call npm install
    cd ..
)

REM Lancer l'agent en mode developpement
echo Lancement de l'agent...
echo.
cd agent
npm run dev

pause