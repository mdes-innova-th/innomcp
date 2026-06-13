<!-- cc-team deliverable
 group: G5 (Generate jest unit tests for untested innomcp-node modules (batch 5))
 member: E020 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1265,"completion_tokens":6331,"total_tokens":7596,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5398,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T11:15:33.278Z -->
```typescript
import express from 'express';
import request from 'supertest';
import orchestratorRouter from '../src/routes/api/orchestrator';

// Mock the MultiAgentOrchestrator dependency
const mockCreateTask = jest.fn();
const mockExecuteCycle = jest.fn();
const mockGetTask = jest.fn();
const mockListTasks = jest.fn();

jest.mock('../src/agents/orchestrator', () => ({
  MultiAgentOrchestrator: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
    executeCycle: mockExecuteCycle,
    getTask: mockGetTask,
    listTasks: mockListTasks,
  })),
}));

describe('orchestratorRouter', () => {
  // App with JSON body parser (normal operation)
  const app = express();
  app.use(express.json());
  app.use(orchestratorRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /tasks', () => {
    test('returns 500 when JSON body parser is missing and body is undefined', async () => {
      const appNoParser = express();
      appNoParser.use(orchestratorRouter);

      const response = await request(appNoParser)
        .post('/tasks')
        .send({ description: 'anything' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal orchestrator error' });
    });

    test('returns 400 when description is missing', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ priority: 'high' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'description is required' });
    });

    test('returns 400 when description is empty string', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ description: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'description is required' });
    });

    test('returns 400 when description is whitespace only', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ description: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'description is required' });
    });

    test('returns 400 when description is not a string (number)', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ description: 123 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'description is required' });
    });

    test('returns 500 if createTask rejects', async () => {
      mockCreateTask.mockRejectedValue(new Error('DB failure'));

      const response = await request(app)
        .post('/tasks')
        .send({ description: 'valid task' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal orchestrator error' });
      expect(mockCreateTask).toHaveBeenCalledWith('valid task', 'medium');
    });
  });

  describe('GET /tasks/:taskId', () => {
    test('returns 404 when task is not found', async () => {
      mockGetTask.mockReturnValue(undefined);

      const response = await request(app).get('/tasks/missing-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Task not found' });
    });

    test('returns 500 when getTask throws', async () => {
      mockGetTask.mockImplementation(() => {
        throw new Error('storage corruption');
      });

      const response = await request(app).get('/tasks/bad-id');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal orchestrator error' });
    });
  });

  describe('GET /tasks', () => {
    test('returns 500 when listTasks throws', async () => {
      mockListTasks.mockImplementation(() => {
        throw new Error('list failed');
      });

      const response = await request(app).get('/tasks');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal orchestrator error' });
    });
  });
});
```
