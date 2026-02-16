/**
 * MCP Gate Tests
 *
 * Verifies that checkMCPReadiness correctly evaluates:
 *  - ServiceRegistry initialization state
 *  - MCP connection status (ConnectionManager and MCPClient paths)
 *  - Required tool availability
 *  - Telemetry emission for success and failure
 *  - Correct reason codes in each scenario
 */

import {
  checkMCPReadiness,
  MCPGateReasonCode,
  type MCPGateResult,
} from '../../../../src/core/ticketing/mcp-gate';

// ---------------------------------------------------------------------------
// Mock logger to verify telemetry emission
// ---------------------------------------------------------------------------
// jest.mock() is hoisted above all variable declarations. To get stable
// references to the mock fns, we create them inside the factory and then
// expose them via a __mockLogger property on the mocked module. Test code
// retrieves the reference via require() after the factory has executed.

jest.mock('../../../../src/shared/logging/logger', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __mockLogger: logger,
    createAgentLogger: () => logger,
  };
});

// Access the shared mock logger via require so we get the same object
// the production code received during module initialization.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockLogger: mockLogger } = require('../../../../src/shared/logging/logger') as {
  __mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };
};

// ---------------------------------------------------------------------------
// Helpers to build mock ServiceRegistry instances
// ---------------------------------------------------------------------------

interface MockRegistryOptions {
  initialized?: boolean;
  connectionManager?: {
    statuses: Array<{ connected: boolean; toolCount: number; name: string }>;
    tools?: Array<{ name: string }>;
  } | null;
  mcpClient?: { connected: boolean } | null;
}

