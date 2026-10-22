@echo off
title TalentIQ AI — Launcher
color 0A

echo.
echo  ╔════════════════════════════════════════╗
echo  ║        TalentIQ AI — Starting Up       ║
echo  ╚════════════════════════════════════════╝
echo.

REM ── Check pnpm is available ──────────────────────────────────────────
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] pnpm is not installed. Run: npm install -g pnpm
    pause
    exit /b 1
)

REM ── Check .env exists ────────────────────────────────────────────────
if not exist "artifacts\api-server\.env" (
    echo  [WARN] artifacts\api-server\.env not found!
    echo  Please copy artifacts\api-server\.env.example and fill in your Clerk keys.
    echo.
)

echo  [1/2] Starting API server on port 5000...
start "TalentIQ — API Server" cmd /k "cd /d %~dp0artifacts\api-server && echo Starting API server... && pnpm dev"

echo  [2/2] Starting Expo mobile app...
timeout /t 3 /nobreak >nul
start "TalentIQ — Mobile App" cmd /k "cd /d %~dp0artifacts\talentiq-mobile && echo Starting Expo... && pnpm dev"

echo.
echo  ✓  Both services are starting in separate windows.
echo.
echo  Mobile app:  Press 'a' for Android emulator
echo               Press 'w' for browser (web)
echo               Or scan the QR code with Expo Go
echo.
echo  API Server:  http://localhost:5000/api/health
echo.
pause
