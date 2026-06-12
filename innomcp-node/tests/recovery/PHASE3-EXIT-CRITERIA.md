# Phase 3 Exit Criteria

## 1. Greeting Fast-Path Fix

**Test**: POST /api/chat `{"message":"hello"}` → response must NOT contain `ห้ามเดาโว้ย`

```bash
curl -s -X POST http://localhost:3012/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}' | grep -c "ห้ามเดาโว้ย"
# Expected: 0
```

**Pass**: response.text contains `สวัสดี` or any polite greeting  
**Fail**: response.text === `ห้ามเดาโว้ย`

---

## 2. WS Reconnect Banner

**Test**: Kill backend → banner appears within 5s in browser

```bash
# Kill backend
taskkill /F /IM node.exe
# In browser: open http://localhost:3000 — banner should appear within 5s
# Yellow banner: กำลังเชื่อมต่อระบบ...
# Red banner (after timeout): ขาดการเชื่อมต่อ
```

**Pass**: Banner visible ≤ 5 seconds, no infinite spinner when disconnected  
**Fail**: Page hangs with blank spinner, or no banner after 10s

---

## 3. /health Providers + Build

**Test**: GET /api/health → response includes `providers` and `build` fields

```bash
curl -s http://localhost:3012/api/health | jq '.providers, .build'
# Expected:
# { "configured": { "mdesOllama": true/false, ... }, "primary": "mdes-ollama" }
# { "version": "x.y.z", "nodeVersion": "vXX", "env": "development" }
```

**Pass**: Both fields present with correct shapes  
**Fail**: Either field missing or `null`

---

## 4. Smoke Suite Green

```bash
cd innomcp-node && node --test tests/recovery/P3A-greeting-fastpath.test.js
cd innomcp-node && node --test tests/recovery/P3D-smoke-suite.test.js
```

**Pass**: All tests exit 0  
**Fail**: Any test failure

---

## Summary Pass Criteria

| # | Criterion | Command | Expected |
|---|---|---|---|
| 1 | hello → greeting, not ห้ามเดาโว้ย | curl POST /api/chat `hello` | No `ห้ามเดาโว้ย` |
| 2 | kill backend → banner ≤ 5s | browser + kill | Banner visible |
| 3 | /health has providers+build | curl /api/health | Both fields present |
| 4 | smoke tests green | node --test | Exit 0 |
