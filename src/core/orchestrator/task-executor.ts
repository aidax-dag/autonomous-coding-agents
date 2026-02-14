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
    const startTime = Date.now();
    const taskId = task.metadata.id;
    const taskSpan = this.deps.telemetry?.getTraceManager().startSpan('executeTask');
    if (taskSpan) {
      taskSpan.attributes['task.id'] = taskId;
      taskSpan.attributes['task.team'] = task.metadata.to;
      taskSpan.attributes['task.type'] = task.metadata.type;
    }

    // Pre-task context budget check
    this.checkContextBudget(taskId);

    this.deps.emitter.emit('workflow:started', taskId);

    try {
      // TASK_BEFORE Hooks
      if (this.deps.hookRegistry.count() > 0) {
        const beforeResults = await this.deps.hookExecutor.executeHooks(
          HookEvent.TASK_BEFORE, task, { stopOnAction: [HookAction.ABORT] }
        ).catch((e: unknown) => {
          logger.warn('TASK_BEFORE hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
          return [];
        });

        const aborted = beforeResults.find(r => r.action === HookAction.ABORT);
        if (aborted) {
          const workflowResult: WorkflowResult = {
            success: false,
            taskId,
            error: `Blocked by validation: ${aborted.message}`,
            duration: Date.now() - startTime,
            teamType: task.metadata.to,
          };
          this.deps.stateManager.recordResult(taskId, workflowResult);
          this.deps.emitter.emit('workflow:completed', workflowResult);
          return workflowResult;
        }
      }

      const team = this.deps.orchestrator.teams.get(task.metadata.to);
      if (!team) {
        throw new AgentError(
          `No team registered for type: ${task.metadata.to}`,
          ErrorCode.AGENT_STATE_ERROR,
          false,
          { teamType: task.metadata.to, taskId },
        );
      }

      const baseAgent = team as BaseTeamAgent;
      const result: TaskHandlerResult = await baseAgent.processTask(task);

      const workflowResult: WorkflowResult = {
        success: result.success,
        taskId,
        result: result.result,
        error: result.error,
        duration: Date.now() - startTime,
        teamType: task.metadata.to,
      };

      // Post-execution task-level validation (G-2: Validation-Agent pipeline)
      if (this.deps.config.enableValidation && result.success) {
        const validationResult = await this.validateTaskResult(task, workflowResult);
        if (validationResult) {
          workflowResult.validation = validationResult;
        }
      }

      // TASK_AFTER Hooks
      if (this.deps.hookRegistry.count() > 0) {
        await this.deps.hookExecutor.executeHooks(
          HookEvent.TASK_AFTER, { task, result }
        ).catch((e: unknown) => {
          logger.warn('TASK_AFTER hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      // Track token usage from task result
      this.trackContextTokens(taskId, result);

      if (taskSpan) this.deps.telemetry!.getTraceManager().endSpan(taskSpan, workflowResult.success ? 'ok' : 'error');
      this.deps.stateManager.recordResult(taskId, workflowResult);
      this.deps.errorEscalator.recordSuccess(taskId);
      this.deps.emitter.emit('workflow:completed', workflowResult);

      return workflowResult;
    } catch (error) {
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

      // TASK_ERROR Hooks (pass classification for learning system)
      if (this.deps.hookRegistry.count() > 0) {
        await this.deps.hookExecutor.executeHooks(
          HookEvent.TASK_ERROR, { task, error: err, classification }
        ).catch((e: unknown) => {
          logger.warn('TASK_ERROR hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      // Learning: look up cached solution for this error
      if (this.deps.config.enableLearning) {
        this.lookupLearningSolution(taskId, err);
      }

      if (action === EscalationAction.STOP_RUNNER) {
        this.deps.stateManager.setStatus(RunnerStatus.ERROR);
        this.deps.emitter.emit('error', err);
      }

      const workflowResult: WorkflowResult = {
        success: false,
        taskId,
        error: err.message,
        duration: Date.now() - startTime,
        teamType: task.metadata.to,
      };

      if (taskSpan) this.deps.telemetry!.getTraceManager().endSpan(taskSpan, 'error');
      this.deps.stateManager.recordResult(taskId, workflowResult);
      this.deps.emitter.emit('workflow:failed', taskId, err);

      return workflowResult;
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
      if (stats.usagePercent > 95) {
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
      const classification = this.deps.errorEscalator.classify(originalError, 'executeTask');
      const action = this.deps.errorEscalator.handleError(originalError, 'executeTask', taskId);

      // TASK_ERROR Hooks (pass classification for learning system)
      if (this.deps.hookRegistry.count() > 0) {
        await this.deps.hookExecutor.executeHooks(
          HookEvent.TASK_ERROR, { task, error: originalError, classification }
        ).catch((e: unknown) => {
          logger.warn('TASK_ERROR hook failed', { taskId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      if (action === EscalationAction.RETRY) {
        const maxRetries = this.deps.config.maxRetries;
        let lastError: Error = originalError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          this.deps.emitter.emit('error:retry', { taskId, attempt, maxRetries, error: lastError });
          logger.info('Retrying task', { taskId, attempt, maxRetries });

          try {
            const team = this.deps.orchestrator.teams.get(task.metadata.to);
            if (!team) {
              throw new AgentError(
                `No team registered for type: ${task.metadata.to}`,
                ErrorCode.AGENT_STATE_ERROR,
                false,
                { teamType: task.metadata.to, taskId },
              );
            }

            const baseAgent = team as BaseTeamAgent;
            const result: TaskHandlerResult = await baseAgent.processTask(task);

            const workflowResult: WorkflowResult = {
              success: result.success,
              taskId,
              result: result.result,
              error: result.error,
              duration: Date.now() - startTime,
              teamType: task.metadata.to,
            };

            // Successful retry: record success, learn from recovery, emit event
            this.deps.errorEscalator.recordSuccess(taskId);
            this.deps.stateManager.recordResult(taskId, workflowResult);

            // Learn from the successful recovery
            if (this.deps.config.enableLearning) {
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

            this.deps.emitter.emit('error:recovered', { taskId, attempt, error: originalError });
            this.deps.emitter.emit('workflow:completed', workflowResult);
            return workflowResult;
          } catch (retryError) {
            lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
            logger.warn('Retry attempt failed', { taskId, attempt, error: lastError.message });
          }
        }

        // All retries exhausted -- fall through to FAIL_TASK behaviour
        this.deps.emitter.emit('error:escalated', { taskId, action: EscalationAction.FAIL_TASK, error: lastError });

        const workflowResult: WorkflowResult = {
          success: false,
          taskId,
          error: lastError.message,
          duration: Date.now() - startTime,
          teamType: task.metadata.to,
        };
        this.deps.stateManager.recordResult(taskId, workflowResult);
        this.deps.emitter.emit('workflow:failed', taskId, lastError);
        return workflowResult;
      }

      if (action === EscalationAction.FAIL_TASK) {
        this.deps.emitter.emit('error:escalated', { taskId, action: EscalationAction.FAIL_TASK, error: originalError });

        const workflowResult: WorkflowResult = {
          success: false,
          taskId,
          error: originalError.message,
          duration: Date.now() - startTime,
          teamType: task.metadata.to,
        };
        this.deps.stateManager.recordResult(taskId, workflowResult);
        this.deps.emitter.emit('workflow:failed', taskId, originalError);
        return workflowResult;
      }

      if (action === EscalationAction.STOP_RUNNER) {
        this.deps.emitter.emit('error:escalated', { taskId, action: EscalationAction.STOP_RUNNER, error: originalError });
        this.deps.stateManager.setStatus(RunnerStatus.ERROR);
        this.deps.emitter.emit('error', originalError);

        const workflowResult: WorkflowResult = {
          success: false,
          taskId,
          error: originalError.message,
          duration: Date.now() - startTime,
          teamType: task.metadata.to,
        };
        this.deps.stateManager.recordResult(taskId, workflowResult);
        this.deps.emitter.emit('workflow:failed', taskId, originalError);
        return workflowResult;
      }

      // For other actions (IGNORE, LOG), fall through to existing behaviour
      return null;
    } catch (recoveryErr) {
      // Graceful degradation: if error recovery itself fails, fall through
      logger.debug('Error recovery pipeline failed', { error: (recoveryErr as Error).message });
      return null;
    }
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
