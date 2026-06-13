<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S004 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":262,"completion_tokens":6689,"total_tokens":6951,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5838,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:20:50.466Z -->
```typescript
import {
  auditLogger,
  AuditLogger,
  AuditAction,
  AuditEntry,
  AuditEntryInput,
  AuditFilter
} from '../src/services/auditLogger';

// Mock external dependencies deterministically (Offline, Strict TS)
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123456789')
}));

describe('AuditLogger Contract', () => {
  const fixedDate = new Date('2023-11-15T12:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('log', () => {
    it('should log a valid entry and return it with generated id and timestamp', () => {
      const input: AuditEntryInput = {
        action: 'login',
        userId: 'user-abc',
        details: 'User logged in successfully'
      };

      const entry = auditLogger.log(input);

      // Assert VALUES/STATE, not just mock calls
      expect(entry).toMatchObject({
        id: 'mock-uuid-123456789',
        timestamp: fixedDate,
        action: 'login',
        userId: 'user-abc',
        details: 'User logged in successfully'
      });
    });

    it('should throw an error when logging an invalid AuditAction', () => {
      const invalidInput = {
        action: 'invalid_hack', // Not in AuditAction union
        userId: 'user-abc'
      };

      expect(() => auditLogger.log(invalidInput as any)).toThrow();
    });

    it('should throw an error when required fields are missing', () => {
      const missingFieldsInput = { action: 'logout' } as any;
      expect(() => auditLogger.log(missingFieldsInput)).toThrow();
    });
  });

  describe('query', () => {
    it('should return filtered entries based on AuditFilter', () => {
      auditLogger.log({ action: 'login', userId: 'user-1' });
      auditLogger.log({ action: 'logout', userId: 'user-1' });
      auditLogger.log({ action: 'login', userId: 'user-2' });

      const filter: AuditFilter = { action: 'login' } as AuditFilter;
      const results = auditLogger.query(filter);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every(entry => entry.action === 'login')).toBe(true);
    });

    it('should return an empty array if no entries match the filter', () => {
      const filter: AuditFilter = { action: 'admin_action' } as AuditFilter;
      const results = auditLogger.query(filter);

      expect(results).toEqual([]);
    });
  });

  describe('exportJSON', () => {
    it('should return a valid JSON string containing the logged entries', () => {
      auditLogger.log({ action: 'data_export', userId: 'admin-user' });

      const jsonString = auditLogger.exportJSON();
      const parsed = JSON.parse(jsonString);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'mock-uuid-123456789',
            action: 'data_export',
            userId: 'admin-user'
          })
        ])
      );
    });

    it('should return a valid JSON string of filtered entries', () => {
      auditLogger.log({ action: 'file_access', userId: 'user-1' });
      auditLogger.log({ action: 'message_sent', userId: 'user-2' });

      const filter: AuditFilter = { action: 'file_access' } as AuditFilter;
      const jsonString = auditLogger.exportJSON(filter);
      const parsed = JSON.parse(jsonString);

      expect(parsed.length).toBeGreaterThanOrEqual(1);
      expect(parsed.every((entry: AuditEntry) => entry.action === 'file_access')).toBe(true);
    });
  });

  describe('exportCSV', () => {
    it('should return a valid CSV string with headers and corresponding data rows', () => {
      auditLogger.log({ action: 'provider_change', userId: 'admin-user' });

      const csvString = auditLogger.exportCSV();
      const lines = csvString.trim().split('\n');

      // Header row contract
      expect(lines[0]).toMatch(/id,timestamp,action,userId/);
      // Data row contract
      expect(lines[1]).toContain('mock-uuid-123456789');
      expect(lines[1]).toContain('provider_change');
      expect(lines[1]).toContain('admin-user');
    });

    it('should return a CSV string with only headers if no entries match filter', () => {
      const filter: AuditFilter = { action: 'admin_action' } as AuditFilter;
      const csvString = auditLogger.exportCSV(filter);
      const lines = csvString.trim().split('\n');

      expect(lines).toHaveLength(1); // Only header row
      expect(lines[0]).toMatch(/id,timestamp,action,userId/);
    });
  });
});
```
