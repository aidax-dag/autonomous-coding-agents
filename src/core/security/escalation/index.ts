/**
 * Escalation Module
 *
 * Progressive sandbox escalation for agent execution control.
 *
 * @module core/security/escalation
 */

export {
  SandboxLevel,
  type SandboxCapabilities,
  type EscalationRequest,
  type EscalationResult,
  type EscalationCondition,
  type EscalationPolicy,
  type EscalationEvent,
  type ISandboxEscalation,
  type OperationType,
} from './escalation.interface.js';

export {
  SandboxEscalation,
  createSandboxEscalation,
} from './sandbox-escalation.js';
