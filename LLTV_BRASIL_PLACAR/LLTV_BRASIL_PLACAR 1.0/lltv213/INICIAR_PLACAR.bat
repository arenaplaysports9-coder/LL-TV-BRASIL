@echo off
chcp 65001 >nul
title LLTV BRASIL - Placar de Futebol
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale Node.js 18 ou superior em https://nodejs.org/
  echo Depois execute este arquivo novamente.
  pause
  exit /b 1
)
start "" "http://localhost:8787/panel.html"
node server.js
pause
