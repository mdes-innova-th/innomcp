<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T067 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1236,"completion_tokens":5224,"total_tokens":6460,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3817,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T11:05:54.228Z -->
```typescript
import express from 'express';
import request from 'supertest';

/* ------------------------------------------------------------------ */
/*  Mock the MultiAgentOrchestrator class so we control its behaviour */
/* ------------------------------------------------------------------ */
const mockCreateTask = jest.fn();
const mockExecuteCycle = jest.fn().mockResolvedValue(undefined);
const mockGetTask = jest.fn();
const mockListTasks = jest.fn();

jest.mock('../../agents/orchestrator', () => ({
  MultiAgentOrchestrator: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
    executeCycle: mockExecuteCycle,
    getTask: mockGetTask,
    listTasks: mockListTasks,
  })),
}));

import orchestratorRouter from '../src/routes/api/orchestrator';

/* ------------------------------------------------------------------ */
/*   Test suite                                                        */
/* ------------------------------------------------------------------ */
describe('orchestrator router', () => {
  let app: express.Express;

  beforeEach(() => {
    // Reset all mocks before each test
    mockCreateTask.mockReset();
    mockExecuteCycle.mockReset().mockResolvedValue(undefined);
    mockGetTask.mockReset();
    mockListTasks.mockReset();

    // Build a fresh Express app and mount the router
    app = express();
    app.use(express.json());
    app.use('/api/orchestrate', orchestratorRouter);
  });

  /* ============================================================== */
  /*  POST /api/orchestrate/tasks                                    */
  /* ============================================================== */
  describe('POST /api/orchestrate/tasks', () => {
    const validPayload = { description: 'Test task', priority: 'high' };

    test('creates a task, starts execution and returns 202', async () => {
      const task = { id: 'task-123', status: 'pending' };
      mockCreateTask.mockResolvedValue(task);

      const res = await request(app)
        .post('/api/orchestrate/tasks')
        .send(validPayload)
        .expect(202);

      expect(res.body).toEqual({ taskId: task.id, status: task.status });
      expect(mockCreateTask).toHaveBeenCalledWith(
        validPayload.description.trim(),
        validPayload.priority,
      );
      // executeCycle is called async but not awaited – the call itself is synchronous
      expect(mockExecuteCycle).toHaveBeenCalledWith(task.id);
    });

    test('defaults priority to "medium" when not provided', async () => {
      const task = { id: 'task-456', status: 'pending' };
      mockCreateTask.mockResolvedValue(task);

      await request(app)
        .post('/api/orchestrate/tasks')
        .send({ description: 'Only description' })
        .expect(202);

      expect(mockCreateTask).toHaveBeenCalledWith('Only description', 'medium');
    });

    test.each([
      { body: {}, desc: 'missing description' },
      { body: { description: '' }, desc: 'empty description' },
      { body: { description: '   ' }, desc: 'whitespace description' },
      { body: { description: 123 }, desc: 'non-string description' },
    ])('returns 400 when $desc', async ({ body }) => {
      await request(app)
        .post('/api/orchestrate/tasks')
        .send(body)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('description is required');
        });
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    test('returns 500 if orchestrator.createTask throws', async () => {
      mockCreateTask.mockRejectedValue(new Error('Boom'));

      await request(app)
        .post('/api/orchestrate/tasks')
        .send(validPayload)
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Internal orchestrator error');
        });
    });
  });

  /* ============================================================== */
  /*  GET /api/orchestrate/tasks/:taskId                             */
  /* ============================================================== */
  describe('GET /api/orchestrate/tasks/:taskId', () => {
    const taskId = 'task-abc';
    const task = { id: taskId, status: 'completed', result: 'done' };

    test('returns the task when found', async () => {
      mockGetTask.mockReturnValue(task);

      const res = await request(app)
        .get(`/api/orchestrate/tasks/${taskId}`)
        .expect(200);

      expect(res.body).toEqual(task);
      expect(mockGetTask).toHaveBeenCalledWith(taskId);
    });

    test('returns 404 when task is not found', async () => {
      mockGetTask.mockReturnValue(undefined);

      await request(app)
        .get('/api/orchestrate/tasks/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Task not found');
        });
    });

    test('returns 500 if orchestrator.getTask throws', async () => {
      mockGetTask.mockImplementation(() => {
        throw new Error('Fail');
      });

      await request(app)
        .get(`/api/orchestrate/tasks/${taskId}`)
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Internal orchestrator error');
        });
    });
  });

  /* ============================================================== */
  /*  GET /api/orchestrate/tasks                                     */
  /* ============================================================== */
  describe('GET /api/orchestrate/tasks', () => {
    test('returns the full task list', async () => {
      const tasks = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'completed' },
      ];
      mockListTasks.mockReturnValue(tasks);

      const res = await request(app)
        .get('/api/orchestrate/tasks')
        .expect(200);

      expect(res.body).toEqual({ tasks });
      expect(mockListTasks).toHaveBeenCalled();
    });

    test('returns 500 if orchestrator.listTasks throws', async () => {
      mockListTasks.mockImplementation(() => {
        throw new Error('Fail');
      });

      await request(app)
        .get('/api/orchestrate/tasks')
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Internal orchestrator error');
        });
    });
  });
});
```
