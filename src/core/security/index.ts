/**
 * Security Module
 *
 * Progressive sandbox escalation and security enforcement.
 *
 * - SandboxEscalation: 4-stage progressive permission system
 *
 * @module core/security
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  SandboxLevel,
  SANDBOX_LEVEL_ORDER,
  ToolCategory,
  DEFAULT_ESCALATION_THRESHOLDS,
  type SandboxPermissions,
  type EscalationContext,
  type EscalationResult,
  type SecurityViolation,
  type EscalationThresholds,
  type ISandboxEscalation,
  type SandboxEscalationOptions,
} from './interfaces/escalation.interface.js';

// ============================================================================
// Implementation
// ============================================================================

export {
  SandboxEscalation,
  createSandboxEscalation,
} from './sandbox-escalation.js';
