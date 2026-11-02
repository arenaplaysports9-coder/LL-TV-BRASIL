$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stopScript = Join-Path $root 'PARAR-SERVIDOR.ps1'
$startScript = Join-Path $root 'INICIAR-SERVIDOR-OCULTO.ps1'

# Encerra somente a instância do servidor pertencente a esta pasta.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopScript

# Aguarda a liberação da porta antes de iniciar novamente.
$port = 8787
$released = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    $client = $null
    try {
        $client = New-Object Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(250) -and $client.Connected
        if (-not $connected) { $released = $true; break }
    } catch { $released = $true; break }
    finally { if ($client) { $client.Close() } }
}
if (-not $released) {
    Set-Content (Join-Path $root 'data\erro-reinicio.txt') 'Não foi possível liberar a porta 8787. Verifique se outro programa está usando essa porta.'
    exit 1
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
