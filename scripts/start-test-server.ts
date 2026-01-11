/**
 * Test Server Startup Script
 *
 * Starts the API server for E2E testing
 */

import { createApiServer } from '../src/api/server/api-server.js';
import {
  createAgentsRouter,
  createWorkflowsRouter,
  createToolsRouter,
  createHooksRouter,
} from '../src/api/routes/index.js';

async function main() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = createApiServer({
    host: '127.0.0.1',
    port,
    prefix: '/api/v1',
    cors: { enabled: true, origin: true },
    helmet: { enabled: false },
    rateLimit: { max: 1000, timeWindow: '1m' },
    logging: { enabled: true },
    swagger: { enabled: true, title: 'Test API', version: '1.0.0' },
  });

  // Register API routers with /api/v1 prefix
  const instance = server.getInstance();
  await instance.register(
    async (app) => {
      await createAgentsRouter().register(app);
      await createWorkflowsRouter().register(app);
      await createToolsRouter().register(app);
      await createHooksRouter().register(app);
    },
    { prefix: '/api/v1' }
  );

  await server.start();
  console.log(`Test server started on port ${port}`);

  // Handle shutdown
  const shutdown = async () => {
    console.log('Shutting down test server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start test server:', error);
  process.exit(1);
});
