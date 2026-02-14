/**
 * ACP Message Bus
 *
 * In-memory message bus for agent communication protocol.
 * Routes messages between agents, frontends, and system components.
 *
 * @module core/protocols
 */

import type {
  IACPMessageBus,
  ACPMessage,
  ACPMessageType,
  ACPHandler,
  ACPFilter,
  ACPSubscription,
} from './interfaces/acp.interface';

/**
 * Internal subscription record
 */
interface SubscriptionRecord {
  id: number;
  filter: ACPFilter;
  handler: ACPHandler;
}

/**
 * ACPMessageBus options
 */
export interface ACPMessageBusOptions {
  /** Default request timeout in ms */
  defaultTimeout?: number;
}

/**
 * In-memory ACP message bus implementation
 */
export class ACPMessageBus implements IACPMessageBus {
  private readonly subscriptions: SubscriptionRecord[] = [];
  private readonly defaultTimeout: number;
  private nextId = 1;

  constructor(options: ACPMessageBusOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 30000;
  }

  async publish(message: ACPMessage): Promise<void> {
    // Deliver to all matching subscribers
    const promises: Promise<void>[] = [];
    for (const sub of this.subscriptions) {
      if (sub.filter(message)) {
        promises.push(
          Promise.resolve(sub.handler(message)).then(() => undefined),
        );
      }
    }
    await Promise.all(promises);
  }

  subscribe(filter: ACPFilter, handler: ACPHandler): ACPSubscription {
    const id = this.nextId++;
    const record: SubscriptionRecord = { id, filter, handler };
    this.subscriptions.push(record);

    return {
      unsubscribe: () => {
        const idx = this.subscriptions.indexOf(record);
        if (idx >= 0) this.subscriptions.splice(idx, 1);
      },
    };
  }

  on(type: ACPMessageType, handler: ACPHandler): ACPSubscription {
    return this.subscribe((msg) => msg.type === type, handler);
  }

  async request<TReq, TRes>(
    message: ACPMessage<TReq>,
    timeout?: number,
  ): Promise<ACPMessage<TRes>> {
    const timeoutMs = timeout ?? this.defaultTimeout;
    const correlationId = message.id;

    return new Promise<ACPMessage<TRes>>((resolve, reject) => {
      const sub = this.subscribe(
        (msg) => msg.correlationId === correlationId && msg.source === message.target,
        async (response) => {
          clearTimeout(timer);
          sub.unsubscribe();
          resolve(response as ACPMessage<TRes>);
        },
      );

      const timer = setTimeout(() => {
        sub.unsubscribe();
        reject(new Error(`ACP request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Publish the request
      this.publish(message).catch((err) => {
        clearTimeout(timer);
        sub.unsubscribe();
        reject(err);
      });
    });
  }

  subscriptionCount(): number {
    return this.subscriptions.length;
  }

  clear(): void {
    this.subscriptions.length = 0;
  }
}

// ── Helpers ────────────────────────────────────────────────

let messageCounter = 0;

/**
 * Create an ACP message with defaults
 */
export function createACPMessage<T>(
  partial: Pick<ACPMessage<T>, 'type' | 'source' | 'target' | 'payload'> &
    Partial<ACPMessage<T>>,
): ACPMessage<T> {
  return {
    id: partial.id ?? `acp-${++messageCounter}-${Date.now()}`,
    priority: partial.priority ?? 'normal',
    timestamp: partial.timestamp ?? new Date().toISOString(),
    ...partial,
  };
}

/**
 * Factory function for creating an ACPMessageBus
 */
export function createACPMessageBus(
  options?: ACPMessageBusOptions,
): ACPMessageBus {
  return new ACPMessageBus(options);
}
