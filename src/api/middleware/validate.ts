/**
 * Request Body Validation Middleware
 *
 * Uses Zod schemas to validate request bodies before
 * passing to route handlers.
 *
 * @module api/middleware/validate
 */

import { z } from 'zod';
import type { WebServer } from '../../ui/web/web-server';
import type {
  HttpMethod,
  RouteHandler,
  WebRequest,
  WebResponse,
} from '../../ui/web/interfaces/web.interface';
import { logger } from '../../shared/logging/logger';

/**
 * Format Zod validation errors into a human-readable string.
 */
function formatZodErrors(error: z.ZodError): string {
  return error.errors
    .map(e => {
      const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
      return `${path}${e.message}`;
    })
    .join('; ');
}

/**
 * Create a route with Zod schema validation on the request body.
 *
 * Validates req.body against the provided schema. On failure,
 * returns 422 with formatted validation errors. On success,
 * calls the handler with the validated body.
 */
export function createValidatedRoute(
  server: WebServer,
  method: HttpMethod,
  path: string,
  schema: z.ZodType,
  handler: RouteHandler,
): void {
  const validatedHandler: RouteHandler = async (req: WebRequest): Promise<WebResponse> => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorMessage = formatZodErrors(result.error);

      logger.warn('Request validation failed', {
        method,
        path: req.path,
        errors: errorMessage,
      });

      return {
        status: 422,
        body: {
          error: errorMessage,
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      };
    }

    // Replace body with the parsed (and potentially transformed) value
    const validatedReq: WebRequest = {
      ...req,
      body: result.data,
    };

    return handler(validatedReq);
  };

  server.addRoute(method, path, validatedHandler);
}
