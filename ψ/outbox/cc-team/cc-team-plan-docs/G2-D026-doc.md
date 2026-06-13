<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D026 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1786,"completion_tokens":2255,"total_tokens":4041,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1271,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:23:16.743Z -->
- **`WeatherReport`** – Describes current weather for a province. Contains temperature (°C), humidity (%), condition string, optional wind speed (km/h) and visibility (m), and an ISO‑8601 timestamp.

- **`DisasterAlert`** – A disaster warning with type (e.g. “flood”), severity (`low`–`critical`), description, province, issuance time, and optional expiry.

- **`ForecastDay`** – Single‑day weather forecast: date (YYYY‑MM‑DD), min/max temps, condition, precipitation (mm), and humidity.

- **`ProvinceInfo`** – Detailed province data: names (English & Thai), region, area, population, capital, list of postal codes, and bordering provinces.

- **`GeoPoint`** – A geographic point of interest (hospital, school, police, etc.) with coordinates, address, and province.

- **`Evidence`** – A piece of evidence with title, description, category, source, date, and optional attachment URLs.

- **`DataStats`** – Aggregated statistics for a category: total count, last‑updated timestamp, and a summary map of sub‑counts.

- **`KnowledgeItem`** – A knowledge‑base article in Thai or English, with title, content, category, and last‑modified timestamp.

- **`GovInfo`** – Government information on a topic: description, relevant laws, and contact details (name, department, phone, email).

- **`thaiGovtTools`** – Pre‑configured singleton instance of `ThaiGovtTools`. All methods use an internal MCP client to fetch data from Thai government APIs.

  - **`getWeatherReport(province?)`**  
  Gets current weather for a province.  
  @param province – Optional; defaults to `"กรุงเทพมหานคร"` (Bangkok) if omitted.  
  @returns `WeatherReport`  
  *Caveat*: Uses the MCP tool `tmd.weather_report`; data freshness depends on the server.

  - **`getDisasterAlerts()`**  
  Retrieves all active disaster alerts.  
  @returns `DisasterAlert[]`  
  *Caveat*: No filtering; returns alerts for all provinces. Uses `tmd.disaster_alerts`.

  - **`getWeatherForecast(province, days?)`**  
  Gets a multi‑day forecast for a province.  
  @param province – Required province name.  
  @param days – Number of forecast days (1‑14); defaults to 7. Throws if out of range.  
  @returns `ForecastDay[]`

  - **`getProvinceInfo(name)`**  
  Looks up detailed information for a province by name.  
  @param name – Province name (presumably in Thai or English; server‑dependent).  
  @returns `ProvinceInfo`

  - **`findNearest(lat, lon, type?)`**  
  Finds the nearest points of interest to given coordinates.  
  @param lat – Latitude (decimal).  
  @param lon – Longitude (decimal).  
  @param type – Optional filter (e.g. `"hospital"`); defaults to `"all"`.  
  @returns `GeoPoint[]`  
  *Caveat*: The radius is fixed by the underlying `geo.find_nearest` tool.

  - **`searchLocation(query)`**  
  Searches for locations matching a text query.  
  @param query – Search string (name, address, etc.).  
  @returns `GeoPoint[]`

  - **`searchEvidence(query, limit?)`**  
  Searches evidence records by keyword.  
  @param query – Search term.  
  @param limit – Max results (1‑100); defaults to 10. Throws if out of range.  
  @returns `Evidence[]`

  - **`getDataStats(category)`**  
  Gets aggregated statistics for a specific evidence category.  
  @param category – Category string.  
  @returns `DataStats`

  - **`searchKnowledge(query, language?)`**  
  Searches the knowledge base for articles.  
  @param query – Search term.  
  @param language – `"th"` (Thai) or `"en"`; defaults to `"th"`.  
  @returns `KnowledgeItem[]`

  - **`getGovInfo(topic)`**  
  Retrieves government information on a given topic.  
  @param topic – Topic string.  
  @returns `GovInfo`
