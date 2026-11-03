@echo off
setlocal
cd /d "%~dp0"
title NANO-HEPATOTEA Setup

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v18 or newer from https://nodejs.org/
    exit /b 1
)

node "%~dp0scripts\setup.mjs" %*
if errorlevel 1 (
    exit /b 1
)

exit /b 0
