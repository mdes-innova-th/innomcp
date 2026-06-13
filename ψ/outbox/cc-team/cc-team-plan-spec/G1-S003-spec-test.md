<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S003 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":215,"completion_tokens":7000,"total_tokens":7215,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7514,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T11:20:11.945Z -->
```typescript
import { artifactService } from '../src/services/artifactService';
import { readdir, readFile } from 'fs/promises';

jest.mock('fs/promises');

const mockedReaddir = jest.mocked(readdir);
const mockedReadFile = jest.mocked(readFile);

describe('artifactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listArtifacts', () => {
    it('resolves to an array of artifact names for a valid taskId', async () => {
      const names = ['build.log', 'output.json', 'model.bin'];
      mockedReaddir.mockResolvedValue(names);

      const result = await artifactService.listArtifacts('task-abc-123');

      expect(result).toEqual(names);
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((n) => typeof n === 'string')).toBe(true);
    });

    it('resolves to an empty array when a task has no artifacts', async () => {
      mockedReaddir.mockResolvedValue([]);

      const result = await artifactService.listArtifacts('task-empty');

      expect(result).toEqual([]);
    });

    it('rejects when taskId is an empty string', async () => {
      await expect(artifactService.listArtifacts('')).rejects.to
