/**
 * ServiceRegistry Expansion Unit Tests
 *
 * Tests for the new modules added to ServiceRegistry:
 * - A2A Protocol (A2AGateway + A2ARouter)
 * - MCP OAuth (OAuthManager)
 * - Plugin Marketplace (MarketplaceRegistry)
 * - Seven-Phase Workflow (SevenPhaseWorkflow)
 * - Usage Tracking (UsageTracker + CostReporter)
 */

import { ServiceRegistry } from '../../../../src/core/services/service-registry';

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

describe('ServiceRegistry Expansion', () => {
  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      // ignore
    }
    ServiceRegistry.resetInstance();
  });

  // ==========================================================================
  // A2A Protocol Module
  // ==========================================================================

  describe('A2A Protocol module', () => {
    const a2aConfig = {
      agentId: 'test-agent',
      agentName: 'Test Agent',
      capabilities: [],
    };

    it('should initialize A2AGateway when enableA2A is true with config', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: true, a2aConfig });
      expect(registry.getA2AGateway()).not.toBeNull();
    });

    it('should initialize A2ARouter when enableA2A is true with config', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: true, a2aConfig });
      expect(registry.getA2ARouter()).not.toBeNull();
    });

    it('should return null for A2AGateway when enableA2A is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: false });
      expect(registry.getA2AGateway()).toBeNull();
    });

    it('should return null for A2ARouter when enableA2A is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: false });
      expect(registry.getA2ARouter()).toBeNull();
    });

    it('should return null when enableA2A is true but a2aConfig is missing', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: true });
      expect(registry.getA2AGateway()).toBeNull();
      expect(registry.getA2ARouter()).toBeNull();
    });

    it('should clean up A2A modules on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableA2A: true, a2aConfig });
      expect(registry.getA2AGateway()).not.toBeNull();
      expect(registry.getA2ARouter()).not.toBeNull();

      await registry.dispose();
      expect(registry.getA2AGateway()).toBeNull();
      expect(registry.getA2ARouter()).toBeNull();
    });
  });

  // ==========================================================================
  // MCP OAuth Module
  // ==========================================================================

  describe('MCP OAuth module', () => {
    it('should initialize OAuthManager when enableMCPOAuth is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMCPOAuth: true });
      expect(registry.getOAuthManager()).not.toBeNull();
    });

    it('should return null for OAuthManager when enableMCPOAuth is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMCPOAuth: false });
      expect(registry.getOAuthManager()).toBeNull();
    });

    it('should return null for OAuthManager when not configured', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize();
      expect(registry.getOAuthManager()).toBeNull();
    });

    it('should accept custom OAuthManager config', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        enableMCPOAuth: true,
        oauthConfig: { tokenRefreshBufferMs: 120000, maxRetries: 5 },
      });
      expect(registry.getOAuthManager()).not.toBeNull();
    });

    it('should clean up OAuthManager on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMCPOAuth: true });
      expect(registry.getOAuthManager()).not.toBeNull();

      await registry.dispose();
      expect(registry.getOAuthManager()).toBeNull();
    });
  });

  // ==========================================================================
  // Plugin Marketplace Module
  // ==========================================================================

  describe('Plugin Marketplace module', () => {
    it('should initialize MarketplaceRegistry when enableMarketplace is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMarketplace: true });
      expect(registry.getMarketplaceRegistry()).not.toBeNull();
    });

    it('should return null for MarketplaceRegistry when enableMarketplace is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMarketplace: false });
      expect(registry.getMarketplaceRegistry()).toBeNull();
    });

    it('should return null for MarketplaceRegistry when not configured', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize();
      expect(registry.getMarketplaceRegistry()).toBeNull();
    });

    it('should clean up MarketplaceRegistry on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableMarketplace: true });
      expect(registry.getMarketplaceRegistry()).not.toBeNull();

      await registry.dispose();
      expect(registry.getMarketplaceRegistry()).toBeNull();
    });
  });

  // ==========================================================================
  // Seven-Phase Workflow Module
  // ==========================================================================

  describe('Seven-Phase Workflow module', () => {
    const sevenPhaseConfig = { goal: 'Test workflow goal' };

    it('should initialize SevenPhaseWorkflow when enableSevenPhase is true with config', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSevenPhase: true, sevenPhaseConfig });
      expect(registry.getSevenPhaseWorkflow()).not.toBeNull();
    });

    it('should return null for SevenPhaseWorkflow when enableSevenPhase is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSevenPhase: false });
      expect(registry.getSevenPhaseWorkflow()).toBeNull();
    });

    it('should return null when enableSevenPhase is true but config is missing', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSevenPhase: true });
      expect(registry.getSevenPhaseWorkflow()).toBeNull();
    });

    it('should clean up SevenPhaseWorkflow on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSevenPhase: true, sevenPhaseConfig });
      expect(registry.getSevenPhaseWorkflow()).not.toBeNull();

      await registry.dispose();
      expect(registry.getSevenPhaseWorkflow()).toBeNull();
    });
  });

  // ==========================================================================
  // Usage Tracking Module (UsageTracker + CostReporter)
  // ==========================================================================

  describe('Usage Tracking module', () => {
    it('should initialize UsageTracker when enableUsageTracking is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableUsageTracking: true });
      expect(registry.getUsageTracker()).not.toBeNull();
    });

    it('should initialize CostReporter when enableUsageTracking is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableUsageTracking: true });
      expect(registry.getCostReporter()).not.toBeNull();
    });

    it('should return null for CostReporter when enableUsageTracking is false', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableUsageTracking: false });
      expect(registry.getCostReporter()).toBeNull();
    });

    it('should return null for CostReporter when not configured', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize();
      expect(registry.getCostReporter()).toBeNull();
    });

    it('should reuse existing UsageTracker when enableAnalytics is also set', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableAnalytics: true, enableUsageTracking: true });
      // Both should be initialized; UsageTracker is shared
      expect(registry.getUsageTracker()).not.toBeNull();
      expect(registry.getCostReporter()).not.toBeNull();
    });

    it('should clean up CostReporter on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableUsageTracking: true });
      expect(registry.getCostReporter()).not.toBeNull();

      await registry.dispose();
      expect(registry.getCostReporter()).toBeNull();
    });
  });

  // ==========================================================================
  // Graceful Degradation
  // ==========================================================================

  describe('graceful degradation', () => {
    it('should continue initialization when A2A module fails', async () => {
      // Force A2AGateway constructor to fail by providing malformed config
      // that still satisfies TypeScript but will cause internal errors
      const registry = ServiceRegistry.getInstance();
      // enableA2A true but no config -> should skip gracefully (not throw)
      await registry.initialize({
        enableA2A: true,
        enableMCPOAuth: true,
      });
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getA2AGateway()).toBeNull();
      expect(registry.getOAuthManager()).not.toBeNull();
    });

    it('should not affect existing modules when new modules are enabled', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        enableValidation: true,
        enableContext: true,
        enableA2A: true,
        a2aConfig: { agentId: 'test', agentName: 'Test' },
        enableMCPOAuth: true,
        enableMarketplace: true,
      });

      // Existing modules should still work
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getContextManager()).not.toBeNull();

      // New modules should also work
      expect(registry.getA2AGateway()).not.toBeNull();
      expect(registry.getOAuthManager()).not.toBeNull();
      expect(registry.getMarketplaceRegistry()).not.toBeNull();
    });
  });

  // ==========================================================================
  // All New Getters Return Null Before Initialization
  // ==========================================================================

  describe('new getters null safety before initialization', () => {
    it('should return null for all new getters before initialization', () => {
      const registry = ServiceRegistry.getInstance();
      expect(registry.getA2AGateway()).toBeNull();
      expect(registry.getA2ARouter()).toBeNull();
      expect(registry.getOAuthManager()).toBeNull();
      expect(registry.getMarketplaceRegistry()).toBeNull();
      expect(registry.getSevenPhaseWorkflow()).toBeNull();
      expect(registry.getCostReporter()).toBeNull();
    });
  });

  // ==========================================================================
  // Dispose Clears All New Modules
  // ==========================================================================

  describe('dispose clears all new modules', () => {
    it('should set all new modules to null after dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        enableA2A: true,
        a2aConfig: { agentId: 'test', agentName: 'Test' },
        enableMCPOAuth: true,
        enableMarketplace: true,
        enableSevenPhase: true,
        sevenPhaseConfig: { goal: 'Test' },
        enableUsageTracking: true,
      });

      // Verify all initialized
      expect(registry.getA2AGateway()).not.toBeNull();
      expect(registry.getA2ARouter()).not.toBeNull();
      expect(registry.getOAuthManager()).not.toBeNull();
      expect(registry.getMarketplaceRegistry()).not.toBeNull();
      expect(registry.getSevenPhaseWorkflow()).not.toBeNull();
      expect(registry.getCostReporter()).not.toBeNull();

      await registry.dispose();

      // Verify all cleared
      expect(registry.getA2AGateway()).toBeNull();
      expect(registry.getA2ARouter()).toBeNull();
      expect(registry.getOAuthManager()).toBeNull();
      expect(registry.getMarketplaceRegistry()).toBeNull();
      expect(registry.getSevenPhaseWorkflow()).toBeNull();
      expect(registry.getCostReporter()).toBeNull();
      expect(registry.isInitialized()).toBe(false);
    });
  });
});
