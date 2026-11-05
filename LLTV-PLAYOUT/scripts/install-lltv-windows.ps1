param([switch]$SkipDatabaseMigration)
$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root
function Need($name,$cmd){if(!(Get-Command $cmd -ErrorAction SilentlyContinue)){throw "$name não encontrado. Instale e adicione ao PATH."}}
Need 'Node.js 20+' 'node'; Need 'npm' 'npm'; Need 'FFmpeg' 'ffmpeg'; Need 'FFprobe' 'ffprobe'
$nodeMajor=[int]((node -p "process.versions.node.split('.')[0]").Trim());if($nodeMajor -lt 20){throw 'LLTV PLAYOUT exige Node.js 20 ou superior.'}
New-Item -ItemType Directory -Force -Path 'storage\media','storage\playout','storage\logs','backups' | Out-Null
if(!(Test-Path '.env')){Copy-Item '.env.example' '.env';Write-Warning 'Arquivo .env criado a partir do exemplo. Edite JWT_SECRET, DATABASE_URL e RTMP_SECRET_ENCRYPTION_KEY antes de continuar.'}
Write-Host 'Instalando dependências do backend...' -ForegroundColor Cyan
npm install
if($LASTEXITCODE -ne 0){throw 'npm install do backend falhou.'}
Write-Host 'Instalando dependências da interface...' -ForegroundColor Cyan
Push-Location 'apps\web'; npm install; if($LASTEXITCODE -ne 0){Pop-Location;throw 'npm install da interface falhou.'}; npm run build; if($LASTEXITCODE -ne 0){Pop-Location;throw 'Build React falhou.'}; Pop-Location
if(!$SkipDatabaseMigration){
  $envLine=Get-Content '.env' | Where-Object {$_ -match '^DATABASE_URL='} | Select-Object -First 1
  if($envLine -and $envLine -notmatch 'change_this') { npm run db:migrate; if($LASTEXITCODE -ne 0){throw 'Migração PostgreSQL falhou.'} }
  else {Write-Warning 'Migração não executada: configure DATABASE_URL em .env e rode npm run db:migrate.'}
}
Write-Host 'Pré-instalação concluída. Execute npm run doctor e depois scripts\start-dev.bat.' -ForegroundColor Green
