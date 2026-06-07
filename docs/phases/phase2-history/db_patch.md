# Proposed Changes to THAI_KNOWLEDGE_DB.md

## Add `HISTORY` Domain Attributes

### HISTORY (Era)

```json
{
  "type": "era",
  "start_year": 1238,
  "end_year": 1438,
  "capital": "Sukhothai"
}
```

### HISTORY (Person / King)

```json
{
  "type": "person",
  "role": "monarch",
  "dynasty": "Suphannaphum",
  "reign_start": 1590,
  "reign_end": 1605
}
```

### HISTORY (Event)

```json
{
  "type": "event",
  "year": 1592,
  "participants": ["King Naresuan", "Mingyi Swa"],
  "location": "Nong Sarai"
}
```
