# Thai History Tool (MCP)

## Purpose

Provides factual Thai historical data to prevent hallucinations about time periods, kings, and major events.

## Interface

### Input Schema

```json
{
  "query": "string (e.g., 'King Naresuan', 'Sukhothai Era')",
  "type": "era|person|event|any"
}
```

### Output Schema

```json
{
  "success": true,
  "data": [
    {
      "name_th": "สมเด็จพระนเรศวรมหาราช",
      "aliases": ["พระองค์ดำ", "Naresuan the Great"],
      "era": "Ayutthaya",
      "role": "King",
      "period": "1590-1605",
      "significance": "Declared independence from Burma, Elephant Duel"
    }
  ]
}
```

## Data Sources

1.  **Static Seed**:
    - Major Eras (Sukhothai, Ayutthaya, Thonburi, Rattanakosin)
    - Monarchs (Sukhothai - Current)
2.  **Dynamic/RAG**:
    - Specific events or minor figures (via search if needed, but primary focus is core history).
