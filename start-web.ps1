# Starts the web_frontend Vite dev server on port 5173 in the current window.

$root = $PSScriptRoot
$appDir = Join-Path $root 'web_frontend'

if (-not (Test-Path $appDir)) { Write-Error "Missing directory: $appDir"; exit 1 }

Write-Host "Starting web_frontend Vite dev server on port 5173 ($appDir)..." -ForegroundColor Cyan
Write-Host "Web UI: http://localhost:5173" -ForegroundColor Green

Set-Location $appDir
npm run dev -- --port 5173
