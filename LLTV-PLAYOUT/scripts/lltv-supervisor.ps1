param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [int]$Port = 4000,
  [int]$CheckIntervalSeconds = 30,
  [int]$FailureThreshold = 3
)
$ErrorActionPreference = 'Continue'
Set-Location $ProjectRoot
$logDir = Join-Path $ProjectRoot 'storage\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("supervisor-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))
function Write-Log([string]$Message) { Add-Content -Path $logFile -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) }
$failureCount = 0
$child = $null
function Start-Api {
  Write-Log 'Iniciando API LLTV PLAYOUT.'
  $script:child = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm start' -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 8
}
function Stop-Api {
  if ($script:child -and -not $script:child.HasExited) {
    Write-Log 'Encerrando processo da API para reinício controlado.'
    & taskkill.exe /PID $script:child.Id /T /F | Out-Null
  }
  $script:child = $null
}
Start-Api
while ($true) {
  Start-Sleep -Seconds $CheckIntervalSeconds
  if (-not $child -or $child.HasExited) {
    Write-Log 'Processo da API encerrou inesperadamente.'
    Start-Api
    $failureCount = 0
    continue
  }
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/health/live" -TimeoutSec 8
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { $failureCount = 0 } else { $failureCount++ }
  } catch { $failureCount++ ; Write-Log ("Falha no health check ({0}/{1}): {2}" -f $failureCount,$FailureThreshold,$_.Exception.Message) }
  if ($failureCount -ge $FailureThreshold) {
    Write-Log 'Health check excedeu limite; reiniciando API.'
    Stop-Api
    Start-Api
    $failureCount = 0
  }
}
