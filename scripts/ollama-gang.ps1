#!/usr/bin/env pwsh
# OllamaGang — MDES + Local Ollama Load Balancer
# Usage: . .\scripts\ollama-gang.ps1 ; Invoke-OllamaGang -Prompt "..." -Task "code"
# Models auto-selected by task type. MDES first, local fallback.

$MDES_BASE = "https://ollama.mdes-innova.online"
$LOCAL_BASE = "http://localhost:11434"

# Model routing by task
$MODEL_MAP = @{
    "code"    = "qwen2.5-coder:7b"
    "analyze" = "deepseek-r1:8b"
    "fast"    = "qwen2.5-coder:7b"
    "deep"    = "deepseek-r1:8b"
    "vision"  = "qwen3-vl:4b"
    "general" = "qwen2.5-coder:7b"
}

function Test-OllamaEndpoint {
    param([string]$Base, [string]$Model)
    try {
        $body = @{model=$Model; prompt="ping"; stream=$false} | ConvertTo-Json
        $r = Invoke-RestMethod "$Base/api/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 6 -EA Stop
        return $r.response -ne $null
    } catch { return $false }
}

function Invoke-OllamaGang {
    param(
        [string]$Prompt,
        [string]$Task = "code",
        [string]$System = "",
        [int]$MaxTokens = 1024,
        [string]$Agent = "gang-worker"
    )

    $model = $MODEL_MAP[$Task]
    if (-not $model) { $model = "qwen2.5-coder:7b" }

    $body = @{
        model   = $model
        prompt  = $Prompt
        stream  = $false
        options = @{ num_predict = $MaxTokens }
    }
    if ($System) { $body.system = $System }
    $json = $body | ConvertTo-Json -Depth 5

    # Try MDES first
    $mdesHeaders = @{}
    $mdesKey = $env:MDES_API_KEY
    if ($mdesKey) { $mdesHeaders["Authorization"] = "Bearer $mdesKey" }

    try {
        $r = Invoke-RestMethod "$MDES_BASE/api/generate" -Method POST -Body $json `
            -ContentType "application/json" -Headers $mdesHeaders -TimeoutSec 30 -EA Stop
        Write-Host "[$Agent] MDES→$model ✓" -ForegroundColor Cyan
        return $r.response
    } catch {
        Write-Host "[$Agent] MDES fail, fallback local→$model" -ForegroundColor Yellow
    }

    # Fallback to local
    try {
        $r = Invoke-RestMethod "$LOCAL_BASE/api/generate" -Method POST -Body $json `
            -ContentType "application/json" -TimeoutSec 60 -EA Stop
        Write-Host "[$Agent] LOCAL→$model ✓" -ForegroundColor Green
        return $r.response
    } catch {
        Write-Host "[$Agent] BOTH DOWN ✗" -ForegroundColor Red
        return $null
    }
}

function Invoke-OllamaGangParallel {
    param([array]$Jobs)
    # Jobs: @{Prompt=...; Task=...; Agent=...; System=...}
    $results = @{}
    $jobs | ForEach-Object -Parallel {
        $j = $_
        $result = Invoke-OllamaGang -Prompt $j.Prompt -Task $j.Task -Agent $j.Agent `
            -System ($j.System ?? "") -MaxTokens ($j.MaxTokens ?? 1024)
        $results[$j.Agent] = $result
    } -ThrottleLimit 5
    return $results
}

Write-Host "OllamaGang loaded. Models: $($MODEL_MAP.Keys -join ', ')" -ForegroundColor Magenta
Write-Host "MDES: $MDES_BASE | Local: $LOCAL_BASE" -ForegroundColor Gray
