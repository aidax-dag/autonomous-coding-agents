/**
 * SandboxEscalation Tests
 *
 * Progressive Sandbox Escalation (#26-29):
 * 4-stage sandbox system with confidence-based escalation.
 */

import {
  SandboxEscalation,
  createSandboxEscalation,
  SandboxLevel,
  ToolCategory,
  DEFAULT_ESCALATION_THRESHOLDS,
  type EscalationContext,
  type SecurityViolation,
} from '../../../../src/core/security/index';

describe('SandboxEscalation', () => {
  let sandbox: SandboxEscalation;

  beforeEach(() => {
    sandbox = createSandboxEscalation();
  });

  // ==========================================================================
  // Basic Instantiation
  // ==========================================================================

  describe('instantiation', () => {
    it('should create with factory function', () => {
      expect(sandbox).toBeInstanceOf(SandboxEscalation);
    });

    it('should start at RESTRICTED level by default', () => {
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);
    });

    it('should accept custom initial level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.getCurrentLevel()).toBe(SandboxLevel.STANDARD);
    });

    it('should accept custom thresholds', () => {
      const s = createSandboxEscalation({
        thresholds: { restrictedToMonitored: 50 },
      });
      expect(s).toBeInstanceOf(SandboxEscalation);
    });
  });

  // ==========================================================================
  // Permissions
  // ==========================================================================

  describe('permissions', () => {
    it('should return RESTRICTED permissions by default', () => {
      const perms = sandbox.getPermissions();
      expect(perms.allowedToolCategories).toEqual([ToolCategory.READ]);
      expect(perms.monitored).toBe(true);
      expect(perms.maxConcurrentOps).toBe(1);
    });

    it('should return permissions for any level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.STANDARD);
      expect(perms.allowedToolCategories).toContain(ToolCategory.WRITE);
      expect(perms.allowedToolCategories).toContain(ToolCategory.EXECUTE);
    });

    it('should return ELEVATED permissions with all tool categories', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.ELEVATED);
      expect(perms.allowedToolCategories).toContain(ToolCategory.SYSTEM);
      expect(perms.deniedPaths).toEqual([]);
    });

    it('should return a copy (not reference) of permissions', () => {
      const p1 = sandbox.getPermissions();
      const p2 = sandbox.getPermissions();
      expect(p1).toEqual(p2);
      expect(p1).not.toBe(p2);
    });
  });

  // ==========================================================================
  // isAllowed
  // ==========================================================================

  describe('isAllowed', () => {
    it('should allow READ at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.READ)).toBe(true);
    });

    it('should deny WRITE at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.WRITE)).toBe(false);
    });

    it('should deny EXECUTE at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.EXECUTE)).toBe(false);
    });

    it('should deny SYSTEM at STANDARD level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.SYSTEM)).toBe(false);
    });

    it('should allow SYSTEM at ELEVATED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      expect(s.isAllowed(ToolCategory.SYSTEM)).toBe(true);
    });

    it('should deny access to .env files at RESTRICTED', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, '.env')).toBe(false);
    });

    it('should deny access to node_modules at RESTRICTED', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, 'node_modules/foo/bar.js')).toBe(false);
    });

    it('should allow access to .ts files at RESTRICTED', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, 'src/index.ts')).toBe(true);
    });

    it('should deny access to .env even at STANDARD', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.READ, '.env.local')).toBe(false);
    });
  });

  // ==========================================================================
  // Promotion
  // ==========================================================================

  describe('promotion', () => {
    it('should promote from RESTRICTED to MONITORED when confidence is sufficient', () => {
      const context: EscalationContext = {
        confidenceScore: 65,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      };

      const result = sandbox.evaluate(context);
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('promoted');
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.MONITORED);
    });

    it('should promote from MONITORED to STANDARD', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      const result = s.evaluate({
        confidenceScore: 80,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(result.changed).toBe(true);
      expect(result.newLevel).toBe(SandboxLevel.STANDARD);
    });

    it('should promote from STANDARD to ELEVATED', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const result = s.evaluate({
        confidenceScore: 95,
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.STANDARD,
      });
      expect(result.changed).toBe(true);
      expect(result.newLevel).toBe(SandboxLevel.ELEVATED);
    });

    it('should NOT promote without minimum successful tasks', () => {
      const result = sandbox.evaluate({
        confidenceScore: 95,
        successfulTasks: 1,  // below minSuccessfulTasks (2)
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(false);
      expect(result.direction).toBe('unchanged');
    });

    it('should NOT promote when confidence is below threshold', () => {
      const result = sandbox.evaluate({
        confidenceScore: 50,  // below restrictedToMonitored (60)
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(false);
    });

    it('should NOT promote beyond ELEVATED', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      const result = s.evaluate({
        confidenceScore: 100,
        successfulTasks: 100,
        failedTasks: 0,
        currentLevel: SandboxLevel.ELEVATED,
      });
      expect(result.changed).toBe(false);
      expect(result.newLevel).toBe(SandboxLevel.ELEVATED);
    });
  });

  // ==========================================================================
  // Demotion
  // ==========================================================================

  describe('demotion', () => {
    it('should demote when error rate exceeds threshold', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const result = s.evaluate({
        confidenceScore: 80,
        successfulTasks: 3,
        failedTasks: 3,  // 50% error rate > 30% threshold
        currentLevel: SandboxLevel.STANDARD,
      });
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('demoted');
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should demote when confidence drops below demotion threshold', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const result = s.evaluate({
        confidenceScore: 60,  // below monitoredToStandard - 10 = 65
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.STANDARD,
      });
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('demoted');
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should NOT demote below RESTRICTED', () => {
      const result = sandbox.evaluate({
        confidenceScore: 10,
        successfulTasks: 0,
        failedTasks: 5,  // high error rate but already at RESTRICTED
        currentLevel: SandboxLevel.RESTRICTED,
      });
      // At RESTRICTED with high error rate - can't go lower
      expect(result.newLevel).toBe(SandboxLevel.RESTRICTED);
    });

    it('should prioritize demotion over promotion', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      // High confidence but also high error rate
      const result = s.evaluate({
        confidenceScore: 80,
        successfulTasks: 3,
        failedTasks: 3,  // 50% error rate
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(result.direction).toBe('demoted');
    });
  });

  // ==========================================================================
  // Violations
  // ==========================================================================

  describe('violations', () => {
    it('should record violations', () => {
      const violation: SecurityViolation = {
        type: 'path_access',
        severity: 'warning',
        description: 'Attempted to access .env file',
        timestamp: new Date(),
      };
      sandbox.recordViolation(violation);
      expect(sandbox.getViolations()).toHaveLength(1);
    });

    it('should demote on critical violation threshold', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const result = s.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Attempted to access secrets directory',
        timestamp: new Date(),
      });
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('demoted');
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should NOT demote on warning violations', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const result = s.recordViolation({
        type: 'timeout',
        severity: 'warning',
        description: 'Operation timed out',
        timestamp: new Date(),
      });
      expect(result.changed).toBe(false);
    });

    it('should return violation history', () => {
      sandbox.recordViolation({
        type: 'path_access',
        severity: 'warning',
        description: 'Warning 1',
        timestamp: new Date(),
      });
      sandbox.recordViolation({
        type: 'tool_access',
        severity: 'warning',
        description: 'Warning 2',
        timestamp: new Date(),
      });
      const violations = sandbox.getViolations();
      expect(violations).toHaveLength(2);
    });

    it('should return a copy of violation history', () => {
      sandbox.recordViolation({
        type: 'path_access',
        severity: 'warning',
        description: 'Test',
        timestamp: new Date(),
      });
      const v1 = sandbox.getViolations();
      const v2 = sandbox.getViolations();
      expect(v1).not.toBe(v2);
    });
  });

  // ==========================================================================
  // Manual Override
  // ==========================================================================

  describe('setLevel', () => {
    it('should allow manual level setting', () => {
      const result = sandbox.setLevel(SandboxLevel.ELEVATED, 'Admin override');
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('promoted');
      expect(result.newLevel).toBe(SandboxLevel.ELEVATED);
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.ELEVATED);
    });

    it('should detect demotion direction', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      const result = s.setLevel(SandboxLevel.RESTRICTED, 'Security incident');
      expect(result.direction).toBe('demoted');
    });

    it('should report unchanged when setting same level', () => {
      const result = sandbox.setLevel(SandboxLevel.RESTRICTED, 'No change');
      expect(result.changed).toBe(false);
      expect(result.direction).toBe('unchanged');
    });

    it('should include reason in result', () => {
      const result = sandbox.setLevel(SandboxLevel.STANDARD, 'Testing');
      expect(result.reason).toContain('Manual override');
      expect(result.reason).toContain('Testing');
    });
  });

  // ==========================================================================
  // Reset
  // ==========================================================================

  describe('reset', () => {
    it('should reset to RESTRICTED level', () => {
      sandbox.setLevel(SandboxLevel.ELEVATED, 'test');
      sandbox.reset();
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);
    });

    it('should clear violations', () => {
      sandbox.recordViolation({
        type: 'path_access',
        severity: 'warning',
        description: 'Test',
        timestamp: new Date(),
      });
      sandbox.reset();
      expect(sandbox.getViolations()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Thresholds
  // ==========================================================================

  describe('thresholds', () => {
    it('should use default thresholds', () => {
      expect(DEFAULT_ESCALATION_THRESHOLDS.restrictedToMonitored).toBe(60);
      expect(DEFAULT_ESCALATION_THRESHOLDS.monitoredToStandard).toBe(75);
      expect(DEFAULT_ESCALATION_THRESHOLDS.standardToElevated).toBe(90);
    });

    it('should accept custom thresholds', () => {
      const s = createSandboxEscalation({
        thresholds: { restrictedToMonitored: 40 },
      });
      // With lower threshold, should promote at confidence 45
      const result = s.evaluate({
        confidenceScore: 45,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(true);
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should allow updating thresholds via setThresholds', () => {
      sandbox.setThresholds({ restrictedToMonitored: 40 });
      const result = sandbox.evaluate({
        confidenceScore: 45,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(true);
    });

    it('should reject invalid threshold ordering', () => {
      expect(() => {
        sandbox.setThresholds({
          restrictedToMonitored: 80,
          monitoredToStandard: 70,
        });
      }).toThrow();
    });
  });

  // ==========================================================================
  // Custom Permission Overrides
  // ==========================================================================

  describe('permission overrides', () => {
    it('should accept custom permission overrides per level', () => {
      const s = createSandboxEscalation({
        permissionOverrides: {
          [SandboxLevel.RESTRICTED]: {
            maxConcurrentOps: 5,
          },
        },
      });
      const perms = s.getPermissions();
      expect(perms.maxConcurrentOps).toBe(5);
    });
  });

  // ==========================================================================
  // Integration Scenario
  // ==========================================================================

  describe('full escalation scenario', () => {
    it('should progress through all 4 levels', () => {
      // Start at RESTRICTED
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);

      // Build confidence → MONITORED
      sandbox.evaluate({
        confidenceScore: 65,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.MONITORED);

      // More confidence → STANDARD
      sandbox.evaluate({
        confidenceScore: 80,
        successfulTasks: 6,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.STANDARD);

      // High confidence → ELEVATED
      sandbox.evaluate({
        confidenceScore: 95,
        successfulTasks: 10,
        failedTasks: 0,
        currentLevel: SandboxLevel.STANDARD,
      });
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.ELEVATED);
    });

    it('should demote and re-promote on errors', () => {
      // Start at STANDARD
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });

      // Error rate triggers demotion → MONITORED
      s.evaluate({
        confidenceScore: 50,
        successfulTasks: 2,
        failedTasks: 4,
        currentLevel: SandboxLevel.STANDARD,
      });
      expect(s.getCurrentLevel()).toBe(SandboxLevel.MONITORED);

      // Recover → back to STANDARD
      s.evaluate({
        confidenceScore: 80,
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(s.getCurrentLevel()).toBe(SandboxLevel.STANDARD);
    });
  });
});
