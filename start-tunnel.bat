@echo off
chcp 65001 >nul
title TalentIQ AI - Launcher (Tunnel Mode)
color 0A

echo.
echo  ========================================
echo       TalentIQ AI - Tunnel Mode
echo       (Works on LTE / Mobile Data)
echo  ========================================
echo.

REM -- Ensure npm & pnpm global bins are in PATH -----------------------
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%PATH%"

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] pnpm not found in active PATH. Attempting automatic recovery...
    if exist "%APPDATA%\npm\pnpm.cmd" (
        set "PATH=%APPDATA%\npm;%PATH%"
    ) else (
        echo  [INFO] Installing pnpm globally via npm...
        call npm install -g pnpm
    )
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] pnpm is not installed.
    pause
    exit /b 1
)

echo  [1/2] Starting API server on port 5000...
start "TalentIQ - API Server" cmd /k "set PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%%PATH%% && cd /d %~dp0artifacts\api-server && echo Starting API server... && pnpm dev"

echo  [2/2] Starting Expo mobile app with TUNNEL...
timeout /t 3 /nobreak >nul
start "TalentIQ - Mobile App" cmd /k "set PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%%PATH%% && cd /d %~dp0artifacts\talentiq-mobile && echo Starting Expo in TUNNEL mode... && pnpm tunnel"

echo.
echo  * Tunnel mode enables scanning from mobile LTE / cellular data.
echo  * Wait a few seconds for the tunnel URL and QR code to appear.
echo.
pause
