$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root 'data\server.pid'
$stopped = $false
if (Test-Path $pidFile) {
  $serverPid = 0
  try { $serverPid = [int](Get-Content $pidFile -Raw) } catch {}
  if ($serverPid -gt 0) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid" -ErrorAction SilentlyContinue
    if ($proc -and $proc.CommandLine -match 'server\.js') { Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue; $stopped = $true }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}
# Fallback seguro: encerra apenas processos Node que estejam executando este server.js.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.Contains((Join-Path $root 'server.js')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped = $true }
if ($stopped) { Set-Content (Join-Path $root 'data\status-servidor.txt') 'Servidor encerrado.' }
