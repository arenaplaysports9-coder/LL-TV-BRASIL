@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo   LLTV BRASIL - REINICIAR SERVIDOR DO PLACAR
echo ================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js ou confira se ele esta no PATH do Windows.
  pause
  exit /b 1
)
echo Encerrando o servidor antigo na porta 8787...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $pids) { if ($id -and $id -ne $PID) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
timeout /t 2 /nobreak >nul
echo Iniciando o servidor novamente em segundo plano...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
if errorlevel 1 (
  echo Nao foi possivel iniciar automaticamente. Tente executar INICIAR_PLACAR.bat.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
echo.
echo Comando de reinicio enviado. Nao e necessario reiniciar o Windows.
echo Atualize o painel no navegador com Ctrl+F5.
echo.
timeout /t 4 >nul
exit /b 0
