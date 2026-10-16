param(
  [string]$UsbRoot = "D:\",
  [string]$DeploymentId = "",
  [string]$DeploymentUrl = "",
  [string]$ProductionUrl = "https://ldrivingacademy.co.uk"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$usbPath = Resolve-Path $UsbRoot
$volume = Get-Volume -DriveLetter $usbPath.ProviderPath.Substring(0, 1) -ErrorAction SilentlyContinue

$acceptedUsbLabels = @("LDA", "MKEY")
if (-not $volume -or $acceptedUsbLabels -notcontains $volume.FileSystemLabel) {
  throw "Expected the LDA master-key USB drive at $UsbRoot. Found '$($volume.FileSystemLabel)' instead."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$usbProjectRoot = Join-Path $usbPath "Lda Files"
$latestZip = Join-Path $usbProjectRoot "LDA-Master Key-2026.zip"
$manifestName = "MASTER_KEY_MANIFEST.txt"
$adminLaunchPath = "director-master-key-lda-admin-9f4e7c2b6a"
$adminFolder = Join-Path $usbProjectRoot "LDA Admin USB Quick Launch"
$adminShortcut = Join-Path $usbPath "Open LDA Admin.url"
$technicalSupportLaunchPath = "technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50"
$technicalSupportFolder = Join-Path $usbProjectRoot "LDA Technical Support Quick Launch"
$technicalSupportShortcut = Join-Path $usbPath "Open LDA Technical Support.url"

$tempRoot = Join-Path $env:TEMP "lda-master-key-stage-$timestamp"
$tempZip = Join-Path $env:TEMP "LDA-Master-Key-2026-$timestamp.zip"

$excludedDirectories = @(
  ".agents",
  ".git",
  ".monitor",
  ".next",
  ".vercel",
  "node_modules",
  "output",
  "previews",
  "LDA Admin USB Quick Launch",
  "LDA Technical Support Quick Launch",
  "LDA Master Key USB"
)

$excludedFileNames = @(
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.production.local",
  ".env.preview.local"
)

function Test-IsExcludedPath {
  param([string]$RelativePath, [bool]$IsDirectory)

  $parts = $RelativePath -split "[\\/]" | Where-Object { $_ }
  foreach ($directory in $excludedDirectories) {
    if ($parts -contains $directory) {
      return $true
    }
  }

  if (-not $IsDirectory) {
    $name = Split-Path $RelativePath -Leaf
    if ($excludedFileNames -contains $name) {
      return $true
    }
    if ($name -like "*.zip") {
      return $true
    }
  }

  return $false
}

function Get-ShortcutUrl {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  $line = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue | Where-Object { $_ -like "URL=*" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  return $line.Substring(4).Trim()
}

function Get-AdminLaunchUrl {
  $configuredToken = [Environment]::GetEnvironmentVariable("LDA_ADMIN_LAUNCH_TOKEN", "Process")
  if ($configuredToken) {
    return "$ProductionUrl/$adminLaunchPath`?key=$configuredToken"
  }

  $existingUrl = Get-ShortcutUrl -Path $adminShortcut
  if ($existingUrl -like "*/$adminLaunchPath`?key=*") {
    return $existingUrl
  }

  $folderShortcut = Join-Path $adminFolder "Open LDA Admin.url"
  $existingFolderUrl = Get-ShortcutUrl -Path $folderShortcut
  if ($existingFolderUrl -like "*/$adminLaunchPath`?key=*") {
    return $existingFolderUrl
  }

  throw "Missing LDA_ADMIN_LAUNCH_TOKEN and no existing private admin launcher was found on the USB."
}

function Get-TechnicalSupportLaunchUrl {
  $configuredToken = [Environment]::GetEnvironmentVariable("LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN", "Process")
  if ($configuredToken) {
    return "$ProductionUrl/$technicalSupportLaunchPath`?key=$configuredToken"
  }

  $existingUrl = Get-ShortcutUrl -Path $technicalSupportShortcut
  if ($existingUrl -like "*/$technicalSupportLaunchPath`?key=*") {
    return $existingUrl
  }

  $folderShortcut = Join-Path $technicalSupportFolder "Open LDA Technical Support.url"
  $existingFolderUrl = Get-ShortcutUrl -Path $folderShortcut
  if ($existingFolderUrl -like "*/$technicalSupportLaunchPath`?key=*") {
    return $existingFolderUrl
  }

  throw "Missing LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN and no existing private technical support launcher was found on the USB."
}

if (Test-Path $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
if (Test-Path $tempZip) {
  Remove-Item -LiteralPath $tempZip -Force
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Path $usbProjectRoot -Force | Out-Null
New-Item -ItemType Directory -Path $adminFolder -Force | Out-Null
New-Item -ItemType Directory -Path $technicalSupportFolder -Force | Out-Null

$adminUrl = Get-AdminLaunchUrl
$technicalSupportUrl = Get-TechnicalSupportLaunchUrl

$rootPath = $workspaceRoot.Path.TrimEnd("\")
$files = Get-ChildItem -LiteralPath $rootPath -Recurse -Force -File | Where-Object {
  $relative = $_.FullName.Substring($rootPath.Length).TrimStart("\")
  -not (Test-IsExcludedPath -RelativePath $relative -IsDirectory:$false)
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($rootPath.Length).TrimStart("\")
  $destination = Join-Path $tempRoot $relative
  $destinationDirectory = Split-Path $destination -Parent
  if (-not (Test-Path $destinationDirectory)) {
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  }
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}

$manifest = @(
  "LDA Master Key 2026",
  "Created at: $(Get-Date -Format o)",
  "Production URL: $ProductionUrl",
  "Deployment ID: $DeploymentId",
  "Deployment URL: $DeploymentUrl",
  "Workspace source: $rootPath",
  "",
  "This archive is a source-code recovery snapshot.",
  "It deliberately excludes node_modules, build output, local env files, Vercel metadata, old zip files, and USB launcher secrets.",
  "After recovery, run npm install, restore Vercel/Supabase/Stripe secrets from their real services, then deploy."
)

Set-Content -LiteralPath (Join-Path $tempRoot $manifestName) -Value $manifest -Encoding UTF8

Compress-Archive -Path (Join-Path $tempRoot "*") -DestinationPath $tempZip -Force
Copy-Item -LiteralPath $tempZip -Destination $latestZip -Force

$adminShortcutContents = @(
  "[InternetShortcut]",
  "URL=$adminUrl",
  "IconFile=%ProgramFiles%\Google\Chrome\Application\chrome.exe",
  "IconIndex=0"
)
$adminShortcutContents | Set-Content -LiteralPath $adminShortcut -Encoding ASCII
$adminShortcutContents | Set-Content -LiteralPath (Join-Path $adminFolder "Open LDA Admin.url") -Encoding ASCII

@(
  "@echo off",
  "set `"LDA_ADMIN_URL=$adminUrl`"",
  "if exist `"%ProgramFiles%\Google\Chrome\Application\chrome.exe`" (",
  "  start `"`" `"%ProgramFiles%\Google\Chrome\Application\chrome.exe`" `"%LDA_ADMIN_URL%`"",
  ") else if exist `"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe`" (",
  "  start `"`" `"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe`" `"%LDA_ADMIN_URL%`"",
  ") else (",
  "  start `"`" `"%LDA_ADMIN_URL%`"",
  ")"
) | Set-Content -LiteralPath (Join-Path $adminFolder "Open LDA Admin in Chrome.cmd") -Encoding ASCII

@(
  "LDA Admin USB Quick Launch",
  "",
  "Open 'Open LDA Admin.url' or 'Open LDA Admin in Chrome.cmd' to reach the private admin sign-in gateway.",
  "Live URL: $adminUrl",
  "",
  "Authorised admin users still sign in with their approved email, password, and authenticator code.",
  "This shortcut does not contain a password, authenticator code, or reusable signed-in session."
) | Set-Content -LiteralPath (Join-Path $adminFolder "README.txt") -Encoding UTF8

$shortcutContents = @(
  "[InternetShortcut]",
  "URL=$technicalSupportUrl",
  "IconFile=%SystemRoot%\System32\SHELL32.dll",
  "IconIndex=220"
)
$shortcutContents | Set-Content -LiteralPath $technicalSupportShortcut -Encoding ASCII
$shortcutContents | Set-Content -LiteralPath (Join-Path $technicalSupportFolder "Open LDA Technical Support.url") -Encoding ASCII

@(
  "@echo off",
  "start `"`" `"$technicalSupportUrl`""
) | Set-Content -LiteralPath (Join-Path $technicalSupportFolder "Open LDA Technical Support.cmd") -Encoding ASCII

@(
  "LDA Technical Support Quick Launch",
  "",
  "Open 'Open LDA Technical Support.url' to reach the technical-team sign-in gateway.",
  "Live URL: $technicalSupportUrl",
  "",
  "Authorised technical staff sign in with their approved work email, password, and authenticator code.",
  "Admin users can continue to open the same support workspace from the Support section of the admin dashboard.",
  "This shortcut does not contain a password, authenticator code, or private admin launch key."
) | Set-Content -LiteralPath (Join-Path $technicalSupportFolder "README.txt") -Encoding UTF8

Remove-Item -LiteralPath $tempRoot -Recurse -Force
Remove-Item -LiteralPath $tempZip -Force

Write-Host "Updated LDA USB master key:"
Write-Host "Latest: $latestZip"
Write-Host "Admin shortcut: $adminShortcut"
Write-Host "Technical support shortcut: $technicalSupportShortcut"
Write-Host "Mode: overwrite latest only"
