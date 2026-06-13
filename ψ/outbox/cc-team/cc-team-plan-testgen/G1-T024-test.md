<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T024 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1261,"completion_tokens":5840,"total_tokens":7101,"prompt_tokens_details":{"cached_tokens":1248,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4417,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 82s
 generated: 2026-06-13T10:59:43.189Z -->
```typescript
import { sessionStore, PersistedSession } from '../src/services/sessionStore';
import { promises as fs } from 'fs';
import path from 'path';

jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    readdir: jest.fn().mockResolvedValue([]),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

const SESSIONS_DIR = path.join(process.cwd(), 'workspace-storage', '.sessions');

describe('sessionStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createSession = (id: string, lastActivity?: number): PersistedSession => ({
    id,
    createdAt: new Date('2022-01-01').getTime(),
    lastActivity: lastActivity ?? new Date('2022-12-01').getTime(),
    preferences: {},
    stats: { messages: 10, tokens: 100 },
  });

  describe('save', () => {
    test('should persist session to disk', async () => {
      const session = createSession('sess-1');
      await sessionStore.save(session);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(SESSIONS_DIR, 'sess-1.json'),
        JSON.stringify(session, null, 2),
        'utf-8'
      );
    });

    test('should ensure directory exists if access fails', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      const session = createSession('sess-2');
      await sessionStore.save(session);

      expect(fs.mkdir).toHaveBeenCalledWith(SESSIONS_DIR, { recursive: true });
    });
  });

  describe('load', () => {
    test('should load and parse session from disk', async () => {
      const session = createSession('sess-1');
      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(session));

      const result = await sessionStore.load('sess-1');

      expect(result).toEqual(session);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(SESSIONS_DIR, 'sess-1.json'),
        'utf-8'
      );
    });

    test('should return null if session not found (ENOENT)', async () => {
      const error: any = new Error('Not found');
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValueOnce(error);

      const result = await sessionStore.load('missing');

      expect(result).toBeNull();
    });

    test('should throw unexpected errors', async () => {
      const error: any = new Error('Permission denied');
      error.code = 'EACCES';
      (fs.readFile as jest.Mock).mockRejectedValueOnce(error);

      await expect(sessionStore.load('bad-file')).rejects.toThrow('Permission denied');
    });
  });

  describe('loadAll', () => {
    test('should load and parse all valid sessions', async () => {
      const s1 = createSession('s1');
      const s2 = createSession('s2');
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['s1.json', 's2.json']);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(s1))
        .mockResolvedValueOnce(JSON.stringify(s2));

      const result = await sessionStore.loadAll();

      expect(result).toEqual([s1, s2]);
    });

    test('should skip non-json files and corrupted files', async () => {
      const s1 = createSession('s1');
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['s1.json', 's2.txt', 's3.json']);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(s1))
        .mockRejectedValueOnce(new Error('Corrupt'));

      const result = await sessionStore.loadAll();

      expect(result).toEqual([s1]);
    });
  });

  describe('delete', () => {
    test('should delete session file from disk', async () => {
      await sessionStore.delete('sess-1');

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(SESSIONS_DIR, 'sess-1.json')
      );
    });

    test('should not throw if file does not exist (ENOENT)', async () => {
      const error: any = new Error('Not found');
      error.code = 'ENOENT';
      (fs.unlink as jest.Mock).mockRejectedValueOnce(error);

      await expect(sessionStore.delete('missing')).resolves.toBeUndefined();
    });

    test('should throw unexpected errors', async () => {
      const error: any = new Error('Permission denied');
      error.code = 'EACCES';
      (fs.unlink as jest.Mock).mockRejectedValueOnce(error);

      await expect(sessionStore.delete('bad-file')).rejects.toThrow('Permission denied');
    });
  });

  describe('cleanup', () => {
    test('should delete sessions older than maxAgeDays and return count', async () => {
      const now = new Date('2023-01-01T00:00:00Z').getTime();
      const oldSession = createSession('old', now - 31 * 24 * 60 * 60 * 1000);
      const recentSession = createSession('recent', now - 29 * 24 * 60 * 60 * 1000);
      
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['old.json', 'recent.json']);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(oldSession))
        .mockResolvedValueOnce(JSON.stringify(recentSession));

      const deletedCount = await sessionStore.cleanup(30);

      expect(deletedCount).toBe(1);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(SESSIONS_DIR, 'old.json'));
      expect(fs.unlink).not.toHaveBeenCalledWith(path.join(SESSIONS_DIR, 'recent.json'));
    });
  });

  describe('stats', () => {
    test('should aggregate stats correctly', async () => {
      const now = new Date('2023-01-01T00:00:00Z').getTime();
      const activeSession = createSession('active', now - 12 * 60 * 60 * 1000);
      activeSession.stats = { messages: 5, tokens: 50 };
      
      const inactiveSession = createSession('inactive', now - 48 * 60 * 60 * 1000);
      inactiveSession.stats = { messages: 15, tokens: 150 };

      (fs.readdir as jest.Mock).mockResolvedValueOnce(['active.json', 'inactive.json']);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(activeSession))
        .mockResolvedValueOnce(JSON.stringify(inactiveSession));

      const result = await sessionStore.stats();

      expect(result).toEqual({
        total: 2,
        active24h: 1,
        totalMessages: 20,
      });
    });
  });
});
```
