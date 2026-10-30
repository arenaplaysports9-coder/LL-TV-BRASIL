@echo off
chcp 65001 >nul
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LLTV_Placar_Iniciar.vbs"
if exist "%TARGET%" del "%TARGET%"
echo Inicializacao automatica removida, se existia.
pause
