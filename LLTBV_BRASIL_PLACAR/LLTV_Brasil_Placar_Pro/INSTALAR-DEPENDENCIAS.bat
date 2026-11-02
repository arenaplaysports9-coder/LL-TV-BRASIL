@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale Node.js LTS em https://nodejs.org/ & pause & exit /b 1)
npm install
if errorlevel 1 (echo Falha ao instalar dependencias.& pause & exit /b 1)
echo Dependencias instaladas.
pause
