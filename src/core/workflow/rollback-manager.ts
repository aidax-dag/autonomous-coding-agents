/**
 * Rollback Manager Module
 *
 * Provides rollback and recovery capabilities for workflow execution.
 * Supports checkpointing, compensation actions, and multiple rollback strategies.
 *
 * SOLID Principles:
 * - S: RollbackManager focuses solely on rollback and recovery operations
 * - O: Extensible through strategies and compensation handlers
 * - L: All rollback operations follow the same contract
 * - I: Separate interfaces for checkpoints, rollback, and compensation
 * - D: Depends on abstractions (storage adapters, compensation handlers)
 *
 * @module core/workflow/rollback-manager
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { WorkflowStatus, StepStatus } from './workflow-definition';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Rollback strategy types
 */
export enum RollbackStrategy {
  /** Rollback all completed steps in reverse order */
  FULL = 'full',
  /** Rollback to a specific checkpoint */
  TO_CHECKPOINT = 'to_checkpoint',
  /** Rollback only the failed step */
  FAILED_STEP_ONLY = 'failed_step_only',
  /** Rollback to the last successful step */
  TO_LAST_SUCCESS = 'to_last_success',
  /** Skip failed step and continue */
  SKIP_AND_CONTINUE = 'skip_and_continue',
}

/**
 * Checkpoint type
 */
export enum CheckpointType {
  /** Automatic checkpoint before step execution */
  AUTO = 'auto',
  /** Manual checkpoint created by user */
  MANUAL = 'manual',
  /** Checkpoint at workflow start */
  WORKFLOW_START = 'workflow_start',
  /** Checkpoint after successful step */
  STEP_SUCCESS = 'step_success',
  /** Checkpoint at milestone */
  MILESTONE = 'milestone',
}

/**
 * Rollback status
 */
export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
}

/**
 * Compensation result status
 */
export enum CompensationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  NOT_REQUIRED = 'not_required',
}

/**
 * Step state snapshot for checkpoint
 */
export interface StepStateSnapshot {
  stepId: string;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: Date | null;
  completedAt: Date | null;
  retryCount: number;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

/**
 * Workflow state snapshot for checkpoint
 */
export interface WorkflowStateSnapshot {
  workflowInstanceId: string;
  workflowId: string;
  status: WorkflowStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  stepStates: StepStateSnapshot[];
  currentStepId?: string;
  completedStepIds: string[];
  failedStepIds: string[];
  skippedStepIds: string[];
}

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  id: string;
  workflowInstanceId: string;
  type: CheckpointType;
  name?: string;
  description?: string;
  state: WorkflowStateSnapshot;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Compensation action definition
 */
export interface CompensationAction {
  stepId: string;
  name: string;
  description?: string;
  handler: CompensationHandler;
  priority: number;
  required: boolean;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    delay: number;
  };
}

/**
 * Compensation handler function type
 */
export type CompensationHandler = (
  stepId: string,
  stepState: StepStateSnapshot,
  context: CompensationContext
) => Promise<CompensationResult>;

/**
 * Compensation context
 */
export interface CompensationContext {
  workflowInstanceId: string;
  rollbackId: string;
  targetCheckpointId?: string;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Compensation result
 */
export interface CompensationResult {
  status: CompensationStatus;
  stepId: string;
  message?: string;
  error?: Error;
  undoData?: Record<string, unknown>;
  duration: number;
}

/**
 * Rollback request
 */
export interface RollbackRequest {
  workflowInstanceId: string;
  strategy: RollbackStrategy;
  targetCheckpointId?: string;
  targetStepId?: string;
  reason: string;
  force?: boolean;
  skipCompensation?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  id: string;
  workflowInstanceId: string;
  status: RollbackStatus;
  strategy: RollbackStrategy;
  startedAt: Date;
  completedAt?: Date;
  targetCheckpointId?: string;
  restoredState?: WorkflowStateSnapshot;
  compensationResults: CompensationResult[];
  rollbackedStepIds: string[];
  error?: RollbackError;
  duration: number;
}

/**
 * Rollback error
 */
export interface RollbackError {
  code: string;
  message: string;
  stepId?: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * Rollback manager configuration
 */
export interface RollbackManagerConfig {
  workflowInstanceId: string;
  maxCheckpoints: number;
  autoCheckpoint: boolean;
  autoCheckpointInterval?: number;
  defaultStrategy: RollbackStrategy;
  compensationTimeout: number;
  enableHistory: boolean;
  maxHistorySize: number;
  storage?: ICheckpointStorage;
}

/**
 * Rollback manager events
 */
export const RollbackManagerEvents = {
  CHECKPOINT_CREATED: 'checkpoint:created',
  CHECKPOINT_DELETED: 'checkpoint:deleted',
  CHECKPOINT_RESTORED: 'checkpoint:restored',
  ROLLBACK_STARTED: 'rollback:started',
  ROLLBACK_COMPLETED: 'rollback:completed',
  ROLLBACK_FAILED: 'rollback:failed',
  ROLLBACK_PROGRESS: 'rollback:progress',
  COMPENSATION_STARTED: 'compensation:started',
  COMPENSATION_COMPLETED: 'compensation:completed',
  COMPENSATION_FAILED: 'compensation:failed',
  COMPENSATION_SKIPPED: 'compensation:skipped',
} as const;

export type RollbackManagerEventType = typeof RollbackManagerEvents[keyof typeof RollbackManagerEvents];

/**
 * Checkpoint event payload
 */
export interface CheckpointEventPayload {
  checkpoint: Checkpoint;
  timestamp: Date;
}

/**
 * Rollback event payload
 */
export interface RollbackEventPayload {
  rollbackId: string;
  workflowInstanceId: string;
  status: RollbackStatus;
  strategy: RollbackStrategy;
  progress?: number;
  currentStep?: string;
  result?: RollbackResult;
  error?: RollbackError;
  timestamp: Date;
}

/**
 * Compensation event payload
 */
export interface CompensationEventPayload {
  rollbackId: string;
  stepId: string;
  status: CompensationStatus;
  result?: CompensationResult;
  error?: Error;
  timestamp: Date;
}

/**
 * Checkpoint storage interface
 */
export interface ICheckpointStorage {
  save(checkpoint: Checkpoint): Promise<void>;
  get(checkpointId: string): Promise<Checkpoint | undefined>;
  getByWorkflow(workflowInstanceId: string): Promise<Checkpoint[]>;
  delete(checkpointId: string): Promise<boolean>;
  deleteByWorkflow(workflowInstanceId: string): Promise<number>;
  getLatest(workflowInstanceId: string): Promise<Checkpoint | undefined>;
  count(workflowInstanceId: string): Promise<number>;
}

/**
 * Rollback manager interface
 */
export interface IRollbackManager {
  readonly instanceId: string;
  readonly workflowInstanceId: string;
  readonly checkpoints: Checkpoint[];
  readonly compensationActions: Map<string, CompensationAction>;
  readonly rollbackHistory: RollbackResult[];

  // Checkpoint operations
  createCheckpoint(type: CheckpointType, state: WorkflowStateSnapshot, options?: CreateCheckpointOptions): Promise<Checkpoint>;
  getCheckpoint(checkpointId: string): Checkpoint | undefined;
  getLatestCheckpoint(): Checkpoint | undefined;
  getCheckpointsByType(type: CheckpointType): Checkpoint[];
  deleteCheckpoint(checkpointId: string): boolean;
  clearCheckpoints(): void;

  // Compensation operations
  registerCompensation(action: CompensationAction): void;
  unregisterCompensation(stepId: string): boolean;
  getCompensation(stepId: string): CompensationAction | undefined;
  hasCompensation(stepId: string): boolean;

  // Rollback operations
  rollback(request: RollbackRequest): Promise<RollbackResult>;
  canRollback(strategy: RollbackStrategy, targetCheckpointId?: string): boolean;
  getRollbackHistory(): RollbackResult[];

  // Snapshot operations
  createSnapshot(): RollbackManagerSnapshot;
  restore(snapshot: RollbackManagerSnapshot): void;

  // Event handling
  on(event: RollbackManagerEventType, handler: (payload: CheckpointEventPayload | RollbackEventPayload | CompensationEventPayload) => void): void;
  off(event: RollbackManagerEventType, handler: (payload: CheckpointEventPayload | RollbackEventPayload | CompensationEventPayload) => void): void;
}

/**
 * Create checkpoint options
 */
export interface CreateCheckpointOptions {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Rollback manager snapshot for serialization
 */
export interface RollbackManagerSnapshot {
  instanceId: string;
  workflowInstanceId: string;
  checkpoints: Checkpoint[];
  compensationActions: Array<{
    stepId: string;
    name: string;
    description?: string;
    priority: number;
    required: boolean;
    timeout?: number;
    retryPolicy?: { maxAttempts: number; delay: number };
  }>;
  rollbackHistory: RollbackResult[];
  createdAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

export const RollbackManagerConfigSchema = z.object({
  workflowInstanceId: z.string().min(1),
  maxCheckpoints: z.number().int().min(1).max(1000).default(100),
  autoCheckpoint: z.boolean().default(true),
  autoCheckpointInterval: z.number().int().min(1000).optional(),
  defaultStrategy: z.nativeEnum(RollbackStrategy).default(RollbackStrategy.TO_LAST_SUCCESS),
  compensationTimeout: z.number().int().min(1000).default(30000),
  enableHistory: z.boolean().default(true),
  maxHistorySize: z.number().int().min(0).max(1000).default(100),
});

export const RollbackRequestSchema = z.object({
  workflowInstanceId: z.string().min(1),
  strategy: z.nativeEnum(RollbackStrategy),
  targetCheckpointId: z.string().optional(),
  targetStepId: z.string().optional(),
  reason: z.string().min(1),
  force: z.boolean().default(false),
  skipCompensation: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * In-memory checkpoint storage implementation
 */
export class InMemoryCheckpointStorage implements ICheckpointStorage {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private workflowIndex: Map<string, Set<string>> = new Map();

  async save(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, checkpoint);

    if (!this.workflowIndex.has(checkpoint.workflowInstanceId)) {
      this.workflowIndex.set(checkpoint.workflowInstanceId, new Set());
    }
    this.workflowIndex.get(checkpoint.workflowInstanceId)!.add(checkpoint.id);
  }

  async get(checkpointId: string): Promise<Checkpoint | undefined> {
    return this.checkpoints.get(checkpointId);
  }

  async getByWorkflow(workflowInstanceId: string): Promise<Checkpoint[]> {
    const ids = this.workflowIndex.get(workflowInstanceId);
    if (!ids) return [];

    const checkpoints: Checkpoint[] = [];
    for (const id of ids) {
      const checkpoint = this.checkpoints.get(id);
      if (checkpoint) {
        checkpoints.push(checkpoint);
      }
    }

    return checkpoints.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async delete(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this.checkpoints.delete(checkpointId);
    this.workflowIndex.get(checkpoint.workflowInstanceId)?.delete(checkpointId);

    return true;
  }

  async deleteByWorkflow(workflowInstanceId: string): Promise<number> {
    const ids = this.workflowIndex.get(workflowInstanceId);
    if (!ids) return 0;

    const count = ids.size;
    for (const id of ids) {
      this.checkpoints.delete(id);
    }
    this.workflowIndex.delete(workflowInstanceId);

    return count;
  }

  async getLatest(workflowInstanceId: string): Promise<Checkpoint | undefined> {
    const checkpoints = await this.getByWorkflow(workflowInstanceId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
  }

  async count(workflowInstanceId: string): Promise<number> {
    return this.workflowIndex.get(workflowInstanceId)?.size ?? 0;
  }
}

// ============================================================================
// Rollback Manager Implementation
// ============================================================================

/**
 * Rollback Manager
 *
 * Manages workflow rollback and recovery with:
 * - Checkpoint creation and management
 * - Multiple rollback strategies
 * - Compensation action execution
 * - Event emission for monitoring
 * - History tracking
 */
export class RollbackManager implements IRollbackManager {
  readonly instanceId: string;
  readonly workflowInstanceId: string;

  private _checkpoints: Map<string, Checkpoint> = new Map();
  private _compensationActions: Map<string, CompensationAction> = new Map();
  private _rollbackHistory: RollbackResult[] = [];
  private readonly config: RollbackManagerConfig;
  private readonly eventEmitter: EventEmitter;
  private readonly storage: ICheckpointStorage;
  private currentRollbackId: string | null = null;

  constructor(config: RollbackManagerConfig) {
    this.instanceId = generateId();
    this.workflowInstanceId = config.workflowInstanceId;
    this.config = config;
    this.eventEmitter = new EventEmitter();
    this.storage = config.storage ?? new InMemoryCheckpointStorage();
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get checkpoints(): Checkpoint[] {
    return Array.from(this._checkpoints.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  get compensationActions(): Map<string, CompensationAction> {
    return new Map(this._compensationActions);
  }

  get rollbackHistory(): RollbackResult[] {
    return [...this._rollbackHistory];
  }

  // ============================================================================
  // Checkpoint Operations
  // ============================================================================

  async createCheckpoint(
    type: CheckpointType,
    state: WorkflowStateSnapshot,
    options?: CreateCheckpointOptions
  ): Promise<Checkpoint> {
    // Enforce max checkpoints limit
    if (this._checkpoints.size >= this.config.maxCheckpoints) {
      const oldestCheckpoint = this.getOldestCheckpoint();
      if (oldestCheckpoint) {
        await this.deleteCheckpointInternal(oldestCheckpoint.id);
      }
    }

    const checkpoint: Checkpoint = {
      id: generateId(),
      workflowInstanceId: this.workflowInstanceId,
      type,
      name: options?.name,
      description: options?.description,
      state: this.cloneState(state),
      createdAt: new Date(),
      metadata: options?.metadata,
      tags: options?.tags,
    };

    this._checkpoints.set(checkpoint.id, checkpoint);
    await this.storage.save(checkpoint);

    this.emit(RollbackManagerEvents.CHECKPOINT_CREATED, {
      checkpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);

    return checkpoint;
  }

  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this._checkpoints.get(checkpointId);
  }

  getLatestCheckpoint(): Checkpoint | undefined {
    const checkpoints = this.checkpoints;
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
  }

  getCheckpointsByType(type: CheckpointType): Checkpoint[] {
    return this.checkpoints.filter(cp => cp.type === type);
  }

  deleteCheckpoint(checkpointId: string): boolean {
    return this.deleteCheckpointSync(checkpointId);
  }

  private deleteCheckpointSync(checkpointId: string): boolean {
    const checkpoint = this._checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this._checkpoints.delete(checkpointId);
    // Fire and forget storage deletion
    this.storage.delete(checkpointId).catch(() => {});

    this.emit(RollbackManagerEvents.CHECKPOINT_DELETED, {
      checkpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);

    return true;
  }

  private async deleteCheckpointInternal(checkpointId: string): Promise<boolean> {
    const checkpoint = this._checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this._checkpoints.delete(checkpointId);
    await this.storage.delete(checkpointId);

    this.emit(RollbackManagerEvents.CHECKPOINT_DELETED, {
      checkpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);

    return true;
  }

  clearCheckpoints(): void {
    const checkpoints = [...this._checkpoints.values()];
    this._checkpoints.clear();

    // Fire and forget storage deletion
    this.storage.deleteByWorkflow(this.workflowInstanceId).catch(() => {});

    for (const checkpoint of checkpoints) {
      this.emit(RollbackManagerEvents.CHECKPOINT_DELETED, {
        checkpoint,
        timestamp: new Date(),
      } as CheckpointEventPayload);
    }
  }

  private getOldestCheckpoint(): Checkpoint | undefined {
    const checkpoints = this.checkpoints;
    return checkpoints.length > 0 ? checkpoints[0] : undefined;
  }

  // ============================================================================
  // Compensation Operations
  // ============================================================================

  registerCompensation(action: CompensationAction): void {
    if (!action.stepId || !action.name || !action.handler) {
      throw new Error('Invalid compensation action: stepId, name, and handler are required');
    }
    this._compensationActions.set(action.stepId, action);
  }

  unregisterCompensation(stepId: string): boolean {
    return this._compensationActions.delete(stepId);
  }

  getCompensation(stepId: string): CompensationAction | undefined {
    return this._compensationActions.get(stepId);
  }

  hasCompensation(stepId: string): boolean {
    return this._compensationActions.has(stepId);
  }

  // ============================================================================
  // Rollback Operations
  // ============================================================================

  async rollback(request: RollbackRequest): Promise<RollbackResult> {
    const validatedRequest = RollbackRequestSchema.parse(request);

    if (validatedRequest.workflowInstanceId !== this.workflowInstanceId) {
      throw new Error(`Workflow instance ID mismatch: expected ${this.workflowInstanceId}, got ${validatedRequest.workflowInstanceId}`);
    }

    if (this.currentRollbackId !== null) {
      throw new Error('A rollback is already in progress');
    }

    const rollbackId = generateId();
    this.currentRollbackId = rollbackId;
    const startTime = Date.now();

    const result: RollbackResult = {
      id: rollbackId,
      workflowInstanceId: this.workflowInstanceId,
      status: RollbackStatus.IN_PROGRESS,
      strategy: validatedRequest.strategy,
      startedAt: new Date(),
      targetCheckpointId: validatedRequest.targetCheckpointId,
      compensationResults: [],
      rollbackedStepIds: [],
      duration: 0,
    };

    this.emit(RollbackManagerEvents.ROLLBACK_STARTED, {
      rollbackId,
      workflowInstanceId: this.workflowInstanceId,
      status: RollbackStatus.IN_PROGRESS,
      strategy: validatedRequest.strategy,
      timestamp: new Date(),
    } as RollbackEventPayload);

    try {
      switch (validatedRequest.strategy) {
        case RollbackStrategy.FULL:
          await this.executeFullRollback(result, validatedRequest);
          break;
        case RollbackStrategy.TO_CHECKPOINT:
          await this.executeCheckpointRollback(result, validatedRequest);
          break;
        case RollbackStrategy.FAILED_STEP_ONLY:
          await this.executeFailedStepRollback(result, validatedRequest);
          break;
        case RollbackStrategy.TO_LAST_SUCCESS:
          await this.executeLastSuccessRollback(result, validatedRequest);
          break;
        case RollbackStrategy.SKIP_AND_CONTINUE:
          await this.executeSkipAndContinue(result, validatedRequest);
          break;
        default:
          throw new Error(`Unknown rollback strategy: ${validatedRequest.strategy}`);
      }

      result.status = this.hasFailedCompensations(result)
        ? RollbackStatus.PARTIALLY_COMPLETED
        : RollbackStatus.COMPLETED;
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;

      this.emit(RollbackManagerEvents.ROLLBACK_COMPLETED, {
        rollbackId,
        workflowInstanceId: this.workflowInstanceId,
        status: result.status,
        strategy: validatedRequest.strategy,
        result,
        timestamp: new Date(),
      } as RollbackEventPayload);

    } catch (error) {
      result.status = RollbackStatus.FAILED;
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;
      result.error = {
        code: 'ROLLBACK_FAILED',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      };

      this.emit(RollbackManagerEvents.ROLLBACK_FAILED, {
        rollbackId,
        workflowInstanceId: this.workflowInstanceId,
        status: RollbackStatus.FAILED,
        strategy: validatedRequest.strategy,
        error: result.error,
        timestamp: new Date(),
      } as RollbackEventPayload);

      throw error;
    } finally {
      this.currentRollbackId = null;

      if (this.config.enableHistory) {
        this.addToHistory(result);
      }
    }

    return result;
  }

  canRollback(strategy: RollbackStrategy, targetCheckpointId?: string): boolean {
    if (this.currentRollbackId !== null) {
      return false;
    }

    switch (strategy) {
      case RollbackStrategy.FULL:
        return this._checkpoints.size > 0;
      case RollbackStrategy.TO_CHECKPOINT:
        return targetCheckpointId !== undefined && this._checkpoints.has(targetCheckpointId);
      case RollbackStrategy.FAILED_STEP_ONLY:
      case RollbackStrategy.TO_LAST_SUCCESS:
      case RollbackStrategy.SKIP_AND_CONTINUE:
        return true;
      default:
        return false;
    }
  }

  getRollbackHistory(): RollbackResult[] {
    return [...this._rollbackHistory];
  }

  // ============================================================================
  // Rollback Strategy Implementations
  // ============================================================================

  private async executeFullRollback(
    result: RollbackResult,
    request: RollbackRequest
  ): Promise<void> {
    const startCheckpoint = this.getCheckpointsByType(CheckpointType.WORKFLOW_START)[0];

    if (!startCheckpoint) {
      throw new Error('No workflow start checkpoint found for full rollback');
    }

    const latestCheckpoint = this.getLatestCheckpoint();
    if (!latestCheckpoint) {
      throw new Error('No checkpoints available');
    }

    // Get all completed steps from current state (not start state) in reverse order for compensation
    const completedSteps = latestCheckpoint.state.completedStepIds || [];
    const stepsToRollback = [...completedSteps].reverse();

    await this.executeCompensations(result, stepsToRollback, request, latestCheckpoint.state);

    result.targetCheckpointId = startCheckpoint.id;
    result.restoredState = this.cloneState(startCheckpoint.state);
    result.rollbackedStepIds = stepsToRollback;

    this.emit(RollbackManagerEvents.CHECKPOINT_RESTORED, {
      checkpoint: startCheckpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);
  }

  private async executeCheckpointRollback(
    result: RollbackResult,
    request: RollbackRequest
  ): Promise<void> {
    if (!request.targetCheckpointId) {
      throw new Error('Target checkpoint ID is required for TO_CHECKPOINT strategy');
    }

    const targetCheckpoint = this.getCheckpoint(request.targetCheckpointId);
    if (!targetCheckpoint) {
      throw new Error(`Checkpoint not found: ${request.targetCheckpointId}`);
    }

    const latestCheckpoint = this.getLatestCheckpoint();
    if (!latestCheckpoint) {
      throw new Error('No checkpoints available');
    }

    // Find steps completed after the target checkpoint
    const targetCompletedSteps = new Set(targetCheckpoint.state.completedStepIds || []);
    const currentCompletedSteps = latestCheckpoint.state.completedStepIds || [];
    const stepsToRollback = currentCompletedSteps
      .filter(stepId => !targetCompletedSteps.has(stepId))
      .reverse();

    await this.executeCompensations(result, stepsToRollback, request, targetCheckpoint.state);

    result.restoredState = this.cloneState(targetCheckpoint.state);
    result.rollbackedStepIds = stepsToRollback;

    this.emit(RollbackManagerEvents.CHECKPOINT_RESTORED, {
      checkpoint: targetCheckpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);
  }

  private async executeFailedStepRollback(
    result: RollbackResult,
    request: RollbackRequest
  ): Promise<void> {
    const latestCheckpoint = this.getLatestCheckpoint();
    if (!latestCheckpoint) {
      throw new Error('No checkpoints available');
    }

    const failedStepIds = latestCheckpoint.state.failedStepIds || [];
    if (failedStepIds.length === 0) {
      result.rollbackedStepIds = [];
      return;
    }

    // Only rollback the failed steps
    await this.executeCompensations(result, failedStepIds, request, latestCheckpoint.state);
    result.rollbackedStepIds = failedStepIds;
  }

  private async executeLastSuccessRollback(
    result: RollbackResult,
    request: RollbackRequest
  ): Promise<void> {
    // Find the last successful step checkpoint
    const successCheckpoints = this.getCheckpointsByType(CheckpointType.STEP_SUCCESS);
    if (successCheckpoints.length === 0) {
      throw new Error('No successful step checkpoints found');
    }

    const lastSuccessCheckpoint = successCheckpoints[successCheckpoints.length - 1];
    const latestCheckpoint = this.getLatestCheckpoint();

    if (!latestCheckpoint) {
      throw new Error('No checkpoints available');
    }

    // Find steps completed after the last success
    const lastSuccessCompletedSteps = new Set(lastSuccessCheckpoint.state.completedStepIds || []);
    const currentCompletedSteps = latestCheckpoint.state.completedStepIds || [];
    const stepsToRollback = currentCompletedSteps
      .filter(stepId => !lastSuccessCompletedSteps.has(stepId))
      .reverse();

    await this.executeCompensations(result, stepsToRollback, request, lastSuccessCheckpoint.state);

    result.targetCheckpointId = lastSuccessCheckpoint.id;
    result.restoredState = this.cloneState(lastSuccessCheckpoint.state);
    result.rollbackedStepIds = stepsToRollback;

    this.emit(RollbackManagerEvents.CHECKPOINT_RESTORED, {
      checkpoint: lastSuccessCheckpoint,
      timestamp: new Date(),
    } as CheckpointEventPayload);
  }

  private async executeSkipAndContinue(
    result: RollbackResult,
    _request: RollbackRequest
  ): Promise<void> {
    // Skip and continue doesn't actually rollback anything
    // It just marks the failed steps as skipped
    result.rollbackedStepIds = [];
    result.compensationResults = [];
  }

  // ============================================================================
  // Compensation Execution
  // ============================================================================

  private async executeCompensations(
    result: RollbackResult,
    stepIds: string[],
    request: RollbackRequest,
    targetState: WorkflowStateSnapshot
  ): Promise<void> {
    if (request.skipCompensation) {
      return;
    }

    const context: CompensationContext = {
      workflowInstanceId: this.workflowInstanceId,
      rollbackId: result.id,
      targetCheckpointId: request.targetCheckpointId,
      variables: targetState.variables,
      metadata: request.metadata ?? {},
    };

    // Sort by priority (higher priority first)
    const sortedStepIds = this.sortByCompensationPriority(stepIds);

    let completedCount = 0;
    const totalSteps = sortedStepIds.length;

    for (const stepId of sortedStepIds) {
      const compensation = this._compensationActions.get(stepId);
      const stepState = this.findStepState(targetState, stepId);

      if (!compensation) {
        result.compensationResults.push({
          status: CompensationStatus.NOT_REQUIRED,
          stepId,
          message: 'No compensation action registered',
          duration: 0,
        });
        completedCount++;
        continue;
      }

      if (!stepState) {
        result.compensationResults.push({
          status: CompensationStatus.SKIPPED,
          stepId,
          message: 'Step state not found',
          duration: 0,
        });
        completedCount++;
        continue;
      }

      this.emit(RollbackManagerEvents.COMPENSATION_STARTED, {
        rollbackId: result.id,
        stepId,
        status: CompensationStatus.SUCCESS,
        timestamp: new Date(),
      } as CompensationEventPayload);

      const compensationResult = await this.executeCompensationWithRetry(
        compensation,
        stepState,
        context
      );

      result.compensationResults.push(compensationResult);
      completedCount++;

      // Emit progress
      this.emit(RollbackManagerEvents.ROLLBACK_PROGRESS, {
        rollbackId: result.id,
        workflowInstanceId: this.workflowInstanceId,
        status: RollbackStatus.IN_PROGRESS,
        strategy: request.strategy,
        progress: (completedCount / totalSteps) * 100,
        currentStep: stepId,
        timestamp: new Date(),
      } as RollbackEventPayload);

      if (compensationResult.status === CompensationStatus.SUCCESS) {
        this.emit(RollbackManagerEvents.COMPENSATION_COMPLETED, {
          rollbackId: result.id,
          stepId,
          status: CompensationStatus.SUCCESS,
          result: compensationResult,
          timestamp: new Date(),
        } as CompensationEventPayload);
      } else if (compensationResult.status === CompensationStatus.FAILED) {
        this.emit(RollbackManagerEvents.COMPENSATION_FAILED, {
          rollbackId: result.id,
          stepId,
          status: CompensationStatus.FAILED,
          result: compensationResult,
          error: compensationResult.error,
          timestamp: new Date(),
        } as CompensationEventPayload);

        // If compensation is required and failed, we may need to stop
        if (compensation.required && !request.force) {
          throw new Error(`Required compensation for step ${stepId} failed: ${compensationResult.message}`);
        }
      } else if (compensationResult.status === CompensationStatus.SKIPPED) {
        this.emit(RollbackManagerEvents.COMPENSATION_SKIPPED, {
          rollbackId: result.id,
          stepId,
          status: CompensationStatus.SKIPPED,
          result: compensationResult,
          timestamp: new Date(),
        } as CompensationEventPayload);
      }
    }
  }

  private async executeCompensationWithRetry(
    action: CompensationAction,
    stepState: StepStateSnapshot,
    context: CompensationContext
  ): Promise<CompensationResult> {
    const maxAttempts = action.retryPolicy?.maxAttempts ?? 1;
    const delay = action.retryPolicy?.delay ?? 1000;
    const timeout = action.timeout ?? this.config.compensationTimeout;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          () => action.handler(action.stepId, stepState, context),
          timeout
        );
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          await this.sleep(delay * attempt);
        }
      }
    }

    return {
      status: CompensationStatus.FAILED,
      stepId: action.stepId,
      message: lastError?.message ?? 'Compensation failed',
      error: lastError,
      duration: 0,
    };
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Compensation timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private sortByCompensationPriority(stepIds: string[]): string[] {
    return [...stepIds].sort((a, b) => {
      const priorityA = this._compensationActions.get(a)?.priority ?? 0;
      const priorityB = this._compensationActions.get(b)?.priority ?? 0;
      return priorityB - priorityA; // Higher priority first
    });
  }

  private findStepState(
    state: WorkflowStateSnapshot,
    stepId: string
  ): StepStateSnapshot | undefined {
    return state.stepStates.find(s => s.stepId === stepId);
  }

  private hasFailedCompensations(result: RollbackResult): boolean {
    return result.compensationResults.some(r => r.status === CompensationStatus.FAILED);
  }

  private addToHistory(result: RollbackResult): void {
    this._rollbackHistory.push(result);

    // Enforce max history size
    while (this._rollbackHistory.length > this.config.maxHistorySize) {
      this._rollbackHistory.shift();
    }
  }

  private cloneState(state: WorkflowStateSnapshot): WorkflowStateSnapshot {
    return {
      ...state,
      inputs: { ...state.inputs },
      outputs: { ...state.outputs },
      variables: { ...state.variables },
      stepStates: state.stepStates.map(s => ({ ...s })),
      completedStepIds: [...state.completedStepIds],
      failedStepIds: [...state.failedStepIds],
      skippedStepIds: [...state.skippedStepIds],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  createSnapshot(): RollbackManagerSnapshot {
    return {
      instanceId: this.instanceId,
      workflowInstanceId: this.workflowInstanceId,
      checkpoints: this.checkpoints.map(cp => ({
        ...cp,
        state: this.cloneState(cp.state),
      })),
      compensationActions: Array.from(this._compensationActions.values()).map(action => ({
        stepId: action.stepId,
        name: action.name,
        description: action.description,
        priority: action.priority,
        required: action.required,
        timeout: action.timeout,
        retryPolicy: action.retryPolicy,
      })),
      rollbackHistory: this._rollbackHistory.map(r => ({ ...r })),
      createdAt: new Date(),
    };
  }

  restore(snapshot: RollbackManagerSnapshot): void {
    if (snapshot.workflowInstanceId !== this.workflowInstanceId) {
      throw new Error(
        `Workflow instance ID mismatch: expected ${this.workflowInstanceId}, got ${snapshot.workflowInstanceId}`
      );
    }

    this._checkpoints.clear();
    for (const checkpoint of snapshot.checkpoints) {
      this._checkpoints.set(checkpoint.id, checkpoint);
    }

    // Note: We can't restore handlers from snapshot, only metadata
    // Handlers need to be re-registered after restore

    this._rollbackHistory = snapshot.rollbackHistory.map(r => ({ ...r }));
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on(
    event: RollbackManagerEventType,
    handler: (payload: CheckpointEventPayload | RollbackEventPayload | CompensationEventPayload) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  off(
    event: RollbackManagerEventType,
    handler: (payload: CheckpointEventPayload | RollbackEventPayload | CompensationEventPayload) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  private emit(event: RollbackManagerEventType, payload: CheckpointEventPayload | RollbackEventPayload | CompensationEventPayload): void {
    this.eventEmitter.emit(event, payload);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RollbackManager instance
 */
export function createRollbackManager(config: RollbackManagerConfig): RollbackManager {
  const validatedConfig = RollbackManagerConfigSchema.parse(config);
  return new RollbackManager(validatedConfig as RollbackManagerConfig);
}
