@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Verificando Node.js...
node --version
if errorlevel 1 (
 echo ERRO: Instale Node.js 18 ou superior.
 pause
 exit /b 1
)
echo Verificando arquivos principais...
if not exist server.js echo ERRO: server.js ausente
if not exist public\panel.html echo ERRO: public\panel.html ausente
if not exist public\overlay.html echo ERRO: public\overlay.html ausente
echo Verificacao basica concluida.
pause
