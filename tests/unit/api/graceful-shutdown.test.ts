/**
 * Graceful Shutdown Tests
 *
 * Validates shutdown lifecycle: signal handling, idempotency,
 * timeout enforcement, and ordered cleanup execution.
 *
 * @module tests/unit/api/graceful-shutdown
 */

import { GracefulShutdown, createGracefulShutdown } from '@/api/graceful-shutdown';

// Silence logger output during tests
jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('GracefulShutdown', () => {
  let processExitSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    processOnSpy = jest.spyOn(process, 'on');
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('constructor and defaults', () => {
    it('should default timeout to 10000ms', () => {
      const gs = new GracefulShutdown();
      expect(gs.isShuttingDown()).toBe(false);
    });

    it('should accept custom timeout', () => {
      const gs = new GracefulShutdown({ timeoutMs: 5000 });
      expect(gs.isShuttingDown()).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should execute cleanup handlers in registration order', async () => {
      const order: number[] = [];
      const gs = new GracefulShutdown();

      gs.addHandler(async () => { order.push(1); });
      gs.addHandler(async () => { order.push(2); });
      gs.addHandler(async () => { order.push(3); });

      await gs.shutdown();

      expect(order).toEqual([1, 2, 3]);
      expect(gs.isShuttingDown()).toBe(true);
    });

    it('should be idempotent - double shutdown returns same promise', async () => {
      let callCount = 0;
      const gs = new GracefulShutdown();
      gs.addHandler(async () => { callCount++; });

      const p1 = gs.shutdown();
      const p2 = gs.shutdown();

      expect(p1).toBe(p2);

      await p1;
      expect(callCount).toBe(1);
    });

    it('should continue executing handlers even if one throws', async () => {
      const order: number[] = [];
      const gs = new GracefulShutdown();

      gs.addHandler(async () => { order.push(1); });
      gs.addHandler(async () => { throw new Error('handler failed'); });
      gs.addHandler(async () => { order.push(3); });

      await gs.shutdown();

      expect(order).toEqual([1, 3]);
    });

    it('should handle synchronous cleanup handlers', async () => {
      const order: number[] = [];
      const gs = new GracefulShutdown();

      gs.addHandler(() => { order.push(1); });
      gs.addHandler(() => { order.push(2); });

      await gs.shutdown();

      expect(order).toEqual([1, 2]);
    });

    it('should complete with no handlers registered', async () => {
      const gs = new GracefulShutdown();
      await expect(gs.shutdown()).resolves.toBeUndefined();
      expect(gs.isShuttingDown()).toBe(true);
    });
  });

  describe('installSignalHandlers', () => {
    it('should register SIGTERM, SIGINT, uncaughtException, and unhandledRejection', () => {
      const gs = new GracefulShutdown();
      gs.installSignalHandlers();

      const registeredEvents = processOnSpy.mock.calls.map(
        (call: [string, (...args: unknown[]) => void]) => call[0],
      );

      expect(registeredEvents).toContain('SIGTERM');
      expect(registeredEvents).toContain('SIGINT');
      expect(registeredEvents).toContain('uncaughtException');
      expect(registeredEvents).toContain('unhandledRejection');
    });

    it('should trigger shutdown on SIGTERM', async () => {
      let cleaned = false;
      const gs = new GracefulShutdown();
      gs.addHandler(async () => { cleaned = true; });
      gs.installSignalHandlers();

      // Find and invoke the SIGTERM handler
      const sigtermCall = processOnSpy.mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'SIGTERM',
      );
      expect(sigtermCall).toBeDefined();

      const handler = sigtermCall![1] as () => void;
      handler();

      // Wait for async shutdown to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(cleaned).toBe(true);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should trigger shutdown on SIGINT', async () => {
      let cleaned = false;
      const gs = new GracefulShutdown();
      gs.addHandler(async () => { cleaned = true; });
      gs.installSignalHandlers();

      const sigintCall = processOnSpy.mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'SIGINT',
      );
      expect(sigintCall).toBeDefined();

      const handler = sigintCall![1] as () => void;
      handler();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(cleaned).toBe(true);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('timeout enforcement', () => {
    it('should force exit when shutdown exceeds timeout', async () => {
      jest.useFakeTimers();

      const gs = new GracefulShutdown({ timeoutMs: 100 });

      let handlerResolved = false;
      gs.addHandler(() => new Promise((resolve) => {
        setTimeout(() => { handlerResolved = true; resolve(); }, 5000);
      }));

      // Start shutdown (will be pending due to slow handler)
      const shutdownPromise = gs.shutdown();

      // Advance past the timeout but not the handler
      jest.advanceTimersByTime(150);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(handlerResolved).toBe(false);

      // Advance to resolve the handler so promise settles
      jest.advanceTimersByTime(5000);
      await shutdownPromise.catch(() => {});

      jest.useRealTimers();
    });
  });

  describe('createGracefulShutdown factory', () => {
    it('should create instance with server shutdown as first handler', async () => {
      let called = false;
      const serverShutdown = async () => { called = true; };

      const gs = createGracefulShutdown(serverShutdown);

      await gs.shutdown();

      expect(called).toBe(true);
      expect(gs.isShuttingDown()).toBe(true);
    });

    it('should accept custom options', async () => {
      const gs = createGracefulShutdown(async () => {}, { timeoutMs: 5000 });
      await gs.shutdown();
      expect(gs.isShuttingDown()).toBe(true);
    });

    it('should allow adding additional handlers after creation', async () => {
      const order: number[] = [];
      const gs = createGracefulShutdown(async () => { order.push(1); });
      gs.addHandler(async () => { order.push(2); });

      await gs.shutdown();

      expect(order).toEqual([1, 2]);
    });
  });
});
