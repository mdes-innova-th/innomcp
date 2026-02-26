# scripts/run_minimal_ci.ps1
# Minimal CI runner for INNOMCP (Windows/PowerShell)
# - Kills workspace-scoped zombie node.exe trees
# - Runs Minimal Test Matrix builds + selected verifiers
# - Enforces per-step timeouts
# - Produces a single concise evidence summary + per-step logs

[CmdletBinding()]
param(
  # Build matrix
  [switch]$IncludeFrontendBuild,

  # Verifiers matrix
  [switch]$SkipWeather,
  [switch]$SkipTraceV3,
  [switch]$RunGeo,

  # Timeouts (seconds)
  [int]$TimeoutKillZombieSec = 10,
  [int]$TimeoutBuildBackendSec = 600,
  [int]$TimeoutBuildMcpSec = 600,
  [int]$TimeoutBuildFrontendSec = 900,
  [int]$TimeoutThaiGeoToolTestSec = 120,
  [int]$TimeoutWeatherVerifierSec = 300,
  [int]$TimeoutTraceV3VerifierSec = 180,
  [int]$TimeoutGeoTestSec = 420,

  # Evidence output (optional override)
  [string]$EvidenceDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-WorkspaceRoot {
  # script lives in <repoRoot>/scripts
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function New-Stamp {
  return (Get-Date).ToString('yyyyMMdd-HHmmss')
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

function Append-Evidence([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $max = 12
  for ($i = 1; $i -le $max; $i++) {
    try {
      [System.IO.File]::AppendAllText($Path, ($Text + "`n"), $enc)
      return
    } catch {
      if ($i -eq $max) {
        throw
      }
      Start-Sleep -Milliseconds 80
    }
  }
}

function Get-ProcessChildren([int]$ParentPid) {
  # Use CIM to traverse child processes
  $children = @()
  try {
    $direct = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentPid" -ErrorAction SilentlyContinue
    foreach ($c in ($direct | Where-Object { $_ -and $_.ProcessId })) {
      $children += $c
      $children += Get-ProcessChildren -ParentPid ([int]$c.ProcessId)
    }
  } catch {
    # best-effort
  }
  return $children
}

function Stop-ProcessTree([int]$Pid) {
  $kids = Get-ProcessChildren -ParentPid $Pid
  foreach ($k in ($kids | Sort-Object -Property ProcessId -Descending)) {
    try { Stop-Process -Id ([int]$k.ProcessId) -Force -ErrorAction SilentlyContinue } catch {}
  }
  try { Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue } catch {}
}

function Kill-WorkspaceNodeZombies([string]$WorkspaceRoot, [string]$EvidenceSummary, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)

  Append-Evidence -Path $EvidenceSummary -Text "[KILL] workspaceRoot=$WorkspaceRoot"

  $killed = 0
  while ((Get-Date) -lt $deadline) {
    $procs = @()
    try {
      $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
    } catch {
      $procs = @()
    }

    $targets = @($procs | Where-Object {
      $_ -and $_.ProcessId -and $_.CommandLine -and ($_.CommandLine -like "*$WorkspaceRoot*")
    })

    if ($targets.Count -eq 0) { break }

    foreach ($p in $targets) {
      $procId = [int]$p.ProcessId
      $cmd = ($p.CommandLine | Out-String).Trim()
      Append-Evidence -Path $EvidenceSummary -Text "[KILL] pid=$procId cmd=$cmd"
      Stop-ProcessTree -Pid $procId
      $killed++
    }

    Start-Sleep -Milliseconds 250
  }

  Append-Evidence -Path $EvidenceSummary -Text "[KILL] killedCount=$killed"
}

function Read-Tail([string]$FilePath, [int]$Lines = 200) {
  if (-not (Test-Path -LiteralPath $FilePath)) { return "" }
  try {
    return (Get-Content -LiteralPath $FilePath -Tail $Lines -ErrorAction SilentlyContinue) -join "`n"
  } catch {
    return ""
  }
}

function Invoke-Step([string]$Name, [string]$Command, [int]$TimeoutSec, [string]$EvidenceSummary, [string]$EvidenceOut, [string]$EvidenceErr) {
  Append-Evidence -Path $EvidenceSummary -Text ("`n[STEP] {0}`nCMD={1}`nTIMEOUT_SEC={2}`nSTART={3}" -f $Name, $Command, $TimeoutSec, (Get-Date).ToString('o'))

  if (Test-Path -LiteralPath $EvidenceOut) { Remove-Item -LiteralPath $EvidenceOut -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $EvidenceErr) { Remove-Item -LiteralPath $EvidenceErr -Force -ErrorAction SilentlyContinue }

  # Robust exit code capture: cmd.exe sometimes yields null ExitCode via Start-Process.
  # Append a marker line to stdout and parse it after completion.
  $exitMarker = '__INNOMCP_EXITCODE__='
  $wrapped = "$Command & echo $exitMarker%ERRORLEVEL%"
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $wrapped) -NoNewWindow -PassThru -RedirectStandardOutput $EvidenceOut -RedirectStandardError $EvidenceErr

  $ok = $true
  try {
    Wait-Process -Id $p.Id -Timeout $TimeoutSec -ErrorAction Stop
  } catch {
    $ok = $false
    Append-Evidence -Path $EvidenceSummary -Text "RESULT=TIMEOUT"
    Stop-ProcessTree -Pid $p.Id
  }

  # Give the OS a moment to flush redirected streams
  Start-Sleep -Milliseconds 150

  $exitCode = $null
  if ($ok) {
    try {
      if (Test-Path -LiteralPath $EvidenceOut) {
        $markerLine = (Get-Content -LiteralPath $EvidenceOut -Tail 30 -ErrorAction SilentlyContinue | Select-String -Pattern ([regex]::Escape($exitMarker)) | Select-Object -Last 1)
        if ($markerLine -and $markerLine.Line) {
          $raw = $markerLine.Line.Trim()
          if ($raw -match '^__INNOMCP_EXITCODE__=(\d+)$') {
            $exitCode = [int]$Matches[1]
          }
        }
      }
    } catch {
      $exitCode = $null
    }

    Append-Evidence -Path $EvidenceSummary -Text "RESULT=EXIT exitCode=$exitCode END=$((Get-Date).ToString('o'))"
    if ($exitCode -eq $null -or $exitCode -ne 0) { $ok = $false }
  }

  $tailOut = Read-Tail -FilePath $EvidenceOut -Lines 120
  $tailErr = Read-Tail -FilePath $EvidenceErr -Lines 120

  if ($tailOut) {
    Append-Evidence -Path $EvidenceSummary -Text "--- STDOUT (tail) ---"
    Append-Evidence -Path $EvidenceSummary -Text $tailOut
  }
  if ($tailErr) {
    Append-Evidence -Path $EvidenceSummary -Text "--- STDERR (tail) ---"
    Append-Evidence -Path $EvidenceSummary -Text $tailErr
  }

  return @{ Ok = $ok }
}

$workspaceRoot = Get-WorkspaceRoot
$stamp = New-Stamp

$defaultEvidenceDir = Join-Path $workspaceRoot 'innomcp-node\evidence'
$evidenceDir = if ($EvidenceDir -and $EvidenceDir.Trim().Length -gt 0) { (Resolve-Path $EvidenceDir).Path } else { $defaultEvidenceDir }
Ensure-Dir $evidenceDir

$evidenceSummary = Join-Path $evidenceDir "minimal-ci-$stamp.summary.log"
$null = New-Item -ItemType File -Path $evidenceSummary -Force

Append-Evidence -Path $evidenceSummary -Text "MINIMAL_CI_START=$((Get-Date).ToString('o'))"
Append-Evidence -Path $evidenceSummary -Text "WORKSPACE_ROOT=$workspaceRoot"
Append-Evidence -Path $evidenceSummary -Text "INCLUDE_FRONTEND_BUILD=$IncludeFrontendBuild"
Append-Evidence -Path $evidenceSummary -Text "SKIP_WEATHER=$SkipWeather"
Append-Evidence -Path $evidenceSummary -Text "SKIP_TRACEV3=$SkipTraceV3"
Append-Evidence -Path $evidenceSummary -Text "RUN_GEO=$RunGeo"

# 0) Kill zombie workspace node.exe before everything
try {
  Kill-WorkspaceNodeZombies -WorkspaceRoot $workspaceRoot -EvidenceSummary $evidenceSummary -TimeoutSec $TimeoutKillZombieSec
} catch {
  Append-Evidence -Path $evidenceSummary -Text "[KILL] error=$($_.Exception.Message)"
}

# 1) Builds (Minimal Test Matrix A)
$steps = @()
$steps += @{ Name = 'build:backend'; Cmd = 'npm --prefix innomcp-node run build'; Timeout = $TimeoutBuildBackendSec }
$steps += @{ Name = 'build:mcp'; Cmd = 'npm --prefix innomcp-server-node run build'; Timeout = $TimeoutBuildMcpSec }
$steps += @{ Name = 'test:thaiGeoTool'; Cmd = 'npm --prefix innomcp-server-node run test:thaiGeoTool'; Timeout = $TimeoutThaiGeoToolTestSec }
if ($IncludeFrontendBuild) {
  $steps += @{ Name = 'build:frontend'; Cmd = 'npm --prefix innomcp-next run build'; Timeout = $TimeoutBuildFrontendSec }
}

# 2) Verifiers (Minimal Test Matrix B)
if (-not $SkipWeather) {
  $weatherVerifier = Join-Path $workspaceRoot 'innomcp-node\scripts\verify_weather_v2.ts'
  if (-not (Test-Path -LiteralPath $weatherVerifier)) {
    Append-Evidence -Path $evidenceSummary -Text "[BLOCKED] missingVerifier=innomcp-node/scripts/verify_weather_v2.ts"
    Write-Host "BLOCKED missing verifier: verify_weather_v2.ts"
    exit 2
  }
  $steps += @{ Name = 'verify:weather_v2'; Cmd = 'cd innomcp-node && set TS_NODE_CACHE=false && npx ts-node scripts\verify_weather_v2.ts'; Timeout = $TimeoutWeatherVerifierSec }
}

if (-not $SkipTraceV3) {
  # Prefer the requested verifier if it exists; otherwise fall back to the existing Trace v3 verifier.
  $trace725 = Join-Path $workspaceRoot 'innomcp-node\scripts\verify_phase725_trace_v3.ts'
  $traceW1 = Join-Path $workspaceRoot 'innomcp-node\scripts\verify_phaseW1_weather_tracev3.ts'

  if (Test-Path -LiteralPath $trace725) {
    $steps += @{ Name = 'verify:phase725_trace_v3'; Cmd = 'cd innomcp-node && set TS_NODE_CACHE=false && npx ts-node scripts\verify_phase725_trace_v3.ts'; Timeout = $TimeoutTraceV3VerifierSec }
  } elseif (Test-Path -LiteralPath $traceW1) {
    $steps += @{ Name = 'verify:trace_v3_fallback_phaseW1'; Cmd = 'cd innomcp-node && set TS_NODE_CACHE=false && npx ts-node scripts\verify_phaseW1_weather_tracev3.ts'; Timeout = $TimeoutTraceV3VerifierSec }
    Append-Evidence -Path $evidenceSummary -Text "[NOTE] verify_phase725_trace_v3.ts missing; used fallback verify_phaseW1_weather_tracev3.ts"
  } else {
    Append-Evidence -Path $evidenceSummary -Text "[BLOCKED] missingVerifier=verify_phase725_trace_v3.ts AND missingFallback=verify_phaseW1_weather_tracev3.ts"
    Write-Host "BLOCKED missing trace v3 verifier"
    exit 2
  }
}

if ($RunGeo) {
  $steps += @{ Name = 'test:geo'; Cmd = 'npm --prefix innomcp-node run test:geo'; Timeout = $TimeoutGeoTestSec }
  $geoRoundC = Join-Path $workspaceRoot 'innomcp-node\scripts\verify_phase1_geo_roundC.ts'
  if (Test-Path -LiteralPath $geoRoundC) {
    $steps += @{ Name = 'verify:geo_roundC'; Cmd = 'cd innomcp-node && set TS_NODE_CACHE=false && npx ts-node scripts\verify_phase1_geo_roundC.ts'; Timeout = $TimeoutGeoTestSec }
  } else {
    Append-Evidence -Path $evidenceSummary -Text "[NOTE] geo verifier verify_phase1_geo_roundC.ts not found; ran test:geo only"
  }
}

# 3) Execute steps with per-step logs
foreach ($s in $steps) {
  # Kill zombies between steps too (prevents port-lock/stale watchers)
  try { Kill-WorkspaceNodeZombies -WorkspaceRoot $workspaceRoot -EvidenceSummary $evidenceSummary -TimeoutSec $TimeoutKillZombieSec } catch {}

  # Windows filenames cannot contain characters like ':'; keep step names human-readable but sanitize for paths
  $safeStepName = ([string]$s.Name) -replace '[:\\/\*\?"<>\|]', '_'
  $outFile = Join-Path $evidenceDir ("minimal-ci-$stamp.{0}.out.log" -f $safeStepName)
  $errFile = Join-Path $evidenceDir ("minimal-ci-$stamp.{0}.err.log" -f $safeStepName)

  $r = Invoke-Step -Name $s.Name -Command $s.Cmd -TimeoutSec ([int]$s.Timeout) -EvidenceSummary $evidenceSummary -EvidenceOut $outFile -EvidenceErr $errFile

  if (-not $r.Ok) {
    $reason = "step_failed=$($s.Name)"
    Append-Evidence -Path $evidenceSummary -Text "[BLOCKED] $reason"
    Write-Host "BLOCKED $reason"
    Write-Host "EVIDENCE $evidenceSummary"
    exit 1
  }
}

Append-Evidence -Path $evidenceSummary -Text "MINIMAL_CI_END=$((Get-Date).ToString('o'))"
Append-Evidence -Path $evidenceSummary -Text "RESULT=PASS"

Write-Host "PASS"
Write-Host "EVIDENCE $evidenceSummary"
exit 0
