/**
 * Agent Communication Module
 *
 * Provides inter-agent messaging and coordination with:
 * - Direct agent-to-agent messaging
 * - Topic-based pub/sub
 * - Request/reply patterns
 * - Message routing and filtering
 *
 * SOLID Principles:
 * - S: Single responsibility - message coordination
 * - O: Open for extension via message handlers
 * - L: Uses interfaces for substitution
 * - I: Minimal interface dependencies
 * - D: Depends on abstractions (IMessageBroker)
 *
 * @module core/agents/communication
 */

import type { IMessageBroker } from '../interfaces';
import type { IEventBus, IEvent } from '../../events';

/**
 * Message envelope for agent communication
 */
export interface AgentMessage<T = unknown> {
  /** Unique message ID */
  id: string;
  /** Sender agent ID */
  from: string;
  /** Target agent ID (optional for broadcasts) */
  to?: string;
  /** Message type/action */
  type: string;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp: Date;
  /** Correlation ID for request/reply */
  correlationId?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message routing options
 */
export interface MessageRoutingOptions {
  /** Route to specific agent */
  targetAgent?: string;
  /** Route to all agents of a type */
  targetType?: string;
  /** Broadcast to all agents */
  broadcast?: boolean;
  /** Priority level */
  priority?: number;
  /** Time to live in milliseconds */
  ttl?: number;
}

/**
 * Message filter predicate
 */
export type MessageFilter<T = unknown> = (message: AgentMessage<T>) => boolean;

/**
 * Agent message handler with metadata
 */
export type AgentMessageHandler<T = unknown> = (
  message: AgentMessage<T>
) => Promise<unknown> | unknown;

/**
 * Subscription handle for cleanup
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Communication events
 */
export const COMMUNICATION_EVENTS = {
  MESSAGE_SENT: 'communication.message.sent',
  MESSAGE_RECEIVED: 'communication.message.received',
  MESSAGE_FAILED: 'communication.message.failed',
  SUBSCRIPTION_ADDED: 'communication.subscription.added',
  SUBSCRIPTION_REMOVED: 'communication.subscription.removed',
} as const;

/**
 * Agent Communication options
 */
export interface AgentCommunicationOptions {
  /** Underlying message broker */
  messageBroker: IMessageBroker;
  /** Event bus for communication events */
  eventBus?: IEventBus;
  /** Default message timeout in ms */
  defaultTimeout?: number;
  /** Maximum pending requests */
  maxPendingRequests?: number;
}

/**
 * Pending request tracking
 */
interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Agent Communication Manager
 *
 * Coordinates messaging between agents with support for
 * direct messaging, broadcasts, and request/reply patterns.
 */
export class AgentCommunication {
  private readonly broker: IMessageBroker;
  private readonly eventBus?: IEventBus;
  private readonly defaultTimeout: number;
  private readonly maxPendingRequests: number;

  private readonly subscriptions: Map<string, Set<AgentMessageHandler>> = new Map();
  private readonly pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly messageFilters: Map<string, MessageFilter[]> = new Map();

  constructor(options: AgentCommunicationOptions) {
    this.broker = options.messageBroker;
    this.eventBus = options.eventBus;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.maxPendingRequests = options.maxPendingRequests || 1000;
  }

