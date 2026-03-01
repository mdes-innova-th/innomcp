param(
  [string]$LogFile = 'logs\innomcp-mcp-20260219-113902.log',
  [string]$EvidenceOut = 'innomcp-node\evidence\evidence-phase721-extracted.log'
)

$ErrorActionPreference = 'Stop'

$rawLines = Get-Content -Path $LogFile -Encoding UTF8 -ErrorAction Stop

# Reconstruct wrapped [ChatTrace] lines into single logical entries
$entries = @()
for ($i = 0; $i -lt $rawLines.Count; $i++) {
  $line = $rawLines[$i]
  if ($line -notmatch '\[ChatTrace\]') { continue }

  $entry = $line
  $j = $i + 1
  while ($j -lt $rawLines.Count -and $rawLines[$j] -notmatch '^\[\d{4}-\d{2}-\d{2}T') {
    $entry += ' ' + $rawLines[$j].Trim()
    $j++
  }

  $entries += $entry
  $i = $j - 1
}

function Get-TracePairByCid {
  param(
    [string]$cid,
    [ValidateSet('http','ws')][string]$transport
  )

  $in = $entries | Select-String -Pattern ("\[ChatTrace\].*dir=in.*transport=$transport.*cid=" + [regex]::Escape($cid)) | Select-Object -Last 1
  if (-not $in) { return $null }

  $inLine = $in.Line
  $sid = ([regex]::Match($inLine, 'sid=([^ ]+)')).Groups[1].Value

  $out = $entries | Select-String -Pattern ("\[ChatTrace\].*dir=out.*transport=$transport.*sid=" + [regex]::Escape($sid) + ".*cid=" + [regex]::Escape($cid)) | Select-Object -First 1
  $outLine = if ($out) { $out.Line } else { $null }

  return @{ inLine = $inLine; outLine = $outLine }
}

function Sanitize-EvidenceText {
  param(
    [string]$text,
    [int]$max = 220
  )

  if (-not $text) { return '' }

  $t = [string]$text
  $t = $t -replace '`', ''
  $t = $t -replace '```', ''
  $t = $t -replace "\s+", ' '

  # Redact email/IP (best-effort)
  $t = $t -replace '(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL_REDACTED]'
  $t = $t -replace '\b\d{1,3}(?:\.\d{1,3}){3}\b', '[IP_REDACTED]'

  # Redact common secrets (best-effort)
  $t = $t -replace '(?i)\b(authorization|bearer|token|api[_-]?key|apikey|password|pwd)\b\s*[:=]\s*[^\s,;]+' , '$1=[REDACTED]'
  $t = $t -replace '(?i)bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'bearer [REDACTED]'

  # Redact JSON-ish blobs
  $t = $t -replace '(\{[^\}]{0,800}\})', '[JSON_REDACTED]'
  $t = $t -replace '(\[\s*(\{|"|\d|\[)[^\]]{0,800}\])', '[JSON_REDACTED]'

  # If payload contains partial JSON fragments (e.g. "json {") strip braces entirely.
  $t = $t -replace '[\{\}]', ''

  $t = $t.Trim()
  # Remove quotes inside q/a to keep single-line evidence stable.
  $t = $t -replace "'", ''
  $t = $t -replace '"', ''

  if ($t.Length -gt $max) { $t = $t.Substring(0, $max) }
  return $t
}

function Get-Field {
  param([string]$line, [string]$name)
  return ([regex]::Match($line, ($name + '=("[^"]*"|[^ ]+)'))).Groups[1].Value
}

function Unquote {
  param([string]$v)
  if (-not $v) { return '' }
  if ($v.StartsWith('"') -and $v.EndsWith('"')) { return $v.Substring(1, $v.Length - 2) }
  return $v
}

function Get-AnsRemainder {
  param([string]$line)
  if (-not $line) { return '' }
  $m = [regex]::Match($line, '(?i)\bans=(.+)$')
  if (-not $m.Success) { return '' }
  $v = $m.Groups[1].Value.Trim()
  if ($v.StartsWith('"')) { $v = $v.Substring(1) }
  if ($v.EndsWith('"')) { $v = $v.Substring(0, $v.Length - 1) }
  return $v
}

function Pick-Tool {
  param([string]$tool)
  if (-not $tool) { return '-' }
  $t = $tool.Trim()
  if ($t -eq 'none' -or $t -eq '-') { return '-' }
  if ($t.StartsWith('[') -and $t.EndsWith(']')) {
    $inner = $t.Substring(1, $t.Length - 2)
    $first = ($inner -split ',')[0].Trim()
    if (-not $first) { return '-' }
    if ($first -eq 'weatherPipeline') { return 'innomcp-node:weatherPipeline' }
    return $first
  }
  if ($t -eq 'weatherPipeline') { return 'innomcp-node:weatherPipeline' }
  return $t
}

