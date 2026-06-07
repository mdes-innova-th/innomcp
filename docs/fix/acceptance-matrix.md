# INNOMCP Acceptance Matrix
*Generated: 2026-03-19 | Commit: post-06e2144*

## System Architecture
- **innomcp-next** (port 3000): Next.js frontend, WebSocket client
- **innomcp-node** (port 3011): Express backend, MCP orchestrator
- **innomcp-server-node** (port 3012): MCP tool server, 53 tools

## Route Decision Tree
```
User Message
  → fastPathChatMiddleware() [WS + HTTP]
    → GREETING/SIMPLE → FastPath (no LLM, <1s)
    → MATH_OR_CALC → bypass FastPath, go to MCP (deterministic arg extraction)
  → EvidenceGate [WS + HTTP] (if evidenceAction detected)
  → WeatherGate [WS + HTTP] (if weatherLike)
  → GeoGate [WS + HTTP] (if geoLike)
  → GodTierRouter [WS + HTTP] (semantic routing)
    → low confidence (<0.6) → clear category, proceed to MCP
  → GeneralGate [WS + HTTP] (if looksLikeGeneralNoToolsQuery)
    → NOT if weather/geo/evidence/math/datetime detected
  → processMessage() → Tool Selection → Tool Execution → Ollama Synthesis
```

---

## Capability Acceptance Matrix

