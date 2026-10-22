# Starts the chatbot API server (port 5175) and the chatbot Vite dev server (port 5174),
# each in its own PowerShell window so logs stay readable and Ctrl+C works per process.

$root = $PSScriptRoot
$serverDir = Join-Path $root 'chatbot\server'
$appDir = Join-Path $root 'chatbot'

if (-not (Test-Path $serverDir)) { Write-Error "Missing directory: $serverDir"; exit 1 }
if (-not (Test-Path $appDir)) { Write-Error "Missing directory: $appDir"; exit 1 }

Write-Host "Starting chatbot server on port 5175 ($serverDir)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$serverDir'; `$env:PORT = '5175'; node index.js"
)

Write-Host "Starting chatbot Vite dev server on port 5174 ($appDir)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$appDir'; npm run dev -- --port 5174"
)

Write-Host ""
Write-Host "Chatbot API : http://localhost:5175" -ForegroundColor Green
Write-Host "Chatbot UI  : http://localhost:5174" -ForegroundColor Green
Write-Host "Close the spawned windows to stop them."
