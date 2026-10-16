param(
  [string]$UsbRoot = "D:\"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $workspaceRoot

Write-Host "Building LDA before production deploy..."
$nodeVersion = (& node -v).Trim()
if ($nodeVersion -match "^v22\.") {
  npm run build
} else {
  Write-Host "Local Node is $nodeVersion; building with project runtime Node 22..."
  npx.cmd -y node@22 node_modules/next/dist/bin/next build
}

Write-Host "Deploying LDA to Vercel production..."
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$deployOutput = & vercel.cmd deploy --prod --yes 2>&1
$deployExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$deployOutput | ForEach-Object { Write-Host $_ }

if ($deployExitCode -ne 0) {
  throw "Vercel production deployment failed. USB master key was not updated."
}

$deploymentText = ($deployOutput | Out-String)
$deploymentId = ([regex]::Match($deploymentText, "dpl_[A-Za-z0-9]+")).Value
$deploymentUrl = ([regex]::Match($deploymentText, "https://[A-Za-z0-9.-]+\.vercel\.app")).Value

Write-Host "Refreshing USB master key after successful deployment..."
& (Join-Path $PSScriptRoot "update-usb-master-key.ps1") `
  -UsbRoot $UsbRoot `
  -DeploymentId $deploymentId `
  -DeploymentUrl $deploymentUrl `
  -ProductionUrl "https://ldrivingacademy.co.uk"

Write-Host "Running post-deployment LDA release audit..."
$env:LDA_RELEASE_AUDIT_TARGET = "https://ldrivingacademy.co.uk"
npm run audit:release
