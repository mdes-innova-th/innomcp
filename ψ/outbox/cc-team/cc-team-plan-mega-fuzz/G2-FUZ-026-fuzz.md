<!-- cc-team deliverable
 group: G2 (fuzz division)
 member: FUZ-026 role=fuzz model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1773,"completion_tokens":3539,"total_tokens":5312,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1733,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:06:03.745Z -->
### Property-based / Fuzz Test Cases for `ThaiGovtTools`

| Property | Fuzz Input | Expected Invariant |
|---|---|---|
| **getWeatherReport** returns an object with all required `WeatherReport` fields present and of correct primitive type | `undefined` (default used) | `result.province` is string, `result.temperature` is number, `result.humidity` is number, `result.condition` is string, `result.timestamp` is string matching ISO 8601 regex |
| | `''` (empty string) | Same as above (MCP may return fallback or error; service must not throw its own exception) |
| | `null` | Service passes `'null'` as province; result fields still conform to `WeatherReport` (or promise rejects from MCP) |
| | `123` (number) | same |
| | `'ก'.repeat(10000)` (very long Thai string) | same |
| | `'<script>alert(1)</script>'` (injection) | same |
| **getDisasterAlerts** always returns an array of `DisasterAlert` | `no input` | `Array.isArray(result)` is true; every element has `id`, `type`, `severity`, `description`, `province`, `issuedAt` as strings (except `severity` is one of the enum values) |
| | – | – |
| **getWeatherForecast** validates `days` argument | `days = 0` | Throws `Error('Forecast days must be between 1 and 14')` |
| | `days = 15` | same |
| | `days = -1` | same |
| | `days = 1.5` | Passes; should not throw (but MCP may truncate or accept fractional days – service does not validate integer) |
| | `days = NaN` | `NaN < 1` is false, `NaN > 14` is false → no validation throw; passes `NaN` to MCP, likely MCP error; invariant: service does not add its own exception |
| | `days = '7'` (string) | `days < 1` coerces to `'7' < 1` → false; passes string to MCP; outcome depends on MCP |
| | `days = undefined` (default 7) | Service defaults to 7; result must be array of `ForecastDay` |
| **getWeatherForecast** returns array of `ForecastDay` with required fields | `province = ''`, `days = 7` | `Array.isArray(result)` true; each element has `date` (YYYY-MM-DD), `maxTemp`/`minTemp`/`precipitation`/`humidity` as numbers, `condition` as string |
| | `province = null` | Service passes `'null'` (string); result may be empty array or error; invariant: no service-side crash |
| | `province = undefined` | undefined is coerced to string? Actually function expects string, so `undefined` becomes `'undefined'`; no crash |
| **getProvinceInfo** returns `ProvinceInfo` with all required fields | `name = ''` | result has `name`, `nameTh`, `region`, `areaKm2`, `population`, `capital`, `postalCodes`, `borderingProvinces` as per interface |
| | `name = null` | passes `'null'`; same invariant |
| | `name = 0` | passes `'0'`; same |
| | `name = '\0'` (null byte) | MCP may reject; service must not throw its own error |
| **findNearest** returns array of `GeoPoint` | `lat = 0, lon = 0, type = undefined` | `Array.isArray(result)` true; each element has `name`, `latitude`, `longitude`, `type`, `address`, `province` |
| | `lat = 1000, lon = 200` | (out‑of‑range coordinates) – service does not validate; must still return array (possibly empty) |
| | `lat = NaN, lon = Infinity` | passes `NaN`/`Infinity` to MCP; service does not throw |
| | `lat = 'abc', lon = 0` | passes `'abc'`; no service crash (MCP may error) |
| | `type = ''` | passes empty string; result array may be empty |
| | `type = 'invalid_type'` | MCP may return empty; service does not throw |
| **searchLocation** returns array of `GeoPoint` | `query = ''` | returns array (may be empty) |
| | `query = null` | passes `'null'`; same invariant |
| | `query = ' OR 1=1;--'` (SQL‑like) | result is array (no crash) |
| | `query = '\n\t\u0000'` (control chars) | same |
| **searchEvidence** validates `limit` | `limit = 0` | Throws `Error('Limit must be between 1 and 100')` |
| | `limit = 101` | same |
| | `limit = -5` | same |
| | `limit = 100.5` | Does **not** throw (service checks `<1` and `>100`; 100.5 passes); MCP may truncate or error |
| | `limit = '10'` (string) | `'10' < 1` is false, `'10' > 100` is false → no validation throw; passes string to MCP |
| | `limit = NaN` | `NaN < 1` false, `NaN > 100` false → no throw; passes `NaN` |
| | `limit = undefined` (default 10) | Uses default; returns array of `Evidence` with required fields |
| **searchEvidence** returns array of `Evidence` with required fields | `query = ''`, `limit = 10` | `Array.isArray(result)` true; each element has `id`, `title`, `description`, `category`, `source`, `date` as strings |
| | `query = null` | passes `'null'`; same invariant |
| | `query = '/../../../etc/passwd'` | MCP may return empty; service does not crash |
| **getDataStats** returns `DataStats` with required fields | `category = ''` | result has `category`, `totalCount` (number), `lastUpdated` (ISO string), `summary` (object) |
| | `category = null` | passes `'null'`; same |
| | `category = 123` | passes `'123'`; same |
| **searchKnowledge** returns array of `KnowledgeItem` with required fields | `query = ''`, `language = 'th'` | `Array.isArray(result)` true; each element has `id`, `title`, `content`, `language` (`'th'` or `'en'`), `category`, `lastModified` |
| | `query = undefined`, `language = undefined` | `query` becomes `'undefined'`; `language` defaults to `'th'`; invariant holds |
| | `language = 'en'` | valid; returned items have `language: 'en'` or other; no crash |
| | `language = 'EN'` | Service passes `'EN'` (uppercase) – MCP may accept; no service error |
| | `language = 'th_en'` | invalid, but service does not validate; passes string; MCP may reject |
| | `language = null` | passes `'null'`; same |
| **getGovInfo** returns `GovInfo` with required fields | `topic = ''` | result has `topic` (string), `description` (string), `relevantLaws` (array of strings), `contacts` (array of objects with name/department/phone/email) |
| | `topic = null` | passes `'null'`; same |
| | `topic = '; DROP TABLE knowledge;'` | MCP returns data or error; service does not crash |
