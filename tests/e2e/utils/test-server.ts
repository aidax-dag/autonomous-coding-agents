/**
 * E2E Test Server
 *
 * Starts the API server for E2E testing
 */

import { createApiServer } from '../../../src/api/server/api-server.js';
import type { IApiServer } from '../../../src/api/interfaces/api.interface.js';

let server: IApiServer | null = null;

/**
 * Start the test server
 */
export async function startTestServer(port = 3000): Promise<IApiServer> {
  if (server?.isRunning()) {
    return server;
  }

  server = createApiServer({
    host: '127.0.0.1',
    port,
    prefix: '/api/v1',
    cors: { enabled: true, origin: true },
    helmet: { enabled: false }, // Disable for testing
    rateLimit: { max: 1000, timeWindow: '1m' },
    logging: { enabled: false },
    swagger: { enabled: true, title: 'Test API', version: '1.0.0' },
  });

  await server.start();
  console.log(`Test server started on port ${port}`);

  return server;
}

/**
 * Stop the test server
 */
export async function stopTestServer(): Promise<void> {
  if (server?.isRunning()) {
    await server.stop();
    console.log('Test server stopped');
  }
  server = null;
}

/**
 * Get the running server instance
 */
export function getTestServer(): IApiServer | null {
  return server;
}

/**
 * Check if server is running
 */
export function isServerRunning(): boolean {
  return server?.isRunning() ?? false;
}

// Handle process termination
process.on('SIGINT', async () => {
  await stopTestServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopTestServer();
  process.exit(0);
});

// Run directly if executed as script
if (process.argv[1]?.includes('test-server')) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startTestServer(port).catch((error) => {
    console.error('Failed to start test server:', error);
    process.exit(1);
  });
}
