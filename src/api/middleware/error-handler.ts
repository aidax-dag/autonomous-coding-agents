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
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
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
    error: status >= 500 ? 'Internal server error' : 'Request failed',
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
