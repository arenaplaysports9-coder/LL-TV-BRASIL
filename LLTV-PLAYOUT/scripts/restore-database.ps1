param([Parameter(Mandatory=$true)][string]$DumpFile,[switch]$Clean)
$ErrorActionPreference='Stop'
if (!(Test-Path $DumpFile)) { throw "Arquivo não encontrado: $DumpFile" }
$line=Get-Content (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')) '.env') | Where-Object {$_ -match '^DATABASE_URL='} | Select-Object -First 1
if(!$line){throw 'DATABASE_URL ausente no .env.'}
$dbUrl=$line.Substring('DATABASE_URL='.Length).Trim().Trim('"').Trim("'")
Write-Warning 'A restauração altera o banco de destino. Faça backup antes e confirme que DATABASE_URL aponta para o banco correto.'
$restoreArgs=@('--no-owner','--no-acl','--dbname', $dbUrl)
if($Clean){$restoreArgs+=@('--clean','--if-exists')}
$restoreArgs+=@($DumpFile)
& pg_restore @restoreArgs
if($LASTEXITCODE -ne 0){throw "pg_restore falhou: $LASTEXITCODE"}
Write-Host 'Restauração do banco concluída.' -ForegroundColor Green
