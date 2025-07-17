@echo off
REM Script de test de la decouverte automatique du serveur

echo ============================================================
echo      TEST DE DECOUVERTE AUTOMATIQUE - 3CX-NINJA
echo ============================================================
echo.

REM Verifier que le script PowerShell existe
if not exist "agent\scripts\discover-server.ps1" (
    echo ERREUR: Script de decouverte non trouve!
    echo Assurez-vous d'etre dans le repertoire racine du projet.
    pause
    exit /b 1
)

echo Recherche du serveur 3CX-Ninja sur le reseau local...
echo Port de decouverte: 53434
echo.

REM Executer le script de decouverte
powershell -ExecutionPolicy Bypass -File "agent\scripts\discover-server.ps1"

echo.
echo ============================================================
echo.

REM Tester avec un port different si demande
set /p "TEST_OTHER=Tester avec un autre port? (O/N): "
if /i "%TEST_OTHER%"=="O" (
    set /p "CUSTOM_PORT=Entrez le port de decouverte: "
    echo.
    echo Test avec le port !CUSTOM_PORT!...
    echo.
    powershell -ExecutionPolicy Bypass -File "agent\scripts\discover-server.ps1" -DiscoveryPort !CUSTOM_PORT!
)

echo.
pause