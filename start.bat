@echo off
chcp 65001 >nul
title TalentIQ AI - Launcher
color 0A

echo.
echo  ========================================
echo       TalentIQ AI - Starting Up
echo  ========================================
echo.

REM -- Check pnpm is available ------------------------------------------
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] pnpm is not installed. Run: npm install -g pnpm
    pause
    exit /b 1
)

REM -- Check .env exists ------------------------------------------------
if not exist "artifacts\api-server\.env" (
    echo  [WARN] artifacts\api-server\.env not found!
    echo  Please copy artifacts\api-server\.env.example and fill in your Clerk keys.
    echo.
)

if not exist "artifacts\talentiq-mobile\.env" (
    echo  [WARN] artifacts\talentiq-mobile\.env not found!
    echo  Creating default .env for mobile...
    copy "artifacts\talentiq-mobile\.env.example" "artifacts\talentiq-mobile\.env" >nul 2>&1
)

echo  [1/2] Starting API server on port 5000...
start "TalentIQ - API Server" cmd /k "cd /d %~dp0artifacts\api-server && echo Starting API server... && pnpm dev"

echo  [2/2] Starting Expo mobile app...
timeout /t 3 /nobreak >nul
start "TalentIQ - Mobile App" cmd /k "cd /d %~dp0artifacts\talentiq-mobile && echo Starting Expo... && pnpm dev"

echo.
echo  * Both services are starting in separate windows.
echo.
echo  Mobile app:  Press 'w' for browser (web)
echo               Press 'a' for Android emulator
echo               Scan QR code with Expo Go
echo.
echo  NOTE: If your phone is on Cellular/LTE (not Wi-Fi):
echo        Press 's' in the Expo window to switch to TUNNEL mode!
echo        (Or run .\start-tunnel.bat)
echo.
echo  API Server:  http://localhost:5000/api/health
echo.
pause
