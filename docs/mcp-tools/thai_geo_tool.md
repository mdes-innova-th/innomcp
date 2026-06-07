# Thai Geo Tool Specification

## Purpose

ค้นหาข้อมูลภูมิศาสตร์ไทย (จังหวัด, อำเภอ, ตำบล) พิกัด และภูมิภาค เพื่อสนับสนุนบริบทให้กับ AI

## Input Schema

```json
{
  "query": "เชียงใหม่",
  "context": {
    "domain": "geo",
    "language": "th",
    "confidence_required": 0.6
  },
  "filter_region": "เหนือ" // optional
}
```

## Output Schema

```json
{
  "success": true,
  "domain": "geo",
  "data": [
    {
      "id": "PROV-50",
      "name_th": "เชียงใหม่",
      "type": "province",
      "attributes": {
        "region": "เหนือ",
        "lat": 18.7932,
        "lon": 98.9853
      },
      "confidence": 1.0
    }
  ],
  "confidence": 1.0,
  "source": [
    {
      "name": "DOPA",
      "url": "https://www.dopa.go.th"
    },
    {
      "name": "OSM",
      "url": "https://osm.org"
    }
  ],
  "note": "พบข้อมูลจังหวัดตรงกับคำค้นหา"
}
```

## Logic

1. Search `knowledge_entities` with `domain='geo'`.
2. Use Full Text Search on `name_th` and `description`.
3. If `filter_region` is provided, filter by `attributes->>'$.region'`.
4. If confidence < context.confidence_required, return `success: false`.
