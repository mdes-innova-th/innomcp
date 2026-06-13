<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T054 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":715,"completion_tokens":5453,"total_tokens":6168,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4898,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:02:53.363Z -->
```typescript
import router from '../src/routes/api/debug';

const mockPost = jest.fn();
jest.mock('express', () => ({
  Router: () => ({
    post: mockPost,
  })
}));

const mockDetectEmotion = jest.fn();
jest.mock('../../utils/emotionDetector', () => ({
  detectEmotion: mockDetectEmotion
}));

const mockRoute = jest.fn();
jest.mock('../../utils/mcp/godTierRouter', () => ({
  getGodTierRouter: () => ({
    route: mockRoute
  })
}));

const mockError = jest.fn();
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: mockError }
}));

describe('debug router', () => {
  let handler: any;
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

    handler = mockPost.mock.calls[0][1];
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockDetectEmotion.mockReset();
    mockRoute.mockReset();
    mockError.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('POST /selection - missing text', async () => {
    req.body = {};
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Text is required' });
  });

  test('POST /selection - success with default history', async () => {
    req.body = { text: 'hello' };
    mockDetectEmotion.mockReturnValue('happy');
    mockRoute.mockResolvedValue({
      category: 'greeting',
      confidence: 0.9,
      reasoning: 'test',
      isAmbiguous: false,
      matchedKeywords: [],
      keywordScore: 0.5,
      semanticScore: 0.8
    });

    await handler(req, res);

    expect(mockDetectEmotion).toHaveBeenCalledWith('hello');
    expect(mockRoute).toHaveBeenCalledWith('hello', []);
    expect(res.json).toHaveBeenCalledWith({
      input: 'hello',
      emotion: 'happy',
      router: {
        category: 'greeting',
        confidence: 0.9,
        reasoning: 'test',
        isAmbiguous: false,
        matchedKeywords: [],
        keywordScore: 0.5,
        semanticScore: 0.8,
        latencyMs: 0
      },
      timestamp: '2023-01-01T00:00:00.000Z'
    });
  });

  test('POST /selection - success with provided history', async () => {
    req.body = { text: 'hello', history: ['hi'] };
    mockDetectEmotion.mockReturnValue('neutral');
    mockRoute.mockResolvedValue({
      category: 'chat',
      confidence: 0.8,
      reasoning: 'test2',
      isAmbiguous: true,
      matchedKeywords: ['hi'],
      keywordScore: 0.6,
      semanticScore: 0.7
    });

    await handler(req, res);

    expect(mockRoute).toHaveBeenCalledWith('hello', ['hi']);
  });

  test('POST /selection - error handling', async () => {
    req.body = { text: 'error' };
    const error = new Error('Emotion failed');
    mockDetectEmotion.mockImplementation(() => { throw error; });

    await handler(req, res);

    expect(mockError).toHaveBeenCalledWith('Debug selection error: Emotion failed');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Emotion failed', stack: expect.any(String) });
  });
});
```
