# Pack both CapRover tarballs (Windows).
# Usage: .\scripts\caprover\pack-all.ps1 -ApiHost "ems-api.mydomain.com"

param(
  [Parameter(Mandatory = $true)]
  [string]$ApiHost,
  [string]$WebHost = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

$apiUrl = "https://$ApiHost/api"
$socketUrl = "https://$ApiHost"

# Backend
$backendTar = Join-Path $dist "caprover-backend.tgz"
if (Test-Path $backendTar) { Remove-Item $backendTar }
Push-Location (Join-Path $root "ems\ems-backend")
tar -czf $backendTar --exclude=node_modules .
Pop-Location
Write-Host "Created $backendTar"

# Frontend (patch API URL in temp copy)
$frontendDir = Join-Path $root "web_frontend"
$buildDir = Join-Path $env:TEMP "ems-frontend-caprover-build"
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
Copy-Item $frontendDir $buildDir -Recurse -Exclude node_modules,dist
$df = Join-Path $buildDir "Dockerfile"
(Get-Content $df -Raw) `
  -replace 'https://ems-api\.CHANGE_ME\.com/api', $apiUrl `
  -replace 'https://ems-api\.CHANGE_ME\.com', $socketUrl |
  Set-Content $df -NoNewline

$frontendTar = Join-Path $dist "caprover-frontend.tgz"
if (Test-Path $frontendTar) { Remove-Item $frontendTar }
Push-Location $buildDir
tar -czf $frontendTar --exclude=node_modules --exclude=dist .
Pop-Location
Write-Host "Created $frontendTar (API=$apiUrl)"

if ($WebHost) {
  Write-Host "  Frontend: https://$WebHost"
  Write-Host "  Set CLIENT_URL=https://$WebHost on backend CapRover app"
}
