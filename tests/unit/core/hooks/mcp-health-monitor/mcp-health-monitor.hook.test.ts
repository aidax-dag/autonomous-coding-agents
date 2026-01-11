/**
 * MCP Health Monitor Hook Tests
 *
 * @module tests/unit/core/hooks/mcp-health-monitor
 */

import {
  MCPHealthMonitorHook,
  MCPServerStatusLevel,
  MCPServerConfig,
  HealthCheckResult,
  IMCPHealthChecker,
  IMCPServerManager,
  DEFAULT_MCP_HEALTH_MONITOR_CONFIG,
  DEFAULT_MCP_RECOVERY_OPTIONS,
} from '../../../../../src/core/hooks/mcp-health-monitor/index.js';
import { HookEvent, HookContext, HookAction } from '../../../../../src/core/interfaces/hook.interface.js';

/**
 * Create a mock server config
 */
function createMockServerConfig(id: string, overrides?: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    serverId: id,
    serverName: `Test Server ${id}`,
    endpoint: `http://localhost:${3000 + parseInt(id)}`,
    type: 'http',
    healthCheckIntervalMs: 30000,
    healthCheckTimeoutMs: 5000,
    autoRecoveryEnabled: true,
    ...overrides,
  };
}

/**
 * Create a test context
 */
function createMockContext(): HookContext<unknown> {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: {},
  };
}

/**
 * Create a healthy health check result
 */
function createHealthyResult(serverId: string, latencyMs = 50): HealthCheckResult {
  return {
    serverId,
    healthy: true,
    status: MCPServerStatusLevel.HEALTHY,
    latencyMs,
    details: [{ name: 'ping', passed: true, durationMs: latencyMs, message: 'OK' }],
    recommendations: [],
    timestamp: new Date(),
  };
}

/**
 * Create an unhealthy health check result
 */
function createUnhealthyResult(serverId: string, error: string): HealthCheckResult {
  return {
    serverId,
    healthy: false,
    status: MCPServerStatusLevel.UNHEALTHY,
    latencyMs: 0,
    details: [{ name: 'ping', passed: false, durationMs: 0, message: error }],
    recommendations: ['Check server connectivity'],
    timestamp: new Date(),
    error,
  };
}

