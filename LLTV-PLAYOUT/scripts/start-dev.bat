@echo off
cd /d "%~dp0\.."
if not exist .env copy .env.example .env
start "LLTV API" cmd /k "npm run dev"
start "LLTV WEB" cmd /k "cd apps\web && npm install && npm run dev"
