/**
 * Security Module
 *
 * Progressive sandbox escalation, OS-native sandboxing,
 * network isolation, and resource limiting.
 *
 * - SandboxEscalation: 4-stage progressive permission system
 * - SeatbeltSandbox: macOS Seatbelt sandbox integration
 * - LandlockSandbox: Linux Landlock sandbox integration
 * - NetworkIsolation: network access control
 * - ResourceLimiter: memory, CPU, and timeout enforcement
 *
 * @module core/security
 */

// ============================================================================
// Escalation Interfaces
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
} from './interfaces/escalation.interface';

// ============================================================================
// OS-Native Sandbox Interfaces
// ============================================================================

export type {
  SandboxPlatform,
  SandboxPolicy,
  SandboxResult,
  IOSSandbox,
  INetworkIsolation,
  IResourceLimiter,
} from './interfaces/os-sandbox.interface';

// ============================================================================
// Escalation Implementation
// ============================================================================

export {
  SandboxEscalation,
  createSandboxEscalation,
} from './sandbox-escalation';

// ============================================================================
// OS-Native Sandbox Implementations
// ============================================================================

export {
  SeatbeltSandbox,
  createSeatbeltSandbox,
} from './seatbelt-sandbox';

export {
  LandlockSandbox,
  createLandlockSandbox,
} from './landlock-sandbox';

// ============================================================================
// Network Isolation
// ============================================================================

export {
  NetworkIsolation,
  createNetworkIsolation,
} from './network-isolation';

// ============================================================================
// Resource Limiter
// ============================================================================

export {
  ResourceLimiter,
  createResourceLimiter,
} from './resource-limiter';

// ============================================================================
// Platform Sandbox Factory
// ============================================================================

export {
  detectPlatform,
  createPlatformSandbox,
} from './platform-sandbox';
