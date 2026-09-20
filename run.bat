@echo off
title STEELSCAN - Launcher
color 0b

echo =====================================================================
echo                STEELSCAN - INDUSTRIAL OCR SYSTEM
echo =====================================================================
echo  Starting Backend (FastAPI :8000) and Frontend (Vite React :3001)...
echo =====================================================================
echo.

:: Get workspace directory
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: 1. Launch FastAPI Backend in a new window
echo [1/3] Starting Backend API on http://localhost:8000...
start "[STEELSCAN] Backend (Port 8000)" cmd /k "cd /d ""%ROOT_DIR%backend"" && call ""venv\Scripts\activate.bat"" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: 2. Launch Vite Frontend in a new window
echo [2/3] Starting Frontend UI on http://localhost:3001...
start "[STEELSCAN] Frontend (Port 3001)" cmd /k "cd /d ""%ROOT_DIR%frontend"" && npm run dev"

:: 3. Wait for servers to spin up, then open browser
echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:3001...
start http://localhost:3001

echo.
echo =====================================================================
echo  STEELSCAN is now RUNNING!
echo =====================================================================
echo  * Frontend UI:    http://localhost:3001
echo  * Backend API:    http://localhost:8000
echo  * API Swagger:    http://localhost:8000/docs
echo.
echo  To stop everything, run 'stop.bat' or close the terminal windows.
echo =====================================================================
echo.
pause
