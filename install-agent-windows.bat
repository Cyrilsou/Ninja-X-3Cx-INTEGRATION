@echo off
echo ============================================
echo 3CX-NinjaOne Agent Installer
echo ============================================
echo.
echo This will install the 3CX-NinjaOne Agent on your computer.
echo You will need:
echo - The server IP address
echo - Your 3CX extension number
echo.
pause

:: Run PowerShell script with admin privileges
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agent-windows.ps1"

pause