/**
 * Notification System Interface Definitions
 * @module core/notifications
 */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  timestamp: string;
  read: boolean;
  source?: string;
  action?: NotificationAction;
}

export interface NotificationAction {
  label: string;
  handler: () => void;
}

export interface NotificationOptions {
  level?: NotificationLevel;
  source?: string;
  action?: NotificationAction;
  ttl?: number;
}

export interface INotificationManager {
  notify(title: string, message: string, options?: NotificationOptions): Notification;
  getAll(): Notification[];
  getUnread(): Notification[];
  markRead(id: string): boolean;
  markAllRead(): void;
  dismiss(id: string): boolean;
  clear(): void;
  onNotification(handler: NotificationHandler): () => void;
  getUnreadCount(): number;
}

export type NotificationHandler = (notification: Notification) => void;
