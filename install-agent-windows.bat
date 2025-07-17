@echo off
setlocal enabledelayedexpansion

title 3CX-Ninja Agent - Installation Windows

REM ================================================
REM 3CX-Ninja Agent - Script d'installation Windows
REM ================================================

REM Variables de configuration
set "INSTALL_DIR=%PROGRAMFILES%\3CX-Ninja-Agent"
set "DATA_DIR=%APPDATA%\3CX-Ninja-Agent"
set "SHORTCUT_NAME=3CX-Ninja Agent"
set "NODEJS_VERSION=20.11.0"
set "TEMP_DIR=%TEMP%\3cx-ninja-install"
set "LOG_FILE=%TEMP%\3cx-ninja-install.log"

REM Creer le fichier de log
echo Installation demarree le %date% a %time% > "%LOG_FILE%"

REM Verifier les privileges administrateur
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERREUR: Ce script doit etre execute en tant qu'administrateur!
    echo.
    echo Clic droit sur le fichier et selectionnez "Executer en tant qu'administrateur"
    echo.
    pause
    exit /b 1
)

cls
echo ============================================================
echo           3CX-NINJA AGENT - INSTALLATION WINDOWS
echo ============================================================
echo.

REM Decouverte automatique du serveur
echo Recherche automatique du serveur 3CX-Ninja sur le reseau...
echo.

REM Executer le script de decouverte
for /f "delims=" %%i in ('powershell -ExecutionPolicy Bypass -File "agent\scripts\discover-server.ps1" 2^>nul') do set "DISCOVERY_RESULT=%%i"

REM Parser le resultat JSON avec PowerShell
for /f "delims=" %%i in ('powershell -Command "$json = '%DISCOVERY_RESULT%' | ConvertFrom-Json; if ($json.found) { $json.serverUrl } else { 'NOT_FOUND' }"') do set "DISCOVERED_URL=%%i"
for /f "delims=" %%i in ('powershell -Command "$json = '%DISCOVERY_RESULT%' | ConvertFrom-Json; if ($json.found) { $json.apiKey } else { '' }"') do set "DISCOVERED_KEY=%%i"

if not "%DISCOVERED_URL%"=="NOT_FOUND" (
    echo.
    echo Serveur detecte: %DISCOVERED_URL%
    echo.
    set /p "USE_DISCOVERED=Utiliser ce serveur? (O/N) [O]: "
    if /i "%USE_DISCOVERED%"=="" set "USE_DISCOVERED=O"
    if /i "%USE_DISCOVERED%"=="O" (
        set "SERVER_URL=%DISCOVERED_URL%"
        if not "%DISCOVERED_KEY%"=="" set "API_KEY=%DISCOVERED_KEY%"
    )
) else (
    echo Aucun serveur detecte automatiquement.
    echo.
)

REM Demander l'URL du serveur si pas trouve
:ask_server
if "%SERVER_URL%"=="" (
    echo Configuration manuelle du serveur
    echo.
    set /p "SERVER_URL=Entrez l'URL du serveur 3CX-Ninja (ex: http://192.168.1.100:3000): "
    if "%SERVER_URL%"=="" (
        echo ERREUR: L'URL du serveur est obligatoire!
        goto ask_server
    )
)

REM Demander la cle API si pas fournie
:ask_api_key
if "%API_KEY%"=="" (
    echo.
    set /p "API_KEY=Entrez la cle API du serveur: "
    if "%API_KEY%"=="" (
        echo ERREUR: La cle API est obligatoire!
        goto ask_api_key
    )
)

REM Demander les informations de l'agent
echo.
echo Configuration de l'agent
echo.
set /p "AGENT_EMAIL=Email de l'agent: "
set /p "AGENT_NAME=Nom de l'agent: "
set /p "AGENT_EXTENSION=Extension 3CX: "

if "%AGENT_EMAIL%"=="" (
    echo ERREUR: L'email est obligatoire!
    goto ask_server
)

if "%AGENT_EXTENSION%"=="" (
    echo ERREUR: L'extension 3CX est obligatoire!
    goto ask_server
)

echo.
echo Resume de la configuration:
echo    - Serveur: %SERVER_URL%
echo    - Email: %AGENT_EMAIL%
echo    - Nom: %AGENT_NAME%
echo    - Extension: %AGENT_EXTENSION%
echo.
echo Appuyez sur une touche pour continuer ou Ctrl+C pour annuler...
pause > nul

