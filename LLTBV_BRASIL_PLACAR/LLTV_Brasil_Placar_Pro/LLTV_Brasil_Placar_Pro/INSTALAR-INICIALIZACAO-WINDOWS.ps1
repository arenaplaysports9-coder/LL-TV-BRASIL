$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$link = Join-Path $startup 'LLTV Brasil - Iniciar Placar.lnk'
$target = Join-Path $root 'INICIAR-LLTV-OCULTO.vbs'
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($link)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = "`"$target`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Iniciar servidor LLTV Brasil em segundo plano'
$shortcut.Save()
Write-Host 'Inicialização automática configurada. O painel será aberto ao entrar no Windows.' -ForegroundColor Green