  /**
   * Send a message to a specific agent
   */
  async sendToAgent<T, R = void>(
    fromAgentId: string,
    toAgentId: string,
    type: string,
    payload: T,
    options?: Partial<MessageRoutingOptions>
  ): Promise<R | void> {
    const message = this.createMessage(fromAgentId, type, payload, {
      targetAgent: toAgentId,
      ...options,
    });

    await this.publishMessage(message);

    if (options?.priority !== undefined && options.priority > 0) {
      // For high priority messages, wait for acknowledgment
      return this.waitForReply<R>(message.id, options.ttl || this.defaultTimeout);
    }
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast<T>(
    fromAgentId: string,
    type: string,
    payload: T,
    options?: Partial<MessageRoutingOptions>
  ): Promise<void> {
    const message = this.createMessage(fromAgentId, type, payload, {
      broadcast: true,
      ...options,
    });

    await this.publishMessage(message);
  }

  /**
   * Send request and wait for reply
   */
  async request<T, R>(
    fromAgentId: string,
    toAgentId: string,
    type: string,
    payload: T,
    timeout?: number
  ): Promise<R> {
    if (this.pendingRequests.size >= this.maxPendingRequests) {
      throw new Error('Maximum pending requests reached');
    }

    const message = this.createMessage(fromAgentId, type, payload, {
      targetAgent: toAgentId,
    });

    // Ensure we're subscribed to receive the reply
    await this.ensureReplySubscription(fromAgentId);

    // Set up reply handler before publishing
    const replyPromise = this.waitForReply<R>(message.id, timeout || this.defaultTimeout);

    await this.publishMessage(message);

    return replyPromise;
  }

  /**
   * Ensure subscription exists to receive replies
   */
  private async ensureReplySubscription(agentId: string): Promise<void> {
    const topic = this.getAgentTopic(agentId);

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      await this.broker.subscribe(topic, (message) =>
        this.handleIncomingMessage(topic, message)
      );
    }
  }

  /**
   * Reply to a received message
   */
  async reply<T>(
    originalMessage: AgentMessage,
    fromAgentId: string,
    payload: T
  ): Promise<void> {
    const replyMessage = this.createMessage(
      fromAgentId,
      `${originalMessage.type}.reply`,
      payload,
      { targetAgent: originalMessage.from }
    );

    replyMessage.correlationId = originalMessage.id;

    await this.publishMessage(replyMessage);
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribe<T = unknown>(
    agentId: string,
    handler: AgentMessageHandler<T>,
    filter?: MessageFilter<T>
  ): Subscription {
    const topic = this.getAgentTopic(agentId);

    // Add to local subscriptions
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());

      // Subscribe to broker
      this.broker.subscribe(topic, (message) =>
        this.handleIncomingMessage(topic, message)
      );
    }

    const handlers = this.subscriptions.get(topic)!;
    handlers.add(handler as AgentMessageHandler);

    // Add filter if provided
    if (filter) {
      if (!this.messageFilters.has(topic)) {
        this.messageFilters.set(topic, []);
      }
      this.messageFilters.get(topic)!.push(filter as MessageFilter);
    }

    this.emitEvent(COMMUNICATION_EVENTS.SUBSCRIPTION_ADDED, {
      agentId,
      topic,
    });

    return {
      unsubscribe: () => {
        handlers.delete(handler as AgentMessageHandler);
        if (handlers.size === 0) {
          this.subscriptions.delete(topic);
          this.messageFilters.delete(topic);
          this.broker.unsubscribe(topic);

          this.emitEvent(COMMUNICATION_EVENTS.SUBSCRIPTION_REMOVED, {
            agentId,
            topic,
          });
        }
      },
    };
  }

  /**
   * Subscribe to broadcast messages
   */
  subscribeToBroadcasts<T = unknown>(
    handler: AgentMessageHandler<T>
  ): Subscription {
    const topic = this.getBroadcastTopic();

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.broker.subscribe(topic, (message) =>
        this.handleIncomingMessage(topic, message)
      );
    }

    const handlers = this.subscriptions.get(topic)!;
    handlers.add(handler as AgentMessageHandler);

