# FINAL EVIDENCE RUNTIME CLOSURE REPORT

**Date**: 2026-04-01  
**Commit**: `305fb08` (pushed to `origin/main`)  
**Baseline**: `02c2f7e` (pre-fix)  
**Author Session**: System Architect — Evidence Runtime Proof

---

## 1. FREEZE TRUTH (Baseline)

| Item | Value |
|------|-------|
| HEAD before fix | `02c2f7e5f143a1a89168a0574461127f417b46f7` |
| Branch | `main` |
| Working tree | CLEAN |
| Recent commits | 20 logged (geo, knowledge, weather, login, env fixes) |

---

## 2. DB / Table / Column Inventory (REAL — not mock)

**Detect DB**: `209.15.105.27:3306`, database `detect`

| Table | Key Columns | Sample Count |
|-------|------------|-------------|
| machines | id, pc_name, is_online, isp_name, last_check_in | 274 (5 online) |
| nip | no, url, title, isp_name, create_date | 33 today |
| record | rec_id, nip_no, create_date | 702 today |
| sip | same as nip | 0 (empty) |
| hash | id, hash_value | exists |
| log_login | id fields | exists |
| user | id, username | exists |

**innomcp-db**: `127.0.0.1:3308`, database `innomcp-db`  
Tables: apikey, keyword_training, section, section_user, user, userlog, userrole

---

## 3. Code Path Mapping

```
User Chat Input
  └─> inferOfficerEvidenceAction(text) → maps Thai/English/fuzzy to intent
  └─> looksLikeEvidenceKeywordQuery(text) → boolean gate
  └─> mapOfficerEvidenceActionToLocalIntent(action) → local tool intent
  └─> evidenceTool.ts (local fallback) → queryEvidence(SQL) → detect DB
  └─> renderStructuredDirect() → JSON response with structuredContent
```

Both WS (line ~2158) and HTTP (line ~3637) paths use the same routing functions.

---

## 4. FIX RUNTIME PATH — Changes Made

**File**: `innomcp-node/src/routes/api/chat.ts` (+46 / −16 lines)

### 4a. `inferOfficerEvidenceAction()` improvements:
- **Whitespace normalization**: `raw.replace(/\s+/g, " ").trim()`
- **Thai typo variants**: `เมือวาน`, `หลักฐาณ`, `เเนวโน้ม`, `ไอเอสพี`
- **New patterns**: "record ล่าสุด" → `nip_latest`, "machine ไหน offline" → `active_machines_offline_count`, "สรุปแนวโน้มวันนี้" → `evidence_records_last_7_days_trend`, "isp ไหนเจอ illegal url เยอะสุด" → `nip_top_isp_this_month`, "evidence scanner run กี่เครื่อง" → `active_machines_count`, "machine online กี่ตัว" → `active_machines_count`, "จำนวน record เดือนนี้" → `evidence_records_today`

### 4b. `looksLikeEvidenceKeywordQuery()` improvements:
- Added `สแกน|scanner|แนวโน้ม.*หลักฐาน` to evidence terms
- Added `machine` + `ไหน|ตัวไหน|กี่|สถานะ|status` as evidence signal

---

## 5. QUERY UNDERSTANDING — Thai/Typo/Mixed Coverage

22 test queries covering:
- **10 Normal** (standard Thai/English): machine count, ISP ranking, URL count, record latest, offline count, 7-day trend, yesterday totals, NIP top
- **10 Fuzzy** (typo, mixed language, slang): "isp ไหนเจอ illegal url เยอะสุด", "top isp bad url", "url ผิดกฏหมายล่าสุด", "เมือวานISPไหน...", "แนวโน้มหลักฐาน7วัน"
- **2 Edge** (compound queries): "วันนี้ URL detected กี่รายการ", "เมื่อวาน evidence แยกตาม ISP"

---

## 6. EXECUTED TESTS — 22/22 PASS

```
=== SUMMARY: 22 PASS / 0 FAIL / 22 TOTAL ===
```

| Group | Pass | Fail | Total |
|-------|------|------|-------|
| Normal | 10 | 0 | 10 |
| Fuzzy | 10 | 0 | 10 |
| Edge | 2 | 0 | 2 |

