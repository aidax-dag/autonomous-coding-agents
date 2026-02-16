/**
 * ExternalSyncManager Tests
 *
 * Tests the sync orchestration layer: adapter delegation, error isolation,
 * retry with exponential backoff, and enable/disable configuration.
 *
 * All adapter interactions are verified through a mock IExternalSyncAdapter.
 * The manager's sleep method is stubbed to eliminate real delays in tests.
 */

import { ExternalSyncManager } from '@/core/ticketing/sync/sync-manager';
import type {
  IExternalSyncAdapter,
  ExternalSyncResult,
  ExternalSyncConfig,
} from '@/core/ticketing/sync/external-sync.interface';
import type { TicketRecord, TicketReview } from '@/core/ticketing/ticket-feature-service';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    ticketId: 'TKT-001',
    managementNumber: 'ACA-100',
    title: 'Implement sync manager',
    background: 'Need external sync for ticket lifecycle events',
    problem: 'No external visibility into ticket status',
    workDescription: 'Build sync manager with adapter pattern',
    status: 'created',
    createdAt: '2026-02-16T00:00:00.000Z',
    updatedAt: '2026-02-16T00:00:00.000Z',
    expectedArtifacts: [
      { name: 'sync-manager.ts', type: 'source', description: 'Sync manager implementation' },
    ],
    verification: {
      method: 'unit-test',
      conditions: ['All sync events delegated to adapter'],
      checklist: ['Tests pass'],
    },
    createdBy: { agentId: 'planner-01', role: 'planner' },
    assignees: [],
    artifacts: [],
    issues: [],
    reviews: [],
    ...overrides,
  };
}

function createMockReview(overrides: Partial<TicketReview> = {}): TicketReview {
  return {
    reviewerId: 'reviewer-01',
    decision: 'approved',
    comment: 'Looks good',
    updatedAt: '2026-02-16T01:00:00.000Z',
    ...overrides,
  } as TicketReview;
}

function createSuccessResult(overrides: Partial<ExternalSyncResult> = {}): ExternalSyncResult {
  return {
    success: true,
    externalId: '42',
    externalUrl: 'https://github.com/test/repo/issues/42',
    ...overrides,
  };
}

function createFailureResult(
  overrides: Partial<ExternalSyncResult> = {},
): ExternalSyncResult {
  return {
    success: false,
    error: 'Something went wrong',
    retryable: false,
    ...overrides,
  };
}

function createMockAdapter(
  overrides: Partial<IExternalSyncAdapter> = {},
): jest.Mocked<IExternalSyncAdapter> {
  return {
    provider: 'mock',
    syncTicketCreated: jest.fn().mockResolvedValue(createSuccessResult()),
    syncStatusChange: jest.fn().mockResolvedValue(createSuccessResult()),
    syncReviewAdded: jest.fn().mockResolvedValue(createSuccessResult()),
    testConnection: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Stub the private sleep method on a manager instance so retry tests
 * complete instantly. Uses Object property access to bypass TypeScript
 * private visibility.
 */
function stubSleep(manager: ExternalSyncManager): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (manager as any).sleep = jest.fn().mockResolvedValue(undefined);
}

// ============================================================================
// Tests
// ============================================================================

describe('ExternalSyncManager', () => {
  // --------------------------------------------------------------------------
  // Construction and Configuration
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should default to disabled sync with no adapter', () => {
      const manager = new ExternalSyncManager();

      expect(manager.isActive()).toBe(false);
      expect(manager.getConfig().enabled).toBe(false);
      expect(manager.getConfig().provider).toBe('none');
    });

    it('should accept partial config overrides', () => {
      const manager = new ExternalSyncManager({ retryAttempts: 5, retryDelayMs: 500 });
      const config = manager.getConfig();

      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelayMs).toBe(500);
      expect(config.enabled).toBe(false);
    });

    it('should not create adapter when enabled but provider is none', () => {
      const manager = new ExternalSyncManager({ enabled: true, provider: 'none' });

      expect(manager.isActive()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return false when disabled', () => {
      const manager = new ExternalSyncManager({ enabled: false });

      expect(manager.isActive()).toBe(false);
    });

    it('should return true when enabled with injected adapter', () => {
      const manager = new ExternalSyncManager({ enabled: true });
      manager.setAdapter(createMockAdapter());

      expect(manager.isActive()).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config (not a reference)', () => {
      const manager = new ExternalSyncManager({ retryAttempts: 2 });
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('updateConfig', () => {
    it('should disable sync and clear adapter when enabled set to false', () => {
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true }, logger);
      manager.setAdapter(createMockAdapter());
      expect(manager.isActive()).toBe(true);

      manager.updateConfig({ enabled: false });

      expect(manager.isActive()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('External sync disabled');
    });

    it('should disable sync when provider set to none', () => {
      const manager = new ExternalSyncManager({ enabled: true });
      manager.setAdapter(createMockAdapter());

      manager.updateConfig({ provider: 'none' });

      expect(manager.isActive()).toBe(false);
    });

    it('should update retry configuration', () => {
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 3 });

      manager.updateConfig({ retryAttempts: 10 });

      expect(manager.getConfig().retryAttempts).toBe(10);
    });

    it('should clear adapter when provider is none even if adapter was injected', () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, provider: 'none' });
      manager.setAdapter(adapter);
      expect(manager.isActive()).toBe(true);

      // updateConfig checks provider=none and clears the adapter
      manager.updateConfig({ retryAttempts: 5 });

      expect(manager.isActive()).toBe(false);
    });
  });

  describe('setAdapter', () => {
    it('should inject a custom adapter', () => {
      const logger = createMockLogger();
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true }, logger);

      manager.setAdapter(adapter);

      expect(manager.isActive()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Custom sync adapter injected',
        expect.objectContaining({ provider: 'mock' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // Lifecycle Event Handlers
  // --------------------------------------------------------------------------

  describe('onTicketCreated', () => {
    it('should delegate to adapter.syncTicketCreated', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const ticket = createMockTicket();
      const result = await manager.onTicketCreated(ticket);

      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1);
      expect(adapter.syncTicketCreated).toHaveBeenCalledWith(ticket);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.externalId).toBe('42');
    });

    it('should return null when sync is disabled', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: false });
      manager.setAdapter(adapter);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(result).toBeNull();
      expect(adapter.syncTicketCreated).not.toHaveBeenCalled();
    });

    it('should return null when no adapter is configured', async () => {
      const manager = new ExternalSyncManager({ enabled: true, provider: 'none' });

      const result = await manager.onTicketCreated(createMockTicket());

      expect(result).toBeNull();
    });
  });

  describe('onStatusChange', () => {
    it('should delegate to adapter.syncStatusChange', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const result = await manager.onStatusChange('TKT-001', 'created', 'in_progress');

      expect(adapter.syncStatusChange).toHaveBeenCalledTimes(1);
      expect(adapter.syncStatusChange).toHaveBeenCalledWith('TKT-001', 'created', 'in_progress');
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });

    it('should return null when sync is disabled', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: false });
      manager.setAdapter(adapter);

      const result = await manager.onStatusChange('TKT-001', 'created', 'in_progress');

      expect(result).toBeNull();
      expect(adapter.syncStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('onReviewAdded', () => {
    it('should delegate to adapter.syncReviewAdded', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const review = createMockReview();
      const result = await manager.onReviewAdded('TKT-001', review);

      expect(adapter.syncReviewAdded).toHaveBeenCalledTimes(1);
      expect(adapter.syncReviewAdded).toHaveBeenCalledWith('TKT-001', review);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });

    it('should return null when sync is disabled', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: false });
      manager.setAdapter(adapter);

      const result = await manager.onReviewAdded('TKT-001', createMockReview());

      expect(result).toBeNull();
      expect(adapter.syncReviewAdded).not.toHaveBeenCalled();
    });

    it('should pass review with changes_requested decision', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const review = createMockReview({ decision: 'changes_requested', comment: 'Needs work' });
      await manager.onReviewAdded('TKT-001', review);

      expect(adapter.syncReviewAdded).toHaveBeenCalledWith('TKT-001', review);
    });
  });

  // --------------------------------------------------------------------------
  // Error Isolation
  // --------------------------------------------------------------------------

  describe('error isolation', () => {
    it('should not throw when adapter.syncTicketCreated throws', async () => {
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockRejectedValue(new Error('Network failure')),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Network failure');
    });

    it('should not throw when adapter.syncStatusChange throws', async () => {
      const adapter = createMockAdapter({
        syncStatusChange: jest.fn().mockRejectedValue(new Error('API timeout')),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const result = await manager.onStatusChange('TKT-001', 'created', 'in_progress');

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('API timeout');
    });

    it('should not throw when adapter.syncReviewAdded throws', async () => {
      const adapter = createMockAdapter({
        syncReviewAdded: jest.fn().mockRejectedValue(new Error('Auth expired')),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const result = await manager.onReviewAdded('TKT-001', createMockReview());

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Auth expired');
    });

    it('should capture non-Error thrown values', async () => {
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockRejectedValue('string error'),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(result!.success).toBe(false);
      expect(result!.error).toContain('string error');
    });
  });

  // --------------------------------------------------------------------------
  // Retry Behavior
  // --------------------------------------------------------------------------

  describe('retry behavior', () => {
    it('should retry retryable failures up to configured attempts', async () => {
      const retryableFailure = createFailureResult({ retryable: true, error: 'Server error' });
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(retryableFailure),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 3, retryDelayMs: 1 });
      manager.setAdapter(adapter);
      stubSleep(manager);

      const result = await manager.onTicketCreated(createMockTicket());

      // 1 initial + 3 retries = 4 total calls
      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(4);
      expect(result!.success).toBe(false);
      expect(result!.error).toBe('Server error');
    });

    it('should not retry non-retryable failures', async () => {
      const nonRetryableFailure = createFailureResult({ retryable: false, error: 'Auth error' });
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(nonRetryableFailure),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 3, retryDelayMs: 1 });
      manager.setAdapter(adapter);
      stubSleep(manager);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1);
      expect(result!.success).toBe(false);
      expect(result!.error).toBe('Auth error');
    });

    it('should succeed on retry after transient failure', async () => {
      const retryableFailure = createFailureResult({ retryable: true, error: 'Transient' });
      const successResult = createSuccessResult();
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn()
          .mockResolvedValueOnce(retryableFailure)
          .mockResolvedValueOnce(retryableFailure)
          .mockResolvedValueOnce(successResult),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 3, retryDelayMs: 1 });
      manager.setAdapter(adapter);
      stubSleep(manager);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(3);
      expect(result!.success).toBe(true);
      expect(result!.externalId).toBe('42');
    });

    it('should retry when adapter throws an exception', async () => {
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn()
          .mockRejectedValueOnce(new Error('Connection refused'))
          .mockResolvedValueOnce(createSuccessResult()),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 2, retryDelayMs: 1 });
      manager.setAdapter(adapter);
      stubSleep(manager);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(2);
      expect(result!.success).toBe(true);
    });

    it('should return failure after all retry attempts exhausted with exceptions', async () => {
      const adapter = createMockAdapter({
        syncStatusChange: jest.fn().mockRejectedValue(new Error('Persistent failure')),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 2, retryDelayMs: 1 });
      manager.setAdapter(adapter);
      stubSleep(manager);

      const result = await manager.onStatusChange('TKT-001', 'created', 'in_progress');

      // 1 initial + 2 retries = 3 total
      expect(adapter.syncStatusChange).toHaveBeenCalledTimes(3);
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Persistent failure');
    });

    it('should not retry when retryAttempts is 0', async () => {
      const retryableFailure = createFailureResult({ retryable: true });
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(retryableFailure),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0, retryDelayMs: 1 });
      manager.setAdapter(adapter);

      const result = await manager.onTicketCreated(createMockTicket());

      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1);
      expect(result!.success).toBe(false);
    });

    it('should use exponential backoff between retries', async () => {
      const retryableFailure = createFailureResult({ retryable: true });
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(retryableFailure),
      });
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 3, retryDelayMs: 100 });
      manager.setAdapter(adapter);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sleepSpy = jest.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (manager as any).sleep = sleepSpy;

      await manager.onTicketCreated(createMockTicket());

      expect(sleepSpy).toHaveBeenCalledTimes(3);
      // Verify exponential pattern: baseDelay * 2^attempt + jitter
      // attempt 0: 100 * 1 + jitter (100-200)
      // attempt 1: 100 * 2 + jitter (200-300)
      // attempt 2: 100 * 4 + jitter (400-500)
      const delays = sleepSpy.mock.calls.map((call: number[]) => call[0]);
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThan(200);
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThan(300);
      expect(delays[2]).toBeGreaterThanOrEqual(400);
      expect(delays[2]).toBeLessThan(500);
    });
  });

  // --------------------------------------------------------------------------
  // Enable/Disable via Config
  // --------------------------------------------------------------------------

  describe('enable/disable via config', () => {
    it('should skip sync when disabled at construction', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: false });
      manager.setAdapter(adapter);

      await manager.onTicketCreated(createMockTicket());
      await manager.onStatusChange('TKT-001', 'created', 'in_progress');
      await manager.onReviewAdded('TKT-001', createMockReview());

      expect(adapter.syncTicketCreated).not.toHaveBeenCalled();
      expect(adapter.syncStatusChange).not.toHaveBeenCalled();
      expect(adapter.syncReviewAdded).not.toHaveBeenCalled();
    });

    it('should skip sync after runtime disable via updateConfig', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      // First call works
      await manager.onTicketCreated(createMockTicket());
      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1);

      // Disable at runtime
      manager.updateConfig({ enabled: false });

      // Subsequent calls are skipped
      await manager.onTicketCreated(createMockTicket());
      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1); // still 1
    });

    it('should resume sync after re-enabling via updateConfig', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      manager.updateConfig({ enabled: false });
      await manager.onTicketCreated(createMockTicket());
      expect(adapter.syncTicketCreated).not.toHaveBeenCalled();

      // Re-enable and re-inject adapter (updateConfig clears adapter on disable)
      manager.updateConfig({ enabled: true, provider: 'none' });
      manager.setAdapter(adapter);
      await manager.onTicketCreated(createMockTicket());
      expect(adapter.syncTicketCreated).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // testConnection
  // --------------------------------------------------------------------------

  describe('testConnection', () => {
    it('should return true when adapter connection succeeds', async () => {
      const adapter = createMockAdapter({ testConnection: jest.fn().mockResolvedValue(true) });
      const manager = new ExternalSyncManager({ enabled: true });
      manager.setAdapter(adapter);

      const ok = await manager.testConnection();

      expect(ok).toBe(true);
      expect(adapter.testConnection).toHaveBeenCalledTimes(1);
    });

    it('should return false when adapter connection fails', async () => {
      const adapter = createMockAdapter({ testConnection: jest.fn().mockResolvedValue(false) });
      const manager = new ExternalSyncManager({ enabled: true });
      manager.setAdapter(adapter);

      const ok = await manager.testConnection();

      expect(ok).toBe(false);
    });

    it('should return false when no adapter is configured', async () => {
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true, provider: 'none' }, logger);

      const ok = await manager.testConnection();

      expect(ok).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no adapter configured'),
      );
    });

    it('should return false and log error when testConnection throws', async () => {
      const adapter = createMockAdapter({
        testConnection: jest.fn().mockRejectedValue(new Error('DNS failure')),
      });
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true }, logger);
      manager.setAdapter(adapter);

      const ok = await manager.testConnection();

      expect(ok).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection test threw'),
        expect.objectContaining({ error: 'DNS failure' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // Logging
  // --------------------------------------------------------------------------

  describe('logging', () => {
    it('should log success on sync completion', async () => {
      const adapter = createMockAdapter();
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 }, logger);
      manager.setAdapter(adapter);

      await manager.onTicketCreated(createMockTicket());

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('syncTicketCreated succeeded'),
        expect.objectContaining({ ticketId: 'TKT-001', event: 'ticketCreated' }),
      );
    });

    it('should log warning on non-retryable failure', async () => {
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(
          createFailureResult({ retryable: false, error: 'Validation error' }),
        ),
      });
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 }, logger);
      manager.setAdapter(adapter);

      await manager.onTicketCreated(createMockTicket());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-retryable'),
        expect.objectContaining({ error: 'Validation error' }),
      );
    });

    it('should log error when all retries exhausted', async () => {
      const adapter = createMockAdapter({
        syncTicketCreated: jest.fn().mockResolvedValue(
          createFailureResult({ retryable: true, error: 'Server down' }),
        ),
      });
      const logger = createMockLogger();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 1, retryDelayMs: 1 }, logger);
      manager.setAdapter(adapter);
      stubSleep(manager);

      await manager.onTicketCreated(createMockTicket());

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed after all retries'),
        expect.objectContaining({ maxAttempts: 1 }),
      );
    });

    it('should work with default no-op logger without errors', async () => {
      const adapter = createMockAdapter();
      const manager = new ExternalSyncManager({ enabled: true, retryAttempts: 0 });
      manager.setAdapter(adapter);

      // Should not throw even without a logger
      await expect(manager.onTicketCreated(createMockTicket())).resolves.not.toThrow();
    });
  });
});
