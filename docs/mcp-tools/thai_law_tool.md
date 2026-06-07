# thai_law_tool

## Overview
MCP Tool สำหรับค้นหาข้อมูลกฎหมายไทย (Thai Law Lookup)

## Domain
`law`

## Input Schema
```json
{
  "query": "string (min 1) — คำค้น เช่น ชื่อกฎหมาย/ประเภท/หน่วยงาน",
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
  "domain": "law",
  "data": [
    {
      "id": "law:computer-crime-act",
      "name_th": "พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์",
      "aliases": ["พ.ร.บ.คอมพิวเตอร์"],
      "description": "กฎหมายเกี่ยวกับอาชญากรรมทางคอมพิวเตอร์",
      "attributes": {
        "law_type": "พระราชบัญญัติ",
        "status": "active",
        "effective_date": "2017-05-24",
        "applies_to": ["ประชาชน", "ผู้ให้บริการ"]
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
| law_type | string | ประเภท: พระราชบัญญัติ, พระราชกำหนด, ประมวลกฎหมาย, รัฐธรรมนูญ |
| status | string | สถานะ: active, repealed, amended |
| effective_date | string | วันที่มีผลบังคับใช้ (YYYY-MM-DD) |
| applies_to | string[] | กลุ่มที่บังคับใช้ เช่น ประชาชน, หน่วยงานรัฐ |

## Logic
1. Validate query (non-empty)
2. Search `knowledge_entities` WHERE `domain='law'`
3. FULLTEXT first, LIKE fallback
4. Compute confidence score
5. If DB error → fallback to InMemory seed data
6. Return results or error

## DB Table
`knowledge_entities` (shared table, filtered by `domain='law'`)
