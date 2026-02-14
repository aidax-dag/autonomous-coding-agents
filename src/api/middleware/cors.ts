/**
 * CORS Middleware
 *
 * Configurable CORS middleware that reads allowed origins from
 * the CORS_ORIGINS environment variable (comma-separated) or
 * accepts them via options. Supports preflight handling,
 * credentials, exposed headers, and wildcard development mode.
 *
 * @module api/middleware/cors
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import { logger } from '../../shared/logging/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface CORSOptions {
  /** Origins to allow. Reads from CORS_ORIGINS env if not provided. Use ['*'] for wildcard. */
  allowedOrigins?: string[] | '*';
  /** HTTP methods to allow (default: GET, POST, PUT, DELETE, OPTIONS, PATCH) */
  allowedMethods?: string[];
  /** Request headers to allow (default: Content-Type, Authorization, X-Requested-With) */
  allowedHeaders?: string[];
  /** Response headers to expose to clients (default: X-RateLimit-Limit, X-RateLimit-Remaining) */
  exposedHeaders?: string[];
  /** Whether to include Access-Control-Allow-Credentials (default: true) */
  credentials?: boolean;
  /** Preflight cache duration in seconds (default: 86400 = 24h) */
  maxAge?: number;
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];
const DEFAULT_EXPOSED_HEADERS = ['X-RateLimit-Limit', 'X-RateLimit-Remaining'];
const DEFAULT_MAX_AGE = 86400;

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Resolve allowed origins from environment or options.
 * CORS_ORIGINS env var takes precedence (comma-separated list).
 */
function resolveOrigins(optionOrigins?: string[] | '*'): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(o => o.length > 0);
  }
  if (optionOrigins === '*') {
    return ['*'];
  }
  return optionOrigins ?? ['*'];
}

/**
 * Check whether a request origin is permitted.
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

// ── CORSMiddleware class ───────────────────────────────────────────

export class CORSMiddleware {
  private readonly allowedOrigins: string[];
  private readonly allowedMethods: string[];
  private readonly allowedHeaders: string[];
  private readonly exposedHeaders: string[];
  private readonly credentials: boolean;
  private readonly maxAge: number;

  constructor(options?: CORSOptions) {
    this.allowedOrigins = resolveOrigins(options?.allowedOrigins);
    this.allowedMethods = options?.allowedMethods ?? DEFAULT_METHODS;
    this.allowedHeaders = options?.allowedHeaders ?? DEFAULT_HEADERS;
    this.exposedHeaders = options?.exposedHeaders ?? DEFAULT_EXPOSED_HEADERS;
    this.credentials = options?.credentials ?? true;
    this.maxAge = options?.maxAge ?? DEFAULT_MAX_AGE;

    logger.info('CORS middleware initialized', {
      origins: this.allowedOrigins,
      methods: this.allowedMethods,
      credentials: this.credentials,
    });
  }

  /**
   * Install CORS handling on a WebServer instance.
   * Wraps handleRequest to inject CORS headers and handle preflight.
   */
  install(server: WebServer): void {
    const originalHandleRequest = server.handleRequest.bind(server);

    server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
      const origin = req.headers['origin'] || req.headers['Origin'] || '';
      const corsHeaders: Record<string, string> = {};

      // Determine whether this origin is allowed
      const originAllowed = origin ? isOriginAllowed(origin, this.allowedOrigins) : false;
      const isWildcard = this.allowedOrigins.includes('*');

      if (originAllowed && origin) {
        corsHeaders['Access-Control-Allow-Origin'] = isWildcard ? '*' : origin;
      } else if (isWildcard) {
        corsHeaders['Access-Control-Allow-Origin'] = '*';
      }

      // Only set Vary when reflecting a specific origin (not wildcard)
      if (corsHeaders['Access-Control-Allow-Origin'] && corsHeaders['Access-Control-Allow-Origin'] !== '*') {
        corsHeaders['Vary'] = 'Origin';
      }

      corsHeaders['Access-Control-Allow-Methods'] = this.allowedMethods.join(', ');
      corsHeaders['Access-Control-Allow-Headers'] = this.allowedHeaders.join(', ');
      corsHeaders['Access-Control-Max-Age'] = String(this.maxAge);

      if (this.exposedHeaders.length > 0) {
        corsHeaders['Access-Control-Expose-Headers'] = this.exposedHeaders.join(', ');
      }

      if (this.credentials) {
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      }

      // Handle preflight OPTIONS request
      if ((req.method as string) === 'OPTIONS') {
        logger.debug('CORS preflight handled', { origin, path: req.path });
        return {
          status: 204,
          body: null,
          headers: corsHeaders,
        };
      }

      // Reject non-preflight requests from disallowed origins
      if (origin && !originAllowed && !isWildcard) {
        logger.warn('CORS origin rejected', { origin, path: req.path });
        return {
          status: 403,
          body: {
            error: 'Origin not allowed',
            code: 'CORS_REJECTED',
            status: 403,
          },
          headers: {},
        };
      }

      const res = await originalHandleRequest(req);

      res.headers = {
        ...res.headers,
        ...corsHeaders,
      };

      return res;
    };
  }
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Create a CORSMiddleware instance.
 * Call `middleware.install(server)` to wire it into a WebServer.
 */
export function createCORSMiddleware(options?: CORSOptions): CORSMiddleware {
  return new CORSMiddleware(options);
}
