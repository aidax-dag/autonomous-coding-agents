/**
 * Error Escalator
 *
 * Extracted from OrchestratorRunner — centralizes error classification,
 * escalation decisions, and error-handling policies.
 *
 * @module core/orchestrator
 */

import { createLogger, ILogger } from '../services/logger.js';

// ============================================================================
// Types
// ============================================================================

/** Error severity levels */
export enum ErrorSeverity {
  /** Non-blocking — log and continue */
  LOW = 'low',
  /** Degraded — operation continues with reduced functionality */
  MEDIUM = 'medium',
  /** Blocking — operation fails, runner continues */
  HIGH = 'high',
  /** Fatal — runner should stop */
  CRITICAL = 'critical',
}

/** Escalation action to take */
export enum EscalationAction {
  /** Ignore the error and continue */
  IGNORE = 'ignore',
  /** Log and continue */
  LOG = 'log',
  /** Retry the operation */
  RETRY = 'retry',
  /** Fail the current task but continue the runner */
  FAIL_TASK = 'fail_task',
  /** Stop the entire runner */
  STOP_RUNNER = 'stop_runner',
}

/** Classification of an error */
export interface ErrorClassification {
  severity: ErrorSeverity;
  action: EscalationAction;
  category: string;
  retryable: boolean;
  maxRetries: number;
}

/** Error event emitted by the escalator */
export interface ErrorEvent {
  timestamp: Date;
  error: Error;
  classification: ErrorClassification;
  context: string;
  retryCount: number;
}

/** Error escalator configuration */
export interface ErrorEscalatorConfig {
  /** Maximum retries per task (default: 2) */
  maxTaskRetries: number;
  /** Maximum consecutive runner errors before stopping (default: 5) */
  maxConsecutiveErrors: number;
  /** Custom error classifiers */
  classifiers?: ErrorClassifier[];
}

/** Custom error classifier function */
export type ErrorClassifier = (error: Error, context: string) => ErrorClassification | null;

// ============================================================================
// ErrorEscalator
// ============================================================================

const DEFAULT_CONFIG: ErrorEscalatorConfig = {
  maxTaskRetries: 2,
  maxConsecutiveErrors: 5,
};

export class ErrorEscalator {
  private readonly config: ErrorEscalatorConfig;
  private readonly logger: ILogger;
  private readonly retryCounts = new Map<string, number>();
  private consecutiveErrors = 0;
  private readonly history: ErrorEvent[] = [];

  constructor(config?: Partial<ErrorEscalatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger('ErrorEscalator');
  }

  /**
   * Classify an error and determine the escalation action.
   */
  classify(error: Error, context: string): ErrorClassification {
    // Try custom classifiers first
    if (this.config.classifiers) {
      for (const classifier of this.config.classifiers) {
        const result = classifier(error, context);
        if (result) return result;
      }
    }

    // Built-in classification
    return this.defaultClassify(error, context);
  }

  /**
   * Handle an error: classify, record, and return the action to take.
   */
  handleError(error: Error, context: string, taskId?: string): EscalationAction {
    const classification = this.classify(error, context);
    const retryCount = taskId ? (this.retryCounts.get(taskId) || 0) : 0;

    // Record history
    this.history.push({
      timestamp: new Date(),
      error,
      classification,
      context,
      retryCount,
    });

    // Log based on severity
    switch (classification.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL [${context}]: ${error.message}`);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`[${context}]: ${error.message}`);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`[${context}]: ${error.message}`);
        break;
      case ErrorSeverity.LOW:
        this.logger.debug(`[${context}]: ${error.message}`);
        break;
    }

    // Track consecutive errors
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.logger.error(`Max consecutive errors reached (${this.consecutiveErrors})`);
      return EscalationAction.STOP_RUNNER;
    }

    // Check if retryable
    if (classification.retryable && taskId) {
      if (retryCount < classification.maxRetries) {
        this.retryCounts.set(taskId, retryCount + 1);
        return EscalationAction.RETRY;
      }
    }

    return classification.action;
  }

  /**
   * Record a successful operation (resets consecutive error count).
   */
  recordSuccess(taskId?: string): void {
    this.consecutiveErrors = 0;
    if (taskId) {
      this.retryCounts.delete(taskId);
    }
  }

  /**
   * Get error history.
   */
  getHistory(): ErrorEvent[] {
    return [...this.history];
  }

  /**
   * Get retry count for a task.
   */
  getRetryCount(taskId: string): number {
    return this.retryCounts.get(taskId) || 0;
  }

  /**
   * Get consecutive error count.
   */
  getConsecutiveErrorCount(): number {
    return this.consecutiveErrors;
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.retryCounts.clear();
    this.consecutiveErrors = 0;
    this.history.length = 0;
  }

  // =========================================================================
  // Private
  // =========================================================================

  private defaultClassify(error: Error, context: string): ErrorClassification {
    const message = error.message.toLowerCase();

    // Critical: system-level failures
    if (message.includes('enospc') || message.includes('out of memory') || message.includes('heap')) {
      return {
        severity: ErrorSeverity.CRITICAL,
        action: EscalationAction.STOP_RUNNER,
        category: 'system',
        retryable: false,
        maxRetries: 0,
      };
    }

    // High: team/agent not found
    if (message.includes('no team registered') || message.includes('not running')) {
      return {
        severity: ErrorSeverity.HIGH,
        action: EscalationAction.FAIL_TASK,
        category: 'routing',
        retryable: false,
        maxRetries: 0,
      };
    }

    // Medium: LLM/network transient errors
    if (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('503') ||
      message.includes('429') ||
      message.includes('econnreset')
    ) {
      return {
        severity: ErrorSeverity.MEDIUM,
        action: EscalationAction.RETRY,
        category: 'transient',
        retryable: true,
        maxRetries: this.config.maxTaskRetries,
      };
    }

    // Medium: validation/hook errors (non-blocking)
    if (context.includes('hook') || context.includes('validation')) {
      return {
        severity: ErrorSeverity.LOW,
        action: EscalationAction.LOG,
        category: 'validation',
        retryable: false,
        maxRetries: 0,
      };
    }

    // Default: task failure
    return {
      severity: ErrorSeverity.MEDIUM,
      action: EscalationAction.FAIL_TASK,
      category: 'task',
      retryable: true,
      maxRetries: this.config.maxTaskRetries,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createErrorEscalator(config?: Partial<ErrorEscalatorConfig>): ErrorEscalator {
  return new ErrorEscalator(config);
}
