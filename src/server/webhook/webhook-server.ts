/**
 * GitHub Webhook Server
 *
 * HTTP server for receiving and processing GitHub webhook events.
 * Includes HMAC signature verification for security.
 *
 * Feature: F4.2 - GitHub Webhook Support
 */

import http from 'http';
import crypto from 'crypto';
import {
  WebhookConfig,
  WebhookEvent,
  WebhookEventType,
  WebhookHandler,
  WebhookServerStatus,
  PullRequestWebhookPayload,
  PullRequestWebhookPayloadSchema,
  PullRequestReviewWebhookPayload,
  PullRequestReviewWebhookPayloadSchema,
  PingWebhookPayload,
  PingWebhookPayloadSchema,
} from './types.js';
import { createAgentLogger } from '@/shared/logging/logger.js';

const logger = createAgentLogger('Server', 'webhook');

/**
 * GitHub Webhook Server
 */
export class WebhookServer {
  private server?: http.Server;
  private config: WebhookConfig;
  private handlers: Map<WebhookEventType, WebhookHandler[]> = new Map();
  private stats = {
    eventsReceived: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    lastEventAt: undefined as Date | undefined,
    startedAt: new Date(),
  };

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    if (this.server) {
      logger.warn('Webhook server already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Webhook server disabled in config');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        logger.error('Unhandled error in request handler', { error });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        logger.info('Webhook server started', {
          host: this.config.host,
          port: this.config.port,
          path: this.config.path,
        });
        resolve();
      });

      this.server!.on('error', (error) => {
        logger.error('Webhook server error', { error });
        reject(error);
      });
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          logger.error('Error stopping webhook server', { error });
          reject(error);
        } else {
          logger.info('Webhook server stopped');
          this.server = undefined;
          resolve();
        }
      });
    });
  }

  /**
   * Register a webhook event handler
   */
  on(eventType: WebhookEventType, handler: WebhookHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    logger.debug('Registered webhook handler', { eventType });
  }

  /**
   * Get server status
   */
  getStatus(): WebhookServerStatus {
    return {
      running: !!this.server,
      port: this.config.port,
      eventsReceived: this.stats.eventsReceived,
      eventsProcessed: this.stats.eventsProcessed,
      eventsFailed: this.stats.eventsFailed,
      lastEventAt: this.stats.lastEventAt,
      uptime: Date.now() - this.stats.startedAt.getTime(),
    };
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check path
    if (req.url !== this.config.path) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      // Read request body
      const body = await this.readBody(req);

      // Get headers
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const eventType = req.headers['x-github-event'] as string | undefined;
      const deliveryId = req.headers['x-github-delivery'] as string | undefined;

      if (!signature || !eventType || !deliveryId) {
        logger.warn('Missing required webhook headers', { signature, eventType, deliveryId });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required headers' }));
        return;
      }

      // Verify signature
      if (!this.verifySignature(body, signature)) {
        logger.warn('Invalid webhook signature', { deliveryId });
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      // Parse payload
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        logger.warn('Invalid JSON payload', { deliveryId });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Validate and process event
      const event: WebhookEvent = {
        id: crypto.randomUUID(),
        type: eventType as WebhookEventType,
        payload: payload as PullRequestWebhookPayload | PullRequestReviewWebhookPayload | PingWebhookPayload,
        signature,
        deliveryId,
        receivedAt: new Date(),
      };

      this.stats.eventsReceived++;
      this.stats.lastEventAt = event.receivedAt;

      logger.info('Webhook event received', {
        type: eventType,
        deliveryId,
        id: event.id,
      });

      // Process event asynchronously
      this.processEvent(event).catch((error) => {
        logger.error('Error processing webhook event', { event: event.id, error });
        this.stats.eventsFailed++;
      });

      // Respond immediately
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received', eventId: event.id }));
    } catch (error) {
      logger.error('Error handling webhook request', { error });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Verify HMAC signature
   */
  private verifySignature(body: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.config.secret);
    hmac.update(body);
    const expected = `sha256=${hmac.digest('hex')}`;

    // Use timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Process webhook event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    try {
      // Validate payload based on event type
      const validatedPayload = this.validatePayload(event);
      if (!validatedPayload) {
        logger.warn('Invalid payload for event type', { type: event.type, id: event.id });
        this.stats.eventsFailed++;
        return;
      }

      event.payload = validatedPayload;

      // Get handlers for this event type
      const handlers = this.handlers.get(event.type) || [];

      if (handlers.length === 0) {
        logger.debug('No handlers registered for event type', { type: event.type });
        this.stats.eventsProcessed++;
        return;
      }

      // Execute all handlers
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(event);
          } catch (error) {
            logger.error('Handler error', { type: event.type, id: event.id, error });
            throw error;
          }
        })
      );

      this.stats.eventsProcessed++;
      logger.info('Webhook event processed', { type: event.type, id: event.id });
    } catch (error) {
      logger.error('Error processing event', { type: event.type, id: event.id, error });
      this.stats.eventsFailed++;
      throw error;
    }
  }

  /**
   * Validate payload based on event type
   */
  private validatePayload(
    event: WebhookEvent
  ): PullRequestWebhookPayload | PullRequestReviewWebhookPayload | PingWebhookPayload | null {
    try {
      switch (event.type) {
        case 'pull_request': {
          const result = PullRequestWebhookPayloadSchema.safeParse(event.payload);
          return result.success ? result.data : null;
        }
        case 'pull_request_review': {
          const result = PullRequestReviewWebhookPayloadSchema.safeParse(event.payload);
          return result.success ? result.data : null;
        }
        case 'ping': {
          const result = PingWebhookPayloadSchema.safeParse(event.payload);
          return result.success ? result.data : null;
        }
        default:
          // For unsupported event types, just return the payload as-is
          return event.payload as
            | PullRequestWebhookPayload
            | PullRequestReviewWebhookPayload
            | PingWebhookPayload;
      }
    } catch (error) {
      logger.error('Error validating payload', { type: event.type, error });
      return null;
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      lastEventAt: undefined,
      startedAt: new Date(),
    };
    logger.info('Webhook server stats reset');
  }
}
