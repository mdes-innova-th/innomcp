<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S007 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":210,"completion_tokens":3573,"total_tokens":3783,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":518,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T11:21:41.834Z -->
```typescript
import { analyzeData, AnalysisResult, ColumnStats } from '../src/services/dataAnalysisTool';

describe('dataAnalysisTool — analyzeData contract tests', () => {
  describe('valid inputs — basic structure', () => {
    it('returns an AnalysisResult with correct rowCount and columnCount', async () => {
      const data = [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
        { id: 3, name: 'Charlie', active: true },
      ];

      const result: AnalysisResult = await analyzeData(data);

      expect(result).toBeDefined();
      expect(result.rowCount).toBe(3);
      expect(result.columnCount).toBe(3);
      expect(Array.isArray(result.columns)).toBe(true);
      expect(result.columns).toHaveLength(3);
    });

    it('returns column stats with correct names matching input keys', async () => {
      const data = [
        { age: 25, city: 'NYC' },
        { age: 30, city: 'LA' },
      ];

      const result = await analyzeData(data);
      const columnNames = result.columns.map((c: ColumnStats) => c.name).sort();

      expect(columnNames).toEqual(['age', 'city']);
    });

    it('handles an empty dataset gracefully', async () => {
      const result = await analyzeData([]);

      expect(result.rowCount).toBe(0);
      expect(result.columnCount).toBe(0);
      expect(result.columns).toEqual([]);
    });

    it('handles a single-row dataset', async () => {
      const data = [{ value: 42, label: 'only' }];

      const result = await analyzeData(data);

      expect(result.rowCount).toBe(1);
      expect(result.columnCount).toBe(2);
    });
  });

  describe('numeric column statistics', () => {
    it('computes correct count, min, max, mean for numeric columns', async () => {
      const data = [
        { score: 10 },
        { score: 20 },
        { score: 30 },
        { score: 40 },
        { score: 50 },
      ];

      const result = await analyzeData(data);
      const scoreCol = result.columns.find((c: ColumnStats) => c.name === 'score');

      expect(scoreCol).toBeDefined();
      expect(scoreCol!.count).toBe(5);
      expect(scoreCol!.min).toBe(10);
      expect(scoreCol!.max).toBe(50);
      expect(scoreCol!.mean).toBe(30);
    });

    it('computes median correctly for odd-length numeric columns', async () => {
      const data = [{ v: 3 }, { v: 1 }, { v: 2 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.median).toBe(2);
    });

    it('computes median correctly for even-length numeric columns', async () => {
      const data = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.median).toBe(2.5);
    });

    it('computes stdDev for numeric columns', async () => {
      const data = [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.stdDev).toBeDefined();
      expect(typeof col!.stdDev).toBe('number');
      // Population stdDev of [2,4,4,4,5,5,7,9] = 2.0
      expect(col!.stdDev).toBeCloseTo(2.0, 1);
    });

    it('handles a single numeric value (stdDev = 0)', async () => {
      const data = [{ v: 99 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.min).toBe(99);
      expect(col!.max).toBe(99);
      expect(col!.mean).toBe(99);
      expect(col!.stdDev).toBe(0);
    });
  });

  describe('string column statistics', () => {
    it('computes uniqueCount for string columns', async () => {
      const data = [
        { color: 'red' },
        { color: 'blue' },
        { color: 'red' },
        { color: 'green' },
        { color: 'blue' },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'color');

      expect(col).toBeDefined();
      expect(col!.uniqueCount).toBe(3);
      expect(col!.count).toBe(5);
    });

    it('computes min and max alphabetically for string columns', async () => {
      const data = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'name');

      expect(col).toBeDefined();
      expect(col!.min).toBe('Alice');
      expect(col!.max).toBe('Charlie');
    });
  });

  describe('null and undefined handling', () => {
    it('counts null values in nullCount', async () => {
      const data = [
        { value: 10 },
        { value: null },
        { value: 30 },
        { value: null },
        { value: 50 },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'value');

      expect(col).toBeDefined();
      expect(col!.nullCount).toBe(2);
      expect(col!.count).toBe(3); // non-null count
    });

    it('counts undefined values in nullCount', async () => {
      const data = [
        { value: 10 },
        { value: undefined },
        { value: 30 },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'value');

      expect(col).toBeDefined();
      expect(col!.nullCount).toBe(1);
    });

    it('handles a column that is entirely null', async () => {
      const data = [
        { empty: null },
        { empty: null },
        { empty: null },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'empty');

      expect(col).toBeDefined();
      expect(col!.nullCount).toBe(3);
      expect(col!.count).toBe(0);
      expect(col!.uniqueCount).toBe(0);
    });

    it('excludes nulls from numeric statistics (min, max, mean)', async () => {
      const data = [
        { v: 10 },
        { v: null },
        { v: 30 },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.min).toBe(10);
      expect(col!.max).toBe(30);
      expect(col!.mean).toBe(20);
    });
  });

  describe('boolean column statistics', () => {
    it('computes count and uniqueCount for boolean columns', async () => {
      const data = [
        { active: true },
        { active: false },
        { active: true },
        { active: true },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'active');

      expect(col).toBeDefined();
      expect(col!.count).toBe(4);
      expect(col!.uniqueCount).toBe(2);
    });
  });

  describe('mixed-type and edge-case datasets', () => {
    it('handles rows with inconsistent keys (sparse data)', async () => {
      const data = [
        { a: 1, b: 'x' },
        { a: 2, c: true },
        { b: 'y', c: false },
      ];

      const result = await analyzeData(data);

      expect(result.rowCount).toBe(3);
      expect(result.columnCount).toBeGreaterThanOrEqual(2);
      // All discovered keys should appear
      const names = result.columns.map((c: ColumnStats) => c.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
    });

    it('handles numeric values including zero and negatives', async () => {
      const data = [
        { v: -100 },
        { v: 0 },
        { v: 100 },
      ];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.min).toBe(-100);
      expect(col!.max).toBe(100);
      expect(col!.mean).toBe(0);
    });

    it('handles very large datasets without throwing', async () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({ index: i, label: `item-${i % 50}` }));

      const result = await analyzeData(data);

      expect(result.rowCount).toBe(10000);
      expect(result.columnCount).toBe(2);
      const indexCol = result.columns.find((c: ColumnStats) => c.name === 'index');
      expect(indexCol!.min).toBe(0);
      expect(indexCol!.max).toBe(9999);
    });
  });

  describe('invalid inputs — error contracts', () => {
    it('throws when called with null', async () => {
      await expect(analyzeData(null as any)).rejects.toThrow();
    });

    it('throws when called with undefined', async () => {
      await expect(analyzeData(undefined as any)).rejects.toThrow();
    });

    it('throws when called with a non-array value', async () => {
      await expect(analyzeData('not-an-array' as any)).rejects.toThrow();
    });

    it('throws when called with a number', async () => {
      await expect(analyzeData(42 as any)).rejects.toThrow();
    });

    it('throws when called with a plain object instead of array', async () => {
      await expect(analyzeData({ a: 1 } as any)).rejects.toThrow();
    });
  });

  describe('return type contract', () => {
    it('returns a Promise', () => {
      const result = analyzeData([{ x: 1 }]);
      expect(result).toBeInstanceOf(Promise);
    });

    it('every column stat has required fields', async () => {
      const data = [
        { num: 1, str: 'a', bool: true },
        { num: 2, str: 'b', bool: false },
      ];

      const result = await analyzeData(data);

      for (const col of result.columns) {
        expect(col).toHaveProperty('name');
        expect(typeof col.name).toBe('string');
        expect(col).toHaveProperty('count');
        expect(typeof col.count).toBe('number');
        expect(col).toHaveProperty('nullCount');
        expect(typeof col.nullCount).toBe('number');
        expect(col).toHaveProperty('uniqueCount');
        expect(typeof col.uniqueCount).toBe('number');
      }
    });

    it('rowCount equals the length of the input array', async () => {
      const data = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }];
      const result = await analyzeData(data);
      expect(result.rowCount).toBe(data.length);
    });

    it('columnCount equals the number of unique keys across all rows', async () => {
      const data = [
        { x: 1, y: 2 },
        { x: 3, y: 4, z: 5 },
      ];
      const result = await analyzeData(data);
      expect(result.columnCount).toBe(3); // x, y, z
    });
  });
});
```