    return {
      unsubscribe: () => {
        handlers.delete(handler as AgentMessageHandler);
        if (handlers.size === 0) {
          this.subscriptions.delete(topic);
          this.broker.unsubscribe(topic);
        }
      },
    };
  }

  /**
   * Get pending request count
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(messageId: string): boolean {
    const pending = this.pendingRequests.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(messageId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    for (const [messageId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('All requests cancelled'));
      this.pendingRequests.delete(messageId);
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.cancelAllRequests();

    for (const topic of this.subscriptions.keys()) {
      await this.broker.unsubscribe(topic);
    }

    this.subscriptions.clear();
    this.messageFilters.clear();
  }

  // === Private Methods ===

  private createMessage<T>(
    fromAgentId: string,
    type: string,
    payload: T,
    options?: Partial<MessageRoutingOptions>
  ): AgentMessage<T> {
    return {
      id: this.generateMessageId(),
      from: fromAgentId,
      to: options?.targetAgent,
      type,
      payload,
      timestamp: new Date(),
      metadata: {
        broadcast: options?.broadcast,
        priority: options?.priority,
        ttl: options?.ttl,
      },
    };
  }

  private async publishMessage<T>(message: AgentMessage<T>): Promise<void> {
    try {
      // Determine topic based on routing
      const topic = this.determinePublishTopic(message);

      await this.broker.publish(topic, message);

      this.emitEvent(COMMUNICATION_EVENTS.MESSAGE_SENT, {
        messageId: message.id,
        from: message.from,
        to: message.to,
        type: message.type,
      });
    } catch (error) {
      this.emitEvent(COMMUNICATION_EVENTS.MESSAGE_FAILED, {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private determinePublishTopic<T>(message: AgentMessage<T>): string {
    if (message.metadata?.broadcast) {
      return this.getBroadcastTopic();
    }
    if (message.to) {
      return this.getAgentTopic(message.to);
    }
    return 'agents.messages.general';
  }

  private async handleIncomingMessage(
    topic: string,
    rawMessage: unknown
  ): Promise<void> {
    try {
      const message = this.parseMessage(rawMessage);

      // Check for reply to pending request
      if (message.correlationId) {
        const pending = this.pendingRequests.get(message.correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(message.payload);
          this.pendingRequests.delete(message.correlationId);
          return;
        }
      }

      // Apply filters
      const filters = this.messageFilters.get(topic) || [];
      for (const filter of filters) {
        if (!filter(message)) {
          return; // Message filtered out
        }
      }

      // Dispatch to handlers
      const handlers = this.subscriptions.get(topic);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await handler(message);
          } catch (error) {
            // Log but don't propagate handler errors
            console.error('Message handler error:', error);
          }
        }
      }

      this.emitEvent(COMMUNICATION_EVENTS.MESSAGE_RECEIVED, {
        messageId: message.id,
        from: message.from,
        type: message.type,
      });
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private parseMessage(rawMessage: unknown): AgentMessage {
    if (!rawMessage || typeof rawMessage !== 'object') {
      throw new Error('Invalid message format');
    }

    const msg = rawMessage as Record<string, unknown>;

    if (!msg.id || !msg.from || !msg.type) {
      throw new Error('Message missing required fields');
    }

    return {
      id: msg.id as string,
      from: msg.from as string,
      to: msg.to as string | undefined,
      type: msg.type as string,
      payload: msg.payload,
      timestamp: msg.timestamp ? new Date(msg.timestamp as string) : new Date(),
      correlationId: msg.correlationId as string | undefined,
      metadata: msg.metadata as Record<string, unknown> | undefined,
    };
  }

  private waitForReply<R>(messageId: string, timeout: number): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });
    });
  }

  private getAgentTopic(agentId: string): string {
    return `agents.messages.${agentId}`;
  }

  private getBroadcastTopic(): string {
    return 'agents.messages.broadcast';
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(type: string, payload: Record<string, unknown>): void {
    if (this.eventBus) {
      const event: IEvent = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        source: 'agent-communication',
        timestamp: new Date(),
        payload,
      };
      this.eventBus.emit(event);
    }
  }
}

/**
 * Create an agent communication instance
 */
export function createAgentCommunication(
  options: AgentCommunicationOptions
): AgentCommunication {
  return new AgentCommunication(options);
}
