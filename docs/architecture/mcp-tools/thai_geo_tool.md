# MCP Tool – thai_geo_tool

## Purpose
ค้นหาข้อมูลภูมิศาสตร์ไทย

## Input
```json
{
  "query": "โคราช",
  "context": {
    "domain": "geo"
  }
}
````

## Output

```json
{
  "success": true,
  "domain": "geo",
  "data": [
    {
      "name_th": "นครราชสีมา",
      "aliases": ["โคราช"],
      "attributes": {
        "province": "นครราชสีมา",
        "region": "อีสาน"
      }
    }
  ],
  "confidence": 0.92,
  "source": ["DOPA", "data.go.th"]
}
```
