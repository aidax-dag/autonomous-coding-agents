/**
 * Task Executor
 *
 * Extracted from orchestrator-runner.ts to isolate task execution logic,
 * including single-task execution, error recovery, validation, and
 * learning lookups.
 *
 * @module core/orchestrator/task-executor
 */

import { EventEmitter } from 'events';
import { CEOOrchestrator } from './ceo-orchestrator';
import { TaskDocument } from '../workspace/task-document';
import { BaseTeamAgent } from './base-team-agent';
import { RunnerStateManager } from './runner-state-manager';
import { ErrorEscalator, EscalationAction } from './error-escalator';
import { HookRegistry } from '../hooks/hook-registry';
import { HookExecutor } from '../hooks/hook-executor';
import { HookEvent, HookAction } from '../interfaces/hook.interface';
import { ServiceRegistry } from '../services/service-registry';
import type { GoalBackwardResult } from '../validation/interfaces/validation.interface';
import type { TaskHandlerResult } from './team-agent';
import type { OTelProvider } from '@/shared/telemetry';
import { RunnerStatus, type WorkflowResult, type TaskValidationResult } from './orchestrator-runner';
import { logger } from '@/shared/logging/logger';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import { CONTEXT_BUDGET_WARNING_PCT } from './constants';

/**
 * Dependencies injected into TaskExecutor by OrchestratorRunner
 */
export interface TaskExecutorDeps {
  orchestrator: CEOOrchestrator;
  hookRegistry: HookRegistry;
  hookExecutor: HookExecutor;
  stateManager: RunnerStateManager;
  errorEscalator: ErrorEscalator;
  emitter: EventEmitter;
  telemetry: OTelProvider | null;
  config: {
    enableValidation: boolean;
    minConfidenceThreshold: number;
    enableLearning: boolean;
    enableErrorRecovery: boolean;
    maxRetries: number;
  };
}

/**
 * TaskExecutor
 *
 * Handles individual task execution, including pre/post hooks,
 * validation, error recovery with retries, and learning lookups.
 */
export class TaskExecutor {
  private readonly deps: TaskExecutorDeps;

  constructor(deps: TaskExecutorDeps) {
    this.deps = deps;
  }

  /**
   * Execute a single task through the hook pipeline with validation and error recovery.
   */
  async executeTask(task: TaskDocument): Promise<WorkflowResult> {
    const context = this.createExecutionContext(task);
    this.checkContextBudget(context.taskId);
    this.deps.emitter.emit('workflow:started', context.taskId);
    try {
      return await this.executeTaskCore(task, context);
    } catch (error) {
      return this.handleExecutionFailure(task, error, context.startTime, context.taskId, context.taskSpan);
    }
  }

