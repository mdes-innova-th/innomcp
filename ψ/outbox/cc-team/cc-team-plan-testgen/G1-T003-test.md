<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T003 role=test model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":461,"completion_tokens":3037,"total_tokens":3498,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2924,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T10:50:58.634Z -->
```typescript
import * as artifacts from '../src/utils/artifacts';
import { artifactService } from '../src/services/artifactService';

jest.mock('../src/utils/artifacts');

const mockedArtifacts = jest.mocked(artifacts);

describe('artifactService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('listArtifacts returns artifact names from the utils module', async () => {
    const taskId = 'task-123';
    const names = ['log.txt', 'screenshot.png'];
    mockedArtifacts.listArtifacts.mockResolvedValue(names);

    const result = await artifactService.listArtifacts(taskId);

    expect(result).toEqual(names);
    expect(mockedArtifacts.listArtifacts).toHaveBeenCalledWith(taskId);
    expect(mockedArtifacts.listArtifacts).toHaveBeenCalledTimes(1);
  });

  test('getArtifact transforms raw artifact into router-compatible shape', async () => {
    const taskId = 'task-456';
    const name = 'report.pdf';
    mockedArtifacts.getArtifact.mockResolvedValue({
      name: 'report.pdf',
      mime: 'application/pdf',
      content: 'binary-pretend',
    });

    const result = await artifactService.getArtifact(taskId, name);

    expect(result).toEqual({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('binary-pretend', 'utf-8'),
    });
    expect(mockedArtifacts.getArtifact).toHaveBeenCalledWith(taskId, name);
    expect(mockedArtifacts.getArtifact).toHaveBeenCalledTimes(1);
  });
});
```
