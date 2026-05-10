<#
.SYNOPSIS
    Delegate a task to MDES Ollama sub-agent and log the result
    
.DESCRIPTION
    Called by Codex (parent agent) to dispatch work to MDES Ollama gang.
    Logs all calls to docs/reports/SKILL-USAGE-LOG.md automatically.
    
.PARAMETER Task
    Description of the task (one sentence)

.PARAMETER Model
    MDES model to use (default: qwen3.5:9b for quick, qwen2.5-coder:32b for code)

.PARAMETER Prompt
    Full prompt for the sub-agent

.PARAMETER Log
    Append to skill usage log (default: true)

.EXAMPLE
    .\scripts\delegate-to-mdes.ps1 -Task "Write unit test for auth.js" -Model "qwen2.5-coder:32b" -Prompt "Write Jest test for..."

.NOTES
    API key is read from .vscode/mcp.json (OLLAMA_API_KEY).
    Never store keys in this script or .env files.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Task,
    
    [ValidateSet("qwen3.5:9b", "qwen2.5-coder:32b", "qwen3.5:27b", "gemma4:e4b", "gemma3:12b")]
    [string]$Model = "qwen3.5:9b",
    
    [Parameter(Mandatory=$true)]
    [string]$Prompt,
    
    [bool]$Log = $true
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LogFile     = Join-Path $ProjectRoot "docs\reports\SKILL-USAGE-LOG.md"
$McpConfig   = Join-Path $ProjectRoot ".vscode\mcp.json"

# --- Read API key from mcp.json (not hardcoded) ---
$config      = Get-Content $McpConfig | ConvertFrom-Json
$apiKey      = $config.servers.innovaBot.env.OLLAMA_API_KEY
$baseUrl     = $config.servers.innovaBot.env.OLLAMA_URL

if (-not $apiKey -or $apiKey -eq "") {
    Write-Error "OLLAMA_API_KEY not set in .vscode/mcp.json"
    exit 1
}

# --- Call MDES Ollama ---
$endpoint = "$baseUrl/v1/chat/completions"
$body = @{
    model    = $Model
    messages = @(@{ role = "user"; content = $Prompt })
    stream   = $false
} | ConvertTo-Json -Depth 5

Write-Host "[MDES] Delegating to $Model..." -ForegroundColor Cyan

$startTime = Get-Date
$response = Invoke-RestMethod -Method POST -Uri $endpoint `
    -Headers @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/json" } `
    -Body $body
$elapsed = [int]((Get-Date) - $startTime).TotalSeconds

$result = $response.choices[0].message.content
$tokens = $response.usage.total_tokens

Write-Host "[MDES] Done in ${elapsed}s ($tokens tokens)" -ForegroundColor Green
Write-Host "--- Output ---" -ForegroundColor Yellow
Write-Output $result

# --- Log to SKILL-USAGE-LOG.md ---
if ($Log -and (Test-Path $LogFile)) {
    $ts      = (Get-Date -Format "yyyy-MM-dd HH:mm")
    $outcome = if ($result.Length -gt 50) { "OK" } else { "SHORT" }
    $logLine = "| $ts | mdes-delegate | $Model | $Task | ~$tokens tok | $outcome | elapsed ${elapsed}s |"
    
    # Insert after the header row in the log table
    $content = Get-Content $LogFile
    $idx     = ($content | Select-String "^| — |" | Select-Object -First 1).LineNumber - 1
    if ($idx -ge 0) {
        $content[$idx] = $logLine + [System.Environment]::NewLine + $content[$idx]
        [System.IO.File]::WriteAllLines($LogFile, $content)
        Write-Host "[LOG] Appended to $LogFile" -ForegroundColor DarkGray
    }
}

# Return result as string for piping
return $result
