import { NotificationManager } from '@/core/notifications';

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should create notifications', () => {
    const n = manager.notify('Test', 'Test message');
    expect(n.id).toBeDefined();
    expect(n.title).toBe('Test');
    expect(n.message).toBe('Test message');
    expect(n.level).toBe('info');
    expect(n.read).toBe(false);
  });

  it('should set notification level', () => {
    const n = manager.notify('Error', 'Something broke', { level: 'error' });
    expect(n.level).toBe('error');
  });

  it('should get all notifications', () => {
    manager.notify('A', 'a');
    manager.notify('B', 'b');
    expect(manager.getAll()).toHaveLength(2);
  });

  it('should return notifications newest first', () => {
    manager.notify('First', 'first');
    manager.notify('Second', 'second');
    const all = manager.getAll();
    expect(all[0].title).toBe('Second');
    expect(all[1].title).toBe('First');
  });

  it('should get unread notifications', () => {
    const n = manager.notify('A', 'a');
    manager.notify('B', 'b');
    manager.markRead(n.id);
    expect(manager.getUnread()).toHaveLength(1);
    expect(manager.getUnreadCount()).toBe(1);
  });

  it('should mark all read', () => {
    manager.notify('A', 'a');
    manager.notify('B', 'b');
    manager.markAllRead();
    expect(manager.getUnreadCount()).toBe(0);
  });

  it('should dismiss notifications', () => {
    const n = manager.notify('A', 'a');
    expect(manager.dismiss(n.id)).toBe(true);
    expect(manager.getAll()).toHaveLength(0);
    expect(manager.dismiss('nonexistent')).toBe(false);
  });

  it('should clear all notifications', () => {
    manager.notify('A', 'a');
    manager.notify('B', 'b');
    manager.clear();
    expect(manager.getAll()).toHaveLength(0);
  });

  it('should enforce max notifications', () => {
    const small = new NotificationManager({ maxNotifications: 3 });
    small.notify('1', '1');
    small.notify('2', '2');
    small.notify('3', '3');
    small.notify('4', '4');
    expect(small.getAll()).toHaveLength(3);
    expect(small.getAll()[0].title).toBe('4');
    small.destroy();
  });

  it('should call notification handlers', () => {
    const received: string[] = [];
    const unsub = manager.onNotification((n) => received.push(n.title));

    manager.notify('Hello', 'msg');
    expect(received).toEqual(['Hello']);

    unsub();
    manager.notify('Ignored', 'msg');
    expect(received).toEqual(['Hello']);
  });

  it('should isolate handler errors', () => {
    manager.onNotification(() => { throw new Error('boom'); });
    expect(() => manager.notify('Test', 'msg')).not.toThrow();
  });

  it('should auto-dismiss with TTL', () => {
    jest.useFakeTimers();
    manager.notify('Temp', 'msg', { ttl: 5000 });
    expect(manager.getAll()).toHaveLength(1);

    jest.advanceTimersByTime(5000);
    expect(manager.getAll()).toHaveLength(0);
    jest.useRealTimers();
  });

  it('should set source on notifications', () => {
    const n = manager.notify('Test', 'msg', { source: 'orchestrator' });
    expect(n.source).toBe('orchestrator');
  });

  it('should return false for marking nonexistent as read', () => {
    expect(manager.markRead('nonexistent')).toBe(false);
  });
});
