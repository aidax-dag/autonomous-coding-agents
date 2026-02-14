/**
 * OpenAPI Documentation Server
 *
 * Installs routes for serving the OpenAPI specification and
 * an interactive Swagger UI documentation page.
 *
 * @module api/docs/openapi-serve
 */

import type { IWebServer } from '../../ui/web/interfaces/web.interface';
import { EndpointRegistry, registerAllEndpoints } from './endpoint-registry';
import { OpenAPIGenerator } from './openapi-generator';
import type { OpenAPISpec } from './types';
import { logger } from '../../shared/logging/logger';

/**
 * Build the OpenAPI spec from the endpoint registry.
 * Exported for reuse by the static generation script.
 */
export function buildOpenAPISpec(): OpenAPISpec {
  const registry = new EndpointRegistry();
  registerAllEndpoints(registry);
  const generator = new OpenAPIGenerator(registry);
  return generator.generate();
}

/**
 * Return a minimal inline HTML page that loads Swagger UI from CDN
 * and renders the spec served at /api/docs/openapi.json.
 */
function swaggerUIHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ACA API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
}

/**
 * Install OpenAPI documentation routes on the web server.
 *
 * - GET /api/docs/openapi.json  returns the generated spec as JSON
 * - GET /api/docs               serves an interactive Swagger UI page
 */
export function installOpenAPIDocs(server: IWebServer): void {
  const spec = buildOpenAPISpec();
  const html = swaggerUIHTML();

  server.addRoute('GET', '/api/docs/openapi.json', async () => ({
    status: 200,
    body: spec,
    headers: { 'Content-Type': 'application/json' },
  }));

  server.addRoute('GET', '/api/docs', async () => ({
    status: 200,
    body: html,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }));

  logger.info('OpenAPI docs installed at /api/docs');
}
