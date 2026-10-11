# Hackathon Checkpoint Commit Script
# Ensures freellmapi and MEMORY-main are NEVER committed, only project code.

param (
    [string]$Message = ""
)

$Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "feat(hackathon): progress checkpoint at $Timestamp"
}

# 1. Check if freellmapi or MEMORY are accidentally staged
$staged = git status --porcelain
if ($staged -match "freellmapi" -or $staged -match "MEMORY") {
    Write-Host "[ERROR] Attempted to stage excluded tools. Aborting." -ForegroundColor Red
    exit 1
}

# 2. Stage and commit
git add .
git commit -m "$Message"

Write-Host "✅ Committed successfully: $Message" -ForegroundColor Green
Write-Host "To push to GitHub, run: git push origin main" -ForegroundColor Cyan