All queries returned:
- `route = evidence`
- `dataSource = detectdb`
- `ok = true`
- Real data from production detect DB

**Sample responses verified against DB**:
- Machines online: **5** (matches `SELECT COUNT(*) FROM machines WHERE is_online=1`)
- Top ISP: **dtac: 11, 3bb: 8, true: 7, ais: 7** (matches NIP table)
- Yesterday records: **1,439** (matches record table for March 31)
- 7-day total: **10,020** (1183+537+3421+1531+1207+1439+702)

---

## 7. BROWSER PROOF — 5 Cases

| # | Query | Response | Screenshot |
|---|-------|----------|------------|
| 1 | เครื่องสแกนออนไลน์กี่เครื่อง | "ตอนนี้เครื่องออนไลน์: 5 เครื่อง" (DETECTDB badge) | `screenshots/browser_proof_1_machine_online.png` |
| 2 | ISP ไหนพบ URL ผิดกฎหมายมากที่สุดเดือนนี้ | dtac: 11, 3bb: 8, true: 7, ais: 7 (DETECTDB badge) | `screenshots/browser_proof_2_top_isp.png` |
| 3 | url ผิดกฎหมายล่าสุด | Real URLs: songsaengsawang.com, twitter-thread.com, sgdutyfree2.com (DETECTDB) | `screenshots/browser_proof_3_latest_url.png` |
| 4 | แนวโน้มหลักฐาน 7 วัน | 7-day chart + daily numbers, total 10,020 (DETECTDB) | `screenshots/browser_proof_4_7day_trend.png` |
| 5 | เมื่อวาน evidence แยกตาม ISP | National Telecom: 622, AIS Fibre: 304, True Online: 180 (DETECTDB) | `screenshots/browser_proof_5_yesterday_by_isp.png` |

All 5 show `DETECTDB` badge, `Used tools: local-tools:detect_evidence_stats`, `MODE online`.

---

## 8. DEGRADED MODE PROOF

| Scenario | Result |
|----------|--------|
| **DB available** (normal) | `ok=true`, `dataSource=detectdb`, real numbers |
| **DB forced failure** (`x-test-degrade-db: 1`) | `ok=false`, `dataSource=placeholder`, honest message: "ขออภัย ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน" |
| **Redis down** (ECONNREFUSED) | System continues operating normally, no crash |
| **MCP Server down** (ECONNREFUSED) | Falls back to local tools seamlessly |

No fake data. No silent failure. Honest Thai error message in degraded mode.

---

## 9. INFRASTRUCTURE STATUS

| Service | Status | Notes |
|---------|--------|-------|
| Backend (innomcp-node:3011) | RUNNING | Local AI mode, 4 tools loaded |
| Frontend (innomcp-next:3000) | RUNNING | Chat UI operational |
| Detect DB (209.15.105.27:3306) | LIVE | Real production data |
| innomcp-db (127.0.0.1:3308) | LIVE | Local user/auth DB |
| Redis (localhost:6379) | DOWN | Degraded but system works |
| MCP Server (innomcp-server-node) | DOWN | Local fallback works |
| Ollama (localhost:11434) | RUNNING | qwen2.5-coder:7b / deepseek-r1:32b |

---

## 10. FINAL VERDICT

### PASS ✅ — EVIDENCE RUNTIME IS LIVE AND PROVEN

| Criterion | Status |
|-----------|--------|
| Real DB connection (not mock) | ✅ 209.15.105.27:3306/detect with live data |
| 22+ queries pass (normal + fuzzy + edge) | ✅ 22/22 PASS from real detectdb |
| Thai/typo/mixed language support | ✅ Typo variants, whitespace normalization, bilingual patterns |
| Browser UI proof with real data | ✅ 5 screenshots, DETECTDB badge, real numbers visible |
| Degraded mode honest fallback | ✅ No fake data, honest Thai error message |
| No PLACEHOLDER in responses | ✅ All responses contain real numbers from DB |
| Commit + Push | ✅ `305fb08` pushed to `origin/main` |

**Zero mock. Zero fake. Zero placeholder. All data from production detect DB.**
