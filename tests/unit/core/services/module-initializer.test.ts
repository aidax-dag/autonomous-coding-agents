/**
 * ModuleInitializer Unit Tests
 *
 * Tests the extracted ModuleInitializer module independently from ServiceRegistry.
 * Verifies that each module group initializes correctly based on config flags
 * and that failures in one module do not prevent others from initializing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ModuleInitializer, createEmptyModuleResult, ModuleInitResult } from '../../../../src/core/services/module-initializer';
import type { ServiceRegistryConfig } from '../../../../src/core/services/service-registry';

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      pulls: {},
      issues: {},
      repos: {},
    },
  })),
}));

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ModuleInitializer', () => {
  let initializer: ModuleInitializer;

  beforeEach(() => {
    initializer = new ModuleInitializer();
  });

  describe('createEmptyModuleResult', () => {
    it('should return an object with all fields set to null', () => {
      const result = createEmptyModuleResult();

      expect(result.confidenceChecker).toBeNull();
      expect(result.selfCheckProtocol).toBeNull();
      expect(result.goalBackwardVerifier).toBeNull();
      expect(result.reflexionPattern).toBeNull();
      expect(result.instinctStore).toBeNull();
      expect(result.solutionsCache).toBeNull();
      expect(result.contextManager).toBeNull();
      expect(result.sessionManager).toBeNull();
      expect(result.sandboxEscalation).toBeNull();
      expect(result.permissionManager).toBeNull();
      expect(result.mcpClient).toBeNull();
      expect(result.mcpToolRegistry).toBeNull();
      expect(result.mcpConnectionManager).toBeNull();
      expect(result.lspClient).toBeNull();
      expect(result.diagnosticsCollector).toBeNull();
      expect(result.lspConnectionManager).toBeNull();
      expect(result.skillRegistry).toBeNull();
      expect(result.pluginLoader).toBeNull();
      expect(result.pluginRegistry).toBeNull();
      expect(result.pluginLifecycle).toBeNull();
      expect(result.stateTracker).toBeNull();
      expect(result.phaseManager).toBeNull();
      expect(result.contextBudget).toBeNull();
      expect(result.githubClient).toBeNull();
      expect(result.collaborationHub).toBeNull();
      expect(result.usageTracker).toBeNull();
      expect(result.projectManager).toBeNull();
      expect(result.tenantManager).toBeNull();
      expect(result.billingManager).toBeNull();
      expect(result.ideBridge).toBeNull();
      expect(result.astGrepClient).toBeNull();
      expect(result.loopDetector).toBeNull();
      expect(result.dbClient).toBeNull();
      expect(result.a2aGateway).toBeNull();
      expect(result.a2aRouter).toBeNull();
      expect(result.oauthManager).toBeNull();
      expect(result.marketplaceRegistry).toBeNull();
      expect(result.sevenPhaseWorkflow).toBeNull();
      expect(result.costReporter).toBeNull();
    });
  });

  describe('initializeAll', () => {
    it('should return all nulls when no flags are enabled', async () => {
      const result = await initializer.initializeAll({});

      expect(result.confidenceChecker).toBeNull();
      expect(result.contextManager).toBeNull();
      expect(result.sessionManager).toBeNull();
      expect(result.sandboxEscalation).toBeNull();
      expect(result.usageTracker).toBeNull();
    });

    it('should initialize validation modules when enableValidation is true', async () => {
      const result = await initializer.initializeAll({ enableValidation: true });

      expect(result.confidenceChecker).not.toBeNull();
      expect(result.selfCheckProtocol).not.toBeNull();
      expect(result.goalBackwardVerifier).not.toBeNull();
    });

    it('should initialize context module when enableContext is true', async () => {
      const result = await initializer.initializeAll({ enableContext: true });

      expect(result.contextManager).not.toBeNull();
    });

    it('should initialize learning modules when enableLearning is true', async () => {
      const result = await initializer.initializeAll({ enableLearning: true });

      expect(result.reflexionPattern).not.toBeNull();
      expect(result.instinctStore).not.toBeNull();
      expect(result.solutionsCache).not.toBeNull();
    });

    it('should initialize session module when enableSession is true', async () => {
      const result = await initializer.initializeAll({ enableSession: true });

      expect(result.sessionManager).not.toBeNull();
    });

    it('should initialize security module when enableSecurity is true', async () => {
      const result = await initializer.initializeAll({ enableSecurity: true });

      expect(result.sandboxEscalation).not.toBeNull();
    });

    it('should initialize permission module when enablePermission is true', async () => {
      const result = await initializer.initializeAll({ enablePermission: true });

      expect(result.permissionManager).not.toBeNull();
    });

    it('should initialize skills module when enableSkills is true', async () => {
      const result = await initializer.initializeAll({ enableSkills: true });

      expect(result.skillRegistry).not.toBeNull();
    });

    it('should auto-enable skills when enableMCP is true', async () => {
      const result = await initializer.initializeAll({ enableMCP: true });

      expect(result.skillRegistry).not.toBeNull();
      expect(result.mcpToolRegistry).not.toBeNull();
    });
  });

  describe('initializeValidation', () => {
    it('should create all three validation modules', () => {
      const result = createEmptyModuleResult();
      initializer.initializeValidation(result);

      expect(result.confidenceChecker).not.toBeNull();
      expect(result.selfCheckProtocol).not.toBeNull();
      expect(result.goalBackwardVerifier).not.toBeNull();
    });
  });

  describe('initializeContext', () => {
    it('should create context manager', () => {
      const result = createEmptyModuleResult();
      initializer.initializeContext(result);

      expect(result.contextManager).not.toBeNull();
    });
  });

  describe('initializeSecurity', () => {
    it('should create sandbox escalation', () => {
      const result = createEmptyModuleResult();
      initializer.initializeSecurity(result);

      expect(result.sandboxEscalation).not.toBeNull();
    });

    it('should accept sandbox options', () => {
      const result = createEmptyModuleResult();
      initializer.initializeSecurity(result, { allowNetwork: false, allowFileSystem: false });

      expect(result.sandboxEscalation).not.toBeNull();
    });
  });

  describe('initializePermission', () => {
    it('should create permission manager', () => {
      const result = createEmptyModuleResult();
      initializer.initializePermission(result);

      expect(result.permissionManager).not.toBeNull();
    });
  });

  describe('initializeSkills', () => {
    it('should create skill registry', () => {
      const result = createEmptyModuleResult();
      initializer.initializeSkills(result);

      expect(result.skillRegistry).not.toBeNull();
    });
  });

  describe('initializePlugins', () => {
    it('should create all plugin modules', () => {
      const result = createEmptyModuleResult();
      initializer.initializePlugins(result);

      expect(result.pluginLoader).not.toBeNull();
      expect(result.pluginRegistry).not.toBeNull();
      expect(result.pluginLifecycle).not.toBeNull();
    });
  });

  describe('initializeAnalytics', () => {
    it('should create usage tracker', () => {
      const result = createEmptyModuleResult();
      initializer.initializeAnalytics(result);

      expect(result.usageTracker).not.toBeNull();
    });
  });

  describe('initializeSaaS', () => {
    it('should create tenant and billing managers', () => {
      const result = createEmptyModuleResult();
      initializer.initializeSaaS(result);

      expect(result.tenantManager).not.toBeNull();
      expect(result.billingManager).not.toBeNull();
    });
  });

  describe('initializeLoopDetection', () => {
    it('should create loop detector', () => {
      const result = createEmptyModuleResult();
      initializer.initializeLoopDetection(result);

      expect(result.loopDetector).not.toBeNull();
    });
  });

  describe('initializePersistence', () => {
    it('should create and connect DB client', async () => {
      const result = createEmptyModuleResult();
      await initializer.initializePersistence(result);

      expect(result.dbClient).not.toBeNull();
      expect(result.dbClient!.isConnected()).toBe(true);

      // Cleanup
      await result.dbClient!.disconnect();
    });
  });

  describe('initializeCollaboration', () => {
    it('should create collaboration hub', () => {
      const result = createEmptyModuleResult();
      initializer.initializeCollaboration(result);

      expect(result.collaborationHub).not.toBeNull();
    });
  });

  describe('initializeIDE', () => {
    it('should create IDE bridge', () => {
      const result = createEmptyModuleResult();
      initializer.initializeIDE(result);

      expect(result.ideBridge).not.toBeNull();
    });
  });

  describe('initializeMarketplace', () => {
    it('should create marketplace registry', () => {
      const result = createEmptyModuleResult();
      initializer.initializeMarketplace(result);

      expect(result.marketplaceRegistry).not.toBeNull();
    });
  });

  describe('initializeUsageTracking', () => {
    it('should create usage tracker and cost reporter', () => {
      const result = createEmptyModuleResult();
      initializer.initializeUsageTracking(result);

      expect(result.usageTracker).not.toBeNull();
      expect(result.costReporter).not.toBeNull();
    });

    it('should reuse existing usage tracker for cost reporter', () => {
      const result = createEmptyModuleResult();

      // First create analytics tracker
      initializer.initializeAnalytics(result);
      const originalTracker = result.usageTracker;

      // Then enable usage tracking -- should reuse
      initializer.initializeUsageTracking(result);

      expect(result.usageTracker).toBe(originalTracker);
      expect(result.costReporter).not.toBeNull();
    });
  });

  describe('initializeA2A', () => {
    it('should create A2A gateway and router', () => {
      const result = createEmptyModuleResult();
      initializer.initializeA2A(result, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        capabilities: [],
      });

      expect(result.a2aGateway).not.toBeNull();
      expect(result.a2aRouter).not.toBeNull();
    });
  });

  describe('initializeMCPOAuth', () => {
    it('should create OAuth manager', () => {
      const result = createEmptyModuleResult();
      initializer.initializeMCPOAuth(result);

      expect(result.oauthManager).not.toBeNull();
    });
  });

  describe('initializeMultiProject', () => {
    it('should create project manager', () => {
      const result = createEmptyModuleResult();
      initializer.initializeMultiProject(result, 10);

      expect(result.projectManager).not.toBeNull();
    });
  });

  describe('graceful degradation', () => {
    it('should not prevent other modules from initializing when one fails', async () => {
      // enableValidation and enableContext should both work even if learning path fails
      const result = await initializer.initializeAll({
        enableValidation: true,
        enableContext: true,
        enableLearning: true,
        memoryDir: '/nonexistent/path/that/cannot/be/created',
      });

      // Validation and context should still work
      expect(result.confidenceChecker).not.toBeNull();
      expect(result.contextManager).not.toBeNull();
    });
  });
});
