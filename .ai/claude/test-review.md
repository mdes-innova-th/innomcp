# INNOMCP Schema Review Report
**Date**: 2026-02-07
**Reviewer**: Claude (Senior Pair Programmer)
**Branch**: dev6812mcpchat
**Status**: REVIEW IN PROGRESS

---

## 1. DATABASE ARCHITECTURE OVERVIEW

### 1.1 Two Database Connections
| DB | File | Host | Purpose |
|---|---|---|---|
| **innomcp-db** (main) | `src/utils/db.ts` | localhost | User auth, knowledge, keywords, logs |
| **detect** (evidence) | `src/utils/dbDetect.ts` | 209.15.105.27 (external) | Evidence/URL detection data |

### 1.2 Tables Summary

#### Main DB (innomcp-db) - Existing
| Table | Status | Notes |
|---|---|---|
| `user` | OK | Has duplicate columns (user_dispname vs user_disp_name, password vs user_pwd) |
| `userrole` | OK | 5 roles: admin, citizen, officer, data-importer, executive |
| `userlog` | OK | Login/logout tracking |
| `apikey` | OK | API key management |
| `section` | OK | Government departments |
| `section_user` | OK | User-department relationship |
| `fastpath_phrases` | OK | Quick-reply phrases for chat |

#### Main DB - New (from tables.sql)
| Table | Status | Issues Found |
|---|---|---|
| `query_logs` | NEEDS REVIEW | `ai_mode` has no master table |
| `ambiguity_cases` | OK | FK to query_logs correct |
| `tool_categories` | OK | Good master data table |
| `keyword_training` | OK | FK to tool_categories, compound unique key |
| `semantic_embeddings` | OK | JSON vector storage (acceptable for v1) |
| `knowledge_entities` | NEEDS REVIEW | See findings below |

#### Detect DB (External)
| Table | Status | Notes |
|---|---|---|
| `entries` (assumed) | UNKNOWN | Schema discovered dynamically by evidenceTool |

---

## 2. SECURITY FINDINGS

### 2.1 CRITICAL: Hardcoded DB Credentials
**File**: `innomcp-server-node/src/utils/dbDetect.ts:8`
```
password: process.env.DETECT_DB_PASSWORD || "1nN0!-@-#$"
```
- **Risk**: Credentials committed to source code
- **Fix**: Remove hardcoded fallback, require env vars

### 2.2 HIGH: SQL Injection Risk in evidenceTool
**File**: `innomcp-server-node/src/mcp/tools/evidenceTool.ts`
- Line 52: `DESCRIBE ${tableName}` - unparameterized
- Line 65: `SELECT * FROM ${tableName}` - unparameterized
- **Risk**: `tableName` comes from user input, can inject SQL
- **Fix**: Validate tableName against allowlist or regex `/^[a-zA-Z_][a-zA-Z0-9_]*$/`

### 2.3 MEDIUM: evidenceTool custom_query bypass
**File**: `innomcp-server-node/src/mcp/tools/evidenceTool.ts:77-80`
- Only checks `startsWith("select")` - can bypass with `SELECT ... INTO OUTFILE`
- Only checks `;` - doesn't prevent subqueries or UNION attacks
- **Fix**: Use a SQL parser or stricter validation

---

## 3. SCHEMA REVIEW FINDINGS

### 3.1 knowledge_entities (Thai Knowledge DB)

**Good**:
- FULLTEXT index on `name_th, description` - supports Thai natural language search
- JSON columns for flexible `aliases`, `attributes`, `relations`
- `confidence` field for data quality scoring

**Issues**:
| # | Issue | Severity | Suggestion |
|---|---|---|---|
| K1 | No `name_en` column | LOW | Add for bilingual search |
| K2 | `domain` is free-text VARCHAR(50) | MEDIUM | Should FK to a `knowledge_domains` master table |
| K3 | `relations` JSON is unstructured | LOW | Consider separate `entity_relations` table for queryable relations |
| K4 | No `updated_by` / `created_by` columns | LOW | Add for audit trail |
| K5 | thaiKnowledgeTool returns hardcoded confidence (1.0/0.0) instead of DB value | MEDIUM | Use `results[0].confidence` from DB |

### 3.2 keyword_training

**Good**:
- Compound unique on (keyword, category)
- hit_count for learning frequency
- confidence_score for ranking

**Issues**:
| # | Issue | Severity | Suggestion |
|---|---|---|---|
| KW1 | keywordTool "add" doesn't validate category exists in tool_categories | MEDIUM | Add SELECT check before INSERT |
| KW2 | No `updated_by` tracking | LOW | Add for audit |

### 3.3 Detect DB (Evidence)

**Issues**:
| # | Issue | Severity | Suggestion |
|---|---|---|---|
| E1 | Schema is completely unknown/assumed | HIGH | Run `tables_schema_dump.ts` to document actual schema |
| E2 | `entries` table assumed with `video_path` column | MEDIUM | report_top_urls may fail if column doesn't exist |
| E3 | No connection retry/circuit breaker | MEDIUM | External DB may be unreachable |

### 3.4 user table

**Issues**:
| # | Issue | Severity | Suggestion |
|---|---|---|---|
| U1 | Duplicate columns: `user_dispname` vs `user_disp_name` | LOW | Legacy compat - document which is canonical |
| U2 | Duplicate columns: `password` vs `user_pwd` | LOW | Same - document |
| U3 | `user_role_id` vs `userrole_id` FK confusion | LOW | `userrole_id` is the real FK |

---

## 4. NEW TOOLS REGISTRATION STATUS

All 4 new tools are registered in `server.ts` (lines 101-109):
| Tool | Registered | DB | Status |
|---|---|---|---|
| storageTool | YES | filesystem | OK |
| thaiKnowledgeTool | YES | innomcp-db | OK (needs table creation) |
| keywordTool | YES | innomcp-db | OK (needs table creation) |
| evidenceTool | YES | detect DB | OK (external) |

**Note**: The tables from `tables.sql` need to be executed on innomcp-db before these tools will work.

---

## 5. TOOL COUNT DISCREPANCY

`server.ts:318` says "27 essential tools" but the log message doesn't include the 4 new tools (storageTool, thaiKnowledgeTool, keywordTool, evidenceTool). Actual count = **31 tools**.

---

## 6. DEV MONITORING STATUS

| Item | Status |
|---|---|
| dev-log.txt | NOT YET CREATED (waiting for `npm run dev \| tee dev-log.txt`) |
| Docker services | Need verification |
| DB connectivity | Need verification |

---

## 7. RECOMMENDED ACTIONS (Priority Order)

1. **Run `tables.sql`** on innomcp-db to create the new tables
2. **Fix hardcoded credentials** in `dbDetect.ts`
3. **Fix SQL injection** in `evidenceTool.ts` tableName parameter
4. **Run `tables_schema_dump.ts`** to document detect DB schema
5. **Update tool count** in server.ts log message
6. **Add connection health check** for detect DB on startup

---

*Confidence Level: HIGH*
*Next Review: After dev server is running*
