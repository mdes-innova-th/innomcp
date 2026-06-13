<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-013 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1533,"completion_tokens":7754,"total_tokens":9287,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7265,"image_tokens":0},"cache_creation_input_tokens":0} | 94s
 generated: 2026-06-13T11:38:13.814Z -->
FILE: innomcp-node/src/services/notificationService.ts
<<<<<<< SEARCH
class NotificationService {
=======
interface SessionNotificationSubscription {
  subscribe(callback: (n: Notification) => void): () => void;
  getRecentNotifications(limit?: number): Notification[];
}

class NotificationService {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/notificationService.ts
<<<<<<< SEARCH
  /**
   * Subscribe to notifications for a session.
   * Returns an unsubscribe function.
   */
  subscribe(sessionId: string, callback: (n: Notification) => void): () => void {
    this.listeners.set(sessionId, callback);
    return () => {
      if (this.listeners.get(sessionId) === callback) {
        this.listeners.delete(sessionId);
      }
    };
  }
=======
  /**
   * Obtain a notification handle for a given session. The caller must have
   * already verified authorization to access this session. Returns an object
   * with subscribe and history retrieval scoped to this session.
   */
  getSessionSubscription(sessionId: string): SessionNotificationSubscription {
    return {
      subscribe: (callback: (n: Notification) => void): (() => void) => {
        this.listeners.set(sessionId, callback);
        return () => {
          if (this.listeners.get(sessionId) === callback) {
            this.listeners.delete(sessionId);
          }
        };
      },
      getRecentNotifications: (limit = 50): Notification[] => {
        return this.history
          .filter(n => n.sessionId === sessionId)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      }
    };
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/notificationService.ts
<<<<<<< SEARCH
  /**
   * Retrieve recent notifications for a session, most recent first.
   */
  getRecentNotifications(sessionId: string, limit = 50): Notification[] {
    return this.history
      .filter(n => n.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
=======
>>>>>>> REPLACE
