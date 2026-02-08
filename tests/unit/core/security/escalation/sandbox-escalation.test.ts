/**
 * Unit tests for SandboxEscalation
 *
 * Tests progressive 4-tier sandbox escalation/de-escalation logic.
 */

import {
  SandboxEscalation,
  SandboxLevel,
  createSandboxEscalation,
} from '../../../../../src/core/security/escalation/index.js';
import type {
  EscalationRequest,
} from '../../../../../src/core/security/escalation/index.js';

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(overrides?: Partial<EscalationRequest>): EscalationRequest {
  return {
    entityId: 'agent-1',
    entityType: 'agent',
    currentLevel: SandboxLevel.RESTRICTED,
    requestedLevel: SandboxLevel.STANDARD,
    reason: 'needs file write access',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SandboxEscalation', () => {
  let escalation: SandboxEscalation;

  beforeEach(() => {
    escalation = new SandboxEscalation();
  });

  // ==========================================================================
  // Initial state
  // ==========================================================================

  describe('initial state', () => {
    it('should default new entities to RESTRICTED', () => {
      expect(escalation.getCurrentLevel('unknown')).toBe(SandboxLevel.RESTRICTED);
    });

    it('should return empty history for new entities', () => {
      expect(escalation.getHistory('unknown')).toEqual([]);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('getCapabilities', () => {
    it('should return read-only for RESTRICTED', () => {
      const caps = escalation.getCapabilities(SandboxLevel.RESTRICTED);
      expect(caps.fileAccess).toBe('read-only');
      expect(caps.networkAccess).toBe('none');
      expect(caps.shellAccess).toBe('none');
      expect(caps.canInstallPackages).toBe(false);
    });

    it('should return project-scoped for STANDARD', () => {
      const caps = escalation.getCapabilities(SandboxLevel.STANDARD);
      expect(caps.fileAccess).toBe('project-scoped');
      expect(caps.networkAccess).toBe('none');
      expect(caps.shellAccess).toBe('allowlist');
      expect(caps.shellAllowlist).toContain('git');
      expect(caps.shellAllowlist).toContain('npm');
    });

    it('should return full file + outbound network for ELEVATED', () => {
      const caps = escalation.getCapabilities(SandboxLevel.ELEVATED);
      expect(caps.fileAccess).toBe('full');
      expect(caps.networkAccess).toBe('outbound-only');
      expect(caps.shellAccess).toBe('full');
      expect(caps.canInstallPackages).toBe(true);
    });

    it('should return unrestricted for FULL', () => {
      const caps = escalation.getCapabilities(SandboxLevel.FULL);
      expect(caps.fileAccess).toBe('full');
      expect(caps.networkAccess).toBe('full');
      expect(caps.shellAccess).toBe('full');
      expect(caps.canModifySystemFiles).toBe(true);
      expect(caps.maxExecutionTime).toBe(0);
    });

    it('should return defensive copies', () => {
      const caps1 = escalation.getCapabilities(SandboxLevel.STANDARD);
      const caps2 = escalation.getCapabilities(SandboxLevel.STANDARD);
      expect(caps1).not.toBe(caps2);
      expect(caps1).toEqual(caps2);
    });
  });

  // ==========================================================================
  // Escalation
  // ==========================================================================

  describe('requestEscalation', () => {
    it('should approve escalation to STANDARD with sufficient confidence', () => {
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.STANDARD);
    });

    it('should approve escalation to ELEVATED with sufficient confidence and trust', () => {
      // First escalate to STANDARD
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));

      const result = escalation.requestEscalation(
        makeRequest({
          currentLevel: SandboxLevel.STANDARD,
          requestedLevel: SandboxLevel.ELEVATED,
          confidenceScore: 80,
          trustLevel: 2,
        }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.ELEVATED);
    });

    it('should deny escalation to FULL (above maxAutoLevel)', () => {
      // Escalate to ELEVATED first
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.requestEscalation(
        makeRequest({
          requestedLevel: SandboxLevel.ELEVATED,
          confidenceScore: 80,
          trustLevel: 2,
        }),
      );

      const result = escalation.requestEscalation(
        makeRequest({
          currentLevel: SandboxLevel.ELEVATED,
          requestedLevel: SandboxLevel.FULL,
          confidenceScore: 100,
          trustLevel: 3,
        }),
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('human approval');
    });

    it('should deny escalation with insufficient confidence', () => {
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 30 }),
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Confidence');
    });

    it('should partially escalate when confidence is between thresholds', () => {
      // Request ELEVATED but only have confidence for STANDARD
      const result = escalation.requestEscalation(
        makeRequest({
          requestedLevel: SandboxLevel.ELEVATED,
          confidenceScore: 60, // enough for STANDARD (50), not ELEVATED (75)
          trustLevel: 2,
        }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.STANDARD);
      expect(result.reason).toContain('Partial escalation');
    });

    it('should deny escalation with insufficient trust', () => {
      const result = escalation.requestEscalation(
        makeRequest({
          requestedLevel: SandboxLevel.ELEVATED,
          confidenceScore: 80,
          trustLevel: 0, // needs 2 for ELEVATED
        }),
      );
      // Should partially escalate to RESTRICTED (trust 0 meets RESTRICTED threshold)
      // but since already at RESTRICTED, it's a deny
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Trust level');
    });

    it('should approve without confidence/trust checks when not provided', () => {
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: undefined, trustLevel: undefined }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.STANDARD);
    });

    it('should return no-op for same level request', () => {
      const result = escalation.requestEscalation(
        makeRequest({
          currentLevel: SandboxLevel.RESTRICTED,
          requestedLevel: SandboxLevel.RESTRICTED,
        }),
      );
      expect(result.approved).toBe(true);
      expect(result.reason).toBe('Already at requested level');
    });

    it('should allow de-escalation via request', () => {
      // Escalate first
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));

      const result = escalation.requestEscalation(
        makeRequest({
          currentLevel: SandboxLevel.STANDARD,
          requestedLevel: SandboxLevel.RESTRICTED,
          reason: 'voluntary de-escalation',
        }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.RESTRICTED);
    });

    it('should deny escalation when too many consecutive errors', () => {
      escalation.recordError('agent-1', 'error 1');
      escalation.recordError('agent-1', 'error 2');
      escalation.recordError('agent-1', 'error 3');

      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('consecutive errors');
    });

    it('should record history on escalation', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));

      const history = escalation.getHistory('agent-1');
      expect(history.length).toBe(1);
      expect(history[0].fromLevel).toBe(SandboxLevel.RESTRICTED);
      expect(history[0].toLevel).toBe(SandboxLevel.STANDARD);
      expect(history[0].isEscalation).toBe(true);
    });

    it('should include conditions in result', () => {
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.conditions.length).toBeGreaterThan(0);
      expect(result.conditions[0].type).toBe('max_errors');
    });
  });

  // ==========================================================================
  // De-escalation
  // ==========================================================================

  describe('deescalate', () => {
    it('should lower level by one', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.STANDARD);

      const result = escalation.deescalate('agent-1', 'security violation');
      expect(result.grantedLevel).toBe(SandboxLevel.RESTRICTED);
      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.RESTRICTED);
    });

    it('should be no-op when already RESTRICTED', () => {
      const result = escalation.deescalate('agent-1', 'test');
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.RESTRICTED);
      expect(result.reason).toBe('Already at lowest level');
    });

    it('should enforce cooldown on re-escalation after de-escalation', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.deescalate('agent-1', 'error');

      // Try to re-escalate immediately
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Cooldown');
    });

    it('should record de-escalation in history', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.deescalate('agent-1', 'test');

      const history = escalation.getHistory('agent-1');
      expect(history.length).toBe(2);
      expect(history[1].isEscalation).toBe(false);
    });
  });

  // ==========================================================================
  // Error tracking
  // ==========================================================================

  describe('error tracking', () => {
    it('should auto-deescalate after maxConsecutiveErrors', () => {
      // Escalate to STANDARD first
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.STANDARD);

      escalation.recordError('agent-1', 'err1');
      escalation.recordError('agent-1', 'err2');
      escalation.recordError('agent-1', 'err3'); // triggers auto-deescalation

      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.RESTRICTED);
    });

    it('should reset errors', () => {
      escalation.recordError('agent-1', 'err1');
      escalation.recordError('agent-1', 'err2');
      escalation.resetErrors('agent-1');

      // Should be able to escalate now
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.approved).toBe(true);
    });

    it('should handle resetErrors on unknown entity', () => {
      // Should not throw
      escalation.resetErrors('nonexistent');
    });
  });

  // ==========================================================================
  // Operation checks
  // ==========================================================================

  describe('isOperationAllowed', () => {
    it('should allow file:read at RESTRICTED', () => {
      expect(escalation.isOperationAllowed('agent-1', 'file:read')).toBe(true);
    });

    it('should deny file:write at RESTRICTED', () => {
      expect(escalation.isOperationAllowed('agent-1', 'file:write')).toBe(false);
    });

    it('should deny shell:execute at RESTRICTED', () => {
      expect(escalation.isOperationAllowed('agent-1', 'shell:execute')).toBe(false);
    });

    it('should deny network:outbound at RESTRICTED', () => {
      expect(escalation.isOperationAllowed('agent-1', 'network:outbound')).toBe(false);
    });

    it('should allow file:write at STANDARD', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.isOperationAllowed('agent-1', 'file:write')).toBe(true);
    });

    it('should allow shell:execute at STANDARD', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.isOperationAllowed('agent-1', 'shell:execute')).toBe(true);
    });

    it('should deny network:outbound at STANDARD', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.isOperationAllowed('agent-1', 'network:outbound')).toBe(false);
    });

    it('should allow network:outbound at ELEVATED', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.requestEscalation(
        makeRequest({ requestedLevel: SandboxLevel.ELEVATED, confidenceScore: 80, trustLevel: 2 }),
      );
      expect(escalation.isOperationAllowed('agent-1', 'network:outbound')).toBe(true);
    });

    it('should deny network:inbound at ELEVATED', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.requestEscalation(
        makeRequest({ requestedLevel: SandboxLevel.ELEVATED, confidenceScore: 80, trustLevel: 2 }),
      );
      expect(escalation.isOperationAllowed('agent-1', 'network:inbound')).toBe(false);
    });

    it('should deny file:system at ELEVATED', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      escalation.requestEscalation(
        makeRequest({ requestedLevel: SandboxLevel.ELEVATED, confidenceScore: 80, trustLevel: 2 }),
      );
      expect(escalation.isOperationAllowed('agent-1', 'file:system')).toBe(false);
    });

    it('should deny package:install at STANDARD', () => {
      escalation.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      expect(escalation.isOperationAllowed('agent-1', 'package:install')).toBe(false);
    });
  });

  // ==========================================================================
  // Policy
  // ==========================================================================

  describe('policy', () => {
    it('should return current policy', () => {
      const policy = escalation.getPolicy();
      expect(policy.maxAutoLevel).toBe(SandboxLevel.ELEVATED);
      expect(policy.maxConsecutiveErrors).toBe(3);
    });

    it('should allow partial policy update', () => {
      escalation.setPolicy({ maxConsecutiveErrors: 5 });
      expect(escalation.getPolicy().maxConsecutiveErrors).toBe(5);
      // Other values unchanged
      expect(escalation.getPolicy().maxAutoLevel).toBe(SandboxLevel.ELEVATED);
    });

    it('should respect custom maxAutoLevel', () => {
      const custom = new SandboxEscalation({ maxAutoLevel: SandboxLevel.FULL });
      custom.requestEscalation(makeRequest({ confidenceScore: 80, trustLevel: 1 }));
      custom.requestEscalation(
        makeRequest({ requestedLevel: SandboxLevel.ELEVATED, confidenceScore: 80, trustLevel: 2 }),
      );

      const result = custom.requestEscalation(
        makeRequest({
          requestedLevel: SandboxLevel.FULL,
          confidenceScore: 100,
          trustLevel: 3,
        }),
      );
      expect(result.approved).toBe(true);
      expect(result.grantedLevel).toBe(SandboxLevel.FULL);
    });

    it('should set expiry when defaultExpiryMs > 0', () => {
      escalation.setPolicy({ defaultExpiryMs: 3600000 });
      const result = escalation.requestEscalation(
        makeRequest({ confidenceScore: 80, trustLevel: 1 }),
      );
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createSandboxEscalation', () => {
    it('should create an instance', () => {
      const e = createSandboxEscalation();
      expect(e).toBeInstanceOf(SandboxEscalation);
    });

    it('should accept custom policy', () => {
      const e = createSandboxEscalation({ maxConsecutiveErrors: 10 });
      expect(e.getPolicy().maxConsecutiveErrors).toBe(10);
    });
  });

  // ==========================================================================
  // Multiple entities
  // ==========================================================================

  describe('multiple entities', () => {
    it('should track entities independently', () => {
      escalation.requestEscalation(
        makeRequest({ entityId: 'agent-1', confidenceScore: 80, trustLevel: 1 }),
      );
      escalation.requestEscalation(
        makeRequest({
          entityId: 'agent-2',
          requestedLevel: SandboxLevel.ELEVATED,
          confidenceScore: 80,
          trustLevel: 2,
        }),
      );

      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.STANDARD);
      expect(escalation.getCurrentLevel('agent-2')).toBe(SandboxLevel.ELEVATED);
    });

    it('should track errors independently', () => {
      escalation.requestEscalation(
        makeRequest({ entityId: 'agent-1', confidenceScore: 80, trustLevel: 1 }),
      );
      escalation.requestEscalation(
        makeRequest({ entityId: 'agent-2', confidenceScore: 80, trustLevel: 1 }),
      );

      escalation.recordError('agent-1', 'err1');
      escalation.recordError('agent-1', 'err2');
      escalation.recordError('agent-1', 'err3'); // auto-deescalate agent-1

      expect(escalation.getCurrentLevel('agent-1')).toBe(SandboxLevel.RESTRICTED);
      expect(escalation.getCurrentLevel('agent-2')).toBe(SandboxLevel.STANDARD); // unaffected
    });
  });
});
