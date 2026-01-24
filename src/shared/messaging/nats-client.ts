import {
  connect,
  NatsConnection,
  StringCodec,
  Subscription,
  JetStreamClient,
  JetStreamManager,
  RetentionPolicy,
  StorageType,
  AckPolicy,
} from 'nats';
import { createLogger, ILogger } from '../../core/services/logger.js';

/**
 * NATS Message Broker Client
 *
 * Provides reliable pub/sub messaging with:
 * - Automatic reconnection with exponential backoff
 * - JetStream support for persistent messaging
 * - Type-safe message handling
 * - Proper resource cleanup
 * - Comprehensive error handling
 *
 * Feature: F1.1 - NATS Message Broker Client
 */

export interface NatsClientConfig {
  url: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

export interface StreamConfig {
  name: string;
  subjects: string[];
  retention?: RetentionPolicy;
  storage?: StorageType;
  maxAge?: number; // nanoseconds
}

export interface ConsumerConfig {
  streamName: string;
  consumerName: string;
  filterSubject?: string;
  ackPolicy?: AckPolicy;
}

export class NatsClient {
  private connection: NatsConnection | null = null;
  private codec = StringCodec();
  private jetstream: JetStreamClient | null = null;
  private jetstreamManager: JetStreamManager | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private isClosing = false;
  private logger: ILogger;

  constructor(private config: NatsClientConfig) {
    this.logger = createLogger('NATS');
    this.setupCleanupHandlers();
  }

  /**
   * Connect to NATS server with automatic reconnection
   */
  async connect(): Promise<void> {
    if (this.connection && !this.connection.isClosed()) {
      throw new Error('Already connected to NATS');
    }

    try {
      this.connection = await connect({
        servers: this.config.url,
        reconnect: this.config.reconnect ?? true,
        maxReconnectAttempts: this.config.maxReconnectAttempts ?? 10,
        reconnectTimeWait: this.config.reconnectTimeWait ?? 2000,
      });

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Initialize JetStream
      this.jetstream = this.connection.jetstream();
      this.jetstreamManager = await this.connection.jetstreamManager();

      this.logger.info(`Connected successfully to ${this.config.url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to NATS: ${message}`);
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    (async () => {
      for await (const status of this.connection!.status()) {
        switch (status.type) {
          case 'disconnect':
            this.logger.warn('Disconnected from server');
            break;
          case 'reconnecting':
            this.logger.debug('Reconnecting to server...');
            break;
          case 'reconnect':
            this.logger.info('Reconnected to server');
            break;
          case 'error':
            this.logger.error('Connection error', { data: status.data });
            break;
        }
      }
    })().catch((err) => {
      if (!this.isClosing) {
        this.logger.error('Status handler error', { error: err });
      }
    });
  }

  /**
   * Create a JetStream stream for persistent messaging
   */
  async createStream(config: StreamConfig): Promise<void> {
    if (!this.jetstreamManager) {
      throw new Error('Not connected to NATS or JetStream not initialized');
    }

    try {
      await this.jetstreamManager.streams.add({
        name: config.name,
        subjects: config.subjects,
        retention: config.retention ?? RetentionPolicy.Workqueue,
        storage: config.storage ?? StorageType.File,
        max_age: config.maxAge,
      });

      this.logger.info(`Stream created: ${config.name}`);
    } catch (error) {
      // If stream already exists, that's okay
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('already in use')) {
        throw new Error(`Failed to create stream ${config.name}: ${message}`);
      }
      this.logger.debug(`Stream already exists: ${config.name}`);
    }
  }

  /**
   * Publish a message to a subject (core NATS)
   */
  async publish(subject: string, data: unknown): Promise<void> {
    if (!this.connection || this.connection.isClosed()) {
      throw new Error('Not connected to NATS');
    }

    try {
      const message = JSON.stringify(data);
      this.connection.publish(subject, this.codec.encode(message));
      this.logger.debug(`Published message to ${subject}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to publish to ${subject}: ${message}`);
    }
  }

  /**
   * Publish a message to JetStream for persistence
   */
  async publishToStream(subject: string, data: unknown): Promise<void> {
    if (!this.jetstream) {
      throw new Error('JetStream not initialized');
    }

    try {
      const message = JSON.stringify(data);
      const ack = await this.jetstream.publish(subject, this.codec.encode(message));
      this.logger.debug(`Published to stream ${subject}, seq: ${ack.seq}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to publish to stream ${subject}: ${message}`);
    }
  }

