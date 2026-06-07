# thai_history_tool

## Overview
MCP Tool สำหรับค้นหาข้อมูลประวัติศาสตร์ไทย (Thai History Lookup)

## Domain
`history`

## Input Schema
```json
{
  "query": "string (min 1) — คำค้น เช่น ชื่อเหตุการณ์/ยุคสมัย/บุคคลสำคัญ",
  "context": {
    "language": "th (default)",
    "confidence_required": "0.0–1.0 (default 0.7)"
  }
}
```

## Output (Success)
```json
{
  "success": true,
  "domain": "history",
  "data": [
    {
      "id": "history:sukhothai",
      "name_th": "อาณาจักรสุโขทัย",
      "aliases": ["สุโขทัย"],
      "description": "อาณาจักรไทยแห่งแรก ก่อตั้งโดยพ่อขุนศรีอินทราทิตย์",
      "attributes": {
        "era": "สุโขทัย",
        "period": "พ.ศ. 1792–1981",
        "year_start": 1249,
        "year_end": 1438,
        "event_type": "kingdom",
        "key_figures": ["พ่อขุนศรีอินทราทิตย์", "พ่อขุนรามคำแหง"]
      }
    }
  ],
  "confidence": 0.95,
  "source": ["Royal Thai Government Gazette"],
  "note": "optional match note"
}
```

## Output (Error)
```json
{
  "success": false,
  "error_code": "INVALID_QUERY | NOT_FOUND | DB_ERROR",
  "message": "string"
}
```

## Attributes (domain-specific)
| Field | Type | Description |
|-------|------|-------------|
| era | string | ยุคสมัย เช่น สุโขทัย, อยุธยา, ธนบุรี, รัตนโกสินทร์ |
| period | string | ช่วงเวลา พ.ศ. |
| year_start | number | ปี ค.ศ. เริ่มต้น |
| year_end | number? | ปี ค.ศ. สิ้นสุด (null = ปัจจุบัน) |
| event_type | string | ประเภท: kingdom, battle, treaty, reform, revolution |
| key_figures | string[] | บุคคลสำคัญที่เกี่ยวข้อง |

## Logic
1. Validate query (non-empty)
2. Search `knowledge_entities` WHERE `domain='history'`
3. FULLTEXT first, LIKE fallback
4. Compute confidence score
5. If DB error → fallback to InMemory seed data
6. Return results or error

## DB Table
`knowledge_entities` (shared table, filtered by `domain='history'`)
