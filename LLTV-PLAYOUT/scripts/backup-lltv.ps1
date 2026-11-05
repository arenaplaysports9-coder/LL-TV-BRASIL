param([string]$BackupRoot = "$PSScriptRoot\..\backups")
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvFile = Join-Path $ProjectRoot '.env'
if (!(Test-Path $EnvFile)) { throw '.env não encontrado. Configure DATABASE_URL antes do backup.' }
$line = Get-Content $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (!$line) { throw 'DATABASE_URL não configurado no .env.' }
$dbUrl = $line.Substring('DATABASE_URL='.Length).Trim().Trim('"').Trim("'")
if (!$dbUrl -or $dbUrl -match 'change_this|localhost:5432/lltv_playout$') { Write-Warning 'Verifique se DATABASE_URL aponta para o banco correto.' }
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (!$pgDump) { throw 'pg_dump não encontrado. Instale PostgreSQL Client Tools e adicione ao PATH.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = Join-Path $BackupRoot "LLTV-$stamp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
& $pgDump.Source --format=custom --no-owner --no-acl --dbname="$dbUrl" --file=(Join-Path $dest 'database.dump')
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou: $LASTEXITCODE" }
$media = Join-Path $ProjectRoot 'storage\media'
if (Test-Path $media) { Compress-Archive -Path (Join-Path $media '*') -DestinationPath (Join-Path $dest 'media.zip') -CompressionLevel Optimal }
@("Backup LLTV PLAYOUT", "Criado: $(Get-Date -Format o)", "Banco: dump PostgreSQL custom", "Mídias: media.zip (se existente)", "Não inclui .env, chaves RTMP nem segredos.") | Set-Content (Join-Path $dest 'BACKUP-INFO.txt')
Write-Host "Backup concluído: $dest" -ForegroundColor Green
