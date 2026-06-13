<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T057 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":897,"completion_tokens":5499,"total_tokens":6396,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4182,"image_tokens":0},"cache_creation_input_tokens":0} | 107s
 generated: 2026-06-13T11:06:42.515Z -->
```typescript
import { Request, Response } from 'express';
import router from '../src/routes/api/mdesModels';
import { mdesModelCache } from '../src/services/mdesModelCache';

jest.mock('../src/services/mdesModelCache', () => ({
  mdesModelCache: {
    getModels: jest.fn(),
    getModel: jest.fn(),
    getBestModelForTask: jest.fn(),
  },
}));

const mockedCache = mdesModelCache as jest.Mocked<typeof mdesModelCache>;

const createMockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
};

const createMockReq = (params: Record<string, string> = {}) => {
  return { params } as unknown as Request;
};

const getHandler = (path: string, method: string = 'get') => {
  const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route?.methods[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
};

describe('mdesModels Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /models', () => {
    const handler = getHandler('/models');

    test('returns all models on success', async () => {
      const models = [{ id: '1', name: 'model1' }];
      mockedCache.getModels.mockResolvedValue(models as any);
      
      const req = createMockReq();
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({ success: true, data: models });
    });

    test('returns 500 on error with message', async () => {
      mockedCache.getModels.mockRejectedValue(new Error('DB fail'));
      
      const req = createMockReq();
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB fail' });
    });
    
    test('returns 500 with default message if error is not an Error instance', async () => {
      mockedCache.getModels.mockRejectedValue('string error');
      
      const req = createMockReq();
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'ไม่สามารถดึงรายการ model ได้' });
    });
  });

  describe('GET /models/:name', () => {
    const handler = getHandler('/models/:name');

    test('returns a specific model on success', async () => {
      const model = { id: '1', name: 'model1' };
      mockedCache.getModel.mockResolvedValue(model as any);
      
      const req = createMockReq({ name: 'model1' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(mockedCache.getModel).toHaveBeenCalledWith('model1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: model });
    });

    test('returns 404 if model is not found', async () => {
      mockedCache.getModel.mockResolvedValue(null as any);
      
      const req = createMockReq({ name: 'missing' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'ไม่พบ model: missing' });
    });

    test('returns 500 on error', async () => {
      mockedCache.getModel.mockRejectedValue(new Error('Fail'));
      
      const req = createMockReq({ name: 'model1' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Fail' });
    });
  });

  describe('GET /best/:task', () => {
    const handler = getHandler('/best/:task');

    test('returns best model for valid task', async () => {
      const model = { id: '1', name: 'thai-model' };
      mockedCache.getBestModelForTask.mockResolvedValue(model as any);
      
      const req = createMockReq({ task: 'thai' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(mockedCache.getBestModelForTask).toHaveBeenCalledWith('thai');
      expect(res.json).toHaveBeenCalledWith({ success: true, model });
    });

    test('returns 400 for invalid task', async () => {
      const req = createMockReq({ task: 'invalid' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'task ต้องเป็น: thai, code, reasoning, fast' });
      expect(mockedCache.getBestModelForTask).not.toHaveBeenCalled();
    });

    test('returns 500 on error', async () => {
      mockedCache.getBestModelForTask.mockRejectedValue(new Error('Cache error'));
      
      const req = createMockReq({ task: 'code' });
      const res = createMockRes();
      
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cache error' });
    });
  });
});
```
