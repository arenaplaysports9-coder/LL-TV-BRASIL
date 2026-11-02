@echo off
chcp 65001 >nul
echo Verificando Node.js e npm...
where node >nul 2>nul || (echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/ & pause & exit /b 1)
node --version
where npm >nul 2>nul && npm --version
echo.
pause
