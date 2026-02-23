$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$evidenceDir = Join-Path $repoRoot 'innomcp-node/evidence'

function Get-LatestEvidenceFile([string]$glob) {
  if (-not (Test-Path $evidenceDir)) { return $null }
  $files = Get-ChildItem -Path $evidenceDir -Filter $glob -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
  if ($files.Count -gt 0) { return $files[0].FullName }
  return $null
}

function Run-Step([string]$name, [scriptblock]$action) {
  Write-Host ""
  Write-Host "[STEP] $name"
  & $action
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $name (exit=$LASTEXITCODE)"
  }
}

Write-Host "RC_GATE_START=$((Get-Date).ToString('o'))"

try {
  Run-Step 'minimal-ci' {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_minimal_ci.ps1
  }
  $e1 = Get-LatestEvidenceFile 'minimal-ci-*.summary.log'
  if ($e1) { Write-Host "EVIDENCE_MINIMAL_CI=$e1" }

  Run-Step 'phase73' {
    Push-Location innomcp-node
    try {
      npx ts-node scripts/verify_phase73_repro_3cases.ts
    } finally {
      Pop-Location
    }
  }
  $e2 = Get-LatestEvidenceFile 'phase73-*.log'
  if ($e2) { Write-Host "EVIDENCE_PHASE73=$e2" }

  Run-Step 'phase74' {
    Push-Location innomcp-node
    try {
      npx ts-node scripts/verify_phase74_general_25cases.ts
    } finally {
      Pop-Location
    }
  }
  $e3 = Get-LatestEvidenceFile 'phase74-general-*.log'
  if ($e3) { Write-Host "EVIDENCE_PHASE74=$e3" }

  Write-Host "RC_GATE_END=$((Get-Date).ToString('o'))"
  Write-Host 'RESULT=PASS'
  exit 0
} catch {
  Write-Host "RC_GATE_END=$((Get-Date).ToString('o'))"
  Write-Host ("RESULT=BLOCKED reason=" + $_.Exception.Message)
  exit 1
}
