# ─────────────────────────────────────────────────────────────────────────────
# End-to-end test helper for the device data pipeline.
#
# It injects a sensor reading for a device (as script.py would) and then reads
# it back from the authenticated API to prove the full chain works:
#
#     this script ──POST /api/ingest──► backend ──► DB/Redis
#                 ──GET /api/sensor-data/latest──► verifies value is stored
#
# You still ADD the device and VIEW the data in the real frontend (app/web).
# This script only covers the data-injection + verification leg.
#
# Usage:
#   ./test-e2e.ps1 -DeviceId "<id>" -IngestApiKey "<key>" `
#                  -Email "orgadmin@ems.com" -Password "Admin@123456"
#
# DeviceId + IngestApiKey come from the "MQTT Script Config" dialog shown
# right after you create the device in the frontend.
# ─────────────────────────────────────────────────────────────────────────────
param(
  [Parameter(Mandatory = $true)] [string]$DeviceId,
  [Parameter(Mandatory = $true)] [string]$IngestApiKey,
  [Parameter(Mandatory = $true)] [string]$Email,
  [Parameter(Mandatory = $true)] [string]$Password,
  [string]$BaseUrl = "https://iotbackend.zeeshan-abbas.tech/api",
  [double]$Moisture = 42.5,
  [double]$Battery  = 88,
  [double]$Tx       = 1203
)

$ErrorActionPreference = "Stop"
function Ok($m)   { Write-Host "  [PASS] $m" -ForegroundColor Green }
function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Die($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red; exit 1 }

# ── 1. Ingest a reading (no auth — just the device's x-api-key) ────────────────
Info "Step 1: POST sensor reading to /ingest"
$readings = @(
  @{ variableName = "SoilMoisture"; value = $Moisture; unit = "%" }
  @{ variableName = "BatteryLevel"; value = $Battery;  unit = "%" }
  @{ variableName = "TxCounter";    value = $Tx;       unit = "count" }
)
$ingestBody = @{ deviceId = $DeviceId; readings = $readings } | ConvertTo-Json -Depth 5

try {
  $res = Invoke-RestMethod -Uri "$BaseUrl/ingest" -Method Post `
    -Headers @{ "x-api-key" = $IngestApiKey } `
    -ContentType "application/json" -Body $ingestBody
} catch {
  Die "Ingest request failed: $($_.Exception.Message). Check DeviceId / IngestApiKey."
}
if (-not $res.success) { Die "Ingest returned success=false: $($res | ConvertTo-Json)" }
Ok "Reading accepted (queued=$($res.queued))"

# ── 2. Log in to get a token for the read-back ─────────────────────────────────
Info "Step 2: Login as $Email"
try {
  $login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post `
    -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
} catch {
  Die "Login failed: $($_.Exception.Message)"
}
if (-not $login.token) { Die "No token in login response" }
$auth = @{ Authorization = "Bearer $($login.token)" }
Ok "Logged in"

# Give the queue/flush a moment if async ingest is enabled
Start-Sleep -Seconds 2

# ── 3. Read latest values back and verify the names match ──────────────────────
Info "Step 3: GET /sensor-data/latest and verify values"
try {
  $latest = Invoke-RestMethod -Uri "$BaseUrl/sensor-data/latest?deviceId=$DeviceId" `
    -Method Get -Headers $auth
} catch {
  Die "Latest fetch failed: $($_.Exception.Message)"
}

$data = $latest.data
if (-not $data) { Die "No 'data' in latest response" }

$expected = @{ SoilMoisture = $Moisture; BatteryLevel = $Battery; TxCounter = $Tx }
$allFound = $true
foreach ($name in $expected.Keys) {
  $entry = $data.$name
  if ($null -eq $entry) {
    Write-Host "  [MISS] '$name' not in latest — template has no variable named '$name'." -ForegroundColor Yellow
    $allFound = $false
  } else {
    Ok "$name = $($entry.value) $($entry.unit)"
  }
}

Write-Host ""
if ($allFound) {
  Write-Host "E2E DATA PATH OK — now open this device in the frontend; the values should display." -ForegroundColor Green
} else {
  Write-Host "Data was ingested but some variables are not shown. Fix: add template variables" -ForegroundColor Yellow
  Write-Host "named EXACTLY SoilMoisture / BatteryLevel / TxCounter, then re-run." -ForegroundColor Yellow
  exit 2
}
