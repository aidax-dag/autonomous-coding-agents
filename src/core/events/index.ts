/**
 * Event System Module
 *
 * Provides a lightweight event bus with support for:
 * - Sync and async event emission
 * - Priority-based handler ordering
 * - Filtering and one-time subscriptions
 * - System events
 *
 * @module core/events
 *
 * @example
 * ```typescript
 * import { createEventBus, SystemEvents } from '@/core/events';
 *
 * const eventBus = createEventBus();
 *
 * // Subscribe to events
 * eventBus.on(SystemEvents.TaskCompleted, (event) => {
 *   console.log(`Task ${event.payload.taskId} completed!`);
 * });
 *
 * // Emit events
 * eventBus.emit({
 *   type: SystemEvents.TaskCompleted,
 *   payload: { taskId: '123', success: true },
 *   timestamp: new Date(),
 *   source: 'agent-1',
 *   id: 'event-456',
 * });
 * ```
 */

// Re-export interfaces from core
export {
  SystemEvents,
  type IEvent,
  type EventMetadata,
  type EventType,
  type EventHandler,
  type Subscription,
  type EventFilter,
  type SubscriptionOptions,
  type IEventPublisher,
  type IEventSubscriber,
  type IEventBus,
  type IAsyncEventBus,
  type SystemEventType,
  type AgentStartedEvent,
  type AgentStoppedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type ContextThresholdEvent,
  type IEventFactory,
} from '../interfaces/event.interface';

// Implementation
export {
  EventBus,
  EventFactory,
  createEventBus,
  createEventFactory,
} from './impl/event-bus.impl';