REM Creer les dossiers
echo.
echo Creation des dossiers...
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%DATA_DIR%" 2>nul
mkdir "%TEMP_DIR%" 2>nul

REM Verifier si Node.js est installe
echo.
echo Verification de Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installation de Node.js %NODEJS_VERSION%...
    
    REM Telecharger Node.js
    echo Telechargement de Node.js...
    powershell -Command "& { (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v%NODEJS_VERSION%/node-v%NODEJS_VERSION%-x64.msi', '%TEMP_DIR%\nodejs.msi') }" >> "%LOG_FILE%" 2>&1
    
    if not exist "%TEMP_DIR%\nodejs.msi" (
        echo ERREUR: Impossible de telecharger Node.js!
        goto error
    )
    
    REM Installer Node.js silencieusement
    echo Installation de Node.js...
    msiexec /i "%TEMP_DIR%\nodejs.msi" /qn ADDLOCAL=ALL >> "%LOG_FILE%" 2>&1
    
    REM Rafraichir le PATH
    set "PATH=%PATH%;%PROGRAMFILES%\nodejs\"
    
    REM Verifier l'installation
    node --version >nul 2>&1
    if %errorLevel% neq 0 (
        echo ERREUR: Echec de l'installation de Node.js!
        goto error
    )
    echo Node.js installe avec succes
) else (
    echo Node.js deja installe
    for /f "tokens=*" %%i in ('node --version') do echo    Version: %%i
)

REM Copier les fichiers de l'agent depuis le repertoire actuel
echo.
echo Copie des fichiers de l'agent...

if exist "agent" (
    echo Copie depuis le repertoire local...
    xcopy /E /Y "agent\*" "%INSTALL_DIR%\" >nul 2>&1
    
    REM Copier aussi le dossier shared si present
    if exist "shared" (
        echo Copie du module shared...
        mkdir "%INSTALL_DIR%\..\shared" 2>nul
        xcopy /E /Y "shared\*" "%INSTALL_DIR%\..\shared\" >nul 2>&1
    )
) else (
    echo.
    echo ERREUR: Le dossier 'agent' n'existe pas dans le repertoire actuel!
    echo Veuillez executer ce script depuis la racine du projet 3cx-ninja-realtime.
    echo.
    goto error
)

REM Installer les dependances npm
echo.
echo Installation des dependances...
cd /d "%INSTALL_DIR%"

REM Si le dossier shared existe, construire d'abord
if exist "%INSTALL_DIR%\..\shared\package.json" (
    echo Construction du module shared...
    cd /d "%INSTALL_DIR%\..\shared"
    call npm install >> "%LOG_FILE%" 2>&1
    call npm run build >> "%LOG_FILE%" 2>&1
    cd /d "%INSTALL_DIR%"
)

REM Installer les dependances de l'agent
echo Installation des dependances de l'agent...
call npm install >> "%LOG_FILE%" 2>&1
if %errorLevel% neq 0 (
    echo AVERTISSEMENT: Certaines dependances n'ont pas pu etre installees
)

REM Construire l'agent
echo.
echo Construction de l'agent...
if exist "package.json" (
    call npm run build >> "%LOG_FILE%" 2>&1
    if %errorLevel% neq 0 (
        echo AVERTISSEMENT: La construction a echoue, utilisation du mode developpement
    )
)

REM Creer le fichier de configuration
echo.
echo Creation de la configuration...
(
echo {
echo   "serverUrl": "%SERVER_URL%",
echo   "apiKey": "%API_KEY%",
echo   "agent": {
echo     "email": "%AGENT_EMAIL%",
echo     "name": "%AGENT_NAME%",
echo     "extension": "%AGENT_EXTENSION%"
echo   },
echo   "audio": {
echo     "sampleRate": 16000,
echo     "channels": 1,
echo     "chunkDuration": 5000
echo   },
echo   "autoStart": true,
echo   "minimizeToTray": true,
echo   "startWithWindows": true
echo }
) > "%DATA_DIR%\config.json"

REM Verifier l'executable Electron
echo.
echo Verification de l'executable...
if not exist "%INSTALL_DIR%\dist-electron\3CX-Ninja Agent.exe" (
    if not exist "%INSTALL_DIR%\3cx-ninja-agent.exe" (
        echo AVERTISSEMENT: Executable non trouve, utilisation du mode developpement
        set "AGENT_EXE=npm start"
        set "AGENT_PATH=%INSTALL_DIR%"
    ) else (
        set "AGENT_EXE=%INSTALL_DIR%\3cx-ninja-agent.exe"
        set "AGENT_PATH=%INSTALL_DIR%"
    )
) else (
    set "AGENT_EXE=%INSTALL_DIR%\dist-electron\3CX-Ninja Agent.exe"
    set "AGENT_PATH=%INSTALL_DIR%"
)

