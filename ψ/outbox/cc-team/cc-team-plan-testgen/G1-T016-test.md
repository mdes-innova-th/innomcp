<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T016 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1413,"completion_tokens":4064,"total_tokens":5477,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2586,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-13T10:53:49.800Z -->
```typescript
import { notificationService } from '../src/services/notificationService';

describe('NotificationService', () => {
  let mockCryptoUUID: jest.SpyInstance;
  let mockDateNow: jest.SpyInstance;

  beforeEach(() => {
    // Deterministic timestamps and IDs
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockCryptoUUID = jest.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid');
    // Suppress console.error in broadcast error test
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockDateNow.mockRestore();
    mockCryptoUUID.mockRestore();
    jest.restoreAllMocks();
  });

  describe('subscribe / notify', () => {
    test('calls callback with the full notification', () => {
      const callback = jest.fn();
      const sessionId = 'session-1';
      notificationService.subscribe(sessionId, callback);

      notificationService.notify({
        type: 'task_complete',
        title: 'Test',
        sessionId,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        id: 'fixed-uuid',
        type: 'task_complete',
        title: 'Test',
        sessionId,
        timestamp: 1000,
      });
    });

    test('unsubscribe removes the listener', () => {
      const callback = jest.fn();
      const sessionId = 'session-2';
      const unsubscribe = notificationService.subscribe(sessionId, callback);
      unsubscribe();

      notificationService.notify({ type: 'system', title: 'X', sessionId });
      expect(callback).not.toHaveBeenCalled();
    });

    test('notify does nothing when no listener exists', () => {
      expect(() => {
        notificationService.notify({
          type: 'error',
          title: 'Oops',
          sessionId: 'no-one',
        });
      }).not.toThrow();
    });
  });

  describe('broadcast', () => {
    test('calls all subscribed callbacks', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      notificationService.subscribe('sess-a', cb1);
      notificationService.subscribe('sess-b', cb2);

      notificationService.broadcast({
        type: 'system',
        title: 'Alert',
        message: 'All users',
      });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(
        expect.objectContaining({ broadcast: true, title: 'Alert' })
      );
    });

    test('continues even if one callback throws', () => {
      const throwingCb = jest.fn().mockImplementation(() => { throw new Error('boom'); });
      const normalCb = jest.fn();
      notificationService.subscribe('err-sess', throwingCb);
      notificationService.subscribe('ok-sess', normalCb);

      expect(() => {
        notificationService.broadcast({ type: 'system', title: 'Test' });
      }).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Notification listener error:',
        expect.any(Error)
      );
    });
  });

  describe('convenience helpers', () => {
    test('notifyTaskComplete calls notify with correct shape', () => {
      const callback = jest.fn();
      notificationService.subscribe('sess-task', callback);

      notificationService.notifyTaskComplete('sess-task', 'Task done');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_complete',
          title: 'งานเสร็จสมบูรณ์',
          message: 'Task done',
          sessionId: 'sess-task',
          id: 'fixed-uuid',
          timestamp: 1000,
        })
      );
    });

    test('notifyMDESAlert calls broadcast with correct shape', () => {
      const callback = jest.fn();
      notificationService.subscribe('sess-mdes', callback);

      notificationService.notifyMDESAlert('Alert message');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mdes_alert',
          title: 'การแจ้งเตือนจาก MDES',
          message: 'Alert message',
          broadcast: true,
        })
      );
    });

    test('notifyAgentDone calls notify with correct shape', () => {
      const callback = jest.fn();
      notificationService.subscribe('sess-agent', callback);

      notificationService.notifyAgentDone('sess-agent', 'agent-1', 'gpt-4', 1234);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_done',
          title: 'เอเจนต์ทำงานเสร็จสิ้น',
          message: 'Agent agent-1 (gpt-4) ทำงานเสร็จใน 1234ms',
          sessionId: 'sess-agent',
        })
      );
    });
  });

  describe('getRecentNotifications', () => {
    test('returns notifications for the given session sorted newest first', () => {
      // Simulate three notifications with increasing timestamps
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(300);

      notificationService.notify({ type: 'system', title: 'First', sessionId: 'sess-recent' });
      notificationService.notify({ type: 'system', title: 'Second', sessionId: 'sess-recent' });
      notificationService.notify({ type: 'system', title: 'Third', sessionId: 'other' });

      const result = notificationService.getRecentNotifications('sess-recent', 10);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Second');
      expect(result[1].title).toBe('First');
    });

    test('respects the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        notificationService.notify({
          type: 'system',
          title: `Notif-${i}`,
          sessionId: 'sess-limit',
        });
      }
      const result = notificationService.getRecentNotifications('sess-limit', 3);
      expect(result).toHaveLength(3);
    });

    test('returns empty array for unknown session', () => {
      const result = notificationService.getRecentNotifications('nonexistent');
      expect(result).toEqual([]);
    });
  });
});
```
