<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T084 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":635,"completion_tokens":3532,"total_tokens":4167,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2932,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T11:09:06.515Z -->
```typescript
import express from 'express';
import request from 'supertest';
import { router } from '../src/routes/artifacts';
import { artifactService } from '../services/artifactService';

jest.mock('../services/artifactService', () => ({
  artifactService: {
    listArtifacts: jest.fn(),
    getArtifact: jest.fn(),
  },
}));

const mockedArtifactService = artifactService as jest.Mocked<typeof artifactService>;

describe('artifacts router', () => {
  const app = express();
  app.use(router);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /tasks/:taskId/artifacts', () => {
    test('should return a list of artifacts for a given task', async () => {
      const mockArtifacts = [{ id: '1', name: 'artifact1.txt' }];
      mockedArtifactService.listArtifacts.mockResolvedValue(mockArtifacts);

      const res = await request(app).get('/tasks/task123/artifacts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockArtifacts);
      expect(mockedArtifactService.listArtifacts).toHaveBeenCalledWith('task123');
    });

    test('should handle errors from artifactService.listArtifacts', async () => {
      mockedArtifactService.listArtifacts.mockRejectedValue(new Error('DB Error'));

      const res = await request(app).get('/tasks/task123/artifacts');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'DB Error' });
    });
  });

  describe('GET /tasks/:taskId/artifacts/:name', () => {
    test('should return 404 if artifact is not found', async () => {
      mockedArtifactService.getArtifact.mockResolvedValue(null);

      const res = await request(app).get('/tasks/task123/artifacts/missing.txt');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Artifact not found' });
      expect(mockedArtifactService.getArtifact).toHaveBeenCalledWith('task123', 'missing.txt');
    });

    test('should download the artifact as an attachment', async () => {
      const mockBuffer = Buffer.from('test data');
      const mockArtifact = {
        buffer: mockBuffer,
        mimeType: 'text/plain',
        name: 'test.txt',
      };
      mockedArtifactService.getArtifact.mockResolvedValue(mockArtifact);

      const res = await request(app).get('/tasks/task123/artifacts/test.txt');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="test.txt"');
      expect(res.text).toBe('test data');
      expect(mockedArtifactService.getArtifact).toHaveBeenCalledWith('task123', 'test.txt');
    });

    test('should default mimeType to application/octet-stream if not provided', async () => {
      const mockBuffer = Buffer.from('binary data');
      const mockArtifact = {
        buffer: mockBuffer,
        mimeType: undefined as string | undefined,
        name: 'test.bin',
      };
      mockedArtifactService.getArtifact.mockResolvedValue(mockArtifact);

      const res = await request(app).get('/tasks/task123/artifacts/test.bin');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toBe('attachment; filename="test.bin"');
    });

    test('should handle errors from artifactService.getArtifact', async () => {
      mockedArtifactService.getArtifact.mockRejectedValue(new Error('Fetch Error'));

      const res = await request(app).get('/tasks/task123/artifacts/error.txt');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Fetch Error' });
    });
  });
});
```
