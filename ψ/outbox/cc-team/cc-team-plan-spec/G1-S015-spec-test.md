<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S015 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":378,"completion_tokens":893,"total_tokens":1271,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:23:08.738Z -->
```typescript
import { exportToJSON, exportToCSV, motherExportService } from '../src/services/motherExportService';

describe('motherExportService - public contract', () => {
  describe('exportToJSON', () => {
    it('returns a JSON string when called with no arguments', () => {
      const result = exportToJSON();
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('returns a JSON string when called with an empty options object', () => {
      const result = exportToJSON({});
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('returns a JSON string when called with explicit options', () => {
      const result = exportToJSON({ pretty: true });
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('produces parseable JSON whose top-level value is not undefined', () => {
      const result = exportToJSON();
      const parsed = JSON.parse(result);
      expect(parsed).not.toBeUndefined();
    });
  });

  describe('exportToCSV', () => {
    it('returns a string when called with no arguments', () => {
      const result = exportToCSV();
      expect(typeof result).toBe('string');
    });

    it('returns a string when called with an empty options object', () => {
      const result = exportToCSV({});
      expect(typeof result).toBe('string');
    });

    it('returns a string when called with explicit options', () => {
      const result = exportToCSV({ delimiter: ';' });
      expect(typeof result).toBe('string');
    });

    it('output does not start with a BOM or non-printable character', () => {
      const result = exportToCSV();
      if (result.length > 0) {
        const firstCode = result.charCodeAt(0);
        // First character must be printable ASCII (>= 0x20) or start-of-text.
        expect(firstCode).toBeGreaterThanOrEqual(0x20);
      }
    });
  });

  describe('motherExportService object', () => {
    it('is a non-null object', () => {
      expect(motherExportService).toBeDefined();
      expect(motherExportService).not.toBeNull();
      expect(typeof motherExportService).toBe('object');
    });

    it('exposes exportToJSON as a function', () => {
      expect(typeof motherExportService.exportToJSON).toBe('function');
    });

    it('exposes exportToCSV as a function', () => {
      expect(typeof motherExportService.exportToCSV).toBe('function');
    });

    it('exportToJSON method returns a parseable JSON string', () => {
      const result = motherExportService.exportToJSON();
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('exportToCSV method returns a string', () => {
      const result = motherExportService.exportToCSV();
      expect(typeof result).toBe('string');
    });

    it('object method results are consistent with the standalone functions', () => {
      const standaloneJson = exportToJSON();
      const methodJson = motherExportService.exportToJSON();
      expect(typeof methodJson).toBe(typeof standaloneJson);

      const standaloneCsv = exportToCSV();
      const methodCsv = motherExportService.exportToCSV();
      expect(typeof methodCsv).toBe(typeof standaloneCsv);
    });
  });

  describe('boundary / determinism', () => {
    it('exportToJSON called multiple times with no args returns strings of equal type', () => {
      const a = exportToJSON();
      const b = exportToJSON();
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });

    it('exportToCSV called multiple times with no args returns strings of equal type', () => {
      const a = exportToCSV();
      const b = exportToCSV();
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });
  });
});
```
