/**
 * ServiceRegistry Unit Tests
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

describe('ServiceRegistry', () => {
  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      // ignore
    }
    ServiceRegistry.resetInstance();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = ServiceRegistry.getInstance();
      const b = ServiceRegistry.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      const a = ServiceRegistry.getInstance();
      ServiceRegistry.resetInstance();
      const b = ServiceRegistry.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('initialize', () => {
    it('should be idempotent', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableValidation: false });
      expect(registry.isInitialized()).toBe(true);

      // Second call should not throw
      await registry.initialize({ enableValidation: false });
      expect(registry.isInitialized()).toBe(true);
    });

    it('should initialize with no flags enabled', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).toBeNull();
      expect(registry.getSelfCheckProtocol()).toBeNull();
      expect(registry.getGoalBackwardVerifier()).toBeNull();
      expect(registry.getReflexionPattern()).toBeNull();
      expect(registry.getInstinctStore()).toBeNull();
      expect(registry.getSolutionsCache()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
    });

    it('should initialize validation modules when enabled', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableValidation: true });
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getSelfCheckProtocol()).not.toBeNull();
      expect(registry.getGoalBackwardVerifier()).not.toBeNull();
    });

    it('should initialize context module when enabled', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });
      expect(registry.getContextManager()).not.toBeNull();
    });

    it('should continue when individual modules fail', async () => {
      const registry = ServiceRegistry.getInstance();
      // Use a non-writable path to force learning module failure
      await registry.initialize({
        enableLearning: true,
        memoryDir: '/nonexistent/path/that/fails',
      });
      expect(registry.isInitialized()).toBe(true);
      // Some or all learning modules may be null due to path failure
      // but initialization should succeed
    });
  });

  describe('dispose', () => {
    it('should clean up all modules', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        enableValidation: true,
        enableContext: true,
      });
      expect(registry.isInitialized()).toBe(true);

      await registry.dispose();
      expect(registry.isInitialized()).toBe(false);
      expect(registry.getConfidenceChecker()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
    });

    it('should be safe to call on uninitialized registry', async () => {
      const registry = ServiceRegistry.getInstance();
      await expect(registry.dispose()).resolves.not.toThrow();
    });
  });

  describe('getters null safety', () => {
    it('should return null for all getters before initialization', () => {
      const registry = ServiceRegistry.getInstance();
      expect(registry.getConfidenceChecker()).toBeNull();
      expect(registry.getSelfCheckProtocol()).toBeNull();
      expect(registry.getGoalBackwardVerifier()).toBeNull();
      expect(registry.getReflexionPattern()).toBeNull();
      expect(registry.getInstinctStore()).toBeNull();
      expect(registry.getSolutionsCache()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
    });

    it('should return null for disabled modules after initialization', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableValidation: true });
      // Learning and context were not enabled
      expect(registry.getReflexionPattern()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
      // Validation should be present
      expect(registry.getConfidenceChecker()).not.toBeNull();
    });

    it('should return null for GitHub client before initialization', () => {
      const registry = ServiceRegistry.getInstance();
      expect(registry.getGitHubClient()).toBeNull();
    });
  });

  describe('GitHub module', () => {
    it('should initialize GitHub client when enabled with token', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableGitHub: true, githubToken: 'ghp_test' });
      expect(registry.getGitHubClient()).not.toBeNull();
    });

    it('should not initialize GitHub client when enabled without token', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableGitHub: true });
      expect(registry.getGitHubClient()).toBeNull();
    });

    it('should not initialize GitHub client when disabled', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableGitHub: false, githubToken: 'ghp_test' });
      expect(registry.getGitHubClient()).toBeNull();
    });

    it('should clean up GitHub client on dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableGitHub: true, githubToken: 'ghp_test' });
      expect(registry.getGitHubClient()).not.toBeNull();

      await registry.dispose();
      expect(registry.getGitHubClient()).toBeNull();
    });
  });

  describe('Loop detection module', () => {
    it('should initialize loop detector when enableLoopDetection is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableLoopDetection: true });
      expect(registry.getLoopDetector()).not.toBeNull();
    });

    it('should return null when enableLoopDetection is not set', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize();
      expect(registry.getLoopDetector()).toBeNull();
    });
  });
});
