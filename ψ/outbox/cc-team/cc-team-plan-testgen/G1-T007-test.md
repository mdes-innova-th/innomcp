<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T007 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2453,"completion_tokens":4635,"total_tokens":7088,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3784,"image_tokens":0},"cache_creation_input_tokens":0} | 86s
 generated: 2026-06-13T10:52:24.837Z -->
```typescript
import { analyzeData } from '../src/services/dataAnalysisTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

jest.mock('node:fs/promises');

const mockedFs = jest.mocked(fs);

describe('dataAnalysisTool', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    mockedFs.readFile.mockResolvedValue('');
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('analyzes CSV string and generates chart + artifact', async () => {
    const csv = `cat,val\nA,10\nA,20\nB,30`;
    const root = path.resolve('workspace');
    const opts = { workspaceRoot: root };

    const result = await analyzeData(csv, opts);

    expect(result.rowCount).toBe(3);
    expect(result.colCount).toBe(2);
    expect(result.columns).toHaveLength(2);

    const catCol = result.columns.find(c => c.name === 'cat');
    expect(catCol?.type).toBe('string');
    expect(catCol?.topValues).toEqual([{ value: 'A', count: 2 }, { value: 'B', count: 1 }]);

    const valCol = result.columns.find(c => c.name === 'val');
    expect(valCol?.type).toBe('number');
    expect(valCol?.min).toBe(10);
    expect(valCol?.max).toBe(30);
    expect(valCol?.mean).toBe(20);

    expect(result.chartSvg).toBeDefined();
    expect(result.chartSvg).toContain('<svg');

    const expectedDir = path.resolve(root, 'artifacts', 'charts');
    expect(mockedFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });

    const expectedFile = path.join(expectedDir, `chart-${Date.now()}.svg`);
    expect(mockedFs.writeFile).toHaveBeenCalledWith(expectedFile, result.chartSvg, 'utf-8');
    expect(result.artifactPath).toBe(expectedFile);
  });

  test('reads from file path and prevents directory traversal', async () => {
    const csv = `h1\nv1`;
    mockedFs.readFile.mockResolvedValue(csv);
    const root = path.resolve('workspace');

    const validInput = { path: 'data.csv', workspaceRoot: root };
    const validResult = await analyzeData(validInput, { workspaceRoot: root });
    expect(mockedFs.readFile).toHaveBeenCalledWith(path.resolve(root, 'data.csv'), 'utf-8');
    expect(validResult.rowCount).toBe(1);

    const invalidInput = { path: '../secret.csv', workspaceRoot: root };
    await expect(analyzeData(invalidInput, { workspaceRoot: root }))
      .rejects.toThrow('Path outside workspace');
  });

  test('respects maxRows limit', async () => {
    const csv = `val\n1\n2\n3\n4\n5`;
    const result = await analyzeData(csv, { workspaceRoot: '', maxRows: 2 });
    expect(result.rowCount).toBe(2);
  });

  test('handles empty CSV', async () => {
    const result = await analyzeData('', { workspaceRoot: '' });
    expect(result.rowCount).toBe(0);
    expect(result.colCount).toBe(0);
    expect(result.columns).toEqual([]);
    expect(result.chartSvg).toBeUndefined();
    expect(mockedFs.writeFile).not.toHaveBeenCalled();
  });
});
```
