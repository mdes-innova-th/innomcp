# Phase 9 Release Gate

### How to PASS (1-Page Guide)

To achieve a `READY_FOR_VIT` verdict, the following gates must be cleared without exceptions:

1. **Hygiene Passed:** `git status` reveals zero untracked `.env` files or hardcoded credentials. Only authorized staging list files can be committed.
2. **Security Sweep Clean:** Zero hits for target strings in tracked files and evidence logs:
   - `โหมดทดสอบ` / `เพื่อการทดสอบระบบ`
   - `process.env.*res.json` / `DETECT_DB_PASSWORD.*res.json`
   - `auth-header|token-scheme`
   - `uid[=]|ukey[=]|sample-literal-A|sample-literal-B`
3. **Database Seeded:** Authoritative MariaDB container (`mariadb-innomcp` on port 3308) is seeded and accessible.
4. **Ports Free:** Required UI & Backend ports (3000, 3011, 3012) are ready and unblocked.
5. **CROSS Authorized:** Security checks have been signed off. (If CROSS is LIMIT, GRAVY is authorized to bypass as solo reviewer but strictly documents the limitation).

**Current Verdict:** READY_FOR_VIT