describe('MCPHealthMonitorHook', () => {
  let hook: MCPHealthMonitorHook;

  beforeEach(() => {
    jest.useFakeTimers();
    hook = new MCPHealthMonitorHook();
  });

  afterEach(() => {
    hook.dispose();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create hook with default configuration', () => {
      expect(hook.name).toBe('mcp-health-monitor');
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
      expect(hook.priority).toBe(DEFAULT_MCP_HEALTH_MONITOR_CONFIG.priority);
      expect(hook.isEnabled()).toBe(true);
    });

    it('should create hook with custom priority', () => {
      const customHook = new MCPHealthMonitorHook({ priority: 50 });
      expect(customHook.priority).toBe(50);
      customHook.dispose();
    });

    it('should initialize with servers from config', () => {
      const serverConfig = createMockServerConfig('1');
      const hookWithServer = new MCPHealthMonitorHook({
        servers: [serverConfig],
      });

      expect(hookWithServer.getRegisteredServers()).toContain('1');
      expect(hookWithServer.getServerStatus('1')).toBeDefined();
      hookWithServer.dispose();
    });

    it('should be enabled by default', () => {
      expect(hook.isEnabled()).toBe(true);
    });

    it('should respect enabled config', () => {
      const disabledHook = new MCPHealthMonitorHook({ enabled: false });
      expect(disabledHook.isEnabled()).toBe(false);
      disabledHook.dispose();
    });
  });

  describe('server registration', () => {
    it('should register a server', () => {
      const config = createMockServerConfig('test-server');
      hook.registerServer(config);

      expect(hook.getRegisteredServers()).toContain('test-server');
    });

    it('should initialize server status as unknown', () => {
      const config = createMockServerConfig('test-server');
      hook.registerServer(config);

      const status = hook.getServerStatus('test-server');
      expect(status).toBeDefined();
      expect(status?.status).toBe(MCPServerStatusLevel.UNKNOWN);
    });

    it('should initialize server statistics', () => {
      const config = createMockServerConfig('test-server');
      hook.registerServer(config);

      const stats = hook.getStatistics('test-server');
      expect(stats).toBeDefined();
      expect(stats?.totalChecks).toBe(0);
      expect(stats?.successfulChecks).toBe(0);
    });

    it('should unregister a server', () => {
      const config = createMockServerConfig('test-server');
      hook.registerServer(config);
      hook.unregisterServer('test-server');

      expect(hook.getRegisteredServers()).not.toContain('test-server');
      expect(hook.getServerStatus('test-server')).toBeUndefined();
    });

    it('should return all registered servers', () => {
      hook.registerServer(createMockServerConfig('1'));
      hook.registerServer(createMockServerConfig('2'));
      hook.registerServer(createMockServerConfig('3'));

      const servers = hook.getRegisteredServers();
      expect(servers).toHaveLength(3);
      expect(servers).toContain('1');
      expect(servers).toContain('2');
      expect(servers).toContain('3');
    });
  });

  describe('health checks', () => {
    it('should return failed result for unregistered server', async () => {
      const result = await hook.checkHealth('nonexistent');
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Server not registered');
    });

    it('should use custom health check function when provided', async () => {
      const customHealthCheck = jest.fn().mockResolvedValue(createHealthyResult('custom-server'));

      hook.registerServer(createMockServerConfig('custom-server', {
        customHealthCheck,
      }));

      const result = await hook.checkHealth('custom-server');
      expect(customHealthCheck).toHaveBeenCalled();
      expect(result.healthy).toBe(true);
    });

    it('should use health checker when injected', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      const result = await hook.checkHealth('server-1');
      expect(mockChecker.checkHealth).toHaveBeenCalled();
      expect(result.healthy).toBe(true);
    });

    it('should use server manager for basic health check', async () => {
      const mockManager: IMCPServerManager = {
        restartServer: jest.fn().mockResolvedValue(true),
        getServerConfig: jest.fn(),
        getAllServerConfigs: jest.fn().mockReturnValue([]),
        isServerAvailable: jest.fn().mockReturnValue(true),
        getServerCapabilities: jest.fn().mockReturnValue(['tool-call']),
      };

      hook.setServerManager(mockManager);
      hook.registerServer(createMockServerConfig('server-1'));

      const result = await hook.checkHealth('server-1');
      expect(mockManager.isServerAvailable).toHaveBeenCalledWith('server-1');
      expect(result.healthy).toBe(true);
    });

    it('should return healthy result when no checker is available', async () => {
      hook.registerServer(createMockServerConfig('server-1'));

      const result = await hook.checkHealth('server-1');
      expect(result.healthy).toBe(true);
    });

    it('should check all servers', async () => {
      hook.registerServer(createMockServerConfig('1'));
      hook.registerServer(createMockServerConfig('2'));
      hook.registerServer(createMockServerConfig('3'));

      const results = await hook.checkAllHealth();
      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);
    });

    it('should handle health check timeout', async () => {
      const slowHealthCheck = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(createHealthyResult('slow')), 10000))
      );

      hook.registerServer(createMockServerConfig('slow', {
        customHealthCheck: slowHealthCheck,
        healthCheckTimeoutMs: 100,
      }));

      const resultPromise = hook.checkHealth('slow');
      await jest.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('status tracking', () => {
    it('should update status to healthy on successful check', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      const status = hook.getServerStatus('server-1');
      expect(status?.status).toBe(MCPServerStatusLevel.HEALTHY);
      expect(status?.consecutiveFailures).toBe(0);
    });

    it('should increment consecutive failures on failed check', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Connection failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      const status = hook.getServerStatus('server-1');
      expect(status?.consecutiveFailures).toBe(1);
    });

    it('should mark as unhealthy after consecutive failures threshold', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      // Default threshold is 3
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const status = hook.getServerStatus('server-1');
      expect(status?.status).toBe(MCPServerStatusLevel.UNHEALTHY);
      expect(status?.consecutiveFailures).toBe(3);
    });

    it('should reset consecutive failures on successful check', async () => {
      let checkCount = 0;
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockImplementation((serverId: string) => {
          checkCount++;
          if (checkCount <= 2) {
            return Promise.resolve(createUnhealthyResult(serverId, 'Failed'));
          }
          return Promise.resolve(createHealthyResult(serverId));
        }),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      expect(hook.getServerStatus('server-1')?.consecutiveFailures).toBe(2);

      await hook.checkHealth('server-1');
      expect(hook.getServerStatus('server-1')?.consecutiveFailures).toBe(0);
      expect(hook.getServerStatus('server-1')?.status).toBe(MCPServerStatusLevel.HEALTHY);
    });

    it('should mark as degraded on high latency', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 600)), // Above 500ms threshold
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      const status = hook.getServerStatus('server-1');
      expect(status?.status).toBe(MCPServerStatusLevel.DEGRADED);
    });
  });

  describe('statistics', () => {
    it('should track total checks', async () => {
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const stats = hook.getStatistics('server-1');
      expect(stats?.totalChecks).toBe(3);
    });

    it('should track successful checks', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const stats = hook.getStatistics('server-1');
      expect(stats?.successfulChecks).toBe(2);
      expect(stats?.failedChecks).toBe(0);
    });

    it('should track failed checks', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const stats = hook.getStatistics('server-1');
      expect(stats?.failedChecks).toBe(2);
    });

    it('should calculate average response time', async () => {
      let callCount = 0;
      const latencies = [100, 200, 300];
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockImplementation((serverId: string) => {
          const latency = latencies[callCount++] || 100;
          return Promise.resolve(createHealthyResult(serverId, latency));
        }),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const stats = hook.getStatistics('server-1');
      expect(stats?.averageResponseTimeMs).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should track min and max response times', async () => {
      let callCount = 0;
      const latencies = [100, 50, 300];
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockImplementation((serverId: string) => {
          const latency = latencies[callCount++] || 100;
          return Promise.resolve(createHealthyResult(serverId, latency));
        }),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const stats = hook.getStatistics('server-1');
      expect(stats?.minResponseTimeMs).toBe(50);
      expect(stats?.maxResponseTimeMs).toBe(300);
    });

    it('should reset statistics', async () => {
      hook.registerServer(createMockServerConfig('server-1'));
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      expect(hook.getStatistics('server-1')?.totalChecks).toBe(2);

      hook.resetStatistics('server-1');
      expect(hook.getStatistics('server-1')?.totalChecks).toBe(0);
    });

    it('should get all statistics', async () => {
      hook.registerServer(createMockServerConfig('1'));
      hook.registerServer(createMockServerConfig('2'));

      await hook.checkHealth('1');
      await hook.checkHealth('2');

      const allStats = hook.getAllStatistics();
      expect(allStats.size).toBe(2);
      expect(allStats.has('1')).toBe(true);
      expect(allStats.has('2')).toBe(true);
    });
  });

  describe('auto recovery', () => {
    it('should enable auto recovery for a server', () => {
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      expect(hook.getServerStatus('server-1')?.autoRecoveryEnabled).toBe(false);

      hook.enableAutoRecovery('server-1');
      expect(hook.getServerStatus('server-1')?.autoRecoveryEnabled).toBe(true);
    });

    it('should disable auto recovery for a server', () => {
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: true,
      }));

      hook.disableAutoRecovery('server-1');
      expect(hook.getServerStatus('server-1')?.autoRecoveryEnabled).toBe(false);
    });

    it('should trigger recovery when server becomes unhealthy', async () => {
      const mockManager: IMCPServerManager = {
        restartServer: jest.fn().mockResolvedValue(true),
        getServerConfig: jest.fn(),
        getAllServerConfigs: jest.fn().mockReturnValue([]),
        isServerAvailable: jest.fn().mockReturnValue(false),
        getServerCapabilities: jest.fn().mockReturnValue([]),
      };

      let checkCount = 0;
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockImplementation((serverId: string) => {
          checkCount++;
          if (checkCount <= 3) {
            return Promise.resolve(createUnhealthyResult(serverId, 'Failed'));
          }
          return Promise.resolve(createHealthyResult(serverId));
        }),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setServerManager(mockManager);
      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      // Trigger 3 failures to mark as unhealthy
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      // Wait for recovery attempt
      await jest.advanceTimersByTimeAsync(DEFAULT_MCP_RECOVERY_OPTIONS.retryDelayMs + 100);

      expect(mockManager.restartServer).toHaveBeenCalledWith('server-1');
    });

    it('should track recovery in progress', async () => {
      const mockManager: IMCPServerManager = {
        restartServer: jest.fn().mockImplementation(() =>
          new Promise((resolve) => setTimeout(() => resolve(true), 1000))
        ),
        getServerConfig: jest.fn(),
        getAllServerConfigs: jest.fn().mockReturnValue([]),
        isServerAvailable: jest.fn().mockReturnValue(false),
        getServerCapabilities: jest.fn().mockReturnValue([]),
      };

      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setServerManager(mockManager);
      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      // Trigger failures
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      // Start recovery
      await jest.advanceTimersByTimeAsync(DEFAULT_MCP_RECOVERY_OPTIONS.retryDelayMs + 50);

      expect(hook.isRecoveryInProgress('server-1')).toBe(true);

      // Complete recovery
      await jest.advanceTimersByTimeAsync(1500);
      expect(hook.isRecoveryInProgress('server-1')).toBe(false);
    });

    it('should manually trigger recovery', async () => {
      const mockManager: IMCPServerManager = {
        restartServer: jest.fn().mockResolvedValue(true),
        getServerConfig: jest.fn(),
        getAllServerConfigs: jest.fn().mockReturnValue([]),
        isServerAvailable: jest.fn().mockReturnValue(true),
        getServerCapabilities: jest.fn().mockReturnValue([]),
      };

      hook.setServerManager(mockManager);
      hook.registerServer(createMockServerConfig('server-1'));

      const recoveryPromise = hook.triggerRecovery('server-1');
      await jest.advanceTimersByTimeAsync(DEFAULT_MCP_RECOVERY_OPTIONS.retryDelayMs + 100);

      const result = await recoveryPromise;
      expect(result).toBe(true);
      expect(mockManager.restartServer).toHaveBeenCalledWith('server-1');
    });

    it('should return false for unregistered server recovery', async () => {
      const result = await hook.triggerRecovery('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('monitoring', () => {
    it('should start monitoring', () => {
      hook.registerServer(createMockServerConfig('server-1'));
      hook.startMonitoring();

      expect(hook.isMonitoringActive()).toBe(true);
    });

    it('should stop monitoring', () => {
      hook.registerServer(createMockServerConfig('server-1'));
      hook.startMonitoring();
      hook.stopMonitoring();

      expect(hook.isMonitoringActive()).toBe(false);
    });

    it('should perform periodic health checks when monitoring', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));
      hook.startMonitoring();

      // Advance past the health check interval
      await jest.advanceTimersByTimeAsync(DEFAULT_MCP_HEALTH_MONITOR_CONFIG.healthCheckIntervalMs + 100);

      expect(mockChecker.checkHealth).toHaveBeenCalled();
    });

    it('should not start monitoring twice', () => {
      hook.startMonitoring();
      hook.startMonitoring();

      expect(hook.isMonitoringActive()).toBe(true);
      hook.stopMonitoring();
      expect(hook.isMonitoringActive()).toBe(false);
    });
  });

  describe('subscriptions', () => {
    it('should subscribe to status changes', async () => {
      const callback = jest.fn();
      hook.onStatusChange(callback);

      let checkCount = 0;
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockImplementation((serverId: string) => {
          checkCount++;
          if (checkCount <= 3) {
            return Promise.resolve(createUnhealthyResult(serverId, 'Failed'));
          }
          return Promise.resolve(createHealthyResult(serverId));
        }),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      // Trigger status changes
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      expect(callback).toHaveBeenCalled();
    });

    it('should subscribe to health warnings', async () => {
      const callback = jest.fn();
      hook.onHealthWarning(callback);

      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 1500)), // High latency
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe('high_latency');
    });

    it('should subscribe to health check results', async () => {
      const callback = jest.fn();
      hook.onHealthCheck(callback);

      hook.registerServer(createMockServerConfig('server-1'));
      await hook.checkHealth('server-1');

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].serverId).toBe('server-1');
    });

    it('should subscribe to recovery events', async () => {
      const callback = jest.fn();
      hook.onRecovery(callback);

      const mockManager: IMCPServerManager = {
        restartServer: jest.fn().mockResolvedValue(true),
        getServerConfig: jest.fn(),
        getAllServerConfigs: jest.fn().mockReturnValue([]),
        isServerAvailable: jest.fn().mockReturnValue(true),
        getServerCapabilities: jest.fn().mockReturnValue([]),
      };

      hook.setServerManager(mockManager);
      hook.registerServer(createMockServerConfig('server-1'));

      const recoveryPromise = hook.triggerRecovery('server-1');
      await jest.advanceTimersByTimeAsync(DEFAULT_MCP_RECOVERY_OPTIONS.retryDelayMs + 100);
      await recoveryPromise;

      expect(callback).toHaveBeenCalledWith('server-1', true, undefined);
    });

    it('should unsubscribe correctly', () => {
      const callback = jest.fn();
      const subscription = hook.onStatusChange(callback);

      subscription.unsubscribe();

      // The callback should no longer be in the list
      hook.registerServer(createMockServerConfig('server-1'));
    });
  });

  describe('warnings', () => {
    it('should generate high latency warning', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 1500)),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      const warnings = hook.getActiveWarnings('server-1');
      expect(warnings.some((w) => w.type === 'high_latency')).toBe(true);
    });

    it('should generate degraded warning', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 600)),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      await hook.checkHealth('server-1');

      const warnings = hook.getActiveWarnings('server-1');
      expect(warnings.some((w) => w.type === 'degraded')).toBe(true);
    });

    it('should generate consecutive failures warning', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const warnings = hook.getActiveWarnings('server-1');
      expect(warnings.some((w) => w.type === 'consecutive_failures')).toBe(true);
    });

    it('should get all active warnings', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 1500)),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('1'));
      hook.registerServer(createMockServerConfig('2'));

      await hook.checkHealth('1');
      await hook.checkHealth('2');

      const allWarnings = hook.getActiveWarnings();
      expect(allWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    it('should execute and return status data', async () => {
      hook.registerServer(createMockServerConfig('server-1'));

      const result = await hook.execute(createMockContext());

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.data).toBeDefined();
      expect(result.data?.serverStatuses).toBeDefined();
    });

    it('should report unhealthy servers', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createUnhealthyResult('server-1', 'Failed')),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      // Make unhealthy first
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');
      await hook.checkHealth('server-1');

      const result = await hook.execute(createMockContext());

      expect(result.message).toContain('Unhealthy');
      expect(result.message).toContain('server-1');
    });

    it('should report degraded servers', async () => {
      const mockChecker: IMCPHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue(createHealthyResult('server-1', 600)),
        supportsHealthCheck: jest.fn().mockReturnValue(true),
      };

      hook.setHealthChecker(mockChecker);
      hook.registerServer(createMockServerConfig('server-1'));

      const result = await hook.execute(createMockContext());

      expect(result.message).toContain('Degraded');
      expect(result.message).toContain('server-1');
    });
  });

  describe('dispose', () => {
    it('should stop monitoring on dispose', () => {
      hook.startMonitoring();
      expect(hook.isMonitoringActive()).toBe(true);

      hook.dispose();
      expect(hook.isMonitoringActive()).toBe(false);
    });

    it('should clear all state on dispose', () => {
      hook.registerServer(createMockServerConfig('server-1'));
      hook.onStatusChange(() => {});
      hook.onHealthWarning(() => {});

      hook.dispose();

      expect(hook.getRegisteredServers()).toHaveLength(0);
      expect(hook.getAllServerStatuses().size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle callback errors gracefully', async () => {
      hook.onHealthCheck(() => {
        throw new Error('Callback error');
      });

      hook.registerServer(createMockServerConfig('server-1'));

      // Should not throw
      await expect(hook.checkHealth('server-1')).resolves.toBeDefined();
    });

    it('should handle concurrent health checks', async () => {
      hook.registerServer(createMockServerConfig('server-1'));

      const results = await Promise.all([
        hook.checkHealth('server-1'),
        hook.checkHealth('server-1'),
        hook.checkHealth('server-1'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.serverId).toBe('server-1');
      });
    });

    it('should handle empty server list', async () => {
      const results = await hook.checkAllHealth();
      expect(results.size).toBe(0);
    });

    it('should use custom recovery options', () => {
      hook.registerServer(createMockServerConfig('server-1', {
        autoRecoveryEnabled: false,
      }));

      hook.enableAutoRecovery('server-1', {
        maxRetries: 5,
        retryDelayMs: 2000,
      });

      expect(hook.getServerStatus('server-1')?.autoRecoveryEnabled).toBe(true);
    });
  });
});
