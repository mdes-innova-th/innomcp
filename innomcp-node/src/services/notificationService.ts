type NotificationType = 'task_complete' | 'agent_done' | 'error' | 'system' | 'mdes_alert';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  sessionId?: string;
  broadcast?: boolean;
  timestamp: number;
  data?: unknown;
}

class NotificationService {
  private static readonly MAX_HISTORY = 1000;
  private listeners = new Map<string, (n: Notification) => void>();
  private history: Notification[] = [];

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

  /**
   * Send a notification to a specific session.
   */
  notify(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    this.addToHistory(fullNotification);
    const callback = this.listeners.get(notification.sessionId!);
    if (callback) {
      callback(fullNotification);
    }
  }

  /**
   * Broadcast a notification to all connected sessions.
   */
  broadcast(notification: Omit<Notification, 'id' | 'timestamp' | 'sessionId'>): void {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      broadcast: true,
    };
    this.addToHistory(fullNotification);
    for (const [, callback] of this.listeners) {
      try {
        callback(fullNotification);
      } catch (err) {
        console.error('Notification listener error:', err);
      }
    }
  }

  /**
   * Convenience: task completion notification.
   */
  notifyTaskComplete(sessionId: string, taskSummary: string): void {
    this.notify({
      type: 'task_complete',
      title: 'งานเสร็จสมบูรณ์',
      message: taskSummary,
      sessionId,
    });
  }

  /**
   * Convenience: MDES system alert (broadcast to all sessions).
   */
  notifyMDESAlert(message: string): void {
    this.broadcast({
      type: 'mdes_alert',
      title: 'การแจ้งเตือนจาก MDES',
      message,
    });
  }

  /**
   * Convenience: agent task finished notification.
   */
  notifyAgentDone(sessionId: string, agentId: string, model: string, elapsed: number): void {
    this.notify({
      type: 'agent_done',
      title: 'เอเจนต์ทำงานเสร็จสิ้น',
      message: `Agent ${agentId} (${model}) ทำงานเสร็จใน ${elapsed}ms`,
      sessionId,
    });
  }

  /**
   * Retrieve recent notifications for a session, most recent first.
   */
  getRecentNotifications(sessionId: string, limit = 50): Notification[] {
    return this.history
      .filter(n => n.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  private addToHistory(notification: Notification): void {
    this.history.push(notification);
    if (this.history.length > NotificationService.MAX_HISTORY) {
      this.history = this.history.slice(-NotificationService.MAX_HISTORY);
    }
  }
}

export const notificationService = new NotificationService();