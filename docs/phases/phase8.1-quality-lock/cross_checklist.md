# Phase 8.1: CROSS Security & Quality Checklist

## Redaction Rules & Placeholders

1. **No Placeholder Weather:** The system must never use static fallback strings like "อุณหภูมิ 25-30 องศา" unless it's strictly a controlled smoke test responding to a smoke test identifier. Production queries must use real payloads or return an explicit data-missing error.
2. **Missing Creds Masking:** Missing credentials for any DB (like `DETECT_DB_PASSWORD`) must return a sanitized error message (e.g., "ยังไม่เชื่อมต่อฐานข้อมูล") rather than printing out the connection string failure.

## Grep Checks

**1. No Hardcoded Placeholder Weather (check `services` and `utils/mcp/tools`):**

```cmd
findstr /s /i /n "อุณหภูมิ 25-30" src\*.ts
```

**2. No Test-Mode Leakages:**

```cmd
findstr /s /i /n "โหมดทดสอบ" src\*.ts
findstr /s /i /n "เพื่อการทดสอบระบบ" src\*.ts
```

**3. Environment Variable Safety in Responses:**

```cmd
findstr /s /i /r /n "process\.env.*res\.json" src\*.ts
findstr /s /i /r /n "DETECT_DB_PASSWORD.*res\.json" src\*.ts
```

## Checklist

- [ ] Confirmed UI-real phrasing in `renderThaiGeoAnswerShort` (handling Bangkok explicitly).
- [ ] Confirmed `CHAT_TRACE_QA=1` still produces clean structured metadata without raw DB blobs.
- [ ] Evaluated multi-district weather payloads to ensure they are bulleted and correctly chunked without LLM hallucination.
