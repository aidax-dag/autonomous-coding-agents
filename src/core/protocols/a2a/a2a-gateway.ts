/**
 * A2A Gateway
 *
 * Bridges external A2A agents with the internal ACP message bus.
 * Manages peer discovery, message routing, and task delegation
 * between agents communicating over the A2A protocol.
 *
 * @module core/protocols/a2a
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../../shared/logging/logger';
import { createACPMessage } from '../acp-message-bus';
import type { ACPMessageBus } from '../acp-message-bus';
import type {
  AgentCard,
  AgentCapability,
  A2AMessage,
  A2AMessageType,
  TaskDelegation,
  TaskCompletion,
} from './types';
import type { A2AMessageHandler } from './a2a-router';

export type { A2AMessageHandler } from './a2a-router';

const logger = createAgentLogger('Protocols', 'a2a-gateway');

// ── Configuration ────────────────────────────────────────────

/**
 * Configuration for creating an A2A Gateway
 */
export interface A2AGatewayConfig {
  /** This agent's unique ID */
  agentId: string;
  /** This agent's human-readable name */
  agentName: string;
  /** Capabilities this agent exposes */
  capabilities?: AgentCapability[];
  /** Optional internal ACP message bus for bridging */
  messageBus?: ACPMessageBus;
  /** Default request timeout in ms (default: 30000) */
  defaultTimeout?: number;
}

// ── Message counter ──────────────────────────────────────────

let a2aMessageCounter = 0;

// ── Gateway ──────────────────────────────────────────────────

/**
 * A2A Gateway — bridges external agents with the internal ACP bus.
 *
 * Emits:
 * - 'message:received' — when any A2A message is received
 * - 'message:sent' — when an A2A message is sent
 * - 'peer:registered' — when a peer is registered
 * - 'peer:unregistered' — when a peer is removed
 * - 'task:delegated' — when a task is delegated to a peer
 * - 'task:completed' — when a delegated task completes
 */
export class A2AGateway extends EventEmitter {
  private readonly config: A2AGatewayConfig;
  private readonly peers: Map<string, AgentCard> = new Map();
  private readonly pendingTasks: Map<string, TaskDelegation> = new Map();
  private readonly handlers: Map<A2AMessageType, A2AMessageHandler> = new Map();
  private readonly timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly defaultTimeout: number;

  constructor(config: A2AGatewayConfig) {
    super();
    this.config = config;
    this.defaultTimeout = config.defaultTimeout ?? 30000;

    // Register built-in handlers
    this.handlers.set('ping', async (msg) => this.handlePing(msg));

    logger.info('A2A Gateway initialized', {
      agentId: config.agentId,
      agentName: config.agentName,
      capabilities: config.capabilities?.length ?? 0,
    });
  }

  // ========================================================================
  // Agent Discovery
  // ========================================================================

  /**
   * Register a remote agent (peer)
   */
  registerPeer(card: AgentCard): void {
    if (this.peers.has(card.id)) {
      throw new Error(`Peer already registered: ${card.id}`);
    }

    this.peers.set(card.id, card);
    this.emit('peer:registered', card);
    logger.info('Peer registered', {
      peerId: card.id,
      peerName: card.name,
      capabilities: card.capabilities.length,
    });
  }

  /**
   * Unregister a remote agent
   */
  unregisterPeer(agentId: string): boolean {
    const existed = this.peers.delete(agentId);
    if (existed) {
      this.emit('peer:unregistered', agentId);
      logger.info('Peer unregistered', { peerId: agentId });
    }
    return existed;
  }

  /**
   * Get all known peers
   */
  getPeers(): AgentCard[] {
    return [...this.peers.values()];
  }

  /**
   * Get this agent's card
   */
  getAgentCard(): AgentCard {
    return {
      id: this.config.agentId,
      name: this.config.agentName,
      description: `A2A agent: ${this.config.agentName}`,
      version: '1.0.0',
      capabilities: this.config.capabilities ?? [],
      endpoint: '',
      protocol: 'a2a-v1',
      status: 'available',
    };
  }

  /**
   * Find peers by capability name
   */
  findPeersByCapability(capability: string): AgentCard[] {
    return this.getPeers().filter((peer) =>
      peer.capabilities.some((cap) => cap.name === capability),
    );
  }

  // ========================================================================
  // Message Handling
  // ========================================================================

  /**
   * Handle an incoming A2A message from an external agent.
   * Routes to registered handler based on message type.
   * Optionally bridges to the ACP bus when configured.
   */
  async handleMessage(message: A2AMessage): Promise<A2AMessage | null> {
    this.emit('message:received', message);
    logger.debug('Message received', {
      type: message.type,
      from: message.from,
      messageId: message.id,
    });

    // Bridge task delegation to ACP bus if configured
    if (this.config.messageBus && message.type === 'task:delegate') {
      await this.bridgeToACP(message);
    }

    // Bridge task completion to ACP bus if configured
    if (this.config.messageBus && message.type === 'task:complete') {
      await this.bridgeCompletionToACP(message);
    }

    const handler = this.handlers.get(message.type);
    if (!handler) {
      logger.debug('No handler for message type', { type: message.type });
      return null;
    }

    const response = await handler(message);

    if (response) {
      this.emit('message:sent', response);
    }

    return response;
  }

