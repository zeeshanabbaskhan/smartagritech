# Deprecated: CapRover pack — use scripts/deploy/pack-all.ps1
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiHost,
  [string]$WebHost = ""
)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here "..\deploy\pack-all.ps1") -ApiHost $ApiHost -WebHost $WebHost
