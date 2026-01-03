/**
 * Event Bus Implementation
 *
 * A lightweight event bus with support for:
 * - Sync and async event emission
 * - Priority-based handler ordering
 * - Filtering and one-time subscriptions
 * - Pause/resume functionality
 *
 * @module core/events/impl
 */

import type {
  IEvent,
  IAsyncEventBus,
  EventType,
  EventHandler,
  Subscription,
  EventFilter,
  SubscriptionOptions,
  EventMetadata,
} from '../../interfaces/event.interface';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Internal subscription structure
 */
interface InternalSubscription<T extends IEvent = IEvent> {
  id: string;
  eventType: string;
  handler: EventHandler<T>;
  filter?: EventFilter<T>;
  priority: number;
  once: boolean;
  active: boolean;
}

/**
 * Event Bus Implementation
 */
export class EventBus implements IAsyncEventBus {
  private subscriptions = new Map<string, InternalSubscription[]>();
  private paused = false;
  private pendingPromises = new Set<Promise<void>>();
  private disposed = false;

  /**
   * Emit an event synchronously (fire-and-forget)
   */
  emit<T extends IEvent>(event: T): void {
    if (this.paused || this.disposed) return;

    const handlers = this.getHandlers(event.type);
    for (const sub of handlers) {
      if (!sub.active) continue;
      if (sub.filter && !sub.filter(event as unknown as IEvent)) continue;

      try {
        const result = sub.handler(event as unknown as IEvent);
        // Track async handlers but don't wait
        if (result instanceof Promise) {
          this.trackPromise(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }

      if (sub.once) {
        sub.active = false;
      }
    }

    this.cleanupInactive(event.type);
  }

  /**
   * Emit an event asynchronously (wait for all handlers)
   */
  async emitAsync<T extends IEvent>(event: T): Promise<void> {
    if (this.paused || this.disposed) return;

    const handlers = this.getHandlers(event.type);
    const promises: Promise<void>[] = [];

    for (const sub of handlers) {
      if (!sub.active) continue;
      if (sub.filter && !sub.filter(event as unknown as IEvent)) continue;

      try {
        const result = sub.handler(event as unknown as IEvent);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }

      if (sub.once) {
        sub.active = false;
      }
    }

    await Promise.all(promises);
    this.cleanupInactive(event.type);
  }

  /**
   * Emit multiple events
   */
  emitBatch<T extends IEvent>(events: T[]): void {
    for (const event of events) {
      this.emit(event);
    }
  }

  /**
   * Subscribe to an event type
   */
  on<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options: SubscriptionOptions<T> = {}
  ): Subscription {
    return this.subscribe(eventType, handler, { ...options, once: false });
  }

  /**
   * Subscribe to an event type with async handler
   */
  onAsync<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options: SubscriptionOptions<T> = {}
  ): Subscription {
    return this.subscribe(eventType, handler, options);
  }

  /**
   * Subscribe to an event type once
   */
  once<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options: SubscriptionOptions<T> = {}
  ): Subscription {
    return this.subscribe(eventType, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from an event
   */
  off(subscription: Subscription): void {
    const subs = this.subscriptions.get(subscription.eventType);
    if (!subs) return;

    const index = subs.findIndex((s) => s.id === subscription.id);
    if (index !== -1) {
      subs[index].active = false;
    }
  }

  /**
   * Wait for a specific event
   */
  waitFor<T extends IEvent>(
    eventType: EventType<T>,
    timeout?: number,
    filter?: EventFilter<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const subscription = this.once(
        eventType,
        (event) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(event as T);
        },
        { filter: filter as EventFilter<IEvent> }
      );

      if (timeout) {
        timeoutId = setTimeout(() => {
          this.off(subscription);
          reject(new Error(`Timeout waiting for event: ${String(eventType)}`));
        }, timeout);
      }
    });
  }

  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      const type = this.normalizeEventType(eventType);
      this.subscriptions.delete(type);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: EventType): number {
    const type = this.normalizeEventType(eventType);
    const subs = this.subscriptions.get(type);
    return subs?.filter((s) => s.active).length ?? 0;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Check if event type has listeners
   */
  hasListeners(eventType: EventType): boolean {
    return this.listenerCount(eventType) > 0;
  }

  /**
   * Pause event emission
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume event emission
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Check if event bus is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get pending async handlers count
   */
  pendingCount(): number {
    return this.pendingPromises.size;
  }

  /**
   * Wait for all pending handlers to complete
   */
  async flush(): Promise<void> {
    await Promise.all(this.pendingPromises);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disposed = true;
    this.subscriptions.clear();
    this.pendingPromises.clear();
  }

  // === Private Methods ===

  private subscribe<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options: SubscriptionOptions<T>
  ): Subscription {
    const type = this.normalizeEventType(eventType);
    const id = generateId();

    const subscription: InternalSubscription<T> = {
      id,
      eventType: type,
      handler: handler as EventHandler<IEvent>,
      filter: options.filter as EventFilter<IEvent> | undefined,
      priority: options.priority ?? 0,
      once: options.once ?? false,
      active: true,
    };

    const subs = this.subscriptions.get(type) ?? [];
    subs.push(subscription as InternalSubscription);
    // Sort by priority (higher first)
    subs.sort((a, b) => b.priority - a.priority);
    this.subscriptions.set(type, subs);

    return {
      id,
      eventType: type,
      unsubscribe: () => this.off({ id, eventType: type, isActive: false, unsubscribe: () => {} }),
      isActive: true,
    };
  }

  private getHandlers(eventType: string): InternalSubscription[] {
    return this.subscriptions.get(eventType) ?? [];
  }

  private cleanupInactive(eventType: string): void {
    const subs = this.subscriptions.get(eventType);
    if (!subs) return;

    const active = subs.filter((s) => s.active);
    if (active.length === 0) {
      this.subscriptions.delete(eventType);
    } else if (active.length !== subs.length) {
      this.subscriptions.set(eventType, active);
    }
  }

  private normalizeEventType<T extends IEvent>(eventType: EventType<T>): string {
    return typeof eventType === 'string' ? eventType : eventType.name;
  }

  private trackPromise(promise: Promise<void>): void {
    this.pendingPromises.add(promise);
    promise.finally(() => {
      this.pendingPromises.delete(promise);
    });
  }
}

/**
 * Event Factory Implementation
 */
export class EventFactory {
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Create a new event
   */
  create<T>(type: string, payload: T, metadata?: EventMetadata): IEvent<T> {
    return {
      id: generateId(),
      type,
      payload,
      timestamp: new Date(),
      source: this.source,
      metadata,
    };
  }

  /**
   * Create a system event
   */
  createSystemEvent<T>(
    type: string,
    payload: T,
    metadata?: EventMetadata
  ): IEvent<T> {
    return this.create(type, payload, {
      ...metadata,
      system: true,
    });
  }
}

/**
 * Create a new event bus instance
 */
export function createEventBus(): IAsyncEventBus {
  return new EventBus();
}

/**
 * Create a new event factory
 */
export function createEventFactory(source: string): EventFactory {
  return new EventFactory(source);
}