  /**
   * Register a handler for a specific A2A message type
   */
  onMessage(type: A2AMessageType, handler: A2AMessageHandler): void {
    this.handlers.set(type, handler);
    logger.debug('Handler registered', { type });
  }

  // ========================================================================
  // Task Delegation
  // ========================================================================

  /**
   * Delegate a task to a remote agent.
   * Creates and returns a task:delegate message.
   * Throws if the target peer is not registered.
   */
  async delegateTask(
    targetAgentId: string,
    delegation: TaskDelegation,
  ): Promise<A2AMessage> {
    if (!this.peers.has(targetAgentId)) {
      throw new Error(`Unknown peer: ${targetAgentId}`);
    }

    this.pendingTasks.set(delegation.taskId, delegation);

    const message = this.createMessage<TaskDelegation>(
      'task:delegate',
      targetAgentId,
      delegation,
    );

    this.emit('task:delegated', delegation);

    logger.info('Task delegated', {
      taskId: delegation.taskId,
      target: targetAgentId,
      priority: delegation.priority,
    });

    // Set up timeout if specified
    const timeout = delegation.timeout ?? this.defaultTimeout;
    if (timeout > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(delegation.taskId);
        if (this.pendingTasks.has(delegation.taskId)) {
          logger.warn('Delegated task timed out', {
            taskId: delegation.taskId,
            target: targetAgentId,
            timeout,
          });
          this.pendingTasks.delete(delegation.taskId);
          this.emit('task:timeout', delegation.taskId);
        }
      }, timeout);
      this.timers.set(delegation.taskId, timer);
    }

    return message;
  }

  /**
   * Get all pending delegated tasks
   */
  getPendingTasks(): TaskDelegation[] {
    return [...this.pendingTasks.values()];
  }

  /**
   * Complete a delegated task (called by local handler)
   */
  completeTask(taskId: string, completion: TaskCompletion): A2AMessage {
    this.pendingTasks.delete(taskId);

    // Clear the timeout timer if one exists
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    const message = this.createMessage<TaskCompletion>(
      'task:complete',
      '*',
      completion,
    );

    this.emit('task:completed', completion);

    logger.info('Task completed', {
      taskId,
      success: completion.success,
      duration: completion.duration,
    });

    return message;
  }

  // ========================================================================
  // Message Creation
  // ========================================================================

  /**
   * Create a new A2A message from this agent
   */
  createMessage<T>(
    type: A2AMessageType,
    to: string,
    payload: T,
  ): A2AMessage<T> {
    return {
      id: `a2a-${++a2aMessageCounter}-${Date.now()}`,
      type,
      from: this.config.agentId,
      to,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Dispose the gateway, clearing all state
   */
  dispose(): void {
    // Clear all pending timeout timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.peers.clear();
    this.pendingTasks.clear();
    this.handlers.clear();
    this.removeAllListeners();
    logger.info('A2A Gateway disposed', { agentId: this.config.agentId });
  }

  // ── Private ────────────────────────────────────────────────

  /**
   * Handle ping messages by returning a pong
   */
  private async handlePing(message: A2AMessage): Promise<A2AMessage> {
    return this.createMessage('pong', message.from, {
      agentId: this.config.agentId,
      status: 'available',
    });
  }

  /**
   * Bridge an incoming task:delegate message to the ACP bus
   */
  private async bridgeToACP(message: A2AMessage): Promise<void> {
    if (!this.config.messageBus) return;

    const delegation = message.payload as TaskDelegation;
    const acpMessage = createACPMessage({
      type: 'task:submit',
      source: `a2a:${message.from}`,
      target: this.config.agentId,
      payload: {
        description: delegation.description,
        type: 'a2a-delegation',
        config: delegation.context,
      },
      priority: delegation.priority,
    });

    await this.config.messageBus.publish(acpMessage);
    logger.debug('Bridged task:delegate to ACP', {
      a2aMessageId: message.id,
      acpMessageId: acpMessage.id,
    });
  }

  /**
   * Bridge an incoming task:complete message to the ACP bus
   */
  private async bridgeCompletionToACP(message: A2AMessage): Promise<void> {
    if (!this.config.messageBus) return;

    const completion = message.payload as TaskCompletion;
    const acpMessage = createACPMessage({
      type: 'task:result',
      source: `a2a:${message.from}`,
      target: this.config.agentId,
      payload: {
        taskId: completion.taskId,
        success: completion.success,
        result: completion.result,
        duration: completion.duration,
        error: completion.error,
      },
    });

    await this.config.messageBus.publish(acpMessage);
    logger.debug('Bridged task:complete to ACP', {
      a2aMessageId: message.id,
      acpMessageId: acpMessage.id,
    });
  }
}

// ── Factory ──────────────────────────────────────────────────

/**
 * Factory function for creating an A2A Gateway
 */
export function createA2AGateway(config: A2AGatewayConfig): A2AGateway {
  return new A2AGateway(config);
}
