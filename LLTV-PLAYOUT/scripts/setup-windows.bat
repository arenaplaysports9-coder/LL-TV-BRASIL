@echo off
setlocal
cd /d "%~dp0\.."
echo === LLTV PLAYOUT - Preparacao do ambiente ===
where node >nul 2>nul || (echo Node.js nao encontrado. Instale Node.js 20 LTS+ & exit /b 1)
where npm >nul 2>nul || (echo npm nao encontrado. & exit /b 1)
call npm install
if errorlevel 1 exit /b 1
echo Dependencias do backend instaladas.
echo Para iniciar PostgreSQL, execute scripts\start-database.bat
echo Depois execute: npm run db:migrate e npm run dev
endlocal
