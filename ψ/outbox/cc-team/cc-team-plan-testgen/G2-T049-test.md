<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T049 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":609,"completion_tokens":2841,"total_tokens":3450,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2546,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:01:36.651Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/chat/report';
import { logBoth } from '../src/utils/mcpLogger';

jest.mock('../src/utils/mcpLogger', () => ({
  logBoth: jest.fn(),
}));

describe('POST /report', () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return success on valid report', async () => {
    const response = await request(app)
      .post('/report')
      .send({
        messageIndex: 1,
        messageText: 'This is a bad message',
        reason: 'offensive',
        timestamp: '2023-10-01T00:00:00Z',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Report received' });
    expect(logBoth).toHaveBeenCalledWith('warn', expect.stringContaining('[CHAT REPORT] User reported message at index 1: offensive'));
    expect(logBoth).toHaveBeenCalledWith('warn', expect.stringContaining('[CHAT REPORT] Message content: This is a bad message...'));
  });

  test('should return 500 and log error if messageText is missing', async () => {
    const response = await request(app)
      .post('/report')
      .send({
        messageIndex: 2,
        reason: 'spam',
        timestamp: '2023-10-01T00:00:00Z',
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, error: 'Failed to report message' });
    expect(logBoth).toHaveBeenCalledWith('error', expect.stringContaining('[CHAT REPORT] Error:'));
  });
});
```
