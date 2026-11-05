param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$supervisor = Join-Path $ProjectRoot 'scripts\lltv-supervisor.ps1'
if (-not (Test-Path $supervisor)) { throw "Supervisor não encontrado: $supervisor" }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$supervisor`" -ProjectRoot `"$ProjectRoot`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'LLTV PLAYOUT Supervisor' -Action $action -Trigger $trigger -Settings $settings -Description 'Mantém a API LLTV PLAYOUT ativa e reinicia em caso de falha.' -Force | Out-Null
Write-Host 'Tarefa LLTV PLAYOUT Supervisor instalada para iniciar no logon deste usuário.'
Write-Host 'Para operação em servidor dedicado, configure também energia, rede e usuário de inicialização.'