  /**
   * Post-execution task-level validation using ConfidenceChecker.
   * Runs after agent returns a result but before TASK_AFTER hooks.
   * Validation failures never break task execution (wrapped in try/catch).
   */
  async validateTaskResult(
    task: TaskDocument,
    _workflowResult: WorkflowResult,
  ): Promise<TaskValidationResult | null> {
    try {
      const registry = ServiceRegistry.getInstance();
      const checker = registry.getConfidenceChecker();
      if (!checker) return null;

      const checkResult = await checker.check({
        taskId: task.metadata.id,
        taskType: task.metadata.type,
        description: task.content,
        files: task.metadata.files?.map((f) => f.path),
        dependencies: task.metadata.dependencies?.map((d) => d.taskId),
      });

      const threshold = this.deps.config.minConfidenceThreshold;
      if (checkResult.score < threshold) {
        logger.warn('Low confidence task result', {
          task: task.metadata.id,
          confidence: checkResult.score,
          threshold,
          recommendation: checkResult.recommendation,
        });
        this.deps.emitter.emit('validation:low-confidence', {
          taskId: task.metadata.id,
          confidence: checkResult.score,
          recommendation: checkResult.recommendation,
        });
      }

      const failedChecks = checkResult.items
        .filter((item) => !item.passed)
        .map((item) => item.name);

      return {
        confidence: checkResult.score,
        passed: checkResult.passed,
        recommendation: checkResult.recommendation,
        failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
      };
    } catch (err) {
      logger.debug('Task validation check failed', { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Verify a goal using the GoalBackwardVerifier.
   */
  async verifyGoal(
    goalDescription: string,
    tasks: TaskDocument[],
  ): Promise<GoalBackwardResult | undefined> {
    const registry = ServiceRegistry.getInstance();
    const verifier = registry.getGoalBackwardVerifier();
    if (!verifier) return undefined;

    const expectedPaths: string[] = [];
    for (const task of tasks) {
      if (task.metadata.files) {
        for (const file of task.metadata.files) {
          if (file.path && !expectedPaths.includes(file.path)) {
            expectedPaths.push(file.path);
          }
        }
      }
    }

    if (expectedPaths.length === 0) return undefined;

    return verifier.verify({
      description: goalDescription,
      expectedPaths,
    });
  }

  /**
   * Check context budget before executing a task.
   * Emits context:budget-warning when utilization exceeds 95%.
   */
  checkContextBudget(taskId: string): void {
    try {
      const registry = ServiceRegistry.getInstance();
      const contextManager = registry.getContextManager();
      if (!contextManager) return;

      const stats = contextManager.getUsageStats();
      if (stats.usagePercent > CONTEXT_BUDGET_WARNING_PCT) {
        logger.warn('Context budget nearly exhausted', { utilization: stats.usagePercent });
        this.deps.emitter.emit('context:budget-warning', { taskId, utilization: stats.usagePercent });
      }
    } catch (err) {
      logger.debug('Budget check failed', { error: (err as Error).message });
    }
  }

  /**
   * Track token usage from a task result in the ContextManager.
   */
  trackContextTokens(taskId: string, result: TaskHandlerResult): void {
    try {
      const registry = ServiceRegistry.getInstance();
      const contextManager = registry.getContextManager();
      if (!contextManager) return;

      const tokensUsed = (result as unknown as Record<string, unknown>).tokensUsed as number
        || ((result as unknown as Record<string, unknown>).metrics as Record<string, unknown>)?.totalTokens as number
        || 0;
      if (tokensUsed > 0) {
        contextManager.addTokens(tokensUsed);
        logger.debug('Token usage tracked', { taskId, tokensUsed });
      }
    } catch (err) {
      logger.debug('Token tracking failed', { error: (err as Error).message });
    }
  }

  /**
   * Handle a task error with retry logic via the ErrorEscalator.
   *
   * Returns a WorkflowResult when the error was fully handled (retry succeeded,
   * FAIL_TASK, or STOP_RUNNER). Returns null to fall through to the existing
   * catch-block behaviour (e.g. when the ErrorEscalator is unavailable).
   */
  async handleTaskError(
    task: TaskDocument,
    originalError: Error,
    startTime: number,
  ): Promise<WorkflowResult | null> {
    const taskId = task.metadata.id;

    try {
      const { classification, action } = this.classifyError(originalError, taskId);

      await this.runTaskErrorHooks(task, originalError, classification, taskId);
      const recoveryResult = await this.attemptRecovery(task, originalError, startTime, action);
      if (recoveryResult) {
        return recoveryResult;
      }

      return this.escalateError(task, originalError, startTime, action);
    } catch (recoveryErr) {
      // Graceful degradation: if error recovery itself fails, fall through
      logger.debug('Error recovery pipeline failed', { error: (recoveryErr as Error).message });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers extracted from executeTask
  // ---------------------------------------------------------------------------

  private createExecutionContext(task: TaskDocument): {
    startTime: number;
    taskId: string;
    taskSpan: ReturnType<ReturnType<OTelProvider['getTraceManager']>['startSpan']> | undefined;
  } {
    const taskId = task.metadata.id;
    const taskSpan = this.deps.telemetry?.getTraceManager().startSpan('executeTask');
    if (taskSpan) {
      taskSpan.attributes['task.id'] = taskId;
      taskSpan.attributes['task.team'] = task.metadata.to;
      taskSpan.attributes['task.type'] = task.metadata.type;
    }

    return {
      startTime: Date.now(),
      taskId,
      taskSpan,
    };
  }

  private async executeTaskCore(
    task: TaskDocument,
    context: {
      startTime: number;
      taskId: string;
      taskSpan: ReturnType<ReturnType<OTelProvider['getTraceManager']>['startSpan']> | undefined;
    },
  ): Promise<WorkflowResult> {
    const abortResult = await this.runPreHooks(task, context.startTime);
    if (abortResult) {
      return abortResult;
    }

    const result = await this.executeTaskOnTeam(task);
    const workflowResult = this.createWorkflowResult(
      context.taskId, result.success, task.metadata.to, context.startTime,
      { result: result.result, error: result.error },
    );

    await this.runPostValidation(task, workflowResult, result);
    await this.runPostHooks(task, result, context.taskId);
    this.trackContextTokens(context.taskId, result);
    this.handleExecutionSuccess(context.taskId, workflowResult, context.taskSpan);
    return workflowResult;
  }

  /**
   * Execute TASK_BEFORE hooks and return an abort WorkflowResult if any hook
   * signals ABORT, or null to continue execution.
   */
  private async runPreHooks(
    task: TaskDocument,
    startTime: number,
  ): Promise<WorkflowResult | null> {
    if (this.deps.hookRegistry.count() === 0) {
      return null;
    }

    const beforeResults = await this.deps.hookExecutor.executeHooks(
      HookEvent.TASK_BEFORE, task, { stopOnAction: [HookAction.ABORT] }
    ).catch((e: unknown) => {
      logger.warn('TASK_BEFORE hook failed', { taskId: task.metadata.id, error: e instanceof Error ? e.message : String(e) });
      return [];
    });

    const aborted = beforeResults.find(r => r.action === HookAction.ABORT);
    if (aborted) {
      const workflowResult = this.createWorkflowResult(
        task.metadata.id, false, task.metadata.to, startTime,
        { error: `Blocked by validation: ${aborted.message}` },
      );
      this.deps.stateManager.recordResult(task.metadata.id, workflowResult);
      this.deps.emitter.emit('workflow:completed', workflowResult);
      return workflowResult;
    }

    return null;
  }

  /**
   * Look up the team for the task and execute the task via the team agent.
   * Throws AgentError if the team is not registered.
   */
  private async executeTaskOnTeam(task: TaskDocument): Promise<TaskHandlerResult> {
    const team = this.deps.orchestrator.teams.get(task.metadata.to);
    if (!team) {
      throw new AgentError(
        `No team registered for type: ${task.metadata.to}`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { teamType: task.metadata.to, taskId: task.metadata.id },
      );
    }

    const baseAgent = team as BaseTeamAgent;
    return baseAgent.processTask(task);
  }

  /**
   * Run post-execution validation if enabled and the task succeeded.
   * Attaches validation metadata to the workflow result.
   */
  private async runPostValidation(
    task: TaskDocument,
    workflowResult: WorkflowResult,
    result: TaskHandlerResult,
  ): Promise<void> {
    if (this.deps.config.enableValidation && result.success) {
      const validationResult = await this.validateTaskResult(task, workflowResult);
      if (validationResult) {
        workflowResult.validation = validationResult;
      }
    }
  }

  /**
   * Execute TASK_AFTER hooks. Failures are logged but do not break execution.
   */
  private async runPostHooks(
    task: TaskDocument,
    result: TaskHandlerResult,
    taskId: string,
  ): Promise<void> {
    if (this.deps.hookRegistry.count() > 0) {
      await this.deps.hookExecutor.executeHooks(
        HookEvent.TASK_AFTER, { task, result }
      ).catch((e: unknown) => {
        logger.warn('TASK_AFTER hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
      });
    }
  }

  /**
   * Finalize a successful task execution: record result, record success, emit events, end span.
   */
  private handleExecutionSuccess(
    taskId: string,
    workflowResult: WorkflowResult,
    taskSpan: ReturnType<ReturnType<OTelProvider['getTraceManager']>['startSpan']> | undefined,
  ): void {
    if (taskSpan) this.deps.telemetry!.getTraceManager().endSpan(taskSpan, workflowResult.success ? 'ok' : 'error');
    this.deps.stateManager.recordResult(taskId, workflowResult);
    this.deps.errorEscalator.recordSuccess(taskId);
    this.deps.emitter.emit('workflow:completed', workflowResult);
  }

  /**
   * Handle the catch block of executeTask: attempt error recovery, escalate,
   * run error hooks, and return an appropriate failure WorkflowResult.
   */
  private async handleExecutionFailure(
    task: TaskDocument,
    error: unknown,
    startTime: number,
    taskId: string,
    taskSpan: ReturnType<ReturnType<OTelProvider['getTraceManager']>['startSpan']> | undefined,
  ): Promise<WorkflowResult> {
    const err = error instanceof Error ? error : new Error(String(error));

    // Error recovery pipeline: attempt retry when enabled
    if (this.deps.config.enableErrorRecovery) {
      const recoveryResult = await this.handleTaskError(task, err, startTime);
      if (recoveryResult) {
        if (taskSpan) this.deps.telemetry!.getTraceManager().endSpan(taskSpan, recoveryResult.success ? 'ok' : 'error');
        return recoveryResult;
      }
    }

    const classification = this.deps.errorEscalator.classify(err, 'executeTask');
    const action = this.deps.errorEscalator.handleError(err, 'executeTask', taskId);

    await this.runTaskErrorHooks(task, err, classification, taskId);

    // Learning: look up cached solution for this error
    if (this.deps.config.enableLearning) {
      this.lookupLearningSolution(taskId, err);
    }

    if (action === EscalationAction.STOP_RUNNER) {
      this.deps.stateManager.setStatus(RunnerStatus.ERROR);
      this.deps.emitter.emit('error', err);
    }

    const workflowResult = this.createWorkflowResult(
      taskId, false, task.metadata.to, startTime,
      { error: err.message },
    );

    if (taskSpan) this.deps.telemetry!.getTraceManager().endSpan(taskSpan, 'error');
    this.deps.stateManager.recordResult(taskId, workflowResult);
    this.deps.emitter.emit('workflow:failed', taskId, err);

    return workflowResult;
  }

  // ---------------------------------------------------------------------------
  // Private helpers extracted from handleTaskError
  // ---------------------------------------------------------------------------

  private classifyError(
    error: Error,
    taskId: string,
  ): { classification: unknown; action: EscalationAction } {
    const classification = this.deps.errorEscalator.classify(error, 'executeTask');
    const action = this.deps.errorEscalator.handleError(error, 'executeTask', taskId);
    return { classification, action };
  }

  private attemptRecovery(
    task: TaskDocument,
    originalError: Error,
    startTime: number,
    action: EscalationAction,
  ): Promise<WorkflowResult | null> {
    if (action === EscalationAction.RETRY) {
      return this.retryTask(task, startTime, originalError);
    }

    return Promise.resolve(null);
  }

  private escalateError(
    task: TaskDocument,
    originalError: Error,
    startTime: number,
    action: EscalationAction,
  ): Promise<WorkflowResult | null> {
    const taskId = task.metadata.id;
    if (action === EscalationAction.FAIL_TASK) {
      return Promise.resolve(
        this.createFailureResult(taskId, originalError, startTime, task.metadata.to, EscalationAction.FAIL_TASK),
      );
    }

    if (action === EscalationAction.STOP_RUNNER) {
      return Promise.resolve(this.handleStopRunner(taskId, originalError, startTime, task.metadata.to));
    }

    return Promise.resolve(null);
  }

  /**
   * Execute TASK_ERROR hooks. Failures are logged but do not propagate.
   */
  private async runTaskErrorHooks(
    task: TaskDocument,
    error: Error,
    classification: unknown,
    taskId: string,
  ): Promise<void> {
    if (this.deps.hookRegistry.count() > 0) {
      await this.deps.hookExecutor.executeHooks(
        HookEvent.TASK_ERROR, { task, error, classification }
      ).catch((e: unknown) => {
        logger.warn('TASK_ERROR hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
      });
    }
  }

  /**
   * Retry a task up to maxRetries times. Returns the WorkflowResult from
   * either a successful retry or from exhausting all retries.
   */
  private async retryTask(
    task: TaskDocument,
    startTime: number,
    originalError: Error,
  ): Promise<WorkflowResult> {
    const taskId = task.metadata.id;
    const maxRetries = this.deps.config.maxRetries;
    let lastError: Error = originalError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.deps.emitter.emit('error:retry', { taskId, attempt, maxRetries, error: lastError });
      logger.info('Retrying task', { taskId, attempt, maxRetries });

      try {
        const result = await this.executeTaskOnTeam(task);

        const workflowResult = this.createWorkflowResult(
          taskId, result.success, task.metadata.to, startTime,
          { result: result.result, error: result.error },
        );

        // Successful retry: record success, learn from recovery, emit event
        this.deps.errorEscalator.recordSuccess(taskId);
        this.deps.stateManager.recordResult(taskId, workflowResult);

        await this.learnFromRecovery(originalError, attempt);

        this.deps.emitter.emit('error:recovered', { taskId, attempt, error: originalError });
        this.deps.emitter.emit('workflow:completed', workflowResult);
        return workflowResult;
      } catch (retryError) {
        lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
        logger.warn('Retry attempt failed', { taskId, attempt, error: lastError.message });
      }
    }

    // All retries exhausted -- fall through to FAIL_TASK behaviour
    return this.createFailureResult(taskId, lastError, startTime, task.metadata.to, EscalationAction.FAIL_TASK);
  }

  /**
   * Record a learning entry when a retry succeeds, so the system can
   * recognise and resolve similar transient errors in the future.
   */
  private async learnFromRecovery(originalError: Error, attempt: number): Promise<void> {
    if (!this.deps.config.enableLearning) {
      return;
    }

    try {
      const registry = ServiceRegistry.getInstance();
      const reflexion = registry.getReflexionPattern();
      if (reflexion) {
        await reflexion.learn(
          originalError,
          `Retry succeeded on attempt ${attempt}`,
          `Transient error resolved by retry`,
        );
      }
    } catch (learningErr) {
      logger.debug('Recovery learning failed', { error: (learningErr as Error).message });
    }
  }

  /**
   * Build a failure WorkflowResult, record it, emit appropriate events, and return it.
   * Consolidates the repeated pattern used by FAIL_TASK and retry-exhausted paths.
   */
  private createFailureResult(
    taskId: string,
    error: Error,
    startTime: number,
    teamType: WorkflowResult['teamType'],
    action: EscalationAction,
  ): WorkflowResult {
    this.deps.emitter.emit('error:escalated', { taskId, action, error });

    const workflowResult = this.createWorkflowResult(
      taskId, false, teamType, startTime,
      { error: error.message },
    );
    this.deps.stateManager.recordResult(taskId, workflowResult);
    this.deps.emitter.emit('workflow:failed', taskId, error);
    return workflowResult;
  }

  /**
   * Handle STOP_RUNNER escalation: set runner status to error, emit error,
   * then delegate to createFailureResult for the common failure path.
   */
  private handleStopRunner(
    taskId: string,
    error: Error,
    startTime: number,
    teamType: WorkflowResult['teamType'],
  ): WorkflowResult {
    this.deps.stateManager.setStatus(RunnerStatus.ERROR);
    this.deps.emitter.emit('error', error);
    return this.createFailureResult(taskId, error, startTime, teamType, EscalationAction.STOP_RUNNER);
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a WorkflowResult object. Centralises the construction that was
   * previously duplicated across multiple code paths.
   */
  private createWorkflowResult(
    taskId: string,
    success: boolean,
    teamType: WorkflowResult['teamType'],
    startTime: number,
    extras?: { result?: unknown; error?: string },
  ): WorkflowResult {
    return {
      success,
      taskId,
      result: extras?.result,
      error: extras?.error,
      duration: Date.now() - startTime,
      teamType,
    };
  }

  /**
   * Look up a cached solution for an error from the learning system.
   */
  private lookupLearningSolution(taskId: string, err: Error): void {
    try {
      const registry = ServiceRegistry.getInstance();
      const reflexion = registry.getReflexionPattern();
      if (reflexion) {
        reflexion.lookup(err).then((cachedSolution) => {
          if (cachedSolution) {
            logger.info('Found cached solution for error', {
              taskId,
              solution: cachedSolution.solution?.substring(0, 100),
            });
            this.deps.emitter.emit('learning:solution-found', { taskId, solution: cachedSolution });
          }
        }).catch((lookupErr: Error) => {
          logger.debug('Learning lookup failed', { error: lookupErr.message });
        });
      }
    } catch (learningErr) {
      logger.debug('Learning lookup failed', { error: (learningErr as Error).message });
    }
  }
}
