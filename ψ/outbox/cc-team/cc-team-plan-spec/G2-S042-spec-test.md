<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S042 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":213,"completion_tokens":4542,"total_tokens":4755,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3866,"image_tokens":0},"cache_creation_input_tokens":0} | 84s
 generated: 2026-06-13T11:32:47.119Z -->
```typescript
import router, { ensureProjectsTable, ensureTaskProjectColumn } from '../src/routes/api/activity';

describe('activity module contract', () => {
  const createMockDb = (shouldFail = false) => ({
    query: jest.fn().mockImplementation(() =>
      shouldFail ? Promise.reject(new Error('DB connection failed')) : Promise.resolve({ rows: [] })
    ),
  });

  describe('ensureProjectsTable', () => {
    it('resolves successfully and issues a CREATE TABLE query for projects', async () => {
      const db = createMockDb();
      const result = await ensureProjectsTable(db as any);
      
      expect(result).toBeUndefined();
      expect(db.query).toHaveBeenCalledTimes(1);
      
      const sql = db.query.mock.calls[0][0];
      expect(typeof sql).toBe('string');
      expect(sql).toMatch(/CREATE\s+TABLE/i);
      expect(sql).toMatch(/projects/i);
    });

    it('propagates database errors', async () => {
      const db = createMockDb(true);
      await expect(ensureProjectsTable(db as any)).rejects.toThrow('DB connection failed');
    });

    it('throws when provided with an invalid or null database client', async () => {
      await expect(ensureProjectsTable(null as any)).rejects.toThrow();
      await expect(ensureProjectsTable(undefined as any)).rejects.toThrow();
      await expect(ensureProjectsTable({} as any)).rejects.toThrow();
    });
  });

  describe('ensureTaskProjectColumn', () => {
    it('resolves successfully and issues an ALTER TABLE query linking tasks to projects', async () => {
      const db = createMockDb();
      const result = await ensureTaskProjectColumn(db as any);
      
      expect(result).toBeUndefined();
      expect(db.query).toHaveBeenCalledTimes(1);
      
      const sql = db.query.mock.calls[0][0];
      expect(typeof sql).toBe('string');
      expect(sql).toMatch(/task/i);
      expect(sql).toMatch(/project/i);
      expect(sql).toMatch(/ALTER|ADD|COLUMN|FOREIGN/i);
    });

    it('propagates database errors', async () => {
      const db = createMockDb(true);
      await expect(ensureTaskProjectColumn(db as any)).rejects.toThrow('DB connection failed');
    });

    it('throws when provided with an invalid database client', async () => {
      await expect(ensureTaskProjectColumn(null as any)).rejects.toThrow();
    });
  });

  describe('router (default export)', () => {
    it('exports a valid Express-compatible router function', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('has registered at least one route or middleware layer', () => {
      expect((router as any).stack.length).toBeGreaterThan(0);
    });
  });
});
```
