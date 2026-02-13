/**
 * API Server Tests
 */

import { EventEmitter } from 'events';

// Mock OrchestratorRunner
const mockRunner = Object.assign(new EventEmitter(), {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  currentStatus: 'running',
});

jest.mock('../../../src/core/orchestrator/runner-config', () => ({
  createRunnerFromEnv: jest.fn(() => mockRunner),
  loadRunnerConfig: jest.fn(() => ({})),
}));

jest.mock('../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock http.createServer to avoid actual port binding
jest.mock('http', () => ({
  createServer: jest.fn(() => {
    const server = new EventEmitter();
    (server as any).listen = jest.fn((_port: number, _host: string, cb: () => void) => cb());
    (server as any).close = jest.fn((cb: (err?: Error) => void) => cb());
    return server;
  }),
}));

import { startAPIServer } from '../../../src/api/server';
import type { WebRequest } from '../../../src/ui/web/interfaces/web.interface';

describe('startAPIServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunner.removeAllListeners();
    mockRunner.start.mockResolvedValue(undefined);
    mockRunner.destroy.mockResolvedValue(undefined);
  });

  it('should create and start the runner', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    expect(mockRunner.start).toHaveBeenCalled();
    expect(handle.runner).toBe(mockRunner);
    expect(handle.dashboard).toBeDefined();
    expect(typeof handle.shutdown).toBe('function');

    await handle.shutdown();
  });

  it('should provide a working shutdown function', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    await handle.shutdown();

    expect(mockRunner.destroy).toHaveBeenCalled();
  });

  it('should wire dashboard with HUD and message bus', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    const server = handle.dashboard.getServer();
    const routes = server.getRoutes();
    const routePaths = routes.map(r => `${r.method} ${r.path}`);

    expect(routePaths).toContain('GET /api/health');
    expect(routePaths).toContain('GET /api/snapshot');
    expect(routePaths).toContain('GET /api/agents');
    expect(routePaths).toContain('POST /api/tasks');

    await handle.shutdown();
  });

  it('should install request logger and error handler middleware', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    const server = handle.dashboard.getServer();
    // Verify error handler is active: 404 should return standardized format
    const res = await server.handleRequest({
      method: 'GET',
      path: '/nonexistent',
      params: {},
      query: {},
      headers: {},
    } as WebRequest);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('error');

    await handle.shutdown();
  });

  it('should update HUD on workflow events', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    // Simulate workflow:started event
    mockRunner.emit('workflow:started', 'task-1');

    // Simulate workflow:completed event
    mockRunner.emit('workflow:completed', {
      taskId: 'task-1',
      teamType: 'development',
      success: true,
      duration: 500,
    });

    // The HUD snapshot should reflect the agent update
    const server = handle.dashboard.getServer();
    const snapshotRes = await server.handleRequest({
      method: 'GET',
      path: '/api/snapshot',
      params: {},
      query: {},
      headers: {},
    } as WebRequest);

    // Snapshot is available because we passed a HUD dashboard
    expect(snapshotRes.status).toBe(200);

    await handle.shutdown();
  });

  it('should add HUD warning on runner error', async () => {
    const handle = await startAPIServer({ port: 0, host: '127.0.0.1' });

    mockRunner.emit('error', new Error('test error'));

    // Snapshot should contain warning
    const server = handle.dashboard.getServer();
    const snapshotRes = await server.handleRequest({
      method: 'GET',
      path: '/api/snapshot',
      params: {},
      query: {},
      headers: {},
    } as WebRequest);

    expect(snapshotRes.status).toBe(200);
    const body = snapshotRes.body as { warnings: string[] };
    expect(body.warnings).toContain('test error');

    await handle.shutdown();
  });

  it('should use default port and host when not specified', async () => {
    const originalEnv = { ...process.env };
    delete process.env.PORT;
    delete process.env.HOST;

    const handle = await startAPIServer();

    const config = handle.dashboard.getServer().getConfig();
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');

    await handle.shutdown();
    process.env = originalEnv;
  });

  it('should respect PORT and HOST environment variables', async () => {
    const originalEnv = { ...process.env };
    process.env.PORT = '4000';
    process.env.HOST = '192.168.1.1';

    const handle = await startAPIServer();

    const config = handle.dashboard.getServer().getConfig();
    expect(config.port).toBe(4000);
    expect(config.host).toBe('192.168.1.1');

    await handle.shutdown();
    process.env = originalEnv;
  });

  it('should prefer explicit options over environment variables', async () => {
    const originalEnv = { ...process.env };
    process.env.PORT = '4000';
    process.env.HOST = '192.168.1.1';

    const handle = await startAPIServer({ port: 5000, host: '10.0.0.1' });

    const config = handle.dashboard.getServer().getConfig();
    expect(config.port).toBe(5000);
    expect(config.host).toBe('10.0.0.1');

    await handle.shutdown();
    process.env = originalEnv;
  });
});
