@echo off
cd /d "%~dp0\.."
where docker >nul 2>nul || (echo Docker Desktop nao encontrado. & exit /b 1)
docker compose up -d postgres
