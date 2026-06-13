<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S029 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":266,"completion_tokens":5200,"total_tokens":5466,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3637,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:28:21.160Z -->
```typescript
import {
  WebhookEvent,
  Webhook,
  listWebhooks,
  getWebhook,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  fireWebhookById,
  fireWebhook,
} from '../src/services/webhookService';

// Mock external network dependency for firing webhooks
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('webhookService Contract Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Assuming the module might have internal state, we try to clean up created webhooks
    // In a real scenario, if a reset function existed, we'd call it here.
    const webhooks = listWebhooks();
    webhooks.forEach((w) => deleteWebhook(w.id));
  });

  describe('createWebhook', () => {
    it('should create a webhook and return it with a generated id and enabled status', () => {
      const url = 'https://example.com/hook';
      const events: WebhookEvent[] = ['message.created', 'user.updated'];
      const userId = 'user_123';

      const webhook = createWebhook(url, events, userId);

      expect(webhook).toBeDefined();
      expect(typeof webhook.id).toBe('string');
      expect(webhook.id.length).toBeGreaterThan(0);
      expect(webhook.url).toBe(url);
      expect(webhook.events).toEqual(events);
      expect(webhook.userId).toBe(userId);
      // Contract: newly created webhooks are typically enabled by default
      expect(webhook.enabled).toBe(true);
    });

    it('should throw an error when creating a webhook with invalid inputs', () => {
      // Contract: empty url is invalid
      expect(() => createWebhook('', ['message.created'])).toThrow();
      // Contract: empty events array is invalid
      expect(() => createWebhook('https://valid.url', [])).toThrow();
    });
  });

  describe('listWebhooks', () => {
    it('should return an empty array when no webhooks exist', () => {
      const webhooks = listWebhooks();
      expect(webhooks).toEqual([]);
    });

    it('should return all created webhooks when no userId is provided', () => {
      createWebhook('https://a.com', ['message.created'], 'user1');
      createWebhook('https://b.com', ['user.updated'], 'user2');

      const webhooks = listWebhooks();
      expect(webhooks.length).toBe(2);
      expect(webhooks.map((w) => w.url)).toEqual(expect.arrayContaining(['https://a.com', 'https://b.com']));
    });

    it('should filter webhooks by userId when provided', () => {
      createWebhook('https://a.com', ['message.created'], 'user1');
      createWebhook('https://b.com', ['user.updated'], 'user2');
      createWebhook('https://c.com', ['message.deleted'], 'user1');

      const user1Webhooks = listWebhooks('user1');
      expect(user1Webhooks.length).toBe(2);
      expect(user1Webhooks.every((w) => w.userId === 'user1')).toBe(true);
    });
  });

  describe('getWebhook', () => {
    it('should return the webhook if it exists', () => {
      const created = createWebhook('https://get.com', ['message.created'], 'user1');
      const fetched = getWebhook(created.id);
      expect(fetched).toEqual(created);
    });

    it('should return undefined if the webhook does not exist', () => {
      const fetched = getWebhook('non_existent_id');
      expect(fetched).toBeUndefined();
    });
  });

  describe('deleteWebhook', () => {
    it('should return true and remove the webhook from the state', () => {
      const created = createWebhook('https://delete.com', ['message.created'], 'user1');
      const result = deleteWebhook(created.id);
      
      expect(result).toBe(true);
      expect(getWebhook(created.id)).toBeUndefined();
    });

    it('should return false if the webhook does not exist', () => {
      const result = deleteWebhook('non_existent_id');
      expect(result).toBe(false);
    });
  });

  describe('toggleWebhook', () => {
    it('should toggle the enabled state and return the updated webhook', () => {
      const created = createWebhook('https://toggle.com', ['message.created'], 'user1');
      expect(created.enabled).toBe(true);

      const toggledOff = toggleWebhook(created.id, false);
      expect(toggledOff).not.toBeNull();
      expect(toggledOff!.enabled).toBe(false);

      // Verify state mutation persisted
      expect(getWebhook(created.id)!.enabled).toBe(false);
    });

    it('should return null if the webhook does not exist', () => {
      const result = toggleWebhook('non_existent_id', true);
      expect(result).toBeNull();
    });
  });

  describe('fireWebhookById', () => {
    it('should resolve successfully and trigger an HTTP POST to the webhook URL', async () => {
      const created = createWebhook('https://fire.com', ['message.created'], 'user1');
      const payload = { text: 'Hello World' };

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await expect(fireWebhookById(created.id, payload)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        created.url,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('should reject with an error if the webhook ID does not exist', async () => {
      await expect(fireWebhookById('non_existent_id', {})).rejects.toThrow();
    });

    it('should reject if the network request fails', async () => {
      const created = createWebhook('https://fire-fail.com', ['message.created'], 'user1');
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(fireWebhookById(created.id, {})).rejects.toThrow('Network Error');
    });
  });

  describe('fireWebhook', () => {
    it('should resolve successfully and trigger an HTTP POST to the webhook URL', async () => {
      const created = createWebhook('https://fire-obj.com', ['message.created'], 'user1');
      const payload = { event: 'test' };

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await expect(fireWebhook(created, payload)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        created.url,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('should reject if the network request fails', async () => {
      const created = createWebhook('https://fire-obj-fail.com', ['message.created'], 'user1');
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      await expect(fireWebhook(created, {})).rejects.toThrow('Timeout');
    });
  });
});
```
