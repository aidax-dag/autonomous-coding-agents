/**
 * Error Handler Middleware
 *
 * Standardizes error responses to `{ error: string, code: string, status: number }`.
 * Wraps WebServer route handlers to catch exceptions and normalize output.
 *
 * @module api/middleware/error-handler
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import { HTTP_STATUS } from '../constants';

/**
 * Standardized API error response
 */
export interface APIErrorResponse {
  error: string;
  code: string;
  status: number;
}

/**
 * Known error code mapping
 */
function classifyError(status: number): string {
  switch (status) {
    case HTTP_STATUS.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HTTP_STATUS.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HTTP_STATUS.FORBIDDEN:
      return 'FORBIDDEN';
    case HTTP_STATUS.NOT_FOUND:
      return 'NOT_FOUND';
    case HTTP_STATUS.CONFLICT:
      return 'CONFLICT';
    case HTTP_STATUS.VALIDATION_ERROR:
      return 'VALIDATION_ERROR';
    case HTTP_STATUS.RATE_LIMITED:
      return 'RATE_LIMITED';
    case HTTP_STATUS.INTERNAL_ERROR:
      return 'INTERNAL_ERROR';
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= HTTP_STATUS.INTERNAL_ERROR ? 'SERVER_ERROR' : 'CLIENT_ERROR';
  }
}

/**
 * Normalize an error response body to the standard format.
 */
function normalizeErrorBody(status: number, body: unknown): APIErrorResponse {
  const code = classifyError(status);

  if (body && typeof body === 'object' && 'error' in body) {
    return {
      error: String((body as { error: string }).error),
      code,
      status,
    };
  }

  return {
    error: status >= HTTP_STATUS.INTERNAL_ERROR ? 'Internal server error' : 'Request failed',
    code,
    status,
  };
}

/**
 * Install error normalization on the WebServer.
 * Wraps handleRequest to ensure all error responses (status >= 400)
 * follow the standardized format.
 */
export function installErrorHandler(server: WebServer): void {
  const originalHandleRequest = server.handleRequest.bind(server);

  server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
    const res = await originalHandleRequest(req);

    if (res.status >= 400) {
      return {
        status: res.status,
        body: normalizeErrorBody(res.status, res.body),
        headers: res.headers,
      };
    }

    return res;
  };
}
