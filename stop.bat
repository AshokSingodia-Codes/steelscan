@echo off
title STEELSCAN - Process Terminator
color 0c

echo =====================================================================
echo                STEELSCAN - STOPPING SERVICES
echo =====================================================================
echo Terminating Backend (Port 8000) and Frontend (Port 3001) processes...

powershell -Command "Get-NetTCPConnection -LocalPort 8000, 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Services stopped.
echo =====================================================================
timeout /t 2 /nobreak >nul
