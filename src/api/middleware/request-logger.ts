/**
 * Request Logger Middleware
 *
 * Logs HTTP method, path, status code, and response duration
 * for every request processed by the WebServer.
 *
 * @module api/middleware/request-logger
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import { logger } from '../../shared/logging/logger';

/**
 * Request logger that wraps WebServer route handlers with logging.
 */
export class RequestLogger {
  /**
   * Install logging on all current and future routes of the given WebServer.
   * Wraps the server's handleRequest method to log every request.
   */
  install(server: WebServer): void {
    const originalHandleRequest = server.handleRequest.bind(server);

    server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
      const start = Date.now();

      const res = await originalHandleRequest(req);

      const duration = Date.now() - start;
      const level = res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'info';

      logger[level](`${req.method} ${req.path} ${res.status} ${duration}ms`, {
        method: req.method,
        path: req.path,
        status: res.status,
        duration,
      });

      return res;
    };
  }
}

/**
 * Factory function
 */
export function createRequestLogger(): RequestLogger {
  return new RequestLogger();
}
