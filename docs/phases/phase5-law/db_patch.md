# DB Patch: Thai Law & Religion

## 1. Add Domains to Enum

- `LAW`
- `RELIGION`

## 2. Law Entity Attributes

```json
{
  "law_type": "ACT|CODE|DECREE",
  "status": "ACTIVE|REVOKED",
  "published_date": "YYYY-MM-DD",
  "sections": [{ "no": "1", "content": "..." }]
}
```

## 3. Religion Entity Attributes

```json
{
  "religion_type": "TEMPLE|MONK|TRADITION",
  "denomination": "Mahanikaya|Dhammayuttika", // for temples/monks
  "location": {
    "lat": number,
    "lon": number,
    "province": string
  },
  "significance": string
}
```
