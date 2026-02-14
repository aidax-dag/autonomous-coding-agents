/**
 * Database Health Check API
 *
 * Provides a `/api/db/health` endpoint that reports the current database
 * engine status, connectivity, and migration state. Designed for use by
 * load balancers, monitoring systems, and operational dashboards.
 *
 * The endpoint is intentionally unauthenticated (like `/api/health`) so
 * infrastructure probes can reach it without credentials.
 *
 * @module api/routes/db-health
 */

import type { IWebServer, WebRequest, WebResponse } from '@/ui/web/interfaces/web.interface';
import type { IDBClient } from '@/core/persistence/db-client';
import { SQLiteClient } from '@/core/persistence/sqlite-client';
import { PostgresClient } from '@/core/persistence/postgres-client';
import { createAgentLogger } from '@/shared/logging/logger';

const logger = createAgentLogger('db-health');

// ============================================================================
// Types
// ============================================================================

export interface DBHealthStatus {
  /** Overall database health */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Database engine type */
  engine: 'sqlite' | 'postgres' | 'memory';
  /** Whether the database is currently connected */
  connected: boolean;
  /** Result of the SELECT 1 probe (true = reachable) */
  reachable: boolean;
  /** Latency of the probe in milliseconds */
  latencyMs: number;
  /** ISO 8601 timestamp of the check */
  checkedAt: string;
  /** Optional error message when unhealthy */
  error?: string;
}

export interface DBHealthAPIOptions {
  server: IWebServer;
  dbClient: IDBClient;
  engine: 'sqlite' | 'postgres' | 'memory';
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Registers the database health check endpoint on the given web server.
 *
 * GET /api/db/health
 *
 * Returns 200 when healthy, 503 when degraded or unhealthy.
 */
export class DBHealthAPI {
  private readonly server: IWebServer;
  private readonly dbClient: IDBClient;
  private readonly engine: 'sqlite' | 'postgres' | 'memory';

  constructor(options: DBHealthAPIOptions) {
    this.server = options.server;
    this.dbClient = options.dbClient;
    this.engine = options.engine;
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.server.addRoute('GET', '/api/db/health', this.handleDBHealth.bind(this));
  }

  private async handleDBHealth(_req: WebRequest): Promise<WebResponse> {
    const checkedAt = new Date().toISOString();
    const connected = this.dbClient.isConnected();

    if (!connected) {
      const result: DBHealthStatus = {
        status: 'unhealthy',
        engine: this.engine,
        connected: false,
        reachable: false,
        latencyMs: 0,
        checkedAt,
        error: 'Database client is not connected',
      };
      return { status: 503, body: result };
    }

    // Run a connectivity probe
    const start = performance.now();
    let reachable = false;
    let error: string | undefined;

    try {
      if (this.dbClient instanceof SQLiteClient) {
        reachable = this.dbClient.healthCheck();
      } else if (this.dbClient instanceof PostgresClient) {
        reachable = await this.dbClient.healthCheck();
      } else {
        // InMemoryDBClient or unknown -- attempt a simple query
        await this.dbClient.query('SELECT 1');
        reachable = true;
      }
    } catch (err) {
      reachable = false;
      error = err instanceof Error ? err.message : String(err);
      logger.warn('Database health check failed', { error });
    }

    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    const status: DBHealthStatus['status'] = reachable
      ? 'healthy'
      : 'unhealthy';

    const result: DBHealthStatus = {
      status,
      engine: this.engine,
      connected,
      reachable,
      latencyMs,
      checkedAt,
      ...(error ? { error } : {}),
    };

    return {
      status: reachable ? 200 : 503,
      body: result,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create and register the DB health check API routes.
 */
export function createDBHealthAPI(options: DBHealthAPIOptions): DBHealthAPI {
  return new DBHealthAPI(options);
}
