@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process cmd -ArgumentList '/k cd /d \"%~dp0\" && npm run dev' -Verb RunAs"
    exit /b
)
npm run dev
