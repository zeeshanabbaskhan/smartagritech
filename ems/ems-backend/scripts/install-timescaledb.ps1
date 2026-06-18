#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Install TimescaleDB 2.27.2 for PostgreSQL 17 on Windows and enable it on the EMS database.

.USAGE
  Right-click PowerShell -> Run as administrator, then:
    cd d:\projects\smartagritechapp\ems\ems-backend\scripts
    .\install-timescaledb.ps1

  Or from an elevated prompt in repo root:
    powershell -ExecutionPolicy Bypass -File .\ems\ems-backend\scripts\install-timescaledb.ps1
#>

$ErrorActionPreference = 'Stop'

$PgRoot   = 'C:\Program Files\PostgreSQL\17'
$PgBin    = Join-Path $PgRoot 'bin'
$PgLib    = Join-Path $PgRoot 'lib'
$PgExt    = Join-Path $PgRoot 'share\extension'
$PgConf   = Join-Path $PgRoot 'data\postgresql.conf'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ZipUrl   = 'https://github.com/timescale/timescaledb/releases/download/2.27.2/timescaledb-postgresql-17-windows-amd64.zip'
$WorkDir  = Join-Path $RepoRoot 'timescaledb-install'
$SrcDir   = Join-Path $WorkDir 'extracted\timescaledb'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path $PgBin\psql.exe)) {
  throw "PostgreSQL 17 not found at $PgRoot"
}

# timescaledb-tune and psql need pg_config on PATH (not set in elevated PowerShell by default)
$env:PATH = "$PgBin;$env:PATH"

Write-Step 'Downloading TimescaleDB 2.27.2 (PostgreSQL 17, Windows)'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$zip = Join-Path $WorkDir 'timescaledb.zip'
if (-not (Test-Path $SrcDir)) {
  Invoke-WebRequest -Uri $ZipUrl -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath (Join-Path $WorkDir 'extracted') -Force
}

Write-Step 'Copying TimescaleDB binaries and extension files'
Copy-Item "$SrcDir\*.dll" $PgLib -Force
Copy-Item "$SrcDir\timescaledb.control" $PgExt -Force
Copy-Item "$SrcDir\timescaledb--*.sql" $PgExt -Force
Copy-Item "$SrcDir\timescaledb-tune.exe" $PgBin -Force

Write-Step 'Configuring shared_preload_libraries in postgresql.conf'

function Repair-PostgresqlConf {
  param([string]$ConfPath)

  $lines = Get-Content $ConfPath
  $out   = [System.Collections.Generic.List[string]]::new()
  $added = $false

  foreach ($line in $lines) {
    # Remove corrupted block from a previous failed script run
    if ($line -match 'param\(\$m\)|\$libs\s*=|return "shared_preload_libraries') { continue }

    if ($line -match '^\s*#?\s*shared_preload_libraries\s*=') {
      if (-not $added) {
        $out.Add("shared_preload_libraries = 'timescaledb'")
        $added = $true
      }
      continue
    }

    $out.Add($line)
  }

  if (-not $added) {
    for ($i = 0; $i -lt $out.Count; $i++) {
      if ($out[$i] -match '# - Shared Library Preloading -') {
        $out.Insert($i + 1, "shared_preload_libraries = 'timescaledb'")
        $added = $true
        break
      }
    }
  }

  if (-not $added) {
    $out.Add('')
    $out.Add("shared_preload_libraries = 'timescaledb'")
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($ConfPath, $out.ToArray(), $utf8NoBom)
}

Repair-PostgresqlConf -ConfPath $PgConf

Write-Step 'Running timescaledb-tune (optional — skips on failure)'
$tune = Join-Path $PgBin 'timescaledb-tune.exe'
if (Test-Path $tune) {
  try {
    & $tune --yes --conf-path=$PgConf 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'timescaledb-tune exited with code' $LASTEXITCODE '- continuing anyway' -ForegroundColor Yellow
    }
  } catch {
    Write-Host 'timescaledb-tune skipped:' $_.Exception.Message -ForegroundColor Yellow
    Write-Host 'shared_preload_libraries was already set manually — safe to continue.' -ForegroundColor Yellow
  }
}

Write-Step 'Restarting PostgreSQL service'
Restart-Service postgresql-x64-17 -Force
Start-Sleep -Seconds 3

Write-Step 'Enabling TimescaleDB extension on database "ems"'
$env:PGPASSWORD = 'postgres'
& "$PgBin\psql.exe" -U postgres -d ems -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
if ($LASTEXITCODE -ne 0) { throw 'CREATE EXTENSION failed — check PostgreSQL logs' }

Write-Step 'Applying EMS hypertable setup (compression, retention, continuous aggregate)'
$setupSql = Join-Path $PSScriptRoot 'setup-timescaledb.sql'
& "$PgBin\psql.exe" -U postgres -d ems -f $setupSql
if ($LASTEXITCODE -ne 0) { throw 'setup-timescaledb.sql failed — see errors above' }

Write-Step 'Verifying installation'
& "$PgBin\psql.exe" -U postgres -d ems -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';"
& "$PgBin\psql.exe" -U postgres -d ems -c "SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'sensor_readings';"

Write-Host "`nTimescaleDB installation complete." -ForegroundColor Green
