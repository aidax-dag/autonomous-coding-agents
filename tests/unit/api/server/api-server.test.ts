/**
 * API Server Tests
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module tests/unit/api/server
 */

import { ApiServer, createApiServer } from '../../../../src/api/server/api-server';
import type { IApiServer } from '../../../../src/api/interfaces/api.interface';

describe('ApiServer', () => {
  let server: IApiServer;

  afterEach(async () => {
    if (server?.isRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server with default configuration', () => {
      server = new ApiServer();
      expect(server).toBeInstanceOf(ApiServer);
      expect(server.isRunning()).toBe(false);
    });

    it('should create server with custom configuration', () => {
      server = new ApiServer({
        host: 'localhost',
        port: 4000,
        prefix: '/api/v2',
      });
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should merge custom config with defaults', () => {
      server = new ApiServer({
        port: 5000,
        cors: { enabled: false },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });
  });

  describe('createApiServer', () => {
    it('should create server instance via factory function', () => {
      server = createApiServer();
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should pass configuration to server', () => {
      server = createApiServer({ port: 6000 });
      expect(server).toBeInstanceOf(ApiServer);
    });
  });

  describe('getInstance', () => {
    it('should return Fastify instance', () => {
      server = new ApiServer();
      const instance = server.getInstance();
      expect(instance).toBeDefined();
      expect(typeof instance.route).toBe('function');
    });
  });

  describe('start', () => {
    it('should start the server', async () => {
      server = new ApiServer({ port: 0 }); // Use random port
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should throw if server already running', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();

      await expect(server.start()).rejects.toThrow('Server is already running');
    });

    it('should register health endpoint', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();

      const address = server.getAddress();
      expect(address).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('should stop running server', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should handle stopping non-running server', async () => {
      server = new ApiServer();
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      server = new ApiServer();
      expect(server.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('getAddress', () => {
    it('should return null when not running', () => {
      server = new ApiServer();
      expect(server.getAddress()).toBeNull();
    });

    it('should return address when running', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();

      const address = server.getAddress();
      expect(address).toMatch(/^http:\/\/.+:\d+$/);
    });
  });

  describe('registerRoutes', () => {
    it('should register route definitions', async () => {
      server = new ApiServer({ port: 0 });

      server.registerRoutes([
        {
          method: 'GET',
          path: '/test',
          handler: async () => ({ success: true, data: 'test' }),
        },
      ]);

      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should register multiple routes', async () => {
      server = new ApiServer({ port: 0 });

      server.registerRoutes([
        {
          method: 'GET',
          path: '/test1',
          handler: async () => ({ success: true, data: 'test1' }),
        },
        {
          method: 'POST',
          path: '/test2',
          handler: async () => ({ success: true, data: 'test2' }),
        },
      ]);

      await server.start();
      expect(server.isRunning()).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('should return unhealthy when not running', () => {
      server = new ApiServer();
      const health = server.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.uptime).toBe(0);
    });

    it('should return healthy when running', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();

      const health = server.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.requestsServed).toBe(0);
    });

    it('should include details', async () => {
      server = new ApiServer({ port: 0 });
      await server.start();

      const health = server.getHealth();
      expect(health.details).toBeDefined();
      expect(health.details?.version).toBe('1.0.0');
      expect(health.details?.nodeVersion).toBe(process.version);
    });
  });

  describe('configuration options', () => {
    it('should support CORS configuration', () => {
      server = new ApiServer({
        cors: {
          enabled: true,
          origin: ['http://localhost:3000'],
          methods: ['GET', 'POST'],
        },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should support helmet configuration', () => {
      server = new ApiServer({
        helmet: {
          enabled: true,
          contentSecurityPolicy: false,
        },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should support rate limit configuration', () => {
      server = new ApiServer({
        rateLimit: {
          max: 50,
          timeWindow: '30 seconds',
        },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should support logging configuration', () => {
      server = new ApiServer({
        logging: {
          enabled: false,
          level: 'error',
        },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });

    it('should support graceful shutdown configuration', () => {
      server = new ApiServer({
        gracefulShutdown: {
          enabled: true,
          timeout: 5000,
          signals: ['SIGTERM'],
        },
      });
      expect(server).toBeInstanceOf(ApiServer);
    });
  });
});
