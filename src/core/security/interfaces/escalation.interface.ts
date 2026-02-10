/**
 * Progressive Sandbox Escalation Interfaces
 *
 * Defines a 4-stage sandbox system where agent permissions escalate
 * based on confidence scores and task history.
 *
 * @module core/security/interfaces/escalation
 */

// ============================================================================
// Sandbox Levels
// ============================================================================

/**
 * Sandbox escalation levels (least to most privileged)
 */
export enum SandboxLevel {
  /** Read-only access, limited tool set, no file writes */
  RESTRICTED = 'restricted',
  /** Read + limited writes, monitored execution */
  MONITORED = 'monitored',
  /** Normal permissions, full tool access */
  STANDARD = 'standard',
  /** Full access including system config modifications */
  ELEVATED = 'elevated',
}

/**
 * Numeric mapping for sandbox levels (for threshold comparison)
 */
export const SANDBOX_LEVEL_ORDER: Record<SandboxLevel, number> = {
  [SandboxLevel.RESTRICTED]: 0,
  [SandboxLevel.MONITORED]: 1,
  [SandboxLevel.STANDARD]: 2,
  [SandboxLevel.ELEVATED]: 3,
};

// ============================================================================
// Permission Definitions
// ============================================================================

/**
 * Tool category permissions
 */
export enum ToolCategory {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  NETWORK = 'network',
  SYSTEM = 'system',
}

/**
 * Permission set for a sandbox level
 */
export interface SandboxPermissions {
  /** Allowed tool categories */
  allowedToolCategories: ToolCategory[];
  /** Allowed file path patterns (glob) */
  allowedPaths: string[];
  /** Denied file path patterns (glob) */
  deniedPaths: string[];
  /** Max concurrent operations */
  maxConcurrentOps: number;
  /** Whether execution is monitored/logged */
  monitored: boolean;
  /** Max execution time per operation (ms) */
  maxExecutionTime: number;
}

// ============================================================================
// Escalation Context
// ============================================================================

/**
 * Context for escalation decisions
 */
export interface EscalationContext {
  /** Current confidence score (0-100) */
  confidenceScore: number;
  /** Number of successful tasks in current session */
  successfulTasks: number;
  /** Number of failed tasks in current session */
  failedTasks: number;
  /** Current sandbox level */
  currentLevel: SandboxLevel;
  /** Task type being executed */
  taskType?: string;
  /** Task complexity */
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * Result of an escalation decision
 */
export interface EscalationResult {
  /** Previous sandbox level */
  previousLevel: SandboxLevel;
  /** New sandbox level */
  newLevel: SandboxLevel;
  /** Whether level changed */
  changed: boolean;
  /** Direction of change */
  direction: 'promoted' | 'demoted' | 'unchanged';
  /** Reason for the decision */
  reason: string;
  /** Permissions for the new level */
  permissions: SandboxPermissions;
}

/**
 * Violation that may trigger demotion
 */
export interface SecurityViolation {
  /** Type of violation */
  type: 'path_access' | 'tool_access' | 'timeout' | 'error_rate' | 'manual';
  /** Severity */
  severity: 'warning' | 'critical';
  /** Description */
  description: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Escalation Thresholds
// ============================================================================

/**
 * Threshold configuration for level transitions
 */
export interface EscalationThresholds {
  /** Confidence score needed for RESTRICTED -> MONITORED */
  restrictedToMonitored: number;
  /** Confidence score needed for MONITORED -> STANDARD */
  monitoredToStandard: number;
  /** Confidence score needed for STANDARD -> ELEVATED */
  standardToElevated: number;
  /** Min successful tasks before promotion is considered */
  minSuccessfulTasks: number;
  /** Max error rate before demotion (0-1) */
  maxErrorRate: number;
  /** Number of critical violations before immediate demotion */
  maxCriticalViolations: number;
}

/**
 * Default escalation thresholds
 */
export const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  restrictedToMonitored: 60,
  monitoredToStandard: 75,
  standardToElevated: 90,
  minSuccessfulTasks: 2,
  maxErrorRate: 0.3,
  maxCriticalViolations: 1,
};

// ============================================================================
// Core Interface
// ============================================================================

/**
 * Sandbox Escalation Interface
 *
 * Manages progressive sandbox levels based on confidence and behavior.
 */
export interface ISandboxEscalation {
  /**
   * Get current sandbox level
   */
  getCurrentLevel(): SandboxLevel;

  /**
   * Get permissions for the current level
   */
  getPermissions(): SandboxPermissions;

  /**
   * Get permissions for a specific level
   */
  getPermissionsForLevel(level: SandboxLevel): SandboxPermissions;

  /**
   * Evaluate whether to escalate/de-escalate based on context
   */
  evaluate(context: EscalationContext): EscalationResult;

  /**
   * Record a security violation (may trigger demotion)
   */
  recordViolation(violation: SecurityViolation): EscalationResult;

  /**
   * Check if a specific operation is allowed at current level
   */
  isAllowed(toolCategory: ToolCategory, path?: string): boolean;

  /**
   * Force set to a specific level (admin override)
   */
  setLevel(level: SandboxLevel, reason: string): EscalationResult;

  /**
   * Reset to initial level
   */
  reset(): void;

  /**
   * Get violation history
   */
  getViolations(): SecurityViolation[];

  /**
   * Configure escalation thresholds
   */
  setThresholds(thresholds: Partial<EscalationThresholds>): void;
}

/**
 * Options for creating a SandboxEscalation instance
 */
export interface SandboxEscalationOptions {
  /** Initial sandbox level (default: RESTRICTED) */
  initialLevel?: SandboxLevel;
  /** Custom thresholds */
  thresholds?: Partial<EscalationThresholds>;
  /** Custom permission overrides per level */
  permissionOverrides?: Partial<Record<SandboxLevel, Partial<SandboxPermissions>>>;
  /** Project root for path resolution */
  projectRoot?: string;
}
