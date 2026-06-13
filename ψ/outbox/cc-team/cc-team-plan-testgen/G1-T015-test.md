<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T015 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":949,"completion_tokens":1120,"total_tokens":2069,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T10:53:15.922Z -->
```typescript
import {
  motherExportService,
  exportToJSON,
  exportToCSV,
  ExportOptions,
} from '../src/services/motherExportService';
import { motherHistory, MotherRun } from '../src/services/motherHistory';

jest.mock('../src/services/motherHistory', () => ({
  motherHistory: {
    get: jest.fn(),
  },
}));

const mockedMotherHistory = motherHistory as jest.Mocked<typeof motherHistory>;

describe('motherExportService', () => {
  const sampleRun: MotherRun = {
    runId: 'run-1',
    timestamp: 1700000000000,
    intent: 'summarize',
    query: 'hello "world"',
    providers: [
      {
        providerId: 'p1',
        providerName: 'Provider One',
        latencyMs: 123,
        success: true,
        qualityScore: 0.9,
        preview: 'preview "one"',
      },
      {
        providerId: 'p2',
        providerName: 'Provider Two',
        latencyMs: 456,
        success: false,
        qualityScore: undefined as unknown as number,
        preview: 'preview two',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportToJSON', () => {
    test('returns a pretty-printed JSON string of the history', () => {
      mockedMotherHistory.get.mockReturnValueOnce([sampleRun]);

      const result = exportToJSON();

      expect(mockedMotherHistory.get).toHaveBeenCalledWith(undefined);
      expect(JSON.parse(result)).toEqual([sampleRun]);
      expect(result).toBe(JSON.stringify([sampleRun], null, 2));
    });

    test('passes the limit option through to motherHistory.get', () => {
      mockedMotherHistory.get.mockReturnValueOnce([]);
      const options: ExportOptions = { limit: 5 };

      const result = exportToJSON(options);

      expect(mockedMotherHistory.get).toHaveBeenCalledWith(5);
      expect(result).toBe(JSON.stringify([], null, 2));
    });

    test('returns "[]" when there is no history', () => {
      mockedMotherHistory.get.mockReturnValueOnce([]);

      const result = exportToJSON();

      expect(result).toBe('[]');
    });
  });

  describe('exportToCSV', () => {
    test('returns a friendly message when there is no history', () => {
      mockedMotherHistory.get.mockReturnValueOnce([]);

      const result = exportToCSV();

      expect(mockedMotherHistory.get).toHaveBeenCalledWith(undefined);
      expect(result).toBe('No history available to export.');
    });

    test('produces a CSV with header and one row per provider', () => {
      mockedMotherHistory.get.mockReturnValueOnce([sampleRun]);

      const result = exportToCSV();

      const lines = result.split('\n');
      expect(lines[0]).toBe(
        'runId,timestamp,intent,query,providerId,providerName,latencyMs,success,qualityScore,preview'
      );
      expect(lines).toHaveLength(1 + 2);

      const row1 = lines[1].split(',');
      expect(row1[0]).toBe('run-1');
      expect(row1[1]).toBe('1700000000000');
      expect(row1[2]).toBe('summarize');
      expect(row1[3]).toBe('"hello ""world"""');
      expect(row1[4]).toBe('p1');
      expect(row1[5]).toBe('Provider One');
      expect(row1[6]).toBe('123');
      expect(row1[7]).toBe('TRUE');
      expect(row1[8]).toBe('0.9');
      expect(row1[9]).toBe('"preview ""one"""');

      const row2 = lines[2].split(',');
      expect(row2[7]).toBe('FALSE');
      expect(row2[8]).toBe('N/A');
    });

    test('propagates the limit option to motherHistory.get', () => {
      mockedMotherHistory.get.mockReturnValueOnce([]);
      const options: ExportOptions = { limit: 10 };

      const result = exportToCSV(options);

      expect(mockedMotherHistory.get).toHaveBeenCalledWith(10);
      expect(result).toBe('No history available to export.');
    });
  });

  describe('motherExportService singleton', () => {
    test('exposes toJSON that delegates to exportToJSON', () => {
      mockedMotherHistory.get.mockReturnValueOnce([sampleRun]);

      const result = motherExportService.toJSON({ limit: 1 });

      expect(mockedMotherHistory.get).toHaveBeenCalledWith(1);
      expect(JSON.parse(result)).toEqual([sampleRun]);
    });

    test('exposes toCSV that delegates to exportToCSV', () => {
      mockedMotherHistory.get.mockReturnValueOnce([sampleRun]);

      const result = motherExportService.toCSV();

      expect(typeof result).toBe('string');
      expect(result.split('\n')[0]).toBe(
        'runId,timestamp,intent,query,providerId,providerName,latencyMs,success,qualityScore,preview'
      );
    });
  });
});
```
