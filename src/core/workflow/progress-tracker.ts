/**
 * Progress Tracker Module
 *
 * Provides workflow progress tracking, estimation, and reporting capabilities.
 *
 * SOLID Principles:
 * - S: ProgressTracker focuses solely on progress tracking and reporting
 * - O: Extensible through custom reporters and estimators
 * - L: All trackers follow the same IProgressTracker contract
 * - I: Separate interfaces for tracking, reporting, and estimation
 * - D: Depends on abstractions (IProgressTracker, IProgressReporter)
 *
 * @module core/workflow/progress-tracker
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { StepStatus, WorkflowStatus } from './workflow-definition';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Step progress information
 */
export interface StepProgress {
  stepId: string;
  name: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow progress information
 */
export interface WorkflowProgress {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  runningSteps: number;
  pendingSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  estimatedCompletionTime?: Date;
  steps: Map<string, StepProgress>;
  currentStep?: string;
  errors: ProgressError[];
  metadata?: Record<string, unknown>;
}

/**
 * Progress error information
 */
export interface ProgressError {
  stepId: string;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Progress update type
 */
export type ProgressUpdateType =
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:paused'
  | 'workflow:resumed'
  | 'workflow:cancelled'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'step:skipped'
  | 'step:retry'
  | 'progress:updated';

/**
 * Progress update event
 */
export interface ProgressUpdate {
  type: ProgressUpdateType;
  instanceId: string;
  timestamp: Date;
  stepId?: string;
  previousStatus?: string;
  currentStatus: string;
  progressPercentage: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Progress report format
 */
export type ProgressReportFormat = 'text' | 'json' | 'markdown' | 'html';

/**
 * Progress report options
 */
export interface ProgressReportOptions {
  format: ProgressReportFormat;
  includeSteps?: boolean;
  includeErrors?: boolean;
  includeTimings?: boolean;
  includeEstimates?: boolean;
  verbose?: boolean;
}

/**
 * Progress report output
 */
export interface ProgressReport {
  format: ProgressReportFormat;
  content: string;
  generatedAt: Date;
  instanceId: string;
}

/**
 * Progress tracker events
 */
export const ProgressTrackerEvents = {
  PROGRESS_UPDATED: 'progress:updated',
  STEP_STARTED: 'step:started',
  STEP_COMPLETED: 'step:completed',
  STEP_FAILED: 'step:failed',
  WORKFLOW_STARTED: 'workflow:started',
  WORKFLOW_COMPLETED: 'workflow:completed',
  WORKFLOW_FAILED: 'workflow:failed',
  MILESTONE_REACHED: 'milestone:reached',
  ESTIMATION_UPDATED: 'estimation:updated',
} as const;

export type ProgressTrackerEventType =
  typeof ProgressTrackerEvents[keyof typeof ProgressTrackerEvents];

/**
 * Progress event payload
 */
export interface ProgressEventPayload {
  instanceId: string;
  timestamp: Date;
  progress: WorkflowProgress;
  update?: ProgressUpdate;
  milestone?: string;
}

/**
 * Estimation configuration
 */
export interface EstimationConfig {
  useHistoricalData?: boolean;
  movingAverageWindow?: number;
  confidenceLevel?: number;
}

/**
 * Time estimation result
 */
export interface TimeEstimation {
  estimatedTimeRemaining: number;
  estimatedCompletionTime: Date;
  confidence: number;
  basedOnSteps: number;
}

/**
 * Progress tracker configuration
 */
export interface ProgressTrackerConfig {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  totalSteps: number;
  stepNames?: Map<string, string>;
  milestones?: Map<number, string>;
  estimation?: EstimationConfig;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

/**
 * Progress tracker interface
 */
export interface IProgressTracker {
  readonly instanceId: string;
  readonly progress: WorkflowProgress;
  readonly history: ProgressUpdate[];

  // Workflow lifecycle
  startWorkflow(): void;
  completeWorkflow(): void;
  failWorkflow(error: string): void;
  pauseWorkflow(): void;
  resumeWorkflow(): void;
  cancelWorkflow(): void;

  // Step tracking
  startStep(stepId: string, metadata?: Record<string, unknown>): void;
  completeStep(stepId: string, metadata?: Record<string, unknown>): void;
  failStep(stepId: string, error: string, retryable?: boolean): void;
  skipStep(stepId: string, reason?: string): void;
  retryStep(stepId: string): void;

  // Progress queries
  getProgress(): WorkflowProgress;
  getStepProgress(stepId: string): StepProgress | undefined;
  getEstimation(): TimeEstimation | undefined;