function Map-Code {
  param([string]$code)
  $n = 0
  [void][int]::TryParse(($code -replace '"',''), [ref]$n)
  if ($n -ge 200 -and $n -lt 400) { return 'ok' }
  if ($n -gt 0) { return 'err' }
  return 'err'
}

function Summarize-Answer {
  param(
    [string]$rawAns,
    [string]$rawCode
  )

  if (-not $rawAns) { return '' }
  $ans = [string]$rawAns

  $isStructuredFail = $false
  if ($ans -match '(?i)"ok"\s*:\s*false' -or $ans -match '(?i)\bok\s*[:=]\s*false\b') {
    $isStructuredFail = $true
  }

  if (-not $isStructuredFail) { return $ans }

  $errCode = ''
  $errMsg = ''

  $mCode = [regex]::Match($ans, '(?i)"code"\s*:\s*"?([A-Za-z0-9_\-]+)"?')
  if ($mCode.Success) { $errCode = $mCode.Groups[1].Value }

  $mMsg = [regex]::Match($ans, '(?i)"(error|message)[^"]*"\s*:\s*"([^\r\n]{1,220})')
  if ($mMsg.Success) {
    $errMsg = $mMsg.Groups[2].Value
  } else {
    $errMsg = 'structured_error'
  }

  if (-not $errCode) {
    $httpCode = 0
    [void][int]::TryParse(($rawCode -replace '"',''), [ref]$httpCode)
    $errCode = if ($httpCode -gt 0) { "HTTP_$httpCode" } else { 'FAIL' }
  }

  return "ERR:$errCode $errMsg"
}

function Format-EvidenceLine {
  param(
    [string]$cid,
    [string]$t,
    [string]$mode,
    [string]$route,
    [string]$tool,
    [string]$code,
    [string]$ms,
    [string]$q,
    [string]$a
  )

  $tNorm = if ($t) { $t } else { 'http' }
  $modeNorm = if ($mode) { $mode } else { 'auto' }
  $routeNorm = if ($route) { $route } else { '-' }
  $toolNorm = Pick-Tool $tool
  $codeNorm = Map-Code $code
  $msNorm = 0
  [void][int]::TryParse(($ms -replace '"',''), [ref]$msNorm)

  $qSan = Sanitize-EvidenceText $q
  $aSan = Sanitize-EvidenceText $a

  return "[ChatTrace] t=$tNorm cid=$cid mode=$modeNorm route=$routeNorm tool=$toolNorm code=$codeNorm ms=$msNorm q='$qSan' a='$aSan'"
}

$lines = @()
foreach ($n in 1..6) {
  $cid = "SMOKE721_HTTP_P$n"
  $pair = Get-TracePairByCid $cid 'http'
  if (-not $pair) {
    $lines += (Format-EvidenceLine $cid 'http' 'auto' '-' '-' '0' '0' 'MISSING' 'MISSING')
    continue
  }

  $inLine = $pair.inLine
  $outLine = $pair.outLine

  $ui = Unquote (Get-Field $inLine 'uiMode')
  $msg = Unquote (Get-Field $inLine 'msg')

  if (-not $outLine) {
    $lines += (Format-EvidenceLine $cid 'http' $ui '-' '-' '0' '0' $msg 'MISSING')
    continue
  }

  $route = Unquote (Get-Field $outLine 'route')
  $tool = Unquote (Get-Field $outLine 'tool')
  $code = Unquote (Get-Field $outLine 'code')
  $ms = Unquote (Get-Field $outLine 'durMs')
  $rawAns = Get-AnsRemainder $outLine
  $ans = Summarize-Answer $rawAns $code

  $lines += (Format-EvidenceLine $cid 'http' $ui $route $tool $code $ms $msg $ans)
}

foreach ($n in 1..6) {
  $cid = "SMOKE721_WS_P$n"
  $pair = Get-TracePairByCid $cid 'ws'
  if (-not $pair) {
    $lines += (Format-EvidenceLine $cid 'ws' 'auto' '-' '-' '0' '0' 'MISSING' 'MISSING')
    continue
  }

  $inLine = $pair.inLine
  $outLine = $pair.outLine

  $ui = Unquote (Get-Field $inLine 'uiMode')
  $msg = Unquote (Get-Field $inLine 'msg')

  if (-not $outLine) {
    $lines += (Format-EvidenceLine $cid 'ws' $ui '-' '-' '0' '0' $msg 'MISSING')
    continue
  }

  $route = Unquote (Get-Field $outLine 'route')
  $tool = Unquote (Get-Field $outLine 'tool')
  $code = Unquote (Get-Field $outLine 'code')
  $ms = Unquote (Get-Field $outLine 'durMs')
  $rawAns = Get-AnsRemainder $outLine
  $ans = Summarize-Answer $rawAns $code

  $lines += (Format-EvidenceLine $cid 'ws' $ui $route $tool $code $ms $msg $ans)
}

$outDir = Split-Path -Parent $EvidenceOut
if ($outDir -and -not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

Set-Content -Path $EvidenceOut -Value ($lines -join "`n") -Encoding UTF8
