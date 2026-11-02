@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title LLTV Brasil - Compilar plugin nativo OBS
 echo ==================================================
echo LLTV BRASIL - COMPILACAO AUTOMATICA DO PLUGIN OBS
 echo ==================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DETECTAR-AMBIENTE.ps1"
if errorlevel 1 goto erro

where cmake >nul 2>nul
if errorlevel 1 (
 echo ERRO: CMake nao encontrado. Execute PREPARAR-AMBIENTE.bat e reabra o terminal.
 goto erro
)

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
 echo ERRO: Visual Studio Build Tools nao encontrado. Execute PREPARAR-AMBIENTE.bat.
 goto erro
)
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VS_PATH=%%i"
if not defined VS_PATH (
 echo ERRO: Carga de trabalho C++ nao encontrada no Visual Studio.
 goto erro
)

if not defined OBS_SDK_DIR (
 echo ERRO: SDK de desenvolvimento do OBS nao localizado.
 echo A deteccao automatica encontrou a versao do OBS, mas a instalacao comum nao inclui necessariamente SDK/Qt.
 echo Defina OBS_SDK_DIR para a pasta que contem libobsConfig.cmake e obs-frontend-apiConfig.cmake.
 goto erro
)

if not exist build mkdir build
cmake -S . -B build -G "Visual Studio 17 2022" -A x64 -DCMAKE_PREFIX_PATH="%OBS_SDK_DIR%"
if errorlevel 1 goto erro
cmake --build build --config Release --parallel
if errorlevel 1 goto erro
cmake --install build --config Release --prefix "%~dp0dist"
if errorlevel 1 goto erro

echo.
echo Compilacao concluida. Saida em native-plugin\dist.
echo A instalacao no OBS sera feita somente depois de confirmar a DLL gerada e os arquivos de dados necessarios.
pause
exit /b 0
:erro
echo.
echo A compilacao nao foi concluida. Consulte as mensagens acima e native-plugin\README.md.
pause
exit /b 1
