/**
 * CORS Middleware
 *
 * Environment-based CORS configuration that replaces
 * the hardcoded '*' origin in the WebServer.
 *
 * @module api/middleware/cors
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';

export interface CORSConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-API-Key'];
const DEFAULT_MAX_AGE = 86400;

/**
 * Resolve allowed origins from config and environment.
 * CORS_ORIGINS env var takes precedence (comma-separated).
 */
function resolveOrigins(configOrigins?: string[]): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(o => o.length > 0);
  }
  return configOrigins ?? ['*'];
}

/**
 * Check if the given origin is allowed.
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

/**
 * Install CORS middleware on a WebServer instance.
 * Wraps handleRequest to add CORS headers to all responses
 * and handle preflight OPTIONS requests.
 */
export function installCORS(server: WebServer, config?: CORSConfig): void {
  const allowedOrigins = resolveOrigins(config?.allowedOrigins);
  const allowedMethods = config?.allowedMethods ?? DEFAULT_METHODS;
  const allowedHeaders = config?.allowedHeaders ?? DEFAULT_HEADERS;
  const maxAge = config?.maxAge ?? DEFAULT_MAX_AGE;

  const originalHandleRequest = server.handleRequest.bind(server);

  server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
    const origin = req.headers['origin'] || req.headers['Origin'] || '';

    const corsHeaders: Record<string, string> = {};

    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else if (allowedOrigins.includes('*')) {
      corsHeaders['Access-Control-Allow-Origin'] = '*';
    }

    corsHeaders['Access-Control-Allow-Methods'] = allowedMethods.join(', ');
    corsHeaders['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');
    corsHeaders['Access-Control-Max-Age'] = String(maxAge);

    // Handle preflight OPTIONS request
    // OPTIONS is not in the HttpMethod union but may arrive via browser preflight
    if ((req.method as string) === 'OPTIONS') {
      return {
        status: 204,
        body: null,
        headers: corsHeaders,
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
