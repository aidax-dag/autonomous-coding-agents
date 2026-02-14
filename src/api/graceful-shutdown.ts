/**
 * Graceful Shutdown Handler
 *
 * Manages ordered server shutdown lifecycle including signal handling,
 * in-flight request draining, SSE teardown, and resource cleanup.
 * Idempotent: concurrent shutdown signals are coalesced into a single run.
 *
 * @module api/graceful-shutdown
 */

import { logger } from '../shared/logging/logger';

export interface ShutdownOptions {
  /** Maximum time (ms) to wait for in-flight requests before force exit. Default: 10000 */
  timeoutMs?: number;
}

export type CleanupHandler = () => Promise<void> | void;

/**
 * GracefulShutdown orchestrates an ordered teardown sequence:
 *   1. Stop accepting new connections
 *   2. Wait for in-flight requests (with timeout)
 *   3. Run registered cleanup handlers in order
 *   4. Exit process
 */
export class GracefulShutdown {
  private readonly timeoutMs: number;
  private readonly cleanupHandlers: CleanupHandler[] = [];
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(options?: ShutdownOptions) {
    this.timeoutMs = options?.timeoutMs ?? 10_000;
  }

  /**
   * Register a cleanup handler. Handlers execute in registration order.
   */
  addHandler(handler: CleanupHandler): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Whether a shutdown is already in progress or completed.
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Install process signal listeners (SIGTERM, SIGINT, uncaughtException, unhandledRejection).
   */
  installSignalHandlers(): void {
    const onSignal = (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown`);
      this.shutdown().then(() => {
        process.exit(0);
      }).catch((err) => {
        logger.error('Shutdown failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => onSignal('SIGTERM'));
    process.on('SIGINT', () => onSignal('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception, initiating shutdown', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      this.shutdown().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection, initiating shutdown', {
        error: reason instanceof Error ? reason.message : String(reason),
      });
      this.shutdown().finally(() => process.exit(1));
    });
  }

  /**
   * Execute the shutdown sequence. Idempotent: repeated calls return
   * the same promise without re-running cleanup.
   */
  shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    this.shuttingDown = true;
    this.shutdownPromise = this.executeShutdown();
    return this.shutdownPromise;
  }

  private async executeShutdown(): Promise<void> {
    logger.info('Graceful shutdown started', { timeoutMs: this.timeoutMs });

    const forceTimer = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, this.timeoutMs);

    // Prevent the timer from keeping the event loop alive in tests
    if (typeof forceTimer === 'object' && 'unref' in forceTimer) {
      forceTimer.unref();
    }

    try {
      for (let i = 0; i < this.cleanupHandlers.length; i++) {
        try {
          await this.cleanupHandlers[i]();
        } catch (err) {
          logger.error(`Cleanup handler [${i}] failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      logger.info('Graceful shutdown completed');
    } finally {
      clearTimeout(forceTimer);
    }
  }
}

/**
 * Factory: create a GracefulShutdown wired to an API server shutdown function.
 *
 * @param serverShutdown - The async function returned by startAPIServer that
 *   stops the dashboard and destroys the runner.
 * @param options - Optional timeout configuration.
 */
export function createGracefulShutdown(
  serverShutdown: () => Promise<void>,
  options?: ShutdownOptions,
): GracefulShutdown {
  const gs = new GracefulShutdown(options);
  gs.addHandler(serverShutdown);
  return gs;
}