  // Reporting
  generateReport(options?: Partial<ProgressReportOptions>): ProgressReport;

  // Events
  on(event: ProgressTrackerEventType, handler: (payload: ProgressEventPayload) => void): void;
  off(event: ProgressTrackerEventType, handler: (payload: ProgressEventPayload) => void): void;

  // Snapshot
  snapshot(): ProgressSnapshot;
  restore(snapshot: ProgressSnapshot): void;
}

/**
 * Progress snapshot for serialization
 */
export interface ProgressSnapshot {
  instanceId: string;
  progress: SerializedProgress;
  history: ProgressUpdate[];
  createdAt: Date;
}

/**
 * Serialized progress (for JSON compatibility)
 */
export interface SerializedProgress {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  startedAt?: string;
  completedAt?: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  runningSteps: number;
  pendingSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  estimatedCompletionTime?: string;
  steps: Array<[string, StepProgress]>;
  currentStep?: string;
  errors: ProgressError[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Schemas
// ============================================================================

export const ProgressTrackerConfigSchema = z.object({
  instanceId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowName: z.string().min(1),
  totalSteps: z.number().int().min(0),
  enableHistory: z.boolean().default(true),
  maxHistorySize: z.number().int().min(0).max(10000).default(1000),
});

export const ProgressReportOptionsSchema = z.object({
  format: z.enum(['text', 'json', 'markdown', 'html']).default('text'),
  includeSteps: z.boolean().default(true),
  includeErrors: z.boolean().default(true),
  includeTimings: z.boolean().default(true),
  includeEstimates: z.boolean().default(true),
  verbose: z.boolean().default(false),
});

// ============================================================================
// Progress Tracker Implementation
// ============================================================================

/**
 * Progress Tracker
 *
 * Tracks workflow and step progress with:
 * - Real-time progress percentage calculation
 * - Time estimation based on historical data
 * - Multiple report formats
 * - Event emission for progress updates
 * - Milestone tracking
 */
export class ProgressTracker implements IProgressTracker {
  readonly instanceId: string;
  private _progress: WorkflowProgress;
  private _history: ProgressUpdate[] = [];

  private readonly stepNames: Map<string, string>;
  private readonly milestones: Map<number, string>;
  private readonly stepDurations: number[] = [];
  private readonly eventEmitter: EventEmitter;
  private readonly enableHistory: boolean;
  private readonly maxHistorySize: number;

  constructor(config: ProgressTrackerConfig) {
    this.instanceId = config.instanceId;
    this.stepNames = config.stepNames ?? new Map();
    this.milestones = config.milestones ?? new Map();
    this.enableHistory = config.enableHistory ?? true;
    this.maxHistorySize = config.maxHistorySize ?? 1000;
    this.eventEmitter = new EventEmitter();

    // Initialize progress
    this._progress = {
      instanceId: config.instanceId,
      workflowId: config.workflowId,
      workflowName: config.workflowName,
      status: WorkflowStatus.PENDING,
      totalSteps: config.totalSteps,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      runningSteps: 0,
      pendingSteps: config.totalSteps,
      progressPercentage: 0,
      steps: new Map(),
      errors: [],
    };
  }

  /**
   * Get current progress
   */
  get progress(): WorkflowProgress {
    return this._progress;
  }

  /**
   * Get progress update history
   */
  get history(): ProgressUpdate[] {
    return [...this._history];
  }

  // ==========================================================================
  // Workflow Lifecycle
  // ==========================================================================

  /**
   * Start workflow tracking
   */
  startWorkflow(): void {
    this._progress.status = WorkflowStatus.RUNNING;
    this._progress.startedAt = new Date();

    this.recordUpdate({
      type: 'workflow:started',
      instanceId: this.instanceId,
      timestamp: new Date(),
      currentStatus: WorkflowStatus.RUNNING,
      progressPercentage: 0,
      message: `Workflow '${this._progress.workflowName}' started`,
    });

    this.emitEvent(ProgressTrackerEvents.WORKFLOW_STARTED);
  }

  /**
   * Complete workflow tracking
   */
  completeWorkflow(): void {
    this._progress.status = WorkflowStatus.COMPLETED;
    this._progress.completedAt = new Date();
    this._progress.progressPercentage = 100;

    this.recordUpdate({
      type: 'workflow:completed',
      instanceId: this.instanceId,
      timestamp: new Date(),
      previousStatus: WorkflowStatus.RUNNING,
      currentStatus: WorkflowStatus.COMPLETED,
      progressPercentage: 100,
      message: `Workflow '${this._progress.workflowName}' completed successfully`,
    });

    this.emitEvent(ProgressTrackerEvents.WORKFLOW_COMPLETED);
  }

  /**
   * Fail workflow tracking
   */
  failWorkflow(error: string): void {
    this._progress.status = WorkflowStatus.FAILED;
    this._progress.completedAt = new Date();

    this._progress.errors.push({
      stepId: 'workflow',
      error,
      timestamp: new Date(),
      retryable: false,
    });

    this.recordUpdate({
      type: 'workflow:failed',
      instanceId: this.instanceId,
      timestamp: new Date(),
      previousStatus: WorkflowStatus.RUNNING,
      currentStatus: WorkflowStatus.FAILED,
      progressPercentage: this._progress.progressPercentage,
      message: `Workflow '${this._progress.workflowName}' failed: ${error}`,
    });

    this.emitEvent(ProgressTrackerEvents.WORKFLOW_FAILED);
  }

  /**
   * Pause workflow tracking
   */
  pauseWorkflow(): void {
    this._progress.status = WorkflowStatus.PAUSED;

    this.recordUpdate({
      type: 'workflow:paused',
      instanceId: this.instanceId,
      timestamp: new Date(),
      previousStatus: WorkflowStatus.RUNNING,
      currentStatus: WorkflowStatus.PAUSED,
      progressPercentage: this._progress.progressPercentage,
      message: `Workflow '${this._progress.workflowName}' paused`,
    });
  }

  /**
   * Resume workflow tracking
   */
  resumeWorkflow(): void {
    this._progress.status = WorkflowStatus.RUNNING;

    this.recordUpdate({
      type: 'workflow:resumed',
      instanceId: this.instanceId,
      timestamp: new Date(),
      previousStatus: WorkflowStatus.PAUSED,
      currentStatus: WorkflowStatus.RUNNING,
      progressPercentage: this._progress.progressPercentage,
      message: `Workflow '${this._progress.workflowName}' resumed`,
    });
  }

  /**
   * Cancel workflow tracking
   */
  cancelWorkflow(): void {
    this._progress.status = WorkflowStatus.CANCELLED;
    this._progress.completedAt = new Date();

    this.recordUpdate({
      type: 'workflow:cancelled',
      instanceId: this.instanceId,
      timestamp: new Date(),
      previousStatus: this._progress.status,
      currentStatus: WorkflowStatus.CANCELLED,
      progressPercentage: this._progress.progressPercentage,
      message: `Workflow '${this._progress.workflowName}' cancelled`,
    });
  }

  // ==========================================================================
  // Step Tracking
  // ==========================================================================

  /**
   * Start step tracking
   */
  startStep(stepId: string, metadata?: Record<string, unknown>): void {
    const stepProgress: StepProgress = {
      stepId,
      name: this.stepNames.get(stepId) ?? stepId,
      status: StepStatus.RUNNING,
      startedAt: new Date(),
      retryCount: 0,
      metadata,
    };

    this._progress.steps.set(stepId, stepProgress);
    this._progress.currentStep = stepId;
    this._progress.runningSteps++;
    this._progress.pendingSteps = Math.max(0, this._progress.pendingSteps - 1);

    this.updateProgressPercentage();

    this.recordUpdate({
      type: 'step:started',
      instanceId: this.instanceId,
      timestamp: new Date(),
      stepId,
      currentStatus: StepStatus.RUNNING,
      progressPercentage: this._progress.progressPercentage,
      message: `Step '${stepProgress.name}' started`,
      metadata,
    });

    this.emitEvent(ProgressTrackerEvents.STEP_STARTED);
  }

  /**
   * Complete step tracking
   */
  completeStep(stepId: string, metadata?: Record<string, unknown>): void {
    const step = this._progress.steps.get(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found`);
    }

    step.status = StepStatus.COMPLETED;
    step.completedAt = new Date();

    if (step.startedAt) {
      step.duration = step.completedAt.getTime() - step.startedAt.getTime();
      this.stepDurations.push(step.duration);
    }

    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    this._progress.completedSteps++;
    this._progress.runningSteps = Math.max(0, this._progress.runningSteps - 1);

    if (this._progress.currentStep === stepId) {
      this._progress.currentStep = undefined;
    }

    this.updateProgressPercentage();
    this.updateEstimation();
    this.checkMilestones();

    this.recordUpdate({
      type: 'step:completed',
      instanceId: this.instanceId,
      timestamp: new Date(),
      stepId,
      previousStatus: StepStatus.RUNNING,
      currentStatus: StepStatus.COMPLETED,
      progressPercentage: this._progress.progressPercentage,
      message: `Step '${step.name}' completed`,
      metadata,
    });

    this.emitEvent(ProgressTrackerEvents.STEP_COMPLETED);
  }

  /**
   * Fail step tracking
   */
  failStep(stepId: string, error: string, retryable = false): void {
    const step = this._progress.steps.get(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found`);
    }

    step.status = StepStatus.FAILED;
    step.completedAt = new Date();
    step.error = error;

    if (step.startedAt) {
      step.duration = step.completedAt.getTime() - step.startedAt.getTime();
    }

    this._progress.failedSteps++;
    this._progress.runningSteps = Math.max(0, this._progress.runningSteps - 1);

    if (this._progress.currentStep === stepId) {
      this._progress.currentStep = undefined;
    }

    this._progress.errors.push({
      stepId,
      error,
      timestamp: new Date(),
      retryable,
    });

    this.updateProgressPercentage();

    this.recordUpdate({
      type: 'step:failed',
      instanceId: this.instanceId,
      timestamp: new Date(),
      stepId,
      previousStatus: StepStatus.RUNNING,
      currentStatus: StepStatus.FAILED,
      progressPercentage: this._progress.progressPercentage,
      message: `Step '${step.name}' failed: ${error}`,
    });

    this.emitEvent(ProgressTrackerEvents.STEP_FAILED);
  }

  /**
   * Skip step tracking
   */
  skipStep(stepId: string, reason?: string): void {
    const existingStep = this._progress.steps.get(stepId);

    const stepProgress: StepProgress = {
      stepId,
      name: this.stepNames.get(stepId) ?? stepId,
      status: StepStatus.SKIPPED,
      completedAt: new Date(),
      retryCount: existingStep?.retryCount ?? 0,
      metadata: reason ? { skipReason: reason } : undefined,
    };

    this._progress.steps.set(stepId, stepProgress);
    this._progress.skippedSteps++;
    this._progress.pendingSteps = Math.max(0, this._progress.pendingSteps - 1);

    this.updateProgressPercentage();

    this.recordUpdate({
      type: 'step:skipped',
      instanceId: this.instanceId,
      timestamp: new Date(),
      stepId,
      currentStatus: StepStatus.SKIPPED,
      progressPercentage: this._progress.progressPercentage,
      message: `Step '${stepProgress.name}' skipped${reason ? `: ${reason}` : ''}`,
    });
  }

  /**
   * Retry step tracking
   */
  retryStep(stepId: string): void {
    const step = this._progress.steps.get(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found`);
    }

    step.retryCount++;
    step.status = StepStatus.RUNNING;
    step.startedAt = new Date();
    step.completedAt = undefined;
    step.duration = undefined;
    step.error = undefined;

    this._progress.runningSteps++;

    // Adjust failed count if retrying a failed step
    if (this._progress.failedSteps > 0) {
      this._progress.failedSteps--;
    }

    this._progress.currentStep = stepId;

    this.recordUpdate({
      type: 'step:retry',
      instanceId: this.instanceId,
      timestamp: new Date(),
      stepId,
      previousStatus: StepStatus.FAILED,
      currentStatus: StepStatus.RUNNING,
      progressPercentage: this._progress.progressPercentage,
      message: `Step '${step.name}' retry #${step.retryCount}`,
      metadata: { retryCount: step.retryCount },
    });
  }

