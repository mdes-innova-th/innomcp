/**
 * Notification System
 * à¸£à¸°à¸šà¸šà¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¹à¸¥à¸°à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸š
 * 
 * Features:
 * - Real-time notifications
 * - Email notifications
 * - Alert management
 * - Notification preferences
 * 
 * @module utils/notifications
 */

import { logBoth } from '../mcpLogger';

/**
 * Notification Type
 */
export type NotificationType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'critical';

/**
 * Notification
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Notification Preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  categories: {
    system: boolean;
    security: boolean;
    updates: boolean;
    queries: boolean;
  };
}

/**
 * Notification Manager
 */
class NotificationManager {
  private notifications: Map<string, Notification[]> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private maxNotificationsPerUser = 100;

  /**
   * Send notification
   */
  sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      userId,
      metadata
    };

    // Get or create user notifications
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }

    const userNotifications = this.notifications.get(userId)!;
    userNotifications.push(notification);

    // Trim if needed
    if (userNotifications.length > this.maxNotificationsPerUser) {
      userNotifications.shift();
    }

    logBoth('info', `[Notification] Sent ${type} to ${userId}: ${title}`);

    // Check preferences and send via other channels
    this.processNotification(userId, notification);

    return notification.id;
  }

  /**
   * Process notification based on preferences
   */
  private processNotification(userId: string, notification: Notification): void {
    const prefs = this.getPreferences(userId);

    // Send email if enabled
    if (prefs.email && notification.type === 'critical') {
      this.sendEmail(userId, notification);
    }

    // Send push if enabled
    if (prefs.push && ['critical', 'warning'].includes(notification.type)) {
      this.sendPush(userId, notification);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private sendEmail(userId: string, notification: Notification): void {
    logBoth('info', `[Email] Sending to ${userId}: ${notification.title}`);
    // TODO: Implement actual email sending
  }

  /**
   * Send push notification (placeholder)
   */
  private sendPush(userId: string, notification: Notification): void {
    logBoth('info', `[Push] Sending to ${userId}: ${notification.title}`);
    // TODO: Implement actual push notification
  }

  /**
   * Get user notifications
   */
  getNotifications(userId: string, unreadOnly: boolean = false): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    
    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  markAsRead(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId);
    if (!notifications) return false;

    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.read = true;
    return true;
  }

  /**
   * Mark all as read
   */
  markAllAsRead(userId: string): number {
    const notifications = this.notifications.get(userId);
    if (!notifications) return 0;

    let count = 0;
    for (const notification of notifications) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }

    return count;
  }

  /**
   * Delete notification
   */
  deleteNotification(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId);
    if (!notifications) return false;

    const index = notifications.findIndex(n => n.id === notificationId);
    if (index === -1) return false;

    notifications.splice(index, 1);
    return true;
  }

  /**
   * Clear all notifications
   */
  clearAll(userId: string): number {
    const notifications = this.notifications.get(userId);
    if (!notifications) return 0;

    const count = notifications.length;
    this.notifications.set(userId, []);
    return count;
  }

  /**
   * Get unread count
   */
  getUnreadCount(userId: string): number {
    const notifications = this.notifications.get(userId) || [];
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Get preferences
   */
  getPreferences(userId: string): NotificationPreferences {
    if (!this.preferences.has(userId)) {
      // Default preferences
      this.preferences.set(userId, {
        email: false,
        push: false,
        inApp: true,
        categories: {
          system: true,
          security: true,
          updates: true,
          queries: false
        }
      });
    }

    return this.preferences.get(userId)!;
  }

  /**
   * Update preferences
   */
  updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): void {
    const current = this.getPreferences(userId);
    this.preferences.set(userId, { ...current, ...prefs });
    logBoth('info', `[Notification] Preferences updated for ${userId}`);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send system alert
   */
  sendSystemAlert(title: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const type: NotificationType = 
      severity === 'critical' ? 'critical' :
      severity === 'high' ? 'error' :
      severity === 'medium' ? 'warning' : 'info';

    // Send to all admins (placeholder - need admin user list)
    logBoth(type === 'critical' ? 'error' : 'warn', `[System Alert] ${title}: ${message}`);
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

/**
 * Helper: Send notification
 */
export function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): string {
  return notificationManager.sendNotification(userId, type, title, message, metadata);
}

/**
 * Helper: Get notifications
 */
export function getNotifications(userId: string, unreadOnly?: boolean): Notification[] {
  return notificationManager.getNotifications(userId, unreadOnly);
}

/**
 * Helper: Get unread count
 */
export function getUnreadCount(userId: string): number {
  return notificationManager.getUnreadCount(userId);
}

/**
 * Helper: Send system alert
 */
export function sendSystemAlert(
  title: string,
  message: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): void {
  notificationManager.sendSystemAlert(title, message, severity);
}
