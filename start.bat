@echo off
chcp 65001 >nul
title TalentIQ AI - Launcher
color 0A

echo.
echo  ========================================
echo       TalentIQ AI - Starting Up
echo  ========================================
echo.

REM -- Ensure npm & pnpm global bins are in PATH -----------------------
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%PATH%"

REM -- Check pnpm is available ------------------------------------------
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
    echo  [ERROR] Failed to locate or install pnpm.
    echo  Please run in PowerShell/CMD: npm install -g pnpm
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

REM -- Detect active Wi-Fi IP to ensure Expo binds to physical Wi-Fi --
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do set "WIFI_IP=%%i"

if defined WIFI_IP (
    echo  [NETWORK] Detected Wi-Fi IP: %WIFI_IP%
    set "REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%"
)

echo  [1/2] Starting API server on port 5000...
start "TalentIQ - API Server" cmd /k "set PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%%PATH%% && cd /d %~dp0artifacts\api-server && echo Starting API server... && pnpm dev"

echo  [2/2] Starting Expo mobile app...
timeout /t 3 /nobreak >nul
if defined WIFI_IP (
    start "TalentIQ - Mobile App" cmd /k "set PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%%PATH%% && cd /d %~dp0artifacts\talentiq-mobile && set REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP% && echo Starting Expo on %WIFI_IP%... && pnpm dev"
) else (
    start "TalentIQ - Mobile App" cmd /k "set PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%%PATH%% && cd /d %~dp0artifacts\talentiq-mobile && echo Starting Expo... && pnpm dev"
)

echo.
echo  * Both services are starting in separate windows.
echo.
echo  Mobile app:  Press 'w' for browser (web)
echo               Press 'a' for Android emulator
echo               Scan QR code with Expo Go
echo.
echo  ==============================================================
echo   IF EXPO TIMES OUT ON YOUR PHONE:
echo   1. Ensure phone is connected to the SAME Wi-Fi network (%WIFI_IP%)
echo   2. If on Cellular/LTE or hotspot, run: .\start-tunnel.bat
echo      (Or press 's' in the Expo window to switch to TUNNEL mode)
echo  ==============================================================
echo.
echo  API Server:  http://localhost:5000/api/health
echo.
pause
