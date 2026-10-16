$ErrorActionPreference = "Stop"

$folder = "D:\LDA Admin USB Quick Launch"
if (!(Test-Path -LiteralPath $folder)) {
  New-Item -ItemType Directory -Path $folder | Out-Null
}

$route = "https://ldrivingacademy.co.uk/director-master-key-lda-admin-9f4e7c2b6a"
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()

$token = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$url = "$route`?key=$token"

$sha = [Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token))
$sha.Dispose()
$hash = ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()

$urlShortcut = Join-Path $folder "Open LDA Admin.url"
$chromeLauncher = Join-Path $folder "Open LDA Admin in Chrome.cmd"
$hashFile = Join-Path $env:TEMP "lda-josh-admin-launch-hash.txt"

$urlContent = @"
[InternetShortcut]
URL=$url
IconFile=%ProgramFiles%\Google\Chrome\Application\chrome.exe
IconIndex=0
"@

Set-Content -LiteralPath $urlShortcut -Value $urlContent -Encoding ASCII

$cmdContent = @"
@echo off
set "LDA_ADMIN_URL=$url"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%LDA_ADMIN_URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LDA_ADMIN_URL%"
) else (
  start "" "%LDA_ADMIN_URL%"
)
"@

Set-Content -LiteralPath $chromeLauncher -Value $cmdContent -Encoding ASCII
Set-Content -LiteralPath $hashFile -Value $hash -Encoding ASCII

Write-Host "Created Joshua USB launch files."
Write-Host "Hash file written for Vercel env update: $hashFile"