  // ==========================================================================
  // Progress Queries
  // ==========================================================================

  /**
   * Get current progress
   */
  getProgress(): WorkflowProgress {
    return { ...this._progress };
  }

  /**
   * Get step progress
   */
  getStepProgress(stepId: string): StepProgress | undefined {
    const step = this._progress.steps.get(stepId);
    return step ? { ...step } : undefined;
  }

  /**
   * Get time estimation
   */
  getEstimation(): TimeEstimation | undefined {
    if (
      this._progress.estimatedTimeRemaining === undefined ||
      this._progress.estimatedCompletionTime === undefined
    ) {
      return undefined;
    }

    return {
      estimatedTimeRemaining: this._progress.estimatedTimeRemaining,
      estimatedCompletionTime: this._progress.estimatedCompletionTime,
      confidence: this.calculateEstimationConfidence(),
      basedOnSteps: this.stepDurations.length,
    };
  }

  // ==========================================================================
  // Reporting
  // ==========================================================================

  /**
   * Generate progress report
   */
  generateReport(options?: Partial<ProgressReportOptions>): ProgressReport {
    const opts: ProgressReportOptions = {
      format: options?.format ?? 'text',
      includeSteps: options?.includeSteps ?? true,
      includeErrors: options?.includeErrors ?? true,
      includeTimings: options?.includeTimings ?? true,
      includeEstimates: options?.includeEstimates ?? true,
      verbose: options?.verbose ?? false,
    };

    let content: string;

    switch (opts.format) {
      case 'json':
        content = this.generateJsonReport(opts);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(opts);
        break;
      case 'html':
        content = this.generateHtmlReport(opts);
        break;
      default:
        content = this.generateTextReport(opts);
    }

    return {
      format: opts.format,
      content,
      generatedAt: new Date(),
      instanceId: this.instanceId,
    };
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to events
   */
  on(
    event: ProgressTrackerEventType,
    handler: (payload: ProgressEventPayload) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(
    event: ProgressTrackerEventType,
    handler: (payload: ProgressEventPayload) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  // ==========================================================================
  // Snapshot
  // ==========================================================================

  /**
   * Create snapshot
   */
  snapshot(): ProgressSnapshot {
    return {
      instanceId: this.instanceId,
      progress: this.serializeProgress(),
      history: [...this._history],
      createdAt: new Date(),
    };
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: ProgressSnapshot): void {
    if (snapshot.instanceId !== this.instanceId) {
      throw new Error(
        `Snapshot instance ID mismatch: expected '${this.instanceId}', got '${snapshot.instanceId}'`
      );
    }

    this._progress = this.deserializeProgress(snapshot.progress);
    this._history = [...snapshot.history];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Update progress percentage
   */
  private updateProgressPercentage(): void {
    if (this._progress.totalSteps === 0) {
      this._progress.progressPercentage = 0;
      return;
    }

    const completed =
      this._progress.completedSteps +
      this._progress.skippedSteps +
      this._progress.failedSteps;

    this._progress.progressPercentage = Math.round(
      (completed / this._progress.totalSteps) * 100
    );

    this.emitEvent(ProgressTrackerEvents.PROGRESS_UPDATED);
  }

  /**
   * Update time estimation
   */
  private updateEstimation(): void {
    if (this.stepDurations.length === 0) {
      return;
    }

    const remainingSteps =
      this._progress.totalSteps -
      this._progress.completedSteps -
      this._progress.skippedSteps -
      this._progress.failedSteps;

    if (remainingSteps <= 0) {
      this._progress.estimatedTimeRemaining = 0;
      this._progress.estimatedCompletionTime = new Date();
      return;
    }

    // Calculate average step duration
    const avgDuration =
      this.stepDurations.reduce((a, b) => a + b, 0) / this.stepDurations.length;

    this._progress.estimatedTimeRemaining = Math.round(avgDuration * remainingSteps);
    this._progress.estimatedCompletionTime = new Date(
      Date.now() + this._progress.estimatedTimeRemaining
    );

    this.emitEvent(ProgressTrackerEvents.ESTIMATION_UPDATED);
  }

  /**
   * Calculate estimation confidence
   */
  private calculateEstimationConfidence(): number {
    // More completed steps = higher confidence
    const sampleConfidence = Math.min(this.stepDurations.length / 5, 1);

    // Lower variance = higher confidence
    if (this.stepDurations.length < 2) {
      return sampleConfidence * 0.5;
    }

    const avg =
      this.stepDurations.reduce((a, b) => a + b, 0) / this.stepDurations.length;
    const variance =
      this.stepDurations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) /
      this.stepDurations.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg; // Coefficient of variation

    const varianceConfidence = Math.max(0, 1 - cv);

    return Math.round((sampleConfidence * 0.4 + varianceConfidence * 0.6) * 100) / 100;
  }

  /**
   * Check and emit milestone events
   */
  private checkMilestones(): void {
    for (const [percentage, name] of this.milestones) {
      if (
        this._progress.progressPercentage >= percentage &&
        !this.isMilestoneReached(percentage)
      ) {
        this.emitEvent(ProgressTrackerEvents.MILESTONE_REACHED, {
          milestone: name,
        });
      }
    }
  }

  /**
   * Check if milestone was already reached
   */
  private isMilestoneReached(percentage: number): boolean {
    return this._history.some(
      (h) =>
        h.type === 'progress:updated' &&
        h.progressPercentage >= percentage &&
        h.metadata?.milestone
    );
  }

  /**
   * Record progress update
   */
  private recordUpdate(update: ProgressUpdate): void {
    if (!this.enableHistory) {
      return;
    }

    this._history.push(update);

    if (this._history.length > this.maxHistorySize) {
      this._history = this._history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Emit event
   */
  private emitEvent(
    event: ProgressTrackerEventType,
    extra?: Partial<ProgressEventPayload>
  ): void {
    const payload: ProgressEventPayload = {
      instanceId: this.instanceId,
      timestamp: new Date(),
      progress: this.getProgress(),
      ...extra,
    };
    this.eventEmitter.emit(event, payload);
  }

  /**
   * Serialize progress for snapshot
   */
  private serializeProgress(): SerializedProgress {
    return {
      instanceId: this._progress.instanceId,
      workflowId: this._progress.workflowId,
      workflowName: this._progress.workflowName,
      status: this._progress.status,
      startedAt: this._progress.startedAt?.toISOString(),
      completedAt: this._progress.completedAt?.toISOString(),
      totalSteps: this._progress.totalSteps,
      completedSteps: this._progress.completedSteps,
      failedSteps: this._progress.failedSteps,
      skippedSteps: this._progress.skippedSteps,
      runningSteps: this._progress.runningSteps,
      pendingSteps: this._progress.pendingSteps,
      progressPercentage: this._progress.progressPercentage,
      estimatedTimeRemaining: this._progress.estimatedTimeRemaining,
      estimatedCompletionTime: this._progress.estimatedCompletionTime?.toISOString(),
      steps: Array.from(this._progress.steps.entries()),
      currentStep: this._progress.currentStep,
      errors: this._progress.errors,
      metadata: this._progress.metadata,
    };
  }

  /**
   * Deserialize progress from snapshot
   */
  private deserializeProgress(serialized: SerializedProgress): WorkflowProgress {
    return {
      instanceId: serialized.instanceId,
      workflowId: serialized.workflowId,
      workflowName: serialized.workflowName,
      status: serialized.status,
      startedAt: serialized.startedAt ? new Date(serialized.startedAt) : undefined,
      completedAt: serialized.completedAt ? new Date(serialized.completedAt) : undefined,
      totalSteps: serialized.totalSteps,
      completedSteps: serialized.completedSteps,
      failedSteps: serialized.failedSteps,
      skippedSteps: serialized.skippedSteps,
      runningSteps: serialized.runningSteps,
      pendingSteps: serialized.pendingSteps,
      progressPercentage: serialized.progressPercentage,
      estimatedTimeRemaining: serialized.estimatedTimeRemaining,
      estimatedCompletionTime: serialized.estimatedCompletionTime
        ? new Date(serialized.estimatedCompletionTime)
        : undefined,
      steps: new Map(serialized.steps),
      currentStep: serialized.currentStep,
      errors: serialized.errors,
      metadata: serialized.metadata,
    };
  }

  // ==========================================================================
  // Report Generators
  // ==========================================================================

  /**
   * Generate text report
   */
  private generateTextReport(opts: ProgressReportOptions): string {
    const lines: string[] = [];
    const p = this._progress;

    lines.push(`=== Workflow Progress Report ===`);
    lines.push(`Workflow: ${p.workflowName} (${p.workflowId})`);
    lines.push(`Instance: ${p.instanceId}`);
    lines.push(`Status: ${p.status}`);
    lines.push(`Progress: ${p.progressPercentage}%`);
    lines.push(``);

    lines.push(`Steps: ${p.completedSteps}/${p.totalSteps} completed`);
    lines.push(`  - Running: ${p.runningSteps}`);
    lines.push(`  - Failed: ${p.failedSteps}`);
    lines.push(`  - Skipped: ${p.skippedSteps}`);
    lines.push(`  - Pending: ${p.pendingSteps}`);

    if (opts.includeTimings && p.startedAt) {
      lines.push(``);
      lines.push(`Started: ${p.startedAt.toISOString()}`);
      if (p.completedAt) {
        lines.push(`Completed: ${p.completedAt.toISOString()}`);
        const duration = p.completedAt.getTime() - p.startedAt.getTime();
        lines.push(`Duration: ${this.formatDuration(duration)}`);
      }
    }

    if (opts.includeEstimates && p.estimatedTimeRemaining !== undefined) {
      lines.push(``);
      lines.push(`Estimated time remaining: ${this.formatDuration(p.estimatedTimeRemaining)}`);
      if (p.estimatedCompletionTime) {
        lines.push(`Estimated completion: ${p.estimatedCompletionTime.toISOString()}`);
      }
    }

    if (opts.includeSteps && p.steps.size > 0) {
      lines.push(``);
      lines.push(`--- Steps ---`);
      for (const [, step] of p.steps) {
        const status = this.getStatusSymbol(step.status);
        lines.push(`${status} ${step.name} (${step.status})`);
        if (opts.verbose && step.duration) {
          lines.push(`   Duration: ${this.formatDuration(step.duration)}`);
        }
        if (opts.verbose && step.retryCount > 0) {
          lines.push(`   Retries: ${step.retryCount}`);
        }
      }
    }

    if (opts.includeErrors && p.errors.length > 0) {
      lines.push(``);
      lines.push(`--- Errors ---`);
      for (const error of p.errors) {
        lines.push(`[${error.timestamp.toISOString()}] ${error.stepId}: ${error.error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(opts: ProgressReportOptions): string {
    const report: Record<string, unknown> = {
      workflow: {
        id: this._progress.workflowId,
        name: this._progress.workflowName,
        instanceId: this._progress.instanceId,
        status: this._progress.status,
      },
      progress: {
        percentage: this._progress.progressPercentage,
        completed: this._progress.completedSteps,
        total: this._progress.totalSteps,
        failed: this._progress.failedSteps,
        skipped: this._progress.skippedSteps,
        running: this._progress.runningSteps,
        pending: this._progress.pendingSteps,
      },
    };

    if (opts.includeTimings) {
      report.timing = {
        startedAt: this._progress.startedAt?.toISOString(),
        completedAt: this._progress.completedAt?.toISOString(),
        duration:
          this._progress.startedAt && this._progress.completedAt
            ? this._progress.completedAt.getTime() - this._progress.startedAt.getTime()
            : undefined,
      };
    }

    if (opts.includeEstimates) {
      report.estimation = {
        timeRemaining: this._progress.estimatedTimeRemaining,
        completionTime: this._progress.estimatedCompletionTime?.toISOString(),
      };
    }

    if (opts.includeSteps) {
      report.steps = Array.from(this._progress.steps.values());
    }

    if (opts.includeErrors) {
      report.errors = this._progress.errors;
    }

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(opts: ProgressReportOptions): string {
    const lines: string[] = [];
    const p = this._progress;

    lines.push(`# Workflow Progress Report`);
    lines.push(``);
    lines.push(`**Workflow:** ${p.workflowName} (\`${p.workflowId}\`)`);
    lines.push(`**Instance:** \`${p.instanceId}\``);
    lines.push(`**Status:** ${this.getStatusEmoji(p.status)} ${p.status}`);
    lines.push(``);

    // Progress bar
    const progressBar = this.generateProgressBar(p.progressPercentage);
    lines.push(`## Progress: ${p.progressPercentage}%`);
    lines.push(``);
    lines.push(progressBar);
    lines.push(``);

    // Step summary
    lines.push(`## Summary`);
    lines.push(``);
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Steps | ${p.totalSteps} |`);
    lines.push(`| Completed | ${p.completedSteps} |`);
    lines.push(`| Running | ${p.runningSteps} |`);
    lines.push(`| Failed | ${p.failedSteps} |`);
    lines.push(`| Skipped | ${p.skippedSteps} |`);
    lines.push(`| Pending | ${p.pendingSteps} |`);
    lines.push(``);

    if (opts.includeTimings && p.startedAt) {
      lines.push(`## Timing`);
      lines.push(``);
      lines.push(`- **Started:** ${p.startedAt.toISOString()}`);
      if (p.completedAt) {
        lines.push(`- **Completed:** ${p.completedAt.toISOString()}`);
        const duration = p.completedAt.getTime() - p.startedAt.getTime();
        lines.push(`- **Duration:** ${this.formatDuration(duration)}`);
      }
      lines.push(``);
    }

    if (opts.includeEstimates && p.estimatedTimeRemaining !== undefined) {
      lines.push(`## Estimation`);
      lines.push(``);
      lines.push(`- **Time Remaining:** ${this.formatDuration(p.estimatedTimeRemaining)}`);
      if (p.estimatedCompletionTime) {
        lines.push(`- **Estimated Completion:** ${p.estimatedCompletionTime.toISOString()}`);
      }
      lines.push(``);
    }

    if (opts.includeSteps && p.steps.size > 0) {
      lines.push(`## Steps`);
      lines.push(``);
      lines.push(`| Step | Status | Duration | Retries |`);
      lines.push(`|------|--------|----------|---------|`);
      for (const [, step] of p.steps) {
        const emoji = this.getStatusEmoji(step.status);
        const duration = step.duration ? this.formatDuration(step.duration) : '-';
        lines.push(`| ${step.name} | ${emoji} ${step.status} | ${duration} | ${step.retryCount} |`);
      }
      lines.push(``);
    }

    if (opts.includeErrors && p.errors.length > 0) {
      lines.push(`## Errors`);
      lines.push(``);
      for (const error of p.errors) {
        lines.push(`- **${error.stepId}** (${error.timestamp.toISOString()}): ${error.error}`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(opts: ProgressReportOptions): string {
    const p = this._progress;
    const statusColor = this.getStatusColor(p.status);

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Workflow Progress Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px; }
    .progress-bar { background: #eee; height: 20px; border-radius: 10px; margin: 20px 0; }
    .progress-fill { background: #4CAF50; height: 100%; border-radius: 10px; transition: width 0.3s; }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .stat { background: #f5f5f5; padding: 15px; border-radius: 5px; min-width: 100px; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .error { background: #ffebee; padding: 10px; margin: 5px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${p.workflowName}</h1>
    <p>Status: ${p.status} | Instance: ${p.instanceId}</p>
  </div>

  <h2>Progress: ${p.progressPercentage}%</h2>
  <div class="progress-bar">
    <div class="progress-fill" style="width: ${p.progressPercentage}%"></div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${p.completedSteps}/${p.totalSteps}</div>
      <div class="stat-label">Completed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${p.runningSteps}</div>
      <div class="stat-label">Running</div>
    </div>
    <div class="stat">
      <div class="stat-value">${p.failedSteps}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${p.skippedSteps}</div>
      <div class="stat-label">Skipped</div>
    </div>
  </div>`;

    if (opts.includeSteps && p.steps.size > 0) {
      html += `
  <h2>Steps</h2>
  <table>
    <tr>
      <th>Step</th>
      <th>Status</th>
      <th>Duration</th>
      <th>Retries</th>
    </tr>`;
      for (const [, step] of p.steps) {
        const duration = step.duration ? this.formatDuration(step.duration) : '-';
        html += `
    <tr>
      <td>${step.name}</td>
      <td>${step.status}</td>
      <td>${duration}</td>
      <td>${step.retryCount}</td>
    </tr>`;
      }
      html += `
  </table>`;
    }

    if (opts.includeErrors && p.errors.length > 0) {
      html += `
  <h2>Errors</h2>`;
      for (const error of p.errors) {
        html += `
  <div class="error">
    <strong>${error.stepId}</strong> - ${error.error}
    <br><small>${error.timestamp.toISOString()}</small>
  </div>`;
      }
    }

    html += `
</body>
</html>`;

    return html;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    if (ms < 3600000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Get status symbol for text report
   */
  private getStatusSymbol(status: StepStatus | WorkflowStatus): string {
    const symbols: Record<string, string> = {
      completed: '[✓]',
      failed: '[✗]',
      running: '[→]',
      pending: '[ ]',
      skipped: '[-]',
      waiting: '[…]',
      cancelled: '[x]',
      timeout: '[!]',
      paused: '[‖]',
    };
    return symbols[status] || '[ ]';
  }

  /**
   * Get status emoji for markdown report
   */
  private getStatusEmoji(status: StepStatus | WorkflowStatus): string {
    const emojis: Record<string, string> = {
      completed: '✅',
      failed: '❌',
      running: '🔄',
      pending: '⏳',
      skipped: '⏭️',
      waiting: '⏸️',
      cancelled: '🚫',
      timeout: '⏰',
      paused: '⏸️',
    };
    return emojis[status] || '❓';
  }

  /**
   * Get status color for HTML report
   */
  private getStatusColor(status: WorkflowStatus): string {
    const colors: Record<WorkflowStatus, string> = {
      [WorkflowStatus.COMPLETED]: '#4CAF50',
      [WorkflowStatus.FAILED]: '#f44336',
      [WorkflowStatus.RUNNING]: '#2196F3',
      [WorkflowStatus.PENDING]: '#9E9E9E',
      [WorkflowStatus.PAUSED]: '#FF9800',
      [WorkflowStatus.CANCELLED]: '#607D8B',
      [WorkflowStatus.TIMEOUT]: '#FF5722',
    };
    return colors[status] || '#9E9E9E';
  }

  /**
   * Generate ASCII progress bar
   */
  private generateProgressBar(percentage: number): string {
    const width = 40;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\``;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a progress tracker for a workflow
 */
export function createProgressTracker(
  instanceId: string,
  workflowId: string,
  workflowName: string,
  totalSteps: number,
  options?: Partial<ProgressTrackerConfig>
): ProgressTracker {
  return new ProgressTracker({
    instanceId,
    workflowId,
    workflowName,
    totalSteps,
    ...options,
  });
}
