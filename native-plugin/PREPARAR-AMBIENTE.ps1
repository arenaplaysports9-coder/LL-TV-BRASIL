$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'LLTV Brasil - Preparar ambiente OBS'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $root 'INSTALACAO-AMBIENTE.log'
Start-Transcript -Path $log -Append | Out-Null
function Find-Winget {
  $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe",
    "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe"
  )
  foreach ($candidate in $candidates) {
    $found = Get-ChildItem -Path $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}
function Invoke-WingetInstall([string[]]$Arguments, [string]$Label) {
  Write-Host "`n$Label" -ForegroundColor Cyan
  try {
    & $script:winget @Arguments
    $code = $LASTEXITCODE
    if ($code -eq 0) { Write-Host "$Label: concluido." -ForegroundColor Green; return $true }
    if ($code -eq -1978335189 -or $code -eq 2316632083) { Write-Host "$Label: pacote ja instalado ou sem atualizacao necessaria." -ForegroundColor Yellow; return $true }
    Write-Warning "$Label terminou com codigo $code. Consulte $log"
    return $false
  } catch {
    Write-Warning "Nao foi possivel iniciar winget para $Label. $($_.Exception.Message)"
    return $false
  }
}
try {
  Write-Host 'LLTV BRASIL - INSTALACAO DAS FERRAMENTAS DE COMPILACAO OBS' -ForegroundColor Cyan
  Write-Host 'A instalacao do Visual Studio pode ocupar varios GB e exigir reinicializacao.'
  $script:winget = Find-Winget
  if (-not $script:winget) {
    throw 'winget.exe nao foi localizado. Atualize/instale o Aplicativo Instalador (App Installer) pela Microsoft Store e reinicie o Windows.'
  }
  Write-Host "winget localizado: $script:winget" -ForegroundColor Green
  & $script:winget source update
  if ($LASTEXITCODE -ne 0) { Write-Warning 'Nao foi possivel atualizar as fontes do winget; tentando instalar mesmo assim.' }

  $vsArgs = @('install','--id','Microsoft.VisualStudio.2022.BuildTools','--exact','--source','winget','--accept-package-agreements','--accept-source-agreements','--override','--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
  $vsOk = Invoke-WingetInstall $vsArgs '[1/2] Visual Studio 2022 Build Tools + C++'

  $cmakeArgs = @('install','--id','Kitware.CMake','--exact','--source','winget','--accept-package-agreements','--accept-source-agreements')
  $cmakeOk = Invoke-WingetInstall $cmakeArgs '[2/2] CMake'

  Write-Host "`n[3/3] Verificando ferramentas e OBS..." -ForegroundColor Cyan
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:Path
  $cmake = Get-Command cmake.exe -ErrorAction SilentlyContinue
  if ($cmake) { & $cmake.Source --version | Select-Object -First 1 } else { Write-Warning 'CMake ainda nao aparece no PATH. Feche e abra o terminal ou reinicie o Windows.' }
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vs) { Write-Host "Visual Studio C++ encontrado: $vs" -ForegroundColor Green } else { Write-Warning 'Build Tools existe, mas a carga de trabalho C++ nao foi confirmada.' }
  } else { Write-Warning 'Visual Studio Build Tools ainda nao foi localizado.' }
  & (Join-Path $root 'DETECTAR-AMBIENTE.ps1')
  Write-Host "`nLog completo: $log"
  if (-not $vsOk -or -not $cmakeOk) { Write-Warning 'Uma ou mais instalacoes falharam. O log registra os codigos de saida.'; exit 2 }
  Write-Host 'Etapa de instalacao finalizada. Se solicitado, reinicie o Windows.' -ForegroundColor Green
} catch {
  Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Consulte o log: $log"
  exit 1
} finally { Stop-Transcript | Out-Null }
