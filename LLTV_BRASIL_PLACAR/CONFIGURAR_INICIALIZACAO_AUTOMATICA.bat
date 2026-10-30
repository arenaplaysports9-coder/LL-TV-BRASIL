@echo off
chcp 65001 >nul
setlocal
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\LLTV_Placar_Iniciar.vbs"
set "PROJECT=%~dp0"
set "PROJECT=%PROJECT:~0,-1%"
> "%TARGET%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%TARGET%" echo WshShell.CurrentDirectory = "%PROJECT%"
>> "%TARGET%" echo WshShell.Run "cmd.exe /c cd /d ""%PROJECT%"" ^&^& node server.js", 0, False

echo.
echo Inicializacao automatica configurada.
echo O placar iniciara com o Windows em segundo plano, sem janela aberta.
echo Pasta do projeto: %PROJECT%
echo.
echo IMPORTANTE: o Node.js precisa estar instalado.
echo Para remover a inicializacao automatica, execute REMOVER_INICIALIZACAO_AUTOMATICA.bat.
echo.
pause
