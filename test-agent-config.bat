@echo off
REM Script de test de configuration de l'agent

echo ============================================================
echo        TEST DE CONFIGURATION - AGENT 3CX-NINJA
echo ============================================================
echo.

REM Verifier Node.js
echo [1] Verification de Node.js...
node --version >nul 2>&1
if %errorLevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo    OK - Version: %%i
) else (
    echo    ERREUR - Node.js non installe!
)

REM Verifier npm
echo.
echo [2] Verification de npm...
npm --version >nul 2>&1
if %errorLevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do echo    OK - Version: %%i
) else (
    echo    ERREUR - npm non installe!
)

REM Verifier la structure du projet
echo.
echo [3] Verification de la structure du projet...
if exist "agent\package.json" (
    echo    OK - Dossier agent trouve
) else (
    echo    ERREUR - Dossier agent non trouve!
)

if exist "shared\package.json" (
    echo    OK - Dossier shared trouve
) else (
    echo    ERREUR - Dossier shared non trouve!
)

REM Verifier la configuration
echo.
echo [4] Verification de la configuration...
set "CONFIG_FILE=%APPDATA%\3CX-Ninja-Agent\config.json"
if exist "%CONFIG_FILE%" (
    echo    OK - Fichier de configuration trouve
    echo    Emplacement: %CONFIG_FILE%
    echo.
    echo    Contenu:
    type "%CONFIG_FILE%"
) else (
    echo    INFO - Aucune configuration trouvee
    echo    Le fichier sera cree au premier lancement
)

REM Verifier les dependances
echo.
echo [5] Verification des dependances...
if exist "agent\node_modules" (
    echo    OK - Dependances de l'agent installees
) else (
    echo    INFO - Dependances de l'agent non installees
    echo    Executez: cd agent ^&^& npm install
)

if exist "shared\node_modules" (
    echo    OK - Dependances du module shared installees
) else (
    echo    INFO - Dependances du module shared non installees
    echo    Executez: cd shared ^&^& npm install
)

REM Verifier la construction
echo.
echo [6] Verification de la construction...
if exist "shared\dist" (
    echo    OK - Module shared construit
) else (
    echo    INFO - Module shared non construit
    echo    Executez: cd shared ^&^& npm run build
)

if exist "agent\dist-electron" (
    echo    OK - Agent Electron construit
) else (
    echo    INFO - Agent Electron non construit
    echo    Executez: cd agent ^&^& npm run build
)

echo.
echo ============================================================
echo                    RESUME
echo ============================================================
echo.
echo Pour installer et lancer l'agent:
echo.
echo 1. Installer les dependances:
echo    cd shared ^&^& npm install ^&^& npm run build ^&^& cd ..
echo    cd agent ^&^& npm install ^&^& cd ..
echo.
echo 2. Lancer en mode developpement:
echo    cd agent ^&^& npm run dev
echo.
echo 3. Ou utiliser le script de lancement rapide:
echo    start-agent.bat
echo.

pause