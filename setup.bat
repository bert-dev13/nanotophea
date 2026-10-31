@echo off
setlocal
cd /d "%~dp0"
title NANOTOPHEA Setup

echo.
echo ===============================================================================
echo                NANOTOPHEA Automated Environment Setup
echo ===============================================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v18 or newer from https://nodejs.org/
    echo.
    if "%~1"=="" pause
    exit /b 1
)

node "%~dp0scripts\setup.mjs" %*
set "EXIT_CODE=%ERRORLEVEL%"

if "%~1"=="--non-interactive" exit /b %EXIT_CODE%
if "%NON_INTERACTIVE%"=="1" exit /b %EXIT_CODE%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Setup encountered an issue (Exit code: %EXIT_CODE%).
)

echo.
echo Press any key to exit.
pause >nul
exit /b %EXIT_CODE%
