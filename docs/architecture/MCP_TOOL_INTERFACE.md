# MCP Tool Interface – INNOMCP

## Standard MCP Tool Contract

### Input

```json
{
  "query": "string",
  "context": {
    "domain": "string",
    "language": "th",
    "confidence_required": 0.7
  }
}
```

### Output

```json
{
  "success": true,
  "domain": "string",
  "data": [],
  "confidence": 0.85,
  "source": [
    {
      "name": "string",
      "url": "string"
    }
  ],
  "note": "string"
}
```

---

## Error Handling

- success=false
- error_code
- message
