# Reliability Battery Report

- Started: 2026-02-10T02:38:36.471Z
- Finished: 2026-02-10T02:38:36.713Z
- MCP URL: http://localhost:3012/mcp

## 1) Overview

- Total cases: 150
- PASS: 0
- FAIL: 90
- SKIP: 60

## 2) Failing tools + reasons

- calculatorTool: HTTP 406
- currencyExchangeTool: HTTP 406
- dateTimeTool: HTTP 406
- fileReaderTool: HTTP 406
- govdata: HTTP 406
- keywordTool: HTTP 406
- tmd_daily_forecast_4_times: HTTP 406
- translationTool: HTTP 406
- worldbank: HTTP 406

## 3) Skipped tools (missing key)

- nwp_daily_by_location: missing NWP_API_KEY
- nwp_daily_by_place: missing NWP_API_KEY
- nwp_daily_by_region: missing NWP_API_KEY
- nwp_hourly_by_location: missing NWP_API_KEY
- weather: missing OPENWEATHER_API_KEY

## 4) Top 5 slowest tools (avg latency)

- tmd_daily_forecast_4_times: 4ms avg (0 pass, 10 fail, 0 skip)
- keywordTool: 3ms avg (0 pass, 10 fail, 0 skip)
- calculatorTool: 2ms avg (0 pass, 10 fail, 0 skip)
- currencyExchangeTool: 2ms avg (0 pass, 10 fail, 0 skip)
- dateTimeTool: 2ms avg (0 pass, 10 fail, 0 skip)
