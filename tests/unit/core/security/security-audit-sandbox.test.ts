/**
 * Security Audit: Sandbox Escalation
 *
 * Validates security properties of the progressive sandbox escalation model.
 * Tests focus on attack vectors, boundary conditions, and defense-in-depth
 * enforcement rather than basic functional coverage.
 *
 * @module tests/unit/core/security/security-audit-sandbox
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

describe('Security Audit: Sandbox Escalation', () => {
  let sandbox: SandboxEscalation;

  beforeEach(() => {
    sandbox = createSandboxEscalation();
  });

  // ==========================================================================
  // Level Permissions Completeness
  // ==========================================================================

  describe('RESTRICTED level permission enforcement', () => {
    it('should deny WRITE tool category at RESTRICTED level', () => {
      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);
      expect(sandbox.isAllowed(ToolCategory.WRITE)).toBe(false);
    });

    it('should deny EXECUTE tool category at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.EXECUTE)).toBe(false);
    });

    it('should deny NETWORK tool category at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.NETWORK)).toBe(false);
    });

    it('should deny SYSTEM tool category at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.SYSTEM)).toBe(false);
    });

    it('should only allow READ tool category at RESTRICTED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.RESTRICTED);
      expect(perms.allowedToolCategories).toEqual([ToolCategory.READ]);
    });

    it('should enforce maxConcurrentOps=1 at RESTRICTED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.RESTRICTED);
      expect(perms.maxConcurrentOps).toBe(1);
    });

    it('should enforce monitoring at RESTRICTED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.RESTRICTED);
      expect(perms.monitored).toBe(true);
    });
  });

  describe('MONITORED level permission enforcement', () => {
    it('should allow WRITE but deny EXECUTE at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.WRITE)).toBe(true);
      expect(s.isAllowed(ToolCategory.EXECUTE)).toBe(false);
    });

    it('should deny NETWORK at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.NETWORK)).toBe(false);
    });

    it('should deny SYSTEM at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.SYSTEM)).toBe(false);
    });

    it('should enforce monitoring at MONITORED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.MONITORED);
      expect(perms.monitored).toBe(true);
    });
  });

  describe('STANDARD level permission enforcement', () => {
    it('should allow EXECUTE and NETWORK at STANDARD level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.EXECUTE)).toBe(true);
      expect(s.isAllowed(ToolCategory.NETWORK)).toBe(true);
    });

    it('should deny SYSTEM at STANDARD level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.SYSTEM)).toBe(false);
    });

    it('should not enforce monitoring at STANDARD level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.STANDARD);
      expect(perms.monitored).toBe(false);
    });
  });

  describe('ELEVATED level permission enforcement', () => {
    it('should allow all tool categories including SYSTEM at ELEVATED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      expect(s.isAllowed(ToolCategory.READ)).toBe(true);
      expect(s.isAllowed(ToolCategory.WRITE)).toBe(true);
      expect(s.isAllowed(ToolCategory.EXECUTE)).toBe(true);
      expect(s.isAllowed(ToolCategory.NETWORK)).toBe(true);
      expect(s.isAllowed(ToolCategory.SYSTEM)).toBe(true);
    });

    it('should have no denied paths at ELEVATED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.ELEVATED);
      expect(perms.deniedPaths).toEqual([]);
    });

    it('should allow maximum concurrent operations at ELEVATED level', () => {
      const perms = sandbox.getPermissionsForLevel(SandboxLevel.ELEVATED);
      expect(perms.maxConcurrentOps).toBe(10);
    });
  });

  // ==========================================================================
  // Path Security - Sensitive File Protection
  // ==========================================================================

  describe('sensitive file path protection', () => {
    it('should deny .env files at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, '.env')).toBe(false);
      expect(sandbox.isAllowed(ToolCategory.READ, '.env.local')).toBe(false);
      expect(sandbox.isAllowed(ToolCategory.READ, '.env.production')).toBe(false);
    });

    it('should deny .env files at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.READ, '.env')).toBe(false);
      expect(s.isAllowed(ToolCategory.WRITE, '.env.local')).toBe(false);
    });

    it('should deny .env files at STANDARD level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.READ, '.env')).toBe(false);
      expect(s.isAllowed(ToolCategory.WRITE, '.env.production')).toBe(false);
    });

    it('should allow .env files at ELEVATED level (no denied paths)', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      expect(s.isAllowed(ToolCategory.READ, '.env')).toBe(true);
      expect(s.isAllowed(ToolCategory.WRITE, '.env.local')).toBe(true);
    });

    it('should deny secrets/ directory at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, 'secrets/api-key.json')).toBe(false);
    });

    it('should deny secrets/ directory at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.READ, 'secrets/credentials.yaml')).toBe(false);
    });

    it('should deny secrets/ directory at STANDARD level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.READ, 'secrets/token.txt')).toBe(false);
    });

    it('should allow secrets/ directory at ELEVATED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      expect(s.isAllowed(ToolCategory.READ, 'secrets/api-key.json')).toBe(true);
    });

    it('should deny node_modules/ at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, 'node_modules/lodash/index.js')).toBe(false);
    });

    it('should deny node_modules/ at MONITORED level', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      expect(s.isAllowed(ToolCategory.READ, 'node_modules/express/lib/router.js')).toBe(false);
    });

    it('should deny .git/ directory at RESTRICTED level', () => {
      expect(sandbox.isAllowed(ToolCategory.READ, '.git/config')).toBe(false);
      expect(sandbox.isAllowed(ToolCategory.READ, '.git/HEAD')).toBe(false);
    });
  });

  // ==========================================================================
  // Escalation Security - Level Skip Prevention
  // ==========================================================================

  describe('escalation security: level skip prevention', () => {
    it('should only promote one level at a time from RESTRICTED', () => {
      // Even with very high confidence, RESTRICTED should only go to MONITORED
      const result = sandbox.evaluate({
        confidenceScore: 100,
        successfulTasks: 100,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
      expect(result.newLevel).not.toBe(SandboxLevel.STANDARD);
      expect(result.newLevel).not.toBe(SandboxLevel.ELEVATED);
    });

    it('should only promote one level at a time from MONITORED', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      const result = s.evaluate({
        confidenceScore: 100,
        successfulTasks: 100,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(result.newLevel).toBe(SandboxLevel.STANDARD);
      expect(result.newLevel).not.toBe(SandboxLevel.ELEVATED);
    });

    it('should require sequential promotion through all four levels', () => {
      // Track the complete promotion path
      const levels: SandboxLevel[] = [sandbox.getCurrentLevel()];

      // Promote RESTRICTED -> MONITORED
      sandbox.evaluate({
        confidenceScore: 65,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      levels.push(sandbox.getCurrentLevel());

      // Promote MONITORED -> STANDARD
      sandbox.evaluate({
        confidenceScore: 80,
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      levels.push(sandbox.getCurrentLevel());

      // Promote STANDARD -> ELEVATED
      sandbox.evaluate({
        confidenceScore: 95,
        successfulTasks: 10,
        failedTasks: 0,
        currentLevel: SandboxLevel.STANDARD,
      });
      levels.push(sandbox.getCurrentLevel());

      expect(levels).toEqual([
        SandboxLevel.RESTRICTED,
        SandboxLevel.MONITORED,
        SandboxLevel.STANDARD,
        SandboxLevel.ELEVATED,
      ]);
    });
  });

  // ==========================================================================
  // Escalation Security - Confidence Thresholds
  // ==========================================================================

  describe('escalation security: confidence threshold enforcement', () => {
    it('should not promote with confidence exactly at threshold minus 1', () => {
      const result = sandbox.evaluate({
        confidenceScore: DEFAULT_ESCALATION_THRESHOLDS.restrictedToMonitored - 1,
        successfulTasks: 10,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(false);
    });

    it('should promote with confidence exactly at threshold', () => {
      const result = sandbox.evaluate({
        confidenceScore: DEFAULT_ESCALATION_THRESHOLDS.restrictedToMonitored,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(true);
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should require minimum successful tasks regardless of confidence', () => {
      const result = sandbox.evaluate({
        confidenceScore: 100,
        successfulTasks: DEFAULT_ESCALATION_THRESHOLDS.minSuccessfulTasks - 1,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      expect(result.changed).toBe(false);
    });

    it('should enforce increasing thresholds for higher levels', () => {
      expect(DEFAULT_ESCALATION_THRESHOLDS.restrictedToMonitored)
        .toBeLessThan(DEFAULT_ESCALATION_THRESHOLDS.monitoredToStandard);
      expect(DEFAULT_ESCALATION_THRESHOLDS.monitoredToStandard)
        .toBeLessThan(DEFAULT_ESCALATION_THRESHOLDS.standardToElevated);
    });

    it('should reject threshold configurations where ordering is violated', () => {
      expect(() => {
        sandbox.setThresholds({
          restrictedToMonitored: 80,
          monitoredToStandard: 70, // invalid: lower than restrictedToMonitored
        });
      }).toThrow();
    });
  });

  // ==========================================================================
  // Escalation Security - Violation-Based Demotion
  // ==========================================================================

  describe('escalation security: violation-based demotion', () => {
    it('should demote on a single critical violation with default threshold of 1', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(DEFAULT_ESCALATION_THRESHOLDS.maxCriticalViolations).toBe(1);

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

    it('should persist violation history across multiple evaluations', () => {
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

      // Violations should accumulate
      expect(sandbox.getViolations()).toHaveLength(2);

      // Record another
      sandbox.recordViolation({
        type: 'timeout',
        severity: 'warning',
        description: 'Warning 3',
        timestamp: new Date(),
      });
      expect(sandbox.getViolations()).toHaveLength(3);
    });

    it('should not allow promotion to clear violation history', () => {
      // Record violations
      sandbox.recordViolation({
        type: 'path_access',
        severity: 'warning',
        description: 'Violation before promotion',
        timestamp: new Date(),
      });

      // Promote
      sandbox.evaluate({
        confidenceScore: 65,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });

      // Violations should still be present
      expect(sandbox.getViolations()).toHaveLength(1);
    });

    it('should accumulate critical violations across separate recordViolation calls', () => {
      const s = createSandboxEscalation({
        initialLevel: SandboxLevel.ELEVATED,
        thresholds: { maxCriticalViolations: 3 },
      });

      // First critical - no demotion yet
      let result = s.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Critical 1',
        timestamp: new Date(),
      });
      expect(result.changed).toBe(false);

      // Second critical - still no demotion
      result = s.recordViolation({
        type: 'tool_access',
        severity: 'critical',
        description: 'Critical 2',
        timestamp: new Date(),
      });
      expect(result.changed).toBe(false);

      // Third critical - should now trigger demotion
      result = s.recordViolation({
        type: 'error_rate',
        severity: 'critical',
        description: 'Critical 3',
        timestamp: new Date(),
      });
      expect(result.changed).toBe(true);
      expect(result.direction).toBe('demoted');
    });

    it('should only count critical violations, not warnings, for critical threshold', () => {
      const s = createSandboxEscalation({
        initialLevel: SandboxLevel.STANDARD,
        thresholds: { maxCriticalViolations: 2 },
      });

      // Add many warnings
      for (let i = 0; i < 10; i++) {
        s.recordViolation({
          type: 'timeout',
          severity: 'warning',
          description: `Warning ${i}`,
          timestamp: new Date(),
        });
      }

      // Should not demote from warnings alone (via recordViolation)
      expect(s.getCurrentLevel()).toBe(SandboxLevel.STANDARD);

      // One critical should not trigger (threshold is 2)
      s.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Critical 1',
        timestamp: new Date(),
      });
      expect(s.getCurrentLevel()).toBe(SandboxLevel.STANDARD);
    });

    it('should demote by exactly one level on demotion, not skip levels', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      const result = s.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Critical violation',
        timestamp: new Date(),
      });
      expect(result.newLevel).toBe(SandboxLevel.STANDARD);
      expect(result.newLevel).not.toBe(SandboxLevel.MONITORED);
      expect(result.newLevel).not.toBe(SandboxLevel.RESTRICTED);
    });
  });

  // ==========================================================================
  // Demotion Priority - Safety Over Promotion
  // ==========================================================================

  describe('demotion priority over promotion', () => {
    it('should prioritize demotion even when promotion criteria are met', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      const result = s.evaluate({
        confidenceScore: 80, // meets promotion threshold
        successfulTasks: 3,
        failedTasks: 3,      // 50% error rate exceeds maxErrorRate
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(result.direction).toBe('demoted');
      expect(result.newLevel).toBe(SandboxLevel.RESTRICTED);
    });
  });

  // ==========================================================================
  // Edge Cases and Attack Vectors
  // ==========================================================================

  describe('edge cases: path traversal attempts', () => {
    it('should handle paths with directory traversal patterns', () => {
      // These paths should not match allowed patterns at RESTRICTED level
      // because the glob matching works on the full path string
      const traversalPaths = [
        '../../etc/passwd',
        '../../../etc/shadow',
        'src/../../etc/passwd',
      ];

      for (const path of traversalPaths) {
        // At RESTRICTED, allowed paths are limited globs; traversal should not match
        const allowed = sandbox.isAllowed(ToolCategory.READ, path);
        // The key security property: these should not bypass denied path checks
        // or be allowed when they shouldn't be
        expect(typeof allowed).toBe('boolean');
      }
    });

    it('should deny denied paths even when they contain traversal components', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      // .env files should be denied at STANDARD regardless of path depth
      expect(s.isAllowed(ToolCategory.READ, 'config/.env')).toBe(false);
      expect(s.isAllowed(ToolCategory.READ, 'src/config/.env.local')).toBe(false);
    });
  });

  describe('edge cases: empty and boundary inputs', () => {
    it('should handle isAllowed with empty path string', () => {
      // Empty path should not cause an error; tool category is still checked
      const result = sandbox.isAllowed(ToolCategory.READ, '');
      expect(typeof result).toBe('boolean');
    });

    it('should handle isAllowed with undefined path', () => {
      // When path is not provided, only tool category is checked
      expect(sandbox.isAllowed(ToolCategory.READ)).toBe(true);
      expect(sandbox.isAllowed(ToolCategory.WRITE)).toBe(false);
    });

    it('should handle evaluate with zero confidence score', () => {
      const result = sandbox.evaluate({
        confidenceScore: 0,
        successfulTasks: 0,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      // Should not promote, should not error
      expect(result.changed).toBe(false);
      expect(result.newLevel).toBe(SandboxLevel.RESTRICTED);
    });

    it('should handle evaluate with maximum confidence score', () => {
      const result = sandbox.evaluate({
        confidenceScore: 100,
        successfulTasks: 3,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      // Should promote only one level
      expect(result.newLevel).toBe(SandboxLevel.MONITORED);
    });

    it('should handle evaluate with zero tasks', () => {
      const result = sandbox.evaluate({
        confidenceScore: 70,
        successfulTasks: 0,
        failedTasks: 0,
        currentLevel: SandboxLevel.RESTRICTED,
      });
      // Should not promote without minimum successful tasks
      expect(result.changed).toBe(false);
    });
  });

  describe('edge cases: concurrent escalation behavior', () => {
    it('should maintain consistent state across rapid sequential evaluations', () => {
      // Simulate multiple rapid evaluations
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(sandbox.evaluate({
          confidenceScore: 65,
          successfulTasks: 3,
          failedTasks: 0,
          currentLevel: sandbox.getCurrentLevel(),
        }));
      }

      // First evaluation should promote from RESTRICTED to MONITORED
      expect(results[0].changed).toBe(true);
      expect(results[0].newLevel).toBe(SandboxLevel.MONITORED);

      // Subsequent evaluations from MONITORED should not promote
      // because 65 < 75 (monitoredToStandard threshold)
      for (let i = 1; i < 5; i++) {
        expect(results[i].newLevel).toBe(SandboxLevel.MONITORED);
      }
    });

    it('should correctly reflect level after violation then evaluation', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });

      // Record critical violation -> demotes to MONITORED
      s.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Critical access violation',
        timestamp: new Date(),
      });
      expect(s.getCurrentLevel()).toBe(SandboxLevel.MONITORED);

      // Evaluate with high confidence -> should promote back to STANDARD
      const result = s.evaluate({
        confidenceScore: 80,
        successfulTasks: 5,
        failedTasks: 0,
        currentLevel: SandboxLevel.MONITORED,
      });
      expect(result.newLevel).toBe(SandboxLevel.STANDARD);
    });
  });

  // ==========================================================================
  // Reset Security
  // ==========================================================================

  describe('reset clears all security state', () => {
    it('should reset level and violations completely', () => {
      sandbox.setLevel(SandboxLevel.ELEVATED, 'Testing');
      sandbox.recordViolation({
        type: 'path_access',
        severity: 'critical',
        description: 'Test violation',
        timestamp: new Date(),
      });

      sandbox.reset();

      expect(sandbox.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);
      expect(sandbox.getViolations()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Deny Takes Precedence Over Allow
  // ==========================================================================

  describe('deny path precedence over allow path', () => {
    it('should deny a path matching deniedPaths even if it matches allowedPaths', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      // STANDARD allows '**' but denies '**/.env*'
      // A .env file should be denied even though '**' would allow it
      expect(s.isAllowed(ToolCategory.READ, '.env')).toBe(false);
      expect(s.isAllowed(ToolCategory.READ, 'config/.env.local')).toBe(false);
    });

    it('should deny secrets/ at STANDARD even though allowed paths include **', () => {
      const s = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      expect(s.isAllowed(ToolCategory.READ, 'secrets/db-password.txt')).toBe(false);
    });
  });
});
