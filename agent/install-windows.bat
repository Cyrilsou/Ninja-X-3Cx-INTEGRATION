@echo off
echo =========================================
echo Installation Agent 3CX-Ninja pour Windows
echo =========================================
echo.

:: Vérifier les privilèges admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Ce script doit être exécuté en tant qu'administrateur
    pause
    exit /b 1
)

:: Vérifier Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installé
    echo Téléchargez-le depuis: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js détecté

:: Créer les répertoires
echo.
echo Création des répertoires...
if not exist "%APPDATA%\3cx-ninja-agent" mkdir "%APPDATA%\3cx-ninja-agent"
if not exist "%APPDATA%\3cx-ninja-agent\logs" mkdir "%APPDATA%\3cx-ninja-agent\logs"

:: Installer les dépendances
echo.
echo Installation des dépendances...
call npm install

:: Compiler TypeScript
echo.
echo Compilation...
call npm run build

:: Télécharger SoX si nécessaire
echo.
echo Vérification de SoX pour la capture audio...
if not exist "C:\Program Files (x86)\sox-14-4-2\sox.exe" (
    echo.
    echo [ATTENTION] SoX n'est pas installé
    echo SoX est nécessaire pour la capture audio
    echo.
    echo Téléchargement automatique...
    
    :: Télécharger SoX
    powershell -Command "Invoke-WebRequest -Uri 'https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.zip/download' -OutFile '%TEMP%\sox.zip' -UseBasicParsing; Expand-Archive -Path '%TEMP%\sox.zip' -DestinationPath 'C:\Program Files (x86)\sox-14-4-2' -Force; Remove-Item '%TEMP%\sox.zip'; Write-Host 'SoX installe avec succes!'"
    
    :: Ajouter au PATH
    setx PATH "%PATH%;C:\Program Files (x86)\sox-14-4-2" /M
)

:: Créer le raccourci de démarrage
echo.
echo Création du raccourci...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\3CX Ninja Agent.lnk'); $Shortcut.TargetPath = '%CD%\start-agent.bat'; $Shortcut.WorkingDirectory = '%CD%'; $Shortcut.IconLocation = '%CD%\assets\icon.ico'; $Shortcut.Description = 'Agent 3CX-Ninja Realtime'; $Shortcut.Save()"

:: Créer le script de démarrage
echo.
echo Création du script de démarrage...
(
echo @echo off
echo cd /d "%CD%"
echo start npm start
) > start-agent.bat

:: Option de démarrage automatique
echo.
set /p autostart="Voulez-vous que l'agent démarre automatiquement avec Windows? (O/N): "
if /i "%autostart%"=="O" (
    echo.
    echo Configuration du démarrage automatique...
    
    :: Créer une tâche planifiée
    schtasks /create /tn "3CX Ninja Agent" /tr "%CD%\start-agent.bat" /sc onlogon /rl highest /f >nul 2>&1
    
    if %errorlevel% equ 0 (
        echo [OK] Démarrage automatique configuré
    ) else (
        echo [ERREUR] Impossible de configurer le démarrage automatique
    )
)

:: Créer le fichier de configuration par défaut
echo.
echo Création de la configuration par défaut...
if not exist "%APPDATA%\3cx-ninja-agent\config.json" (
    (
    echo {
    echo   "server": {
    echo     "url": "http://localhost:3000",
    echo     "apiKey": "your-api-key-here"
    echo   },
    echo   "audio": {
    echo     "device": "default"
    echo   }
    echo }
    ) > "%APPDATA%\3cx-ninja-agent\config.json"
)

:: Installer le certificat pour HTTPS (optionnel)
echo.
echo Configuration de la sécurité...
netsh advfirewall firewall add rule name="3CX Ninja Agent" dir=in action=allow protocol=TCP localport=3000-3010 >nul 2>&1

:: Résumé
echo.
echo =========================================
echo Installation terminée avec succès!
echo =========================================
echo.
echo Fichiers créés:
echo - Raccourci bureau: 3CX Ninja Agent
echo - Script de démarrage: start-agent.bat
echo - Configuration: %APPDATA%\3cx-ninja-agent\config.json
echo.
echo Pour démarrer l'agent:
echo 1. Double-cliquez sur le raccourci bureau
echo    OU
echo 2. Exécutez: start-agent.bat
echo.
echo Configuration requise:
echo 1. Éditez la configuration dans l'application
echo 2. Entrez l'URL du serveur et la clé API
echo 3. Configurez votre extension 3CX
echo.
pause