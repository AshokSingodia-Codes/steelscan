# STEELSCAN PowerShell Launcher
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "                STEELSCAN - INDUSTRIAL OCR SYSTEM                    " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend
Write-Host "[1/3] Starting Backend API (FastAPI) on Port 8000..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend'; & '.\venv\Scripts\Activate.ps1'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Start Frontend
Write-Host "[2/3] Starting Frontend UI (Vite React) on Port 3001..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$rootDir\frontend'; npm run dev"

# Wait and open browser
Write-Host "[3/3] Waiting for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Opening http://localhost:3001 in default browser..." -ForegroundColor Green
Start-Process "http://localhost:3001"

Write-Host "`nSTEELSCAN is running!" -ForegroundColor Cyan
Write-Host "Frontend:    http://localhost:3001" -ForegroundColor Gray
Write-Host "Backend:     http://localhost:8000" -ForegroundColor Gray
Write-Host "API Docs:    http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "`nCredentials:" -ForegroundColor Gray
Write-Host "  Admin:     admin / admin123" -ForegroundColor Gray
Write-Host "  Operator:  employee / employee123" -ForegroundColor Gray
