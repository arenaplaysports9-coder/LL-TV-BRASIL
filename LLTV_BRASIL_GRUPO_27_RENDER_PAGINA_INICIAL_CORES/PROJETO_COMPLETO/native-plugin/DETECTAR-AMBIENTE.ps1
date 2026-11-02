$ErrorActionPreference = 'SilentlyContinue'
Write-Host 'LLTV BRASIL - DETECCAO AUTOMATICA DO AMBIENTE OBS' -ForegroundColor Cyan
Write-Host ''

# Detecta OBS por caminhos comuns, atalhos de instalação e registro do Windows.
$obsCandidates = @(
  "$env:ProgramFiles\obs-studio\bin\64bit\obs64.exe",
  "${env:ProgramFiles(x86)}\obs-studio\bin\64bit\obs64.exe",
  "$env:LOCALAPPDATA\Programs\obs-studio\bin\64bit\obs64.exe",
  "$env:ProgramFiles\OBS Studio\bin\64bit\obs64.exe"
) | Where-Object { $_ -and (Test-Path $_) }

$uninstallRoots = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*')
foreach ($root in $uninstallRoots) {
  Get-ItemProperty $root | Where-Object { $_.DisplayName -match '^OBS Studio' -and $_.InstallLocation } | ForEach-Object {
    $p = Join-Path $_.InstallLocation 'bin\64bit\obs64.exe'
    if (Test-Path $p) { $obsCandidates += $p }
  }
}
$obsExe = $obsCandidates | Select-Object -Unique | Select-Object -First 1
if ($obsExe) {
  $ver = (Get-Item $obsExe).VersionInfo.ProductVersion
  $script:OBS_VERSION = $ver
  $obsRoot = (Resolve-Path (Join-Path (Split-Path $obsExe -Parent) '..\..')).Path
  $env:OBS_INSTALL_DIR = $obsRoot
  Write-Host "OBS encontrado: $obsExe" -ForegroundColor Green
  Write-Host "Versao detectada: $ver" -ForegroundColor Green
  Write-Host "Pasta: $obsRoot"
} else {
  Write-Warning 'OBS Studio nao foi encontrado nos caminhos padrao. Instale o OBS ou informe OBS_INSTALL_DIR.'
}

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
  $vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($vs) { Write-Host "Visual Studio C++: $vs" -ForegroundColor Green } else { Write-Warning 'Visual Studio encontrado, mas a carga de trabalho C++ nao foi localizada.' }
} else { Write-Warning 'Visual Studio/Build Tools nao localizado.' }
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmake) { Write-Host "CMake: $(& cmake --version | Select-Object -First 1)" -ForegroundColor Green } else { Write-Warning 'CMake nao localizado no PATH.' }

# O instalador normal do OBS nao inclui necessariamente headers/CMake packages de desenvolvimento.
$sdkCandidates = @($env:OBS_SDK_DIR, "$env:ProgramFiles\obs-studio\cmake", "$env:ProgramFiles\obs-studio\lib\cmake", "$env:ProgramFiles\obs-studio\include") | Where-Object { $_ -and (Test-Path $_) }
$sdkFound = $false
foreach ($p in $sdkCandidates) {
  if ((Get-ChildItem $p -Recurse -Filter 'libobsConfig.cmake' -ErrorAction SilentlyContinue | Select-Object -First 1) -or (Get-ChildItem $p -Recurse -Filter 'obs-frontend-apiConfig.cmake' -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    $env:OBS_SDK_DIR = $p; $sdkFound = $true; break
  }
}
if ($sdkFound) { Write-Host "Pacotes CMake do SDK OBS encontrados em: $env:OBS_SDK_DIR" -ForegroundColor Green }
else { Write-Warning 'SDK de desenvolvimento do OBS nao encontrado. A versao do OBS foi detectada, mas o SDK/headers/Qt compativeis precisam ser instalados separadamente.' }

Write-Host ''
Write-Host 'Resumo: a deteccao identifica a versao instalada do OBS e procura o SDK correspondente.'
Write-Host 'Nao baixa nem inventa um SDK: a distribuicao comum do OBS Studio nao inclui todos os arquivos de desenvolvimento.'
