/**
 * Notification Manager
 *
 * Centralized notification hub with in-memory storage, TTL-based auto-dismiss,
 * and subscriber pattern for UI integration.
 *
 * @module core/notifications
 */

import type {
  INotificationManager,
  Notification,
  NotificationOptions,
  NotificationHandler,
} from './interfaces/notification.interface';

let nextId = 0;

export class NotificationManager implements INotificationManager {
  private readonly notifications: Notification[] = [];
  private readonly handlers = new Set<NotificationHandler>();
  private readonly maxNotifications: number;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options?: { maxNotifications?: number }) {
    this.maxNotifications = options?.maxNotifications ?? 100;
  }

  notify(title: string, message: string, options?: NotificationOptions): Notification {
    const notification: Notification = {
      id: `notif-${++nextId}`,
      title,
      message,
      level: options?.level ?? 'info',
      timestamp: new Date().toISOString(),
      read: false,
      source: options?.source,
      action: options?.action,
    };

    this.notifications.unshift(notification);

    if (this.notifications.length > this.maxNotifications) {
      const removed = this.notifications.pop();
      if (removed) this.timers.delete(removed.id);
    }

    if (options?.ttl && options.ttl > 0) {
      const timer = setTimeout(() => this.dismiss(notification.id), options.ttl);
      this.timers.set(notification.id, timer);
    }

    for (const handler of this.handlers) {
      try { handler(notification); } catch { /* subscriber error isolation */ }
    }

    return notification;
  }

  getAll(): Notification[] {
    return [...this.notifications];
  }

  getUnread(): Notification[] {
    return this.notifications.filter((n) => !n.read);
  }

  markRead(id: string): boolean {
    const n = this.notifications.find((n) => n.id === id);
    if (!n) return false;
    n.read = true;
    return true;
  }

  markAllRead(): void {
    for (const n of this.notifications) {
      n.read = true;
    }
  }

  dismiss(id: string): boolean {
    const idx = this.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.notifications.splice(idx, 1);
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    return true;
  }

  clear(): void {
    this.notifications.length = 0;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  destroy(): void {
    this.clear();
    this.handlers.clear();
  }
}

export function createNotificationManager(
  options?: { maxNotifications?: number },
): NotificationManager {
  return new NotificationManager(options);
}
