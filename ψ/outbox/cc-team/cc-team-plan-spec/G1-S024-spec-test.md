<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S024 role=spec-test model=zai-org/GLM-5.1
 finish_reason: length | tokens: {"prompt_tokens":291,"completion_tokens":7000,"total_tokens":7291,"prompt_tokens_details":{"cached_tokens":288,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5478,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 62s
 generated: 2026-06-13T11:27:34.314Z -->
```typescript
import { sessionStore, PersistedSession } from '../src/services/sessionStore';

// Deterministic in-memory file system mock
const memoryStore = new Map<string, string>();

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(async (path: string) => {
    memoryStore.set(path, 'directory');
  }),
  writeFile: jest.fn(async (path: string, data: string) => {
    memoryStore.set(path, data);
  }),
  readFile: jest.fn(async (path: string) => {
    if (memoryStore.has(path)) return memoryStore.get(path)!;
    const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }),
  readdir: jest.fn(async (dirPath: string) => {
    const files: string[] = [];
    for (const key of memoryStore.keys()) {
      if (key.startsWith(dirPath) && !key.substring(dirPath.length + 1).includes('/')) {
        files.push(key.substring(key.lastIndexOf('/') + 1));
      }
    }
    return files;
  }),
  unlink: jest.fn(async (path: string) => {
    if (!memoryStore.has(path)) {
      const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    memoryStore.delete(path);
  }),
  stat: jest.fn(async (path: string) => ({
    isDirectory: () => memoryStore.get(path) === 'directory',
    isFile: () => memoryStore.has(path) && memoryStore.get(path) !== 'directory',
  })),
}));

describe('SessionStore Contract', () => {
  beforeEach(() => {
    memoryStore.clear();
    jest.clearAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should resolve without throwing when ensuring directory exists', async () => {
      await expect(sessionStore.ensureDirectory()).resolves.toBeUndefined();
    });
  });

  describe('save & load', () => {
    const validSession: PersistedSession = {
      id: 'session-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [{ role: 'user', content: 'Hello' }],
    } as PersistedSession;

    it('should save a session and load it back with identical state', async () => {
      await sessionStore.save(validSession);
      const loaded = await sessionStore.load('session-1');
      expect(loaded).toEqual(validSession);
    });

    it('should return null when loading a non-existent session', async () => {
      const loaded = await sessionStore.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should throw an error when saving an invalid session (missing id)', async () => {
      const invalidSession = { createdAt: new Date().toISOString() } as unknown as PersistedSession;
      await expect(sessionStore.save(invalidSession)).rejects.toThrow();
    });

    it('should overwrite existing session on save', async () => {
      await sessionStore.save(validSession);
      const updatedSession = { ...validSession, messages: [{ role: 'assistant', content: 'Hi' }] } as PersistedSession;
      await sessionStore.save(updatedSession);
      
      const loaded = await sessionStore.load('session-1');
      expect(loaded).toEqual(updatedSession);
    });
  });

  describe('loadAll', () => {
    it('should return an empty array when no sessions exist', async () => {
      const all = await sessionStore.loadAll();
      expect(all).toEqual([]);
    });

    it('should return all saved sessions', async () => {
      const session1 = { id: 's1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } as PersistedSession;
      const session2 = { id: 's2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } as PersistedSession;
      
      await sessionStore.save(session1);
      await sessionStore.save(session2);
      
      const all = await sessionStore.loadAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([session1, session2]));
    });
  });

  describe('delete', () => {
    it('should delete an existing session so it can no longer be loaded', async () => {
      const session = { id: 'del-me', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } as PersistedSession;
      await sessionStore.save(session);
      
      await sessionStore.delete('del-me');
      const loaded = await sessionStore.load('del-me');
      expect(loaded).toBeNull();
    });

    it('should resolve gracefully when deleting a non-existent session (idempotent)', async () => {
      await expect(sessionStore.delete('non-existent-id')).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove sessions older than maxAgeDays and return the count removed', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const recentDate = new Date().toISOString();
      
      const oldSession = { id: 'old', createdAt: oldDate, updatedAt: oldDate, messages: [] } as PersistedSession;
      const recentSession = { id: 'recent', createdAt: recentDate, updatedAt: recentDate, messages: [] } as PersistedSession;
      
      await sessionStore.save(oldSession);
      await sessionStore.save(recentSession);
      
      const removedCount = await sessionStore.cleanup(30);
      expect(removedCount).toBe(1);
      expect(await sessionStore.load('old')).toBeNull();
      expect(await sessionStore.load('recent')).not.toBeNull();
    });

    it('should use default maxAgeDays of 30 if not specified', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
      
      const oldSession = { id: 'old-default', createdAt: thirtyOneDaysAgo, updatedAt: thirtyOneDaysAgo, messages: [] } as PersistedSession;
      const okSession = { id: 'ok-default', createdAt: twentyNineDaysAgo, updatedAt: twentyNineDaysAgo, messages: [] } as PersistedSession;
      
      await sessionStore.save(oldSession);
      await sessionStore.save(okSession);
      
      const removedCount = await sessionStore.cleanup();
      expect(removedCount).toBe(1);
      expect(await sessionStore.load('old-default')).toBeNull();
      expect(await sessionStore.load('ok-default')).not.toBeNull();
    });
  });

  describe('stats', () => {
    it('should return zeroed stats when no sessions exist', async () => {
      const stats = await sessionStore.stats();
      expect(stats).toEqual({ total: 0, active24h: 0, totalMessages: 0 });
    });

    it('should correctly calculate total, active24h, and totalMessages', async () => {
      const now = new Date().toISOString();
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      
      const activeSession = { id: 'active', createdAt: now, updatedAt: now, messages: [{ role: 'user', content: 'hi' }] } as PersistedSession;
      const inactive
