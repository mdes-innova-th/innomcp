param(
  [switch]$PrintOnly
)

$queries = @(
  @{ Id = "A"; Query = "อากาศเชียงใหม่ตอนนี้"; Verify = "Should resolve province=เชียงใหม่ and return station + forecast (may include NWP fallback)" },
  @{ Id = "B"; Query = "พยากรณ์อากาศกรุงเทพ 7 วัน"; Verify = "Should resolve province=กรุงเทพมหานคร and return 7-day forecast" },
  @{ Id = "C"; Query = "อากาศวันนี้ที่ขอนแก่น"; Verify = "Should return today summary; chain typically Forecast>Station>NWP" },
  @{ Id = "D"; Query = "ตารางอากาศภูเก็ต"; Verify = "Should pick table mode and return structured table-like output" },
  @{ Id = "E"; Query = "อากาศประเทศไทยวันนี้"; Verify = "National summary path; should not dump payloads; short output" },
  @{ Id = "F"; Query = "สภาพอากาศ"; Verify = "PROVINCE_MISSING guard: ask user for province; must NOT call MCP tools" },
  @{ Id = "G"; Query = "ฝนตกไหมที่นครราชสีมา"; Verify = "Should resolve province=นครราชสีมา and answer rain-related using available sources" }
)

Write-Host "=== INNOMCP Phase 6.5.1 Weather Smoke Test ==="
Write-Host "Run services:" 
Write-Host "  1) From repo root: npm run dev" 
Write-Host "  2) Or individually: innomcp-next (3000), innomcp-node (3011), innomcp-server-node (3013)"
Write-Host ""
Write-Host "Optional quick checks:" 
Write-Host "  - npm test" 
Write-Host "  - npm --prefix innomcp-node run build" 
Write-Host ""

Write-Host "Manual UI steps:" 
Write-Host "  - Open http://localhost:3000" 
Write-Host "  - Use the chat input; send queries A–G below" 
Write-Host ""

Write-Host "What to verify in logs (acceptance points):"
Write-Host "  1) [LocationResolver] resolvedProvinces=[...] method=..."
Write-Host "  2) [WeatherPipeline] mode=... chain=... provinces=... budgetMs=..."
Write-Host "  3) [ForecastEngine] provinceCount=77"
Write-Host "  4) [StationEngine] stationCount=... filteredCount=... province=..."
Write-Host "  - Logs must be short: NO payload dumps / giant JSON"
Write-Host ""

Write-Host "Queries:" 
foreach ($q in $queries) {
  Write-Host ("{0}) {1}" -f $q.Id, $q.Query)
  Write-Host ("    Verify: {0}" -f $q.Verify)
}

if (-not $PrintOnly) {
  Write-Host ""
  Write-Host "Tip: If you see TIMEOUT, retry once and note budgetUsedMs." 
}
