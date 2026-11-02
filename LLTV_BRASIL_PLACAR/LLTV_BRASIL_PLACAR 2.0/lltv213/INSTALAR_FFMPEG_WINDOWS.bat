@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title LLTV Brasil - Instalador FFmpeg

echo ==================================================
echo   LLTV BRASIL - INSTALADOR DO FFMPEG PARA WINDOWS
echo ==================================================
echo.

set "DEST=%~dp0tools\ffmpeg\bin"
if exist "%DEST%\ffmpeg.exe" (
  "%DEST%\ffmpeg.exe" -version >nul 2>&1
  if not errorlevel 1 (
    echo FFmpeg ja esta instalado dentro do projeto.
    "%DEST%\ffmpeg.exe" -version | findstr /b /c:"ffmpeg version"
    echo.
    echo Feche e abra novamente o LLTV Brasil.
    pause
    exit /b 0
  )
)

where winget >nul 2>&1
if not errorlevel 1 (
  echo Tentando instalar pelo Gerenciador de Pacotes do Windows...
  winget install --id Gyan.FFmpeg.Essentials -e --accept-package-agreements --accept-source-agreements
  if not errorlevel 1 (
    echo.
    echo Instalacao pelo winget concluida. Verificando...
    where ffmpeg >nul 2>&1
    if not errorlevel 1 goto :success
  ) else (
    echo O winget falhou. Tentando instalacao independente...
  )
) else (
  echo winget nao esta disponivel. Tentando instalacao independente...
)

echo.
echo Baixando pacote Essentials diretamente do mantenedor Gyan...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $root=Join-Path $env:TEMP 'lltv-ffmpeg-install'; $zip=Join-Path $root 'ffmpeg.zip'; $extract=Join-Path $root 'extract'; New-Item -ItemType Directory -Force -Path $root,$extract | Out-Null; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force; $exe=Get-ChildItem -Path $extract -Filter ffmpeg.exe -Recurse | Select-Object -First 1; if(-not $exe){throw 'ffmpeg.exe nao foi encontrado no pacote baixado'}; $bin=$exe.Directory.FullName; $dest='%DEST%'; New-Item -ItemType Directory -Force -Path $dest | Out-Null; Copy-Item -Path (Join-Path $bin '*') -Destination $dest -Recurse -Force; & (Join-Path $dest 'ffmpeg.exe') -version | Select-Object -First 1; if($LASTEXITCODE -ne 0){throw 'O FFmpeg foi copiado, mas nao iniciou'}; Remove-Item $root -Recurse -Force"
if errorlevel 1 (
  echo.
  echo ERRO: nao foi possivel baixar ou instalar o FFmpeg.
  echo Verifique a internet, espaco em disco e permissao de escrita na pasta do LLTV.
  echo Download oficial das builds Windows: https://www.gyan.dev/ffmpeg/builds/
  pause
  exit /b 1
)

:success
if exist "%DEST%\ffmpeg.exe" (
  "%DEST%\ffmpeg.exe" -version | findstr /b /c:"ffmpeg version"
  if errorlevel 1 goto :verify_error
) else (
  where ffmpeg >nul 2>&1
  if errorlevel 1 (
    echo FFmpeg nao foi localizado.
    pause
    exit /b 1
  )
  ffmpeg -version | findstr /b /c:"ffmpeg version"
  if errorlevel 1 goto :verify_error
)
echo.
echo INSTALACAO CONCLUIDA!
echo FFmpeg instalado em: %DEST%
echo Feche e abra novamente o LLTV Brasil usando REINICIAR_SERVIDOR.bat.
echo.
pause
exit /b 0

:verify_error
echo ERRO: FFmpeg nao passou na verificacao.
pause
exit /b 1
