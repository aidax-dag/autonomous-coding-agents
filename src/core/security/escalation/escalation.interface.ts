/**
 * Progressive Sandbox Escalation Interfaces
 *
 * 4-tier sandbox system that controls agent execution capabilities
 * based on trust level, confidence score, and runtime behavior.
 *
 * Levels: RESTRICTED → STANDARD → ELEVATED → FULL
 *
 * @module core/security/escalation
 */

// ============================================================================
// Sandbox Levels
// ============================================================================

/**
 * Sandbox execution levels (ascending privilege).
 *
 * RESTRICTED — Read-only file access, no network, no shell
 * STANDARD   — Read/write project files, no network, limited shell
 * ELEVATED   — Full file access, outbound network, shell allowed
 * FULL       — Unrestricted (human-approved or built-in trust)
 */
export enum SandboxLevel {
  RESTRICTED = 0,
  STANDARD = 1,
  ELEVATED = 2,
  FULL = 3,
}

/**
 * Capabilities granted at each sandbox level.
 */
export interface SandboxCapabilities {
  /** Allowed file operations */
  fileAccess: 'none' | 'read-only' | 'project-scoped' | 'full';
  /** Network access */
  networkAccess: 'none' | 'outbound-only' | 'full';
  /** Shell/command execution */
  shellAccess: 'none' | 'allowlist' | 'full';
  /** Maximum execution time in seconds (0 = unlimited) */
  maxExecutionTime: number;
  /** Maximum memory in MB (0 = unlimited) */
  maxMemoryMB: number;
  /** Can install packages */
  canInstallPackages: boolean;
  /** Can modify system files outside project */
  canModifySystemFiles: boolean;
  /** Shell command allowlist (only when shellAccess = 'allowlist') */
  shellAllowlist?: string[];
}

// ============================================================================
// Escalation Request / Result
// ============================================================================

/**
 * Request to escalate (or de-escalate) sandbox level.
 */
export interface EscalationRequest {
  /** Entity requesting escalation (agent ID, plugin ID, etc.) */
  entityId: string;
  /** Entity type */
  entityType: 'agent' | 'plugin' | 'tool' | 'workflow';
  /** Current sandbox level */
  currentLevel: SandboxLevel;
  /** Requested sandbox level */
  requestedLevel: SandboxLevel;
  /** Reason for escalation */
  reason: string;
  /** Optional confidence score (0-100) from ConfidenceChecker */
  confidenceScore?: number;
  /** Optional trust level (0-3) from TrustManager */
  trustLevel?: number;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result of an escalation decision.
 */
export interface EscalationResult {
  /** Whether the escalation was approved */
  approved: boolean;
  /** Granted sandbox level (may differ from requested) */
  grantedLevel: SandboxLevel;
  /** Capabilities for the granted level */
  capabilities: SandboxCapabilities;
  /** Reason for the decision */
  reason: string;
  /** Conditions that must be maintained (violation → de-escalation) */
  conditions: EscalationCondition[];
  /** When this escalation expires (undefined = no expiry) */
  expiresAt?: Date;
}

/**
 * A condition that must hold for the current escalation level.
 * If violated, the entity is de-escalated.
 */
export interface EscalationCondition {
  /** Condition type */
  type: 'max_errors' | 'max_duration' | 'confidence_floor' | 'no_violations';
  /** Condition value */
  value: number | string;
  /** Human-readable description */
  description: string;
}

// ============================================================================
// Escalation Policy
// ============================================================================

/**
 * Policy that governs escalation decisions.
 */
export interface EscalationPolicy {
  /** Minimum confidence score to reach each level */
  confidenceThresholds: Record<SandboxLevel, number>;
  /** Minimum trust level to reach each level */
  trustThresholds: Record<SandboxLevel, number>;
  /** Maximum auto-escalation level (above requires human approval) */
  maxAutoLevel: SandboxLevel;
  /** De-escalation cooldown in milliseconds */
  deescalationCooldownMs: number;
  /** Maximum consecutive errors before de-escalation */
  maxConsecutiveErrors: number;
  /** Default escalation expiry in milliseconds (0 = no expiry) */
  defaultExpiryMs: number;
}

// ============================================================================
// Escalation History
// ============================================================================

/**
 * A recorded escalation event.
 */
export interface EscalationEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Entity ID */
  entityId: string;
  /** Previous level */
  fromLevel: SandboxLevel;
  /** New level */
  toLevel: SandboxLevel;
  /** Whether this was an escalation (true) or de-escalation (false) */
  isEscalation: boolean;
  /** Reason */
  reason: string;
  /** Whether it was auto-approved or human-approved */
  autoApproved: boolean;
}

// ============================================================================
// ISandboxEscalation Interface
// ============================================================================

/**
 * Progressive Sandbox Escalation Manager.
 */
export interface ISandboxEscalation {
  /**
   * Get the current sandbox level for an entity.
   */
  getCurrentLevel(entityId: string): SandboxLevel;

  /**
   * Get capabilities for a sandbox level.
   */
  getCapabilities(level: SandboxLevel): SandboxCapabilities;

  /**
   * Request escalation to a higher (or lower) sandbox level.
   */
  requestEscalation(request: EscalationRequest): EscalationResult;

  /**
   * De-escalate an entity (e.g., after an error or violation).
   */
  deescalate(entityId: string, reason: string): EscalationResult;

  /**
   * Record an error for an entity (may trigger auto-de-escalation).
   */
  recordError(entityId: string, error: string): void;

  /**
   * Reset error count for an entity (e.g., after successful operations).
   */
  resetErrors(entityId: string): void;

  /**
   * Check whether an operation is allowed at the entity's current level.
   */
  isOperationAllowed(entityId: string, operation: OperationType): boolean;

  /**
   * Get escalation history for an entity.
   */
  getHistory(entityId: string): EscalationEvent[];

  /**
   * Get current policy.
   */
  getPolicy(): EscalationPolicy;

  /**
   * Update policy.
   */
  setPolicy(policy: Partial<EscalationPolicy>): void;
}

/**
 * Operation types that can be checked against sandbox capabilities.
 */
export type OperationType =
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'file:system'
  | 'network:outbound'
  | 'network:inbound'
  | 'shell:execute'
  | 'package:install';
