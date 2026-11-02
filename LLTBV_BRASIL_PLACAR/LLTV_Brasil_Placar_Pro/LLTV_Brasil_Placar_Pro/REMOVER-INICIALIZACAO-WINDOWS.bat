@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path ([Environment]::GetFolderPath('Startup')) 'LLTV Brasil - Iniciar Placar.lnk'; if(Test-Path $p){Remove-Item $p -Force}; Write-Host 'Inicializacao automatica removida.'; pause"
