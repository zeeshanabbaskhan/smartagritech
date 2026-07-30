# Pack both Linux deploy tarballs (Windows).
#
# With a domain (HTTPS):
#   .\scripts\deploy\pack-all.ps1 -ApiHost "api.yourdomain.com"
#
# With server IP only (HTTP — no domain):
#   .\scripts\deploy\pack-all.ps1 -ApiHost "http://YOUR_SERVER_IP:9001"

param(
  [Parameter(Mandatory = $true)]
  [string]$ApiHost,
  [string]$WebHost = ""
)

$ErrorActionPreference = "Stop"

$scheme = "https"
$hostPort = $ApiHost.Trim()

if ($hostPort -match '^https://') {
  $scheme = "https"
  $hostPort = $hostPort -replace '^https://', ''
} elseif ($hostPort -match '^http://') {
  $scheme = "http"
  $hostPort = $hostPort -replace '^http://', ''
} elseif ($hostPort -match '^http//') {
  $scheme = "http"
  $hostPort = $hostPort -replace '^http//', ''
}

$hostPort = ($hostPort -replace '/.*$', '').TrimEnd('/')
if (-not $hostPort) { throw "Invalid API host: $ApiHost" }

# Bare IPv4 without scheme → HTTP
if ($scheme -eq "https" -and $ApiHost -notmatch '^https://' -and $hostPort -match '^\d+\.\d+\.\d+\.\d+(:\d+)?$') {
  $scheme = "http"
}

# IP without port → backend port 9001
if ($hostPort -match '^\d+\.\d+\.\d+\.\d+$') {
  $hostPort = "${hostPort}:9001"
}

$apiUrl = "${scheme}://${hostPort}/api"
$socketUrl = "${scheme}://${hostPort}"

# scripts/deploy -> repo root
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

# Backend
$backendTar = Join-Path $dist "ems-backend.tgz"
if (Test-Path $backendTar) { Remove-Item $backendTar }
Push-Location (Join-Path $root "ems\ems-backend")
tar -czf $backendTar --exclude=node_modules .
Pop-Location
Write-Host "Created $backendTar"

# Frontend (patch API URL in temp copy)
$frontendDir = Join-Path $root "web_frontend"
$buildDir = Join-Path $env:TEMP "ems-frontend-deploy-build"
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
Copy-Item $frontendDir $buildDir -Recurse -Exclude node_modules,dist
$df = Join-Path $buildDir "Dockerfile"
$content = Get-Content $df -Raw
$content = $content.Replace('https://ems-api.CHANGE_ME.com/api', $apiUrl)
$content = $content.Replace('https://ems-api.CHANGE_ME.com', $socketUrl)
Set-Content $df -Value $content -NoNewline

$frontendTar = Join-Path $dist "ems-frontend.tgz"
if (Test-Path $frontendTar) { Remove-Item $frontendTar }
Push-Location $buildDir
tar -czf $frontendTar --exclude=node_modules --exclude=dist .
Pop-Location
Write-Host "Created $frontendTar (API=$apiUrl)"

if ($WebHost) {
  Write-Host "  Frontend: $WebHost"
  Write-Host "  Set CLIENT_URL=$WebHost in server .env"
} else {
  Write-Host "  Set CLIENT_URL to your frontend URL in server .env (e.g. http://YOUR_SERVER_IP:8080)"
}
