/**
 * E2E: ServiceRegistry Full Initialization
 *
 * Verifies the ServiceRegistry singleton initializes all enabled modules,
 * handles graceful degradation on failures, cleans up on dispose,
 * and maintains correct singleton behavior.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { ServiceRegistry } from '@/core/services/service-registry';

describe('E2E: ServiceRegistry Full Initialization', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = path.join(os.tmpdir(), `e2e-registry-${Date.now()}`);
    fs.mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Singleton behavior
  // ═══════════════════════════════════════════════════════════

  describe('Singleton behavior', () => {
    it('should return the same instance on repeated calls', () => {
      const a = ServiceRegistry.getInstance();
      const b = ServiceRegistry.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetInstance', () => {
      const first = ServiceRegistry.getInstance();
      ServiceRegistry.resetInstance();
      const second = ServiceRegistry.getInstance();
      expect(first).not.toBe(second);
    });

    it('should start in uninitialized state', () => {
      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Initialization with multiple enable flags
  // ═══════════════════════════════════════════════════════════

  describe('Initialization with multiple enable flags', () => {
    it('should initialize validation modules when enableValidation is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableValidation: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getSelfCheckProtocol()).not.toBeNull();
      expect(registry.getGoalBackwardVerifier()).not.toBeNull();
    });

    it('should initialize learning modules when enableLearning is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableLearning: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getReflexionPattern()).not.toBeNull();
      expect(registry.getInstinctStore()).not.toBeNull();
      expect(registry.getSolutionsCache()).not.toBeNull();
    });

    it('should initialize context manager when enableContext is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableContext: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getContextManager()).not.toBeNull();
    });

    it('should initialize session manager when enableSession is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableSession: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSessionManager()).not.toBeNull();
    });

    it('should initialize security module when enableSecurity is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableSecurity: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSandboxEscalation()).not.toBeNull();
    });

    it('should initialize permission module when enablePermission is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enablePermission: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getPermissionManager()).not.toBeNull();
    });

    it('should initialize multiple modules simultaneously', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableValidation: true,
        enableContext: true,
        enableSecurity: true,
        enablePermission: true,
        enableLoopDetection: true,
        enableAnalytics: true,
        enableCollaboration: true,
        enablePersistence: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getContextManager()).not.toBeNull();
      expect(registry.getSandboxEscalation()).not.toBeNull();
      expect(registry.getPermissionManager()).not.toBeNull();
      expect(registry.getLoopDetector()).not.toBeNull();
      expect(registry.getUsageTracker()).not.toBeNull();
      expect(registry.getCollaborationHub()).not.toBeNull();
      expect(registry.getDBClient()).not.toBeNull();
    });

    it('should initialize planning context modules when enablePlanningContext is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enablePlanningContext: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getStateTracker()).not.toBeNull();
      expect(registry.getPhaseManager()).not.toBeNull();
      expect(registry.getContextBudget()).not.toBeNull();
    });

    it('should initialize plugin modules when enablePlugins is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enablePlugins: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getPluginLoader()).not.toBeNull();
      expect(registry.getPluginRegistry()).not.toBeNull();
      expect(registry.getPluginLifecycle()).not.toBeNull();
    });

    it('should initialize skill registry when enableSkills is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableSkills: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSkillRegistry()).not.toBeNull();
    });

    it('should auto-enable skill registry when enableMCP is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableMCP: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSkillRegistry()).not.toBeNull();
      expect(registry.getMCPClient()).not.toBeNull();
    });

    it('should initialize loop detector when enableLoopDetection is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableLoopDetection: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getLoopDetector()).not.toBeNull();
    });

    it('should initialize persistence with in-memory client when enablePersistence is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enablePersistence: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getDBClient()).not.toBeNull();
    });

    it('should initialize multi-project manager when enableMultiProject is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableMultiProject: true,
        maxProjects: 5,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getProjectManager()).not.toBeNull();
    });

    it('should initialize SaaS modules when enableSaaS is true', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableSaaS: true,
      });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getTenantManager()).not.toBeNull();
      expect(registry.getBillingManager()).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Getters return null when modules not enabled
  // ═══════════════════════════════════════════════════════════

  describe('Getters return null when modules not enabled', () => {
    it('should return null for all getters when initialized with no flags', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ projectRoot });

      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).toBeNull();
      expect(registry.getSelfCheckProtocol()).toBeNull();
      expect(registry.getGoalBackwardVerifier()).toBeNull();
      expect(registry.getReflexionPattern()).toBeNull();
      expect(registry.getInstinctStore()).toBeNull();
      expect(registry.getSolutionsCache()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
      expect(registry.getSessionManager()).toBeNull();
      expect(registry.getSandboxEscalation()).toBeNull();
      expect(registry.getPermissionManager()).toBeNull();
      expect(registry.getMCPClient()).toBeNull();
      expect(registry.getLSPClient()).toBeNull();
      expect(registry.getSkillRegistry()).toBeNull();
      expect(registry.getPluginLoader()).toBeNull();
      expect(registry.getLoopDetector()).toBeNull();
      expect(registry.getDBClient()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Idempotent initialization
  // ═══════════════════════════════════════════════════════════

  describe('Idempotent initialization', () => {
    it('should be safe to call initialize multiple times', async () => {
      const registry = ServiceRegistry.getInstance();

      await registry.initialize({
        projectRoot,
        enableValidation: true,
      });

      const checker1 = registry.getConfidenceChecker();

      // Second call should be a no-op
      await registry.initialize({
        projectRoot,
        enableContext: true,
      });

      // Original module still present, second flag ignored because already initialized
      expect(registry.getConfidenceChecker()).toBe(checker1);
      expect(registry.getContextManager()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Dispose cleanup
  // ═══════════════════════════════════════════════════════════

  describe('Dispose cleanup', () => {
    it('should set initialized to false after dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableValidation: true,
        enableContext: true,
        enableLoopDetection: true,
      });

      expect(registry.isInitialized()).toBe(true);

      await registry.dispose();

      expect(registry.isInitialized()).toBe(false);
    });

    it('should null all module references after dispose', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({
        projectRoot,
        enableValidation: true,
        enableContext: true,
        enableSecurity: true,
        enablePermission: true,
        enablePersistence: true,
        enableLoopDetection: true,
        enableAnalytics: true,
        enableCollaboration: true,
      });

      await registry.dispose();

      expect(registry.getConfidenceChecker()).toBeNull();
      expect(registry.getSelfCheckProtocol()).toBeNull();
      expect(registry.getGoalBackwardVerifier()).toBeNull();
      expect(registry.getContextManager()).toBeNull();
      expect(registry.getSandboxEscalation()).toBeNull();
      expect(registry.getPermissionManager()).toBeNull();
      expect(registry.getDBClient()).toBeNull();
      expect(registry.getLoopDetector()).toBeNull();
      expect(registry.getUsageTracker()).toBeNull();
      expect(registry.getCollaborationHub()).toBeNull();
    });

    it('should allow re-initialization after dispose', async () => {
      const registry = ServiceRegistry.getInstance();

      await registry.initialize({
        projectRoot,
        enableValidation: true,
      });
      expect(registry.getConfidenceChecker()).not.toBeNull();

      await registry.dispose();
      expect(registry.getConfidenceChecker()).toBeNull();

      // Re-initialize with different flags
      await registry.initialize({
        projectRoot,
        enableContext: true,
      });
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getContextManager()).not.toBeNull();
      expect(registry.getConfidenceChecker()).toBeNull();
    });
  });
});
