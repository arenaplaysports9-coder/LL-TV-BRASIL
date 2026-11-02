@echo off
setlocal
cd /d "%~dp0"
title LLTV Brasil - Preparar ambiente de compilacao OBS
echo ==================================================
echo LLTV BRASIL - PREPARAR VISUAL STUDIO, CMAKE E OBS
echo ==================================================
echo Este assistente usa o winget oficial e registra um log de instalacao.
echo O Visual Studio Build Tools ocupa varios GB e pode exigir reinicio.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARAR-AMBIENTE.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo A instalacao teve falhas. Consulte native-plugin\INSTALACAO-AMBIENTE.log.
pause
exit /b %RC%