| # | Capability | Route | Tool(s) | Model | Output Shape | Pass Criteria |
|---|-----------|-------|---------|-------|--------------|---------------|
| **CALCULATOR** |
| C1 | Pure math expression | MCP fast-path | calculatorTool | no-llm | {expression, result, computeTime} | result==correct, <500ms |
| C2 | Thai+math prefix | MCP fast-path | calculatorTool | no-llm | same | result==correct, <2s |
| C3 | Statistical (mean/std) | MCP | calculatorTool | no-llm | result + stats | correct values |
| C4 | Unit conversion | MCP | calculatorTool | no-llm | converted value | correct unit |
| C5 | Complex expression | MCP | calculatorTool | no-llm | result | mathematically correct |
| **DATETIME** |
| D1 | วันนี้กี่วัน/เดือน | MCP fast-path | dateTimeTool | no-llm | datetime, format | current date |
| D2 | ตอนนี้กี่โมง | MCP fast-path | dateTimeTool | no-llm | datetime, format | current time |
| D3 | วันที่ X คือวันอะไร | MCP | dateTimeTool | no-llm | day of week | correct answer |
| **WEATHER SUMMARY** |
| W1 | อากาศกรุงเทพวันนี้ | WeatherGate | weatherPipeline | no-llm | weatherPayload | province=BKK, rain%, temp range |
| W2 | ฝนตกไหมพรุ่งนี้ | WeatherGate | weatherPipeline | no-llm | date=tomorrow | rain% |
| W3 | อากาศภูเก็จ (typo) | WeatherGate | weatherPipeline | no-llm | province=ภูเก็ต | resolved alias |
| W4 | อากาศโคราช | WeatherGate | weatherPipeline | no-llm | province=นครราชสีมา | resolved alias |
| **WEATHER PROVINCE** |
| WP1 | พยากรณ์เชียงใหม่ | WeatherGate | weatherPipeline | no-llm | weatherPayload | province=เชียงใหม่ |
| WP2 | อากาศขอนแก่น | WeatherGate | weatherPipeline | no-llm | weatherPayload | province=ขอนแก่น |
| WP3 | สภาพอากาศอุบล | WeatherGate | weatherPipeline | no-llm | weatherPayload | province=อุบลราชธานี |
| WP4 | ฝนที่หาดใหญ่ | WeatherGate | weatherPipeline | no-llm | weatherPayload | province=สงขลา |
| **WEATHER REGION** |
| WR1 | อากาศภาคกลาง | WeatherGate | weatherPipeline | no-llm | region summary | multi-province |
| WR2 | อากาศภาคเหนือ | WeatherGate | weatherPipeline | no-llm | region summary | multi-province |
| WR3 | ฝนภาคอีสาน | WeatherGate | weatherPipeline | no-llm | region summary | northeast provinces |
| WR4 | อากาศภาคใต้ฝั่งอ่าวไทย | WeatherGate | weatherPipeline | no-llm | region summary | south gulf |
| **WEATHER NATIONWIDE** |
| WN1 | พยากรณ์ทั่วประเทศ | WeatherGate | weatherPipeline | no-llm | national summary | all regions |
| WN2 | ฝนตกที่ไหนบ้างวันนี้ | WeatherGate | weatherPipeline | no-llm | multi-province | rain% > 0 |
| WN3 | สภาพอากาศประเทศไทยวันนี้ | WeatherGate | weatherPipeline | no-llm | national | temp/rain |
| **WEATHER 7-DAY** |
| W7D1 | พยากรณ์ 7 วันข้างหน้ากรุงเทพ | WeatherGate | weatherPipeline | no-llm | 7-day array | 7 entries |
| W7D2 | สัปดาห์หน้าฝนตกไหม | WeatherGate | weatherPipeline | no-llm | next week | days with rain |
| W7D3 | อากาศ 7 วันเชียงใหม่ | WeatherGate | weatherPipeline | no-llm | 7-day | province correct |
| **WEATHER TABLE** |
| WT1 | ตารางอุณหภูมิ 7 วัน | WeatherGate | weatherPipeline | no-llm | table format | markdown table |
| WT2 | เปรียบเทียบอากาศ 5 จังหวัด | WeatherGate | weatherPipeline | no-llm | comparison table | 5 columns |
| **WEATHER WARNING/NEWS** |
| WW1 | คำเตือนอากาศร้ายวันนี้ | WeatherGate | weatherPipeline | no-llm | warnings | warning text |
| WW2 | พายุถล่มไหมวันนี้ | WeatherGate | weatherPipeline | no-llm | storm warning | storm info |
| **SEISMIC** |
| SQ1 | แผ่นดินไหวล่าสุด | WeatherGate | weatherPipeline | no-llm | seismic events | magnitude, location |
| SQ2 | แผ่นดินไหว 30 วัน | WeatherGate | weatherPipeline | no-llm | event list | count |
| **CLIMATE NORMAL** |
| CN1 | ค่าปกติภูมิอากาศกรุงเทพ | MCP | tmd climate tools | no-llm | climate normal data | avg temp/rain |
| CN2 | ปริมาณฝนเฉลี่ยรายปี | MCP | tmd climate tools | no-llm | annual rainfall | mm values |
| **MONTHLY RAINFALL** |
| MR1 | ฝนเฉลี่ยมกราคมที่กรุงเทพ | MCP | tmd tools | no-llm | monthly rain | mm |
| MR2 | เดือนไหนฝนมากที่สุด | MCP | tmd tools | local-llm | synthesis | month name |
| **STATION DATA** |
| ST1 | สถานีอากาศใกล้กรุงเทพ | MCP | weatherPipeline | no-llm | station list | station names |
| ST2 | ข้อมูลสถานีผิวพื้น | MCP | weatherPipeline/synop | no-llm | station data | values |
| **HYDRO** |
| HY1 | ระดับน้ำแม่น้ำเจ้าพระยา | WeatherGate | weatherPipeline | no-llm | water level | station data |
| HY2 | น้ำท่วมอีสานไหม | WeatherGate | weatherPipeline | no-llm | flood risk | region info |
| HY3 | แม่กลองน้ำขึ้นไหมสัปดาห์หน้า | WeatherGate | weatherPipeline | no-llm | hydro forecast | water level |
| **AGRO** |
| AG1 | ข้อมูลสถานีเกษตร | MCP | weatherPipeline/agro | no-llm | agro station | values |
| **SYNOP** |
| SY1 | ข้อมูล synop | MCP | weatherPipeline/synop | no-llm | synop data | values |
| **NWP** |
| NP1 | NWP รายชั่วโมงกรุงเทพ | MCP | nwp_hourly_by_place | no-llm | hourly forecast | temp, rain, wind |
| NP2 | NWP รายวันเชียงใหม่ | MCP | nwp_daily_by_place | no-llm | daily forecast | 5+ days |
| NP3 | NWP ภาคเหนือรายชั่วโมง | MCP | nwp_hourly_by_region | no-llm | regional hourly | values |
| **ANALYTICAL WEATHER** |
| AW1 | วิเคราะห์ความชื้นสัมพัทธ์ | WeatherGate (deep) | weatherPipeline | local-llm | synthesis | analysis text |
| AW2 | เปรียบเทียบสถานีผิวพื้นกับอุทก | WeatherGate (deep) | weatherPipeline | local-llm | comparison | analysis |
| AW3 | แนวโน้มอุณหภูมิมกราถึงมีนา | WeatherGate (deep) | weatherPipeline | local-llm | trend analysis | trend text |
| **NASA** |
| NA1 | NASA ภาพวันนี้ | MCP | nasa | remote/local-llm | APOD image | image URL, title |
| NA2 | ภาพอวกาศ nasa | MCP | nasa | remote/local-llm | APOD | description |
| NA3 | นาซ่าถ่ายภาพอะไรวันนี้ | MCP | nasa | remote/local-llm | APOD | image data |
| **WORLDBANK** |
| WB1 | GDP ประเทศไทย | MCP | worldbank | remote/local-llm | GDP data | numeric value |
| WB2 | เศรษฐกิจไทย 10 ปีที่ผ่านมา | MCP | worldbank | remote/local-llm | trend data | year-by-year |
| WB3 | อัตราการเกิด GDP growth ไทย | MCP | worldbank | remote/local-llm | indicator | % value |
| **QR CODE** |
| QR1 | สร้าง QR code ให้ | MCP | qrCodeTool | no-llm | image/url | QR data |
| **VISUALIZATION** |
| VZ1 | สร้างกราฟแท่งข้อมูลอุณหภูมิ 5 เมือง | MCP | echartsTool | remote/local-llm | chart config | chart JSON |
| **EVIDENCE/FILES** |
| EV1 | เครื่องออนไลน์กี่เครื่อง | EvidenceGate | evidenceTool | no-llm | active count | number |
| EV2 | บันทึกหลักฐานวันนี้ | EvidenceGate | evidenceTool | no-llm | records count | number |
| **THAI KNOWLEDGE** |
| TK1 | กรุงเทพอยู่ภาคไหน | MCP/GeoGate | thai_geo_tool | no-llm | geo info | ภาคกลาง |
| TK2 | เชียงใหม่มีอำเภออะไรบ้าง | MCP | thaiKnowledgeTool | no-llm | district list | names |
| **GENERAL** |
| GN1 | Docker คืออะไร | GeneralGate | (no tool) | local-llm | explanation | contains docker |
| GN2 | Machine learning คืออะไร | GeneralGate | (no tool) | local-llm | explanation | ML concepts |

---

## Pass Criteria (Per Test)
1. HTTP/WS request completes (no 4xx/5xx, no timeout)
2. Response appears in browser UI
3. Route correct (WeatherGate/MCP/GeneralGate)
4. Tools used == expected (from `Used tools:` meta)
5. `Used tools: none` NOT shown when tool should be used
6. No placeholder map (`data-testid="weather-map-tiles"` absent OR has real data)
7. No raw JSON leaking to UI
8. Thai language readable
9. Facts match tool output (temp range, province name correct)
10. If tool fails → graceful error message, not 500
11. Screenshot captured
12. Network trace captured
