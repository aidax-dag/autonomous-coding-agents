/**
 * IPC Bridge
 * Communication bridge between main and renderer processes
 * with channel-based message routing and timeout support.
 *
 * @module desktop
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '@/shared/logging/logger';
import type { IPCMessage, IPCHandler } from './types';

const logger = createAgentLogger('Desktop', 'ipc-bridge');

export class IPCBridge extends EventEmitter {
  private handlers: Map<string, IPCHandler> = new Map();
  private pendingRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private messageCount = 0;
  private timeout: number;
  private disposed = false;

  constructor(timeout = 30000) {
    super();
    this.timeout = timeout;
  }

  /**
   * Register a handler for a channel.
   * Throws if a handler is already registered for that channel.
   */
  registerHandler(
    channel: string,
    handler: (payload: unknown) => Promise<unknown> | unknown,
  ): void {
    if (this.disposed) throw new Error('IPCBridge is disposed');
    if (this.handlers.has(channel)) {
      throw new Error(`Handler already registered for channel '${channel}'`);
    }
    this.handlers.set(channel, { channel, handler });
    logger.info('Handler registered', { channel });
    this.emit('handler:registered', channel);
  }

  /**
   * Unregister a handler for a channel.
   * Returns true if a handler was removed.
   */
  unregisterHandler(channel: string): boolean {
    const removed = this.handlers.delete(channel);
    if (removed) {
      this.emit('handler:unregistered', channel);
    }
    return removed;
  }

  /**
   * Send a message on a channel.
   * If a local handler exists, it is invoked directly.
   * Otherwise, the message awaits a matching incoming response with timeout.
   */
  async send(channel: string, payload: unknown): Promise<unknown> {
    if (this.disposed) throw new Error('IPCBridge is disposed');

    const id = this.generateId();
    const message: IPCMessage = {
      id,
      channel,
      payload,
      timestamp: new Date().toISOString(),
      source: 'main',
    };

    this.messageCount++;
    this.emit('message:sent', message);

    // Check if we have a local handler for this channel
    const handler = this.handlers.get(channel);
    if (handler) {
      try {
        const result = await handler.handler(payload);
        this.emit('message:handled', { id, channel, result });
        return result;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        this.emit('message:error', { id, channel, error: errorMessage });
        throw err;
      }
    }

    // No handler: wait for a matching response with timeout
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `IPC request timeout on channel '${channel}' after ${this.timeout}ms`,
          ),
        );
      }, this.timeout);
      if (timer.unref) timer.unref();

      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  /**
   * Handle an incoming message from the renderer process.
   * Resolves pending requests or invokes registered handlers.
   */
  handleIncoming(message: IPCMessage): void {
    if (this.disposed) return;

    this.emit('message:received', message);

    // Check if this is a response to a pending request
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.id);
      pending.resolve(message.payload);
      return;
    }

    // Try to handle as a new message
    const handler = this.handlers.get(message.channel);
    if (handler) {
      new Promise<unknown>((resolve) => resolve(handler.handler(message.payload)))
        .then((result) => {
          this.emit('message:handled', {
            id: message.id,
            channel: message.channel,
            result,
          });
        })
        .catch((err: unknown) => {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          this.emit('message:error', {
            id: message.id,
            channel: message.channel,
            error: errorMessage,
          });
        });
    } else {
      this.emit('message:unhandled', message);
    }
  }

  /** Get all registered channel names. */
  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /** Get total number of messages sent. */
  getMessageCount(): number {
    return this.messageCount;
  }

  /** Get number of pending (awaiting response) requests. */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /** Check if a handler is registered for a channel. */
  hasHandler(channel: string): boolean {
    return this.handlers.has(channel);
  }

  private generateId(): string {
    return `ipc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Dispose the bridge, rejecting all pending requests. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('IPCBridge disposed'));
    }
    this.pendingRequests.clear();
    this.handlers.clear();
    this.messageCount = 0;
    this.removeAllListeners();
  }
}

export function createIPCBridge(timeout?: number): IPCBridge {
  return new IPCBridge(timeout);
}
