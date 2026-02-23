$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$hookPath = Join-Path $repoRoot '.githooks/pre-commit'
if (-not (Test-Path $hookPath)) {
  throw "Missing hook file: $hookPath"
}

# Normalize line endings for Git Bash on Windows (avoid CRLF breaking /bin/sh)
try {
  $raw = [System.IO.File]::ReadAllText($hookPath)
  $normalized = $raw -replace "`r`n", "`n"
  if ($normalized -ne $raw) {
    [System.IO.File]::WriteAllText($hookPath, $normalized, (New-Object System.Text.UTF8Encoding($false)))
  }
} catch {
  throw "Failed to normalize hook EOL: $($_.Exception.Message)"
}

git config core.hooksPath .githooks | Out-Null

try {
  git update-index --chmod=+x .githooks/pre-commit | Out-Null
} catch {
  # On Windows this may be a no-op depending on config; ignore.
}

$configured = (git config core.hooksPath)
Write-Host "OK core.hooksPath=$configured"
Write-Host "OK hook=.githooks/pre-commit"
