<#
.SYNOPSIS
    Delegate a task to the MDES Ollama sub-agent and log the result.

.DESCRIPTION
    Called by Codex as parent agent to dispatch work to the MDES Ollama gang.
    The API key is read from .vscode/mcp.json and is never printed.

.PARAMETER Task
    Short description of the task.

.PARAMETER Model
    MDES model to use.

.PARAMETER Prompt
    Full prompt for the sub-agent.

.PARAMETER Log
    Append to docs/reports/SKILL-USAGE-LOG.md when present.

.PARAMETER TimeoutSec
    HTTP timeout for the Ollama-compatible API request.

.EXAMPLE
    .\scripts\delegate-to-mdes.ps1 -Task "Review Thai routing" -Model "qwen3.5:9b" -Prompt "Inspect the current state..."
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Task,

    [ValidateSet("qwen3.5:9b", "qwen2.5-coder:32b", "qwen3.5:27b", "gemma4:e4b", "gemma3:12b")]
    [string]$Model = "qwen3.5:9b",

    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [bool]$Log = $true,

    [int]$TimeoutSec = 180
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LogFile     = Join-Path $ProjectRoot "docs\reports\SKILL-USAGE-LOG.md"
$McpConfig   = Join-Path $ProjectRoot ".vscode\mcp.json"

function Format-MdesLogCell {
    param([AllowNull()][string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    return (($Value -replace "\r?\n", " ") -replace "\|", "/").Trim()
}

function Add-MdesSkillUsageLog {
    param(
        [string]$ModelName,
        [string]$TaskName,
        [string]$Outcome,
        [string]$Notes
    )

    if (-not $Log -or -not (Test-Path $LogFile)) {
        return
    }

    $date = Get-Date -Format "yyyy-MM-dd"
    $time = "$(Get-Date -Format "HH:mm") ICT"
    $row = "| $(Format-MdesLogCell $date) | $(Format-MdesLogCell $time) | delegate-to-mdes.ps1 | $(Format-MdesLogCell $ModelName) | $(Format-MdesLogCell $TaskName) | $(Format-MdesLogCell $Outcome) | $(Format-MdesLogCell $Notes) |"

    $lines = [System.Collections.Generic.List[string]]::new()
    Get-Content $LogFile | ForEach-Object { [void]$lines.Add($_) }

    $insertAt = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq "## Log Entries") {
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if ($lines[$j] -match "^\|[-| ]+\|$") {
                    $insertAt = $j + 1
                    break
                }
            }
            break
        }
    }

    if ($insertAt -lt 0) {
        [void]$lines.Add($row)
    } else {
        $lines.Insert($insertAt, $row)
    }

    [System.IO.File]::WriteAllLines($LogFile, $lines)
    Write-Host "[LOG] Appended to $LogFile" -ForegroundColor DarkGray
}

if (-not (Test-Path $McpConfig)) {
    Write-Error "MCP config not found: $McpConfig"
    exit 1
}

$config  = Get-Content $McpConfig -Raw | ConvertFrom-Json
$apiKey  = $config.servers.innovaBot.env.OLLAMA_API_KEY
$baseUrl = $config.servers.innovaBot.env.OLLAMA_URL

if (-not $apiKey) {
    Write-Error "OLLAMA_API_KEY not set in .vscode/mcp.json"
    exit 1
}

if (-not $baseUrl) {
    Write-Error "OLLAMA_URL not set in .vscode/mcp.json"
    exit 1
}

$endpoint = "$($baseUrl.TrimEnd('/'))/v1/chat/completions"
$body = @{
    model    = $Model
    messages = @(@{ role = "user"; content = $Prompt })
    stream   = $false
} | ConvertTo-Json -Depth 6

Write-Host "[MDES] Delegating to $Model..." -ForegroundColor Cyan

$startTime = Get-Date
try {
    $response = Invoke-RestMethod -Method POST -Uri $endpoint `
        -Headers @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/json" } `
        -Body $body `
        -TimeoutSec $TimeoutSec

    $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
    $result = [string]$response.choices[0].message.content
    $tokens = if ($response.usage.total_tokens) { $response.usage.total_tokens } else { "unknown" }

    Write-Host "[MDES] Done in ${elapsed}s ($tokens tokens)" -ForegroundColor Green
    Write-Host "--- Output ---" -ForegroundColor Yellow
    Write-Output $result

    $outcome = if ($result.Length -gt 50) { "PASS" } else { "SHORT" }
    Add-MdesSkillUsageLog -ModelName $Model -TaskName $Task -Outcome $outcome -Notes "elapsed ${elapsed}s; tokens $tokens"

    return $result
} catch {
    $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }

    $message = $_.Exception.Message
    if ($statusCode) {
        $message = "HTTP $statusCode; $message"
    }

    Add-MdesSkillUsageLog -ModelName $Model -TaskName $Task -Outcome "FAIL" -Notes "elapsed ${elapsed}s; $message"
    Write-Error "[MDES] Delegation failed after ${elapsed}s: $message"
}
