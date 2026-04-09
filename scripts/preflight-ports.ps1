<#
.SYNOPSIS
    Preflight port check for innomcp services.
    Verifies ports 3011, 3012, 3013, 3014 are free before starting servers.
.DESCRIPTION
    Run before starting dev servers to avoid EADDRINUSE failures.
    Usage: .\scripts\preflight-ports.ps1
#>

$requiredPorts = @(
    @{ Port = 3011; Service = "innomcp-node (chat/api)" },
    @{ Port = 3012; Service = "innomcp-server-node (MCP)" },
    @{ Port = 3013; Service = "detect-evidence-api" },
    @{ Port = 3014; Service = "webd-api" }
)

$allClear = $true

foreach ($entry in $requiredPorts) {
    $port = $entry.Port
    $service = $entry.Service
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid = $conn.OwningProcess | Select-Object -First 1
        $procName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
        Write-Host "  BUSY  :$port  ($service)  PID=$pid ($procName)" -ForegroundColor Red
        $allClear = $false
    } else {
        Write-Host "  FREE  :$port  ($service)" -ForegroundColor Green
    }
}

Write-Host ""
if ($allClear) {
    Write-Host "All ports are free. Ready to start services." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some ports are in use. Kill the processes or change ports before starting." -ForegroundColor Yellow
    exit 1
}