REM Creer un fichier de lancement .bat
echo.
echo Creation du lanceur...
(
echo @echo off
echo cd /d "%AGENT_PATH%"
echo start "" %AGENT_EXE%
) > "%INSTALL_DIR%\lanceur.bat"

REM Creer un raccourci de demarrage
echo.
echo Creation du raccourci...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\%SHORTCUT_NAME%.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\lanceur.bat'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\build\icon.ico'; $Shortcut.Save()" >> "%LOG_FILE%" 2>&1

REM Creer un raccourci dans le menu demarrer
mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\3CX-Ninja" 2>nul
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\3CX-Ninja\%SHORTCUT_NAME%.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\lanceur.bat'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\build\icon.ico'; $Shortcut.Save()" >> "%LOG_FILE%" 2>&1

REM Ajouter au demarrage automatique si demande
echo.
set /p "AUTO_START=Voulez-vous que l'agent demarre automatiquement avec Windows? (O/N): "
if /i "%AUTO_START%"=="O" (
    echo Configuration du demarrage automatique...
    copy "%APPDATA%\Microsoft\Windows\Start Menu\Programs\3CX-Ninja\%SHORTCUT_NAME%.lnk" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul 2>&1
    echo Demarrage automatique configure
)

REM Configurer le pare-feu Windows
echo.
echo Configuration du pare-feu...
netsh advfirewall firewall add rule name="3CX-Ninja Agent" dir=in action=allow program="%AGENT_EXE%" enable=yes >nul 2>&1
netsh advfirewall firewall add rule name="3CX-Ninja Agent" dir=out action=allow program="%AGENT_EXE%" enable=yes >nul 2>&1

REM Creer un script de desinstallation
echo.
echo Creation du script de desinstallation...
(
echo @echo off
echo echo Desinstallation de 3CX-Ninja Agent...
echo taskkill /F /IM "3CX-Ninja Agent.exe" 2^>nul
echo taskkill /F /IM "3cx-ninja-agent.exe" 2^>nul
echo timeout /t 2 ^>nul
echo rmdir /S /Q "%INSTALL_DIR%"
echo rmdir /S /Q "%DATA_DIR%"
echo del "%USERPROFILE%\Desktop\%SHORTCUT_NAME%.lnk" 2^>nul
echo del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\%SHORTCUT_NAME%.lnk" 2^>nul
echo rmdir /S /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\3CX-Ninja" 2^>nul
echo netsh advfirewall firewall delete rule name="3CX-Ninja Agent" ^>nul 2^>^&1
echo echo Desinstallation terminee!
echo pause
) > "%INSTALL_DIR%\uninstall.bat"

REM Nettoyer les fichiers temporaires
echo.
echo Nettoyage...
rmdir /S /Q "%TEMP_DIR%" 2>nul

REM Installation terminee
echo.
echo ============================================================
echo INSTALLATION TERMINEE AVEC SUCCES!
echo ============================================================
echo.
echo Dossier d'installation: %INSTALL_DIR%
echo Dossier de donnees: %DATA_DIR%
echo Raccourci cree sur le bureau
echo.
echo Pour demarrer l'agent:
echo    - Double-cliquez sur le raccourci sur le bureau
echo    - Ou executez: %INSTALL_DIR%\lanceur.bat
echo.
echo Pour desinstaller:
echo    Executez: %INSTALL_DIR%\uninstall.bat
echo.
echo Log d'installation: %LOG_FILE%
echo.

REM Demander si on demarre l'agent
set /p "START_NOW=Voulez-vous demarrer l'agent maintenant? (O/N): "
if /i "%START_NOW%"=="O" (
    echo.
    echo Demarrage de l'agent...
    cd /d "%INSTALL_DIR%"
    start "" "%INSTALL_DIR%\lanceur.bat"
)

echo.
echo Appuyez sur une touche pour terminer...
pause > nul
exit /b 0

:error
echo.
echo ERREUR: Une erreur s'est produite pendant l'installation!
echo Consultez le log: %LOG_FILE%
echo.
pause
exit /b 1