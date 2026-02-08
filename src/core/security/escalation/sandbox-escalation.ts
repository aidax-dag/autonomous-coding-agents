/**
 * Sandbox Escalation Implementation
 *
 * 4-tier progressive sandbox with automatic escalation/de-escalation
 * based on trust, confidence, and runtime behavior.
 *
 * @module core/security/escalation
 */

import { createLogger, ILogger } from '../../services/logger.js';
import {
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

// ============================================================================
// Constants
// ============================================================================

/** Default capabilities for each sandbox level */
const LEVEL_CAPABILITIES: Record<SandboxLevel, SandboxCapabilities> = {
  [SandboxLevel.RESTRICTED]: {
    fileAccess: 'read-only',
    networkAccess: 'none',
    shellAccess: 'none',
    maxExecutionTime: 30,
    maxMemoryMB: 256,
    canInstallPackages: false,
    canModifySystemFiles: false,
  },
  [SandboxLevel.STANDARD]: {
    fileAccess: 'project-scoped',
    networkAccess: 'none',
    shellAccess: 'allowlist',
    maxExecutionTime: 120,
    maxMemoryMB: 512,
    canInstallPackages: false,
    canModifySystemFiles: false,
    shellAllowlist: ['git', 'npm', 'npx', 'node', 'tsc', 'eslint', 'prettier', 'jest', 'vitest'],
  },
  [SandboxLevel.ELEVATED]: {
    fileAccess: 'full',
    networkAccess: 'outbound-only',
    shellAccess: 'full',
    maxExecutionTime: 600,
    maxMemoryMB: 2048,
    canInstallPackages: true,
    canModifySystemFiles: false,
  },
  [SandboxLevel.FULL]: {
    fileAccess: 'full',
    networkAccess: 'full',
    shellAccess: 'full',
    maxExecutionTime: 0,
    maxMemoryMB: 0,
    canInstallPackages: true,
    canModifySystemFiles: true,
  },
};

/** Default escalation policy */
const DEFAULT_POLICY: EscalationPolicy = {
  confidenceThresholds: {
    [SandboxLevel.RESTRICTED]: 0,
    [SandboxLevel.STANDARD]: 50,
    [SandboxLevel.ELEVATED]: 75,
    [SandboxLevel.FULL]: 95,
  },
  trustThresholds: {
    [SandboxLevel.RESTRICTED]: 0,
    [SandboxLevel.STANDARD]: 1,
    [SandboxLevel.ELEVATED]: 2,
    [SandboxLevel.FULL]: 3,
  },
  maxAutoLevel: SandboxLevel.ELEVATED,
  deescalationCooldownMs: 60000, // 1 minute
  maxConsecutiveErrors: 3,
  defaultExpiryMs: 0, // no expiry
};

// ============================================================================
// Entity State
// ============================================================================

interface EntityState {
  level: SandboxLevel;
  consecutiveErrors: number;
  lastDeescalation: Date | null;
  history: EscalationEvent[];
}

// ============================================================================
// SandboxEscalation
// ============================================================================

export class SandboxEscalation implements ISandboxEscalation {
  private readonly logger: ILogger;
  private policy: EscalationPolicy;
  private entities = new Map<string, EntityState>();

  constructor(policy?: Partial<EscalationPolicy>) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.logger = createLogger('SandboxEscalation');
  }

  // =========================================================================
  // ISandboxEscalation
  // =========================================================================

  getCurrentLevel(entityId: string): SandboxLevel {
    return this.getOrCreateEntity(entityId).level;
  }

  getCapabilities(level: SandboxLevel): SandboxCapabilities {
    return { ...LEVEL_CAPABILITIES[level] };
  }

  requestEscalation(request: EscalationRequest): EscalationResult {
    const entity = this.getOrCreateEntity(request.entityId);

    // De-escalation always allowed
    if (request.requestedLevel < entity.level) {
      return this.applyLevelChange(
        request.entityId,
        entity,
        request.requestedLevel,
        request.reason,
        true,
      );
    }

    // Same level — no-op
    if (request.requestedLevel === entity.level) {
      return {
        approved: true,
        grantedLevel: entity.level,
        capabilities: this.getCapabilities(entity.level),
        reason: 'Already at requested level',
        conditions: this.getConditions(entity.level),
      };
    }

    // Check cooldown after de-escalation
    if (entity.lastDeescalation) {
      const elapsed = Date.now() - entity.lastDeescalation.getTime();
      if (elapsed < this.policy.deescalationCooldownMs) {
        return this.deny(entity, `Cooldown active (${Math.ceil((this.policy.deescalationCooldownMs - elapsed) / 1000)}s remaining)`);
      }
    }

    // Check auto-escalation ceiling
    if (request.requestedLevel > this.policy.maxAutoLevel) {
      return this.deny(entity, `Level ${SandboxLevel[request.requestedLevel]} requires human approval (max auto: ${SandboxLevel[this.policy.maxAutoLevel]})`);
    }

    // Check confidence threshold
    const requiredConfidence = this.policy.confidenceThresholds[request.requestedLevel];
    if (request.confidenceScore !== undefined && request.confidenceScore < requiredConfidence) {
      // Grant the highest level the confidence allows
      const grantableLevel = this.highestLevelForConfidence(request.confidenceScore);
      if (grantableLevel > entity.level) {
        return this.applyLevelChange(
          request.entityId,
          entity,
          grantableLevel,
          `Partial escalation: confidence ${request.confidenceScore} < ${requiredConfidence} required for ${SandboxLevel[request.requestedLevel]}`,
          true,
        );
      }
      return this.deny(entity, `Confidence ${request.confidenceScore} below threshold ${requiredConfidence}`);
    }

    // Check trust threshold
    const requiredTrust = this.policy.trustThresholds[request.requestedLevel];
    if (request.trustLevel !== undefined && request.trustLevel < requiredTrust) {
      const grantableLevel = this.highestLevelForTrust(request.trustLevel);
      if (grantableLevel > entity.level) {
        return this.applyLevelChange(
          request.entityId,
          entity,
          grantableLevel,
          `Partial escalation: trust ${request.trustLevel} < ${requiredTrust} required for ${SandboxLevel[request.requestedLevel]}`,
          true,
        );
      }
      return this.deny(entity, `Trust level ${request.trustLevel} below threshold ${requiredTrust}`);
    }

    // Check consecutive errors
    if (entity.consecutiveErrors >= this.policy.maxConsecutiveErrors) {
      return this.deny(entity, `Too many consecutive errors (${entity.consecutiveErrors})`);
    }

    // All checks passed — approve
    return this.applyLevelChange(
      request.entityId,
      entity,
      request.requestedLevel,
      request.reason,
      true,
    );
  }

  deescalate(entityId: string, reason: string): EscalationResult {
    const entity = this.getOrCreateEntity(entityId);

    if (entity.level === SandboxLevel.RESTRICTED) {
      return {
        approved: true,
        grantedLevel: SandboxLevel.RESTRICTED,
        capabilities: this.getCapabilities(SandboxLevel.RESTRICTED),
        reason: 'Already at lowest level',
        conditions: this.getConditions(SandboxLevel.RESTRICTED),
      };
    }

    const newLevel = (entity.level - 1) as SandboxLevel;
    entity.lastDeescalation = new Date();

    return this.applyLevelChange(entityId, entity, newLevel, reason, false);
  }

  recordError(entityId: string, error: string): void {
    const entity = this.getOrCreateEntity(entityId);
    entity.consecutiveErrors++;

    this.logger.debug(`Entity ${entityId} error #${entity.consecutiveErrors}: ${error}`);

    // Auto-de-escalate if too many errors
    if (entity.consecutiveErrors >= this.policy.maxConsecutiveErrors && entity.level > SandboxLevel.RESTRICTED) {
      this.deescalate(entityId, `Auto-deescalation: ${entity.consecutiveErrors} consecutive errors`);
    }
  }

  resetErrors(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.consecutiveErrors = 0;
    }
  }

  isOperationAllowed(entityId: string, operation: OperationType): boolean {
    const level = this.getCurrentLevel(entityId);
    const caps = LEVEL_CAPABILITIES[level];

    switch (operation) {
      case 'file:read':
        return caps.fileAccess !== 'none';
      case 'file:write':
      case 'file:delete':
        return caps.fileAccess === 'project-scoped' || caps.fileAccess === 'full';
      case 'file:system':
        return caps.canModifySystemFiles;
      case 'network:outbound':
        return caps.networkAccess === 'outbound-only' || caps.networkAccess === 'full';
      case 'network:inbound':
        return caps.networkAccess === 'full';
      case 'shell:execute':
        return caps.shellAccess !== 'none';
      case 'package:install':
        return caps.canInstallPackages;
      default:
        return false;
    }
  }

  getHistory(entityId: string): EscalationEvent[] {
    const entity = this.entities.get(entityId);
    return entity ? [...entity.history] : [];
  }

  getPolicy(): EscalationPolicy {
    return { ...this.policy };
  }

  setPolicy(policy: Partial<EscalationPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  // =========================================================================
  // Private
  // =========================================================================

  private getOrCreateEntity(entityId: string): EntityState {
    let entity = this.entities.get(entityId);
    if (!entity) {
      entity = {
        level: SandboxLevel.RESTRICTED,
        consecutiveErrors: 0,
        lastDeescalation: null,
        history: [],
      };
      this.entities.set(entityId, entity);
    }
    return entity;
  }

  private applyLevelChange(
    entityId: string,
    entity: EntityState,
    newLevel: SandboxLevel,
    reason: string,
    autoApproved: boolean,
  ): EscalationResult {
    const fromLevel = entity.level;
    entity.level = newLevel;

    const event: EscalationEvent = {
      timestamp: new Date(),
      entityId,
      fromLevel,
      toLevel: newLevel,
      isEscalation: newLevel > fromLevel,
      reason,
      autoApproved,
    };
    entity.history.push(event);

    this.logger.debug(
      `${entityId}: ${SandboxLevel[fromLevel]} → ${SandboxLevel[newLevel]} (${reason})`,
    );

    const result: EscalationResult = {
      approved: true,
      grantedLevel: newLevel,
      capabilities: this.getCapabilities(newLevel),
      reason,
      conditions: this.getConditions(newLevel),
    };

    if (this.policy.defaultExpiryMs > 0) {
      result.expiresAt = new Date(Date.now() + this.policy.defaultExpiryMs);
    }

    return result;
  }

  private deny(entity: EntityState, reason: string): EscalationResult {
    return {
      approved: false,
      grantedLevel: entity.level,
      capabilities: this.getCapabilities(entity.level),
      reason,
      conditions: this.getConditions(entity.level),
    };
  }

  private getConditions(level: SandboxLevel): EscalationCondition[] {
    const conditions: EscalationCondition[] = [];

    if (level >= SandboxLevel.STANDARD) {
      conditions.push({
        type: 'max_errors',
        value: this.policy.maxConsecutiveErrors,
        description: `Max ${this.policy.maxConsecutiveErrors} consecutive errors before de-escalation`,
      });
    }

    if (level >= SandboxLevel.ELEVATED) {
      conditions.push({
        type: 'no_violations',
        value: 'security',
        description: 'No security violations (file access, network abuse)',
      });
    }

    return conditions;
  }

  private highestLevelForConfidence(score: number): SandboxLevel {
    const levels = [SandboxLevel.FULL, SandboxLevel.ELEVATED, SandboxLevel.STANDARD, SandboxLevel.RESTRICTED];
    for (const level of levels) {
      if (level > this.policy.maxAutoLevel) continue;
      if (score >= this.policy.confidenceThresholds[level]) return level;
    }
    return SandboxLevel.RESTRICTED;
  }

  private highestLevelForTrust(trustLevel: number): SandboxLevel {
    const levels = [SandboxLevel.FULL, SandboxLevel.ELEVATED, SandboxLevel.STANDARD, SandboxLevel.RESTRICTED];
    for (const level of levels) {
      if (level > this.policy.maxAutoLevel) continue;
      if (trustLevel >= this.policy.trustThresholds[level]) return level;
    }
    return SandboxLevel.RESTRICTED;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createSandboxEscalation(policy?: Partial<EscalationPolicy>): SandboxEscalation {
  return new SandboxEscalation(policy);
}