function createMockRegistry(options: MockRegistryOptions = {}) {
  const {
    initialized = true,
    connectionManager = null,
    mcpClient = null,
  } = options;

  return {
    isInitialized: () => initialized,
    getMCPConnectionManager: () => {
      if (!connectionManager) return null;
      return {
        getStatus: () => connectionManager.statuses,
        getAllTools: () => connectionManager.tools ?? [],
      };
    },
    getMCPClient: () => {
      if (!mcpClient) return null;
      return {
        isConnected: () => mcpClient.connected,
      };
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkMCPReadiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // REGISTRY_NOT_INITIALIZED
  // =========================================================================
  describe('REGISTRY_NOT_INITIALIZED', () => {
    it('returns REGISTRY_NOT_INITIALIZED when registry is not initialized', () => {
      const registry = createMockRegistry({ initialized: false });

      const result: MCPGateResult = checkMCPReadiness(registry);

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.REGISTRY_NOT_INITIALIZED);
      expect(result.details).toContain('ServiceRegistry is not initialized');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].name).toBe('ServiceRegistry initialized');
      expect(result.checks[0].passed).toBe(false);
    });

    it('does not run connection or tools checks when registry is not initialized', () => {
      const registry = createMockRegistry({ initialized: false });

      const result = checkMCPReadiness(registry, {
        requiredTools: ['some-tool'],
      });

      // Only one check should be present — short-circuit behavior
      expect(result.checks).toHaveLength(1);
      expect(result.reasonCode).toBe(MCPGateReasonCode.REGISTRY_NOT_INITIALIZED);
    });
  });

  // =========================================================================
  // MCP_NOT_CONNECTED
  // =========================================================================
  describe('MCP_NOT_CONNECTED', () => {
    it('returns MCP_NOT_CONNECTED when ConnectionManager has no connected servers', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [
            { name: 'server-a', connected: false, toolCount: 0 },
            { name: 'server-b', connected: false, toolCount: 0 },
          ],
        },
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.MCP_NOT_CONNECTED);
      expect(result.details).toContain('No MCP server connected');
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].passed).toBe(true); // registry check
      expect(result.checks[1].passed).toBe(false); // connection check
    });

    it('returns MCP_NOT_CONNECTED when MCPClient exists but is not connected', () => {
      const registry = createMockRegistry({
        initialized: true,
        mcpClient: { connected: false },
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.MCP_NOT_CONNECTED);
      expect(result.checks[1].message).toContain('not connected');
    });

    it('returns MCP_NOT_CONNECTED when no ConnectionManager and no MCPClient', () => {
      const registry = createMockRegistry({
        initialized: true,
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.MCP_NOT_CONNECTED);
      expect(result.checks[1].message).toContain(
        'No MCP client or connection manager available',
      );
    });

    it('does not run tools check when connection is not active', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: false, toolCount: 0 }],
        },
      });

      const result = checkMCPReadiness(registry, {
        requiredTools: ['some-tool'],
      });

      // Only registry + connection checks, tools check skipped
      expect(result.checks).toHaveLength(2);
      expect(result.reasonCode).toBe(MCPGateReasonCode.MCP_NOT_CONNECTED);
    });
  });

  // =========================================================================
  // TOOLS_UNAVAILABLE
  // =========================================================================
  describe('TOOLS_UNAVAILABLE', () => {
    it('returns TOOLS_UNAVAILABLE when required tools are missing', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 1 }],
          tools: [{ name: 'tool-a' }],
        },
      });

      const result = checkMCPReadiness(registry, {
        requiredTools: ['tool-a', 'tool-b', 'tool-c'],
      });

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.TOOLS_UNAVAILABLE);
      expect(result.details).toContain('Missing tools: tool-b, tool-c');
      expect(result.checks).toHaveLength(3);
      expect(result.checks[2].passed).toBe(false);
    });

    it('returns TOOLS_UNAVAILABLE when ConnectionManager has no tools at all', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 0 }],
          tools: [],
        },
      });

      const result = checkMCPReadiness(registry, {
        requiredTools: ['missing-tool'],
      });

      expect(result.ready).toBe(false);
      expect(result.reasonCode).toBe(MCPGateReasonCode.TOOLS_UNAVAILABLE);
    });
  });

  // =========================================================================
  // READY (success path)
  // =========================================================================
  describe('READY', () => {
    it('returns READY when ConnectionManager has at least one connected server', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [
            { name: 'srv-a', connected: false, toolCount: 0 },
            { name: 'srv-b', connected: true, toolCount: 3 },
          ],
        },
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(true);
      expect(result.reasonCode).toBe(MCPGateReasonCode.READY);
      expect(result.details).toContain('all checks succeeded');
      expect(result.checks).toHaveLength(2);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('returns READY when single MCPClient is connected', () => {
      const registry = createMockRegistry({
        initialized: true,
        mcpClient: { connected: true },
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(true);
      expect(result.reasonCode).toBe(MCPGateReasonCode.READY);
      expect(result.checks[1].message).toContain('Single MCP client is connected');
    });

    it('returns READY when required tools are all available', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 2 }],
          tools: [{ name: 'tool-x' }, { name: 'tool-y' }],
        },
      });

      const result = checkMCPReadiness(registry, {
        requiredTools: ['tool-x', 'tool-y'],
      });

      expect(result.ready).toBe(true);
      expect(result.reasonCode).toBe(MCPGateReasonCode.READY);
      expect(result.checks).toHaveLength(3);
      expect(result.checks[2].passed).toBe(true);
      expect(result.checks[2].message).toContain('2 required tool(s) are available');
    });

    it('skips tools check when requiredTools is empty', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 0 }],
        },
      });

      const result = checkMCPReadiness(registry, { requiredTools: [] });

      expect(result.ready).toBe(true);
      expect(result.checks).toHaveLength(2);
    });

    it('skips tools check when requiredTools is not provided', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 0 }],
        },
      });

      const result = checkMCPReadiness(registry);

      expect(result.ready).toBe(true);
      expect(result.checks).toHaveLength(2);
    });
  });

  // =========================================================================
  // Telemetry emission
  // =========================================================================
  describe('telemetry emission', () => {
    it('emits info log on success', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 1 }],
        },
      });

      checkMCPReadiness(registry);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP gate check passed',
        expect.objectContaining({
          reasonCode: MCPGateReasonCode.READY,
          ready: true,
        }),
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('emits warn log on REGISTRY_NOT_INITIALIZED failure', () => {
      const registry = createMockRegistry({ initialized: false });

      checkMCPReadiness(registry);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MCP gate check failed',
        expect.objectContaining({
          reasonCode: MCPGateReasonCode.REGISTRY_NOT_INITIALIZED,
          ready: false,
          failedChecks: expect.arrayContaining([
            expect.objectContaining({ name: 'ServiceRegistry initialized' }),
          ]),
        }),
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('emits warn log on MCP_NOT_CONNECTED failure', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: false, toolCount: 0 }],
        },
      });

      checkMCPReadiness(registry);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MCP gate check failed',
        expect.objectContaining({
          reasonCode: MCPGateReasonCode.MCP_NOT_CONNECTED,
        }),
      );
    });

    it('emits warn log on TOOLS_UNAVAILABLE failure', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 0 }],
          tools: [],
        },
      });

      checkMCPReadiness(registry, { requiredTools: ['missing'] });

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MCP gate check failed',
        expect.objectContaining({
          reasonCode: MCPGateReasonCode.TOOLS_UNAVAILABLE,
        }),
      );
    });

    it('includes check counts in telemetry metadata', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 1 }],
          tools: [{ name: 'tool-a' }],
        },
      });

      checkMCPReadiness(registry, { requiredTools: ['tool-a'] });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP gate check passed',
        expect.objectContaining({
          checkCount: 3,
          passedCount: 3,
          failedCount: 0,
        }),
      );
    });
  });

  // =========================================================================
  // Result structure
  // =========================================================================
  describe('result structure', () => {
    it('always includes a timestamp as Date', () => {
      const before = new Date();
      const registry = createMockRegistry({ initialized: false });
      const result = checkMCPReadiness(registry);
      const after = new Date();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('check results contain name, passed, and message fields', () => {
      const registry = createMockRegistry({
        initialized: true,
        connectionManager: {
          statuses: [{ name: 'srv', connected: true, toolCount: 0 }],
        },
      });

      const result = checkMCPReadiness(registry);

      for (const check of result.checks) {
        expect(typeof check.name).toBe('string');
        expect(typeof check.passed).toBe('boolean');
        expect(typeof check.message).toBe('string');
        expect(check.name.length).toBeGreaterThan(0);
        expect(check.message.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // ConnectionManager prefers over MCPClient
  // =========================================================================
  describe('ConnectionManager vs MCPClient priority', () => {
    it('uses ConnectionManager when both are available', () => {
      const registry = {
        isInitialized: () => true,
        getMCPConnectionManager: () => ({
          getStatus: () => [{ name: 'srv', connected: true, toolCount: 1 }],
          getAllTools: () => [{ name: 'tool-a' }],
        }),
        getMCPClient: () => ({
          isConnected: () => false,
        }),
      } as any;

      const result = checkMCPReadiness(registry);

      // Should be READY because ConnectionManager reports connected,
      // even though MCPClient reports disconnected
      expect(result.ready).toBe(true);
      expect(result.reasonCode).toBe(MCPGateReasonCode.READY);
    });
  });
});
