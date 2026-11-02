@echo off
chcp 65001 >nul
setlocal
where node >nul 2>nul
if not errorlevel 1 (
  echo Node.js ja esta instalado:
  node --version
  echo.
  npm --version
  pause
  exit /b 0
)
echo Node.js LTS nao foi encontrado.
where winget >nul 2>nul
if errorlevel 1 (
  echo O winget nao esta disponivel neste Windows.
  echo Abrindo o site oficial para instalar Node.js LTS...
  start "" https://nodejs.org/en/download
  echo Instale a versao LTS, reinicie o terminal e execute VERIFICAR-NODE.bat.
  pause
  exit /b 1
)
echo Tentando instalar Node.js LTS pela Microsoft winget...
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo O winget nao conseguiu executar a instalacao neste computador.
  echo Abrindo a pagina oficial do Node.js para instalacao manual.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
echo Instalacao solicitada. Feche e abra novamente o terminal.
node --version
npm --version
pause
