# Starts the EMS backend, after checking that DATABASE_URL is configured in ems/ems-backend/.env.

$root = $PSScriptRoot
$backendDir = Join-Path $root 'ems\ems-backend'
$envFile = Join-Path $backendDir '.env'

if (-not (Test-Path $backendDir)) { Write-Error "Missing directory: $backendDir"; exit 1 }

if (-not (Test-Path $envFile)) {
    Write-Warning "No .env file found at $envFile - DATABASE_URL is not configured."
} else {
    $dbLine = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=\s*\S' }
    if (-not $dbLine) {
        Write-Warning "DATABASE_URL is missing or empty in $envFile - the backend will likely fail to connect."
    } else {
        Write-Host "DATABASE_URL found in .env" -ForegroundColor Green
    }
}

Write-Host "Starting EMS backend ($backendDir)..." -ForegroundColor Cyan
Set-Location $backendDir
npm start
