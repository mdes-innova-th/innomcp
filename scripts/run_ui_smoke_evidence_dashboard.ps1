Param(
  [int]$TimeoutSeconds = 420
)

$ErrorActionPreference = 'Stop'

function Write-LogLine {
  Param([string]$Line)
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  "$ts  $Line" | Out-File -FilePath $script:EvidenceLog -Encoding utf8 -Append
}

function Kill-NodeTrees {
  try {
    $procs = Get-CimInstance Win32_Process | Where-Object {
      $_.Name -in @('node.exe','npm.exe','npx.exe')
    }

    foreach ($p in $procs) {
      try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
      } catch {
        # ignore
      }
    }
  } catch {
    # ignore
  }
}

function Wait-HttpOk {
  Param(
    [string]$Url,
    [int]$WaitSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 -Uri $Url
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }
  return $false
}

function Resolve-McpHealthUrl {
  $candidates = @(
    'http://localhost:3012/health',
    'http://127.0.0.1:3012/health',
    'http://localhost:3013/health',
    'http://127.0.0.1:3013/health'
  )

  foreach ($u in $candidates) {
    if (Wait-HttpOk -Url $u -WaitSeconds 2) { return $u }
  }
  return $candidates[0]
}

function Tail-TextFile {
  Param(
    [string]$Path,
    [int]$Lines = 30
  )
  if (-not (Test-Path $Path)) { return "(no log file)" }
  try {
    return (Get-Content -Path $Path -Tail $Lines -ErrorAction Stop) -join "`n"
  } catch {
    return "(failed to read log file)"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$evidenceDir = Join-Path $repoRoot 'innomcp-node\evidence'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$script:EvidenceLog = Join-Path $evidenceDir ("ui-smoke-evidence-dashboard-$stamp.log")

Write-LogLine "ui-smoke start"
Write-LogLine "repoRoot=$repoRoot"
Write-LogLine "timeoutSeconds=$TimeoutSeconds"

$pass = $false
$blockedReason = ''

$env:SMOKE_MODE = '1'
$env:NODE_ENV = 'test'
$env:WEATHER_FIXTURE_W1 = '1'

$mcpProc = $null
$backendProc = $null
$frontendProc = $null
$pwProc = $null

$mcpOut = Join-Path $evidenceDir ("ui-smoke-mcp-$stamp.out.log")
$mcpErr = Join-Path $evidenceDir ("ui-smoke-mcp-$stamp.err.log")
$beOut  = Join-Path $evidenceDir ("ui-smoke-backend-$stamp.out.log")
$beErr  = Join-Path $evidenceDir ("ui-smoke-backend-$stamp.err.log")
$feOut  = Join-Path $evidenceDir ("ui-smoke-frontend-$stamp.out.log")
$feErr  = Join-Path $evidenceDir ("ui-smoke-frontend-$stamp.err.log")
$pwOut  = Join-Path $evidenceDir ("ui-smoke-playwright-$stamp.out.log")
$pwErr  = Join-Path $evidenceDir ("ui-smoke-playwright-$stamp.err.log")

try {
  Write-LogLine "cleanup: kill node trees"
  Kill-NodeTrees

  Write-LogLine "start: MCP server (innomcp-server-node)"
  Write-LogLine "mcp logs: out=$mcpOut err=$mcpErr"
  $mcpProc = Start-Process -FilePath 'cmd' -ArgumentList @('/d','/c','npm run dev') -WorkingDirectory (Join-Path $repoRoot 'innomcp-server-node') -WindowStyle Hidden -RedirectStandardOutput $mcpOut -RedirectStandardError $mcpErr -PassThru
  Start-Sleep -Seconds 2
  if ($mcpProc.HasExited) {
    $blockedReason = 'MCP_EXITED_EARLY'
    Write-LogLine "mcp exited early: exitCode=$($mcpProc.ExitCode)"
    Write-LogLine ("mcp stderr tail:`n" + (Tail-TextFile -Path $mcpErr -Lines 40))
    throw "BLOCKED:$blockedReason"
  }

  $mcpHealth = Resolve-McpHealthUrl
  Write-LogLine "wait: MCP health $mcpHealth"
  if (-not (Wait-HttpOk -Url $mcpHealth -WaitSeconds 120)) {
    $blockedReason = 'MCP_NOT_READY'
    throw "BLOCKED:$blockedReason"
  }

  Write-LogLine "start: Backend (innomcp-node)"
  Write-LogLine "backend logs: out=$beOut err=$beErr"
  $backendProc = Start-Process -FilePath 'cmd' -ArgumentList @('/d','/c','npm run dev') -WorkingDirectory (Join-Path $repoRoot 'innomcp-node') -WindowStyle Hidden -RedirectStandardOutput $beOut -RedirectStandardError $beErr -PassThru
  Start-Sleep -Seconds 2
  if ($backendProc.HasExited) {
    $blockedReason = 'BACKEND_EXITED_EARLY'
    Write-LogLine "backend exited early: exitCode=$($backendProc.ExitCode)"
    Write-LogLine ("backend stderr tail:`n" + (Tail-TextFile -Path $beErr -Lines 40))
    throw "BLOCKED:$blockedReason"
  }

  Write-LogLine "wait: Backend health http://127.0.0.1:3011/health"
  if (-not (Wait-HttpOk -Url 'http://localhost:3011/health' -WaitSeconds 120)) {
    $blockedReason = 'BACKEND_NOT_READY'
    throw "BLOCKED:$blockedReason"
  }

  Write-LogLine "start: Frontend (innomcp-next)"
  Write-LogLine "frontend logs: out=$feOut err=$feErr"
  $frontendProc = Start-Process -FilePath 'cmd' -ArgumentList @('/d','/c','npm run dev') -WorkingDirectory (Join-Path $repoRoot 'innomcp-next') -WindowStyle Hidden -RedirectStandardOutput $feOut -RedirectStandardError $feErr -PassThru
  Start-Sleep -Seconds 2
  if ($frontendProc.HasExited) {
    $blockedReason = 'FRONTEND_EXITED_EARLY'
    Write-LogLine "frontend exited early: exitCode=$($frontendProc.ExitCode)"
    Write-LogLine ("frontend stderr tail:`n" + (Tail-TextFile -Path $feErr -Lines 40))
    throw "BLOCKED:$blockedReason"
  }

  Write-LogLine "wait: Frontend http://127.0.0.1:3000"
  if (-not (Wait-HttpOk -Url 'http://localhost:3000' -WaitSeconds 120)) {
    $blockedReason = 'FRONTEND_NOT_READY'
    throw "BLOCKED:$blockedReason"
  }

  $pwCmd = Join-Path $repoRoot 'node_modules\\.bin\\playwright.cmd'
  $spec = 'tests/e2e/tests/evidence-dashboard.spec.ts'
  $cfg = 'playwright.config.ts'
  Write-LogLine "run: Playwright cmd=$pwCmd cfg=$cfg spec=$spec"
  Write-LogLine "playwright logs: out=$pwOut err=$pwErr"

  $pwCmdLine = "`"$pwCmd`" test $spec --config $cfg --reporter=line"
  $pwProc = Start-Process -FilePath 'cmd' -ArgumentList @('/d','/c',$pwCmdLine) -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $pwOut -RedirectStandardError $pwErr -PassThru

  $waitOk = $pwProc.WaitForExit($TimeoutSeconds * 1000)
  if (-not $waitOk) {
    $blockedReason = 'PLAYWRIGHT_TIMEOUT'
    throw "BLOCKED:$blockedReason"
  }

  if (($pwProc.ExitCode -as [int]) -ne 0) {
    $blockedReason = "PLAYWRIGHT_FAILED(exit=$($pwProc.ExitCode))"
    throw "BLOCKED:$blockedReason"
  }

  $pass = $true
} catch {
  $msg = $_.Exception.Message
  if ($msg -like 'BLOCKED:*') {
    $blockedReason = $msg.Substring(8)
  } elseif (-not $blockedReason) {
    $blockedReason = 'UNKNOWN_ERROR'
  }
  Write-LogLine "error: $msg"
} finally {
  Write-LogLine "cleanup: stop Playwright"
  if ($pwProc -and -not $pwProc.HasExited) {
    try { Stop-Process -Id $pwProc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }

  Write-LogLine "cleanup: kill node trees"
  Kill-NodeTrees

  Write-LogLine "cleanup: stop service procs"
  foreach ($p in @($frontendProc,$backendProc,$mcpProc)) {
    if ($p -and -not $p.HasExited) {
      try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

if ($pass) {
  Write-LogLine "RESULT: PASS"
  Write-Output "PASS"
  Write-Output ("evidence:{0}" -f $script:EvidenceLog)
  exit 0
}

Write-LogLine ("RESULT: BLOCKED:{0}" -f $blockedReason)
Write-Output ("BLOCKED:{0}" -f $blockedReason)
Write-Output ("evidence:{0}" -f $script:EvidenceLog)
exit 2
