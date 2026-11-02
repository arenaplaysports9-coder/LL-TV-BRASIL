$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$pidFile = Join-Path $root 'data\server.pid'
$logOut = Join-Path $root 'data\server.log'
$logErr = Join-Path $root 'data\server-error.log'
$port = 8787

# Se já estiver funcionando, apenas abre o painel.
$running = $false
try { $client = New-Object Net.Sockets.TcpClient; $ar = $client.BeginConnect('127.0.0.1',$port,$null,$null); $running = $ar.AsyncWaitHandle.WaitOne(700) -and $client.Connected; $client.Close() } catch {}
if ($running) { Start-Process "http://localhost:$port"; exit 0 }

$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $node) { Set-Content (Join-Path $root 'data\erro-inicializacao.txt') 'Node.js não foi encontrado. Instale o Node.js LTS e tente novamente.'; exit 1 }
if (-not (Test-Path (Join-Path $root 'node_modules\express'))) {
  if (-not $npm) { $npm = Join-Path (Split-Path $node) 'npm.cmd' }
  Push-Location $root
  & $npm install
  $installCode = $LASTEXITCODE
  Pop-Location
  if ($installCode -ne 0) { Set-Content (Join-Path $root 'data\erro-inicializacao.txt') 'Falha ao instalar dependências. Verifique a conexão e execute novamente.'; exit $installCode }
}
if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
$p = Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
Set-Content -Path $pidFile -Value $p.Id -Encoding ASCII
$ready = $false
for ($i=0; $i -lt 25; $i++) {
  Start-Sleep -Milliseconds 500
  try { $c = New-Object Net.Sockets.TcpClient; $a = $c.BeginConnect('127.0.0.1',$port,$null,$null); $ready = $a.AsyncWaitHandle.WaitOne(300) -and $c.Connected; $c.Close() } catch {}
  if ($ready) { break }
  if ($p.HasExited) { break }
}
if ($ready) { Start-Process "http://localhost:$port" }
else { Set-Content (Join-Path $root 'data\erro-inicializacao.txt') 'O servidor não iniciou. Consulte data\server-error.log.'; Start-Process notepad.exe -ArgumentList "`"$logErr`"" }
