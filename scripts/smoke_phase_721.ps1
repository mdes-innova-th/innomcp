param(
  [string]$EvidenceOut = ''
)

$ErrorActionPreference = 'Stop'

$port = 3015
if ($env:SMOKE_PORT) {
  try {
    $port = [int]$env:SMOKE_PORT
  } catch {
    $port = 3015
  }
}
$httpUri = "http://localhost:$port/api/chat"
$wsUri = [Uri]"ws://localhost:$port/chat"

$authUri = "http://localhost:$port/api/auth/login"
$webSession = $null
$authOk = $false

try {
  $loginBody = @{ email = 'user@innomcp.local'; password = 'User@123' } | ConvertTo-Json -Compress
  $null = Invoke-WebRequest -UseBasicParsing -Uri $authUri -Method Post -Headers @{ 'content-type' = 'application/json'; 'x-smoke-run' = '1' } -Body $loginBody -SessionVariable webSession -TimeoutSec 15
  Write-Host "AUTH OK"
  $authOk = $true
} catch {
  Write-Host "AUTH FAIL (will likely hit guest limits): $($_.Exception.Message)"
}

$cases = @(
  @{ n = 1; marker = 'SMOKE721_P1'; uiMode = 'officer'; msg = 'SMOKE721_P1 officer: how many machines online?'; expect = 'officerEvidence' },
  @{ n = 2; marker = 'SMOKE721_P2'; uiMode = 'officer'; msg = 'SMOKE721_P2 officer: detected urls today?'; expect = 'officerEvidence' },
  @{ n = 3; marker = 'SMOKE721_P3'; uiMode = 'officer'; msg = 'SMOKE721_P3 officer: evidence records today?'; expect = 'officerEvidence' },
  @{ n = 4; marker = 'SMOKE721_P4'; uiMode = 'officer'; msg = 'SMOKE721_P4 officer: nwp hourly Bangkok'; expect = 'NOT weatherGate' },
  @{ n = 5; marker = 'SMOKE721_P5'; uiMode = 'officer'; msg = 'SMOKE721_P5 officer: temperature in Bangkok today?'; expect = 'weatherGate' },
  @{ n = 6; marker = 'SMOKE721_P6'; uiMode = '';        msg = 'SMOKE721_P6: temperature in Bangkok today?'; expect = 'weatherGate' }
)

function Run-HttpCase {
  param([hashtable]$c)

  $cid = "SMOKE721_HTTP_P$($c.n)"
  $body = @{ message = $c.msg; uiMode = $c.uiMode } | ConvertTo-Json -Compress

  try {
    $null = Invoke-RestMethod -Uri $httpUri -Method Post -Headers @{ 'x-correlation-id' = $cid; 'content-type' = 'application/json'; 'x-smoke-run' = '1' } -Body $body -WebSession $webSession -TimeoutSec 120
    return @{ ok = $true; cid = $cid }
  } catch {
    return @{ ok = $false; cid = $cid; err = $_.Exception.Message }
  }
}

function Run-WsCase {
  param([hashtable]$c)

  $cid = "SMOKE721_WS_P$($c.n)"

  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.Options.SetRequestHeader('x-correlation-id', $cid)

  $cts = [System.Threading.CancellationTokenSource]::new()
  $cts.CancelAfter([TimeSpan]::FromSeconds(180))

  try {
    $ws.ConnectAsync($wsUri, $cts.Token).Wait()

    $payload = @{ text = $c.msg; uiMode = $c.uiMode } | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync([ArraySegment[byte]]$bytes, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()

    $buffer = New-Object byte[] 8192
    $acc = ''
    $done = $false

    while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open -and -not $done) {
      $seg = [ArraySegment[byte]]$buffer
      $res = $ws.ReceiveAsync($seg, $cts.Token).Result
      if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }

      $acc += [Text.Encoding]::UTF8.GetString($buffer, 0, $res.Count)

      if ($res.EndOfMessage) {
        $text = $acc
        $acc = ''
        if ($text -match '"type"\s*:\s*"done"') {
          $done = $true
          break
        }
      }
    }

    try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $cts.Token).Wait() } catch {}

    return @{ ok = $done; cid = $cid }
  } catch {
    try { $ws.Abort() } catch {}
    return @{ ok = $false; cid = $cid; err = $_.Exception.Message }
  } finally {
    try { $ws.Dispose() } catch {}
    try { $cts.Dispose() } catch {}
  }
}

$out = @()
$out += ('RUN_TS=' + (Get-Date).ToString('s'))
$out += ('HTTP_URI=' + $httpUri)
$out += ('WS_URI=' + $wsUri)

$out += '--- HTTP ---'
$httpResults = @()
foreach ($c in $cases) {
  $r = Run-HttpCase $c
  $httpResults += $r
  $exitCode = if ($r.ok) { 0 } else { 1 }
  $suffix = if ($r.ok) { '' } else { " err=$($r.err)" }
  $out += "HTTP#$($c.n) marker=$($c.marker) cid=$($r.cid) exitCode=$exitCode expect=$($c.expect)$suffix"
}

$out += '--- WS ---'
$wsResults = @()
foreach ($c in $cases) {
  $r = Run-WsCase $c
  $wsResults += $r
  $exitCode = if ($r.ok) { 0 } else { 1 }
  $suffix = if ($r.ok) { '' } else { " err=$($r.err)" }
  $out += "WS#$($c.n) marker=$($c.marker) cid=$($r.cid) exitCode=$exitCode expect=$($c.expect)$suffix"
}

$httpPass = @($httpResults | Where-Object { $_.ok }).Count
$httpFail = @($httpResults | Where-Object { -not $_.ok }).Count
$wsPass = @($wsResults | Where-Object { $_.ok }).Count
$wsFail = @($wsResults | Where-Object { -not $_.ok }).Count

$summary = @()
$summary += ('RUN_TS=' + (Get-Date).ToString('s'))
$summary += ('PORT=' + $port)
$summary += ('AUTH=' + $(if ($authOk) { 'OK' } else { 'FAIL' }))
$summary += ('HTTP_PASS=' + $httpPass)
$summary += ('HTTP_FAIL=' + $httpFail)
$summary += ('WS_PASS=' + $wsPass)
$summary += ('WS_FAIL=' + $wsFail)

Set-Content -Path smoke_run_results.txt -Value ($out -join "`n") -Encoding UTF8
Write-Host "WROTE smoke_run_results.txt"
Get-Item smoke_run_results.txt | Select-Object FullName, Length, LastWriteTime

if ($EvidenceOut -and $EvidenceOut.Trim().Length -gt 0) {
  $dir = Split-Path -Parent $EvidenceOut
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Set-Content -Path $EvidenceOut -Value ($summary -join "`n") -Encoding UTF8
  Write-Host "WROTE EVIDENCE $EvidenceOut"
}
