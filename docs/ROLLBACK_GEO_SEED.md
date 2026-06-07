# Rollback / Troubleshooting Note - Phase 1 GEO

## Database Locking Issue

If `seed_thai_geo.ts` hangs or errors with `SQLITE_BUSY` / `Lock wait timeout`:

1. **Stop the Main App**: The MCP server or Next.js app might be holding a write lock.
2. **Kill Node Processes**: `taskkill /F /IM node.exe /T` (Windows).
3. **Retry Seed**: `npx ts-node scripts/seed_thai_geo.ts`.

## Data Rollback

To remove all Phase 1 GEO data:

```sql
DELETE FROM knowledge_entities WHERE domain = 'geo';
```

## Schema Rollback

To remove the `type` column (only if strictly necessary):

```sql
ALTER TABLE knowledge_entities DROP COLUMN type;
```
