# Phase 7.3: CROSS Verification Verdict

## Review Context

**Reviewer**: CROSS Team
**Date**: 2026-02-22
**Target Docs**: `patch-pack.md`
**Verdict**: **REQUEST_CHANGES** (Conditionally Approved upon Action Items)

## Risk List

1. **Test-mode Leak (High)**: Stubs in `fastPathHandler.ts` are a direct risk to production integrity. If they are not properly gated by environment variables, end-users will see test data disguised as facts.
2. **Gate Miss (Medium)**: Weather/Evidence intent classification collisions. If regexes in fast-paths are overly broad, complex Evidence questions might get swallowed by Weather gates, breaking functionality.
3. **SQL Grouping Correctness (High)**: `evidenceTool.ts` ISP breakdown. Grouping by ISP on un-indexed or loosely structured tables without strict `LIMIT` bounds can cause DB performance degradation or accidental data leakage if the code is not carefully reviewed.

## Do NOT Merge Unless:

- [ ] 1. All `fastPathHandler.ts` dummy weather responses are strictly guarded by `NODE_ENV === 'test'` or an explicit `TEST_STUB=1` env var.
- [ ] 2. `thai_geo_tool` successfully resolves specific addresses (Province + District) neutrally without appending generic trivia ("อยู่ภาค...").
- [ ] 3. `evidenceTool.ts` handles `MISSING_DETECT_DB_CREDS` seamlessly by returning mock aggregate data + a short limitation warning.
- [ ] 4. Any SQL added for ISP breakdown strictly uses `GROUP BY`, `COUNT`, and `LIMIT X` with SQL parameters. NO raw row querying.
- [ ] 5. The unit/integration tests running the 3 specific User Queries in the patch pack pass 100% locally on Vitcup's machine before opening the PR.