  /**
   * Subscribe to a subject (core NATS)
   */
  async subscribe(
    subject: string,
    handler: (data: unknown, subject: string) => Promise<void>
  ): Promise<void> {
    if (!this.connection || this.connection.isClosed()) {
      throw new Error('Not connected to NATS');
    }

    try {
      const sub = this.connection.subscribe(subject);
      this.subscriptions.set(subject, sub);

      this.logger.info(`Subscribed to ${subject}`);

      // Process messages
      (async () => {
        for await (const msg of sub) {
          try {
            const data = JSON.parse(this.codec.decode(msg.data));
            await handler(data, msg.subject);
          } catch (error) {
            this.logger.error(`Error processing message on ${subject}`, { error });
          }
        }
      })().catch((err) => {
        if (!this.isClosing) {
          this.logger.error(`Subscription error on ${subject}`, { error: err });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to subscribe to ${subject}: ${message}`);
    }
  }

  /**
   * Create a durable consumer on a JetStream stream
   */
  async createConsumer(
    config: ConsumerConfig,
    handler: (data: unknown, subject: string) => Promise<void>
  ): Promise<void> {
    if (!this.jetstreamManager || !this.jetstream) {
      throw new Error('JetStream not initialized');
    }

    try {
      // Create consumer
      await this.jetstreamManager.consumers.add(config.streamName, {
        durable_name: config.consumerName,
        filter_subject: config.filterSubject,
        ack_policy: config.ackPolicy ?? AckPolicy.Explicit,
      });

      this.logger.info(
        `Consumer created: ${config.consumerName} on stream ${config.streamName}`
      );

      // Subscribe to consumer
      const consumer = await this.jetstream.consumers.get(
        config.streamName,
        config.consumerName
      );

      (async () => {
        const messages = await consumer.consume();
        for await (const msg of messages) {
          try {
            const data = JSON.parse(this.codec.decode(msg.data));
            await handler(data, msg.subject);
            msg.ack();
          } catch (error) {
            this.logger.error(
              `Error processing message from consumer ${config.consumerName}`,
              { error }
            );
            msg.nak();
          }
        }
      })().catch((err) => {
        if (!this.isClosing) {
          this.logger.error(`Consumer error on ${config.consumerName}`, { error: err });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create consumer ${config.consumerName} on stream ${config.streamName}: ${message}`
      );
    }
  }

  /**
   * Unsubscribe from a subject
   */
  async unsubscribe(subject: string): Promise<void> {
    const sub = this.subscriptions.get(subject);
    if (sub) {
      await sub.drain();
      this.subscriptions.delete(subject);
      this.logger.debug(`Unsubscribed from ${subject}`);
    }
  }

  /**
   * Send a request and wait for a response (request-reply pattern)
   */
  async request(
    subject: string,
    data: string | Uint8Array,
    options?: { timeout?: number }
  ): Promise<{ data: Uint8Array; subject: string }> {
    if (!this.connection || this.connection.isClosed()) {
      throw new Error('Not connected to NATS');
    }

    try {
      const payload = typeof data === 'string' ? this.codec.encode(data) : data;
      const msg = await this.connection.request(subject, payload, {
        timeout: options?.timeout || 30000,
      });

      this.logger.debug(`Request-reply completed for ${subject}`);

      return {
        data: msg.data,
        subject: msg.subject,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Request to ${subject} failed: ${message}`);
    }
  }

  /**
   * Close all subscriptions and connection
   */
  async close(): Promise<void> {
    if (this.isClosing) return;
    this.isClosing = true;

    this.logger.info('Closing connection...');

    try {
      // Drain all subscriptions
      for (const [subject, sub] of this.subscriptions.entries()) {
        try {
          await sub.drain();
          this.logger.debug(`Drained subscription: ${subject}`);
        } catch (error) {
          this.logger.error(`Error draining subscription ${subject}`, { error });
        }
      }
      this.subscriptions.clear();

      // Close connection
      if (this.connection && !this.connection.isClosed()) {
        await this.connection.drain();
        await this.connection.close();
        this.connection = null;
        this.jetstream = null;
        this.jetstreamManager = null;
        this.logger.info('Connection closed');
      }
    } catch (error) {
      this.logger.error('Error during close', { error });
      throw error;
    } finally {
      this.isClosing = false;
    }
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      await this.close();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', () => {
      if (this.connection && !this.connection.isClosed()) {
        this.close().catch((err) => this.logger.error('Error during cleanup', { error: err }));
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Get connection stats
   */
  getStats() {
    if (!this.connection) {
      return null;
    }

    return {
      connected: this.isConnected(),
      subscriptions: this.subscriptions.size,
    };
  }
}

/**
 * Create a singleton NATS client instance
 */
let natsClientInstance: NatsClient | null = null;

export function getNatsClient(config?: NatsClientConfig): NatsClient {
  if (!natsClientInstance) {
    if (!config) {
      throw new Error('NATS client not initialized. Provide config on first call.');
    }
    natsClientInstance = new NatsClient(config);
  }
  return natsClientInstance;
}

export async function initializeNatsClient(config: NatsClientConfig): Promise<NatsClient> {
  const client = getNatsClient(config);
  await client.connect();
  return client;
}
