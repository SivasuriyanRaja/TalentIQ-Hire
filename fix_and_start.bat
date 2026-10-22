@echo off
title TalentIQ AI — Setup & Fix
color 0E

echo.
echo  ╔════════════════════════════════════════╗
echo  ║     TalentIQ AI — Fix & Start          ║
echo  ╚════════════════════════════════════════╝
echo.

REM ── Check Node.js ────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  ✓  Node.js %NODE_VER% detected

REM ── Check pnpm ───────────────────────────────────────────────────────
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  Installing pnpm globally...
    npm install -g pnpm
)

for /f "tokens=*" %%v in ('pnpm --version') do set PNPM_VER=%%v
echo  ✓  pnpm %PNPM_VER% detected

REM ── Install workspace dependencies ───────────────────────────────────
echo.
echo  Installing all workspace dependencies (this may take a minute)...
cd /d "%~dp0"
pnpm install

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] pnpm install failed. Check the error above.
    pause
    exit /b 1
)

echo  ✓  Dependencies installed
echo.

REM ── Check .env ────────────────────────────────────────────────────────
if not exist "artifacts\api-server\.env" (
    echo  [WARN] No .env found for API server.
    echo  Creating .env from template...
    copy "artifacts\api-server\.env.example" "artifacts\api-server\.env" >nul 2>&1
    echo.
    echo  !! Please edit artifacts\api-server\.env with your Clerk + OpenAI keys !!
    echo.
    notepad "artifacts\api-server\.env"
)

REM ── Start services ────────────────────────────────────────────────────
echo  Starting services...
echo.
start "TalentIQ — API Server" cmd /k "cd /d %~dp0artifacts\api-server && pnpm dev"
timeout /t 4 /nobreak >nul
start "TalentIQ — Mobile App" cmd /k "cd /d %~dp0artifacts\talentiq-mobile && pnpm dev"

echo.
echo  ✓  All done! Both windows are starting.
echo.
echo  API:    http://localhost:5000/api/health
echo  Mobile: Scan QR code in the Expo window with Expo Go
echo          or press 'a' for Android / 'w' for browser
echo.
pause
