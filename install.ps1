# Install opencode-qwen2vl-mcp globally under ~/.config
$ErrorActionPreference = "Stop"

$GlobalConfig = Join-Path $env:USERPROFILE ".config"
$InstallDir = Join-Path $GlobalConfig "opencode-qwen2vl-mcp"
$Repo = "https://github.com/stevenke1981/opencode-qwen2vl-mcp.git"

Write-Host "opencode-qwen2vl-mcp global installer" -ForegroundColor Cyan
Write-Host "Install dir: $InstallDir" -ForegroundColor DarkGray

if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
  Write-Host "Cloning to $InstallDir ..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $GlobalConfig | Out-Null
  git clone $Repo $InstallDir
} elseif ($PSScriptRoot -ne $InstallDir) {
  Write-Host "Updating $InstallDir ..." -ForegroundColor Yellow
  Push-Location $InstallDir
  git pull --ff-only
  Pop-Location
}

Set-Location $InstallDir
node scripts/install-global.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone! Restart OpenCode." -ForegroundColor Green
Write-Host 'Verify: opencode run "call qwen_doctor and show the result"' -ForegroundColor White