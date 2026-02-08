/**
 * ServiceRegistry Unit Tests
 */

import { ServiceRegistry } from '../../../../src/core/services/service-registry';

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
  });
});
