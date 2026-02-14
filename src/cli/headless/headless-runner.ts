/**
 * Headless Runner
 *
 * API-only execution engine for CI/CD pipelines. Wraps OrchestratorRunner
 * with timeout handling, structured error collection, and machine-readable
 * output suitable for automated environments.
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '@/shared/logging/logger';
import { CIDetector } from './ci-detector';
import type {
  HeadlessConfig,
  HeadlessResult,
  HeadlessOutput,
  HeadlessError,
  HeadlessMetrics,
  HeadlessTaskResult,
  CIEnvironment,
} from './types';

const logger = createAgentLogger('Headless', 'headless-runner');

/** Minimal interface for an injectable runner (e.g. OrchestratorRunner) */
interface RunnableRunner {
  start(): Promise<void>;
  executeGoal(goal: string): Promise<unknown>;
}

export interface HeadlessRunnerOptions {
  config: HeadlessConfig;
  runner?: RunnableRunner | null; // OrchestratorRunner — optional for dependency injection
}

export class HeadlessRunner extends EventEmitter {
  private config: HeadlessConfig;
  private runner: RunnableRunner | null;
  private ciDetector: CIDetector;
  private errors: HeadlessError[] = [];
  private tasks: HeadlessTaskResult[] = [];
  private startTime: number = 0;
  private disposed = false;

  constructor(options: HeadlessRunnerOptions) {
    super();
    this.config = options.config;
    this.runner = options.runner || null;
    this.ciDetector = new CIDetector();
  }

  /**
   * Execute the configured goal and return a structured result.
   * Handles timeout enforcement and error aggregation.
   */
  async execute(): Promise<HeadlessResult> {
    this.startTime = Date.now();
    const startedAt = new Date().toISOString();

    logger.info('Headless execution started', { goal: this.config.goal });
    this.emit('started', { goal: this.config.goal });

    try {
      // Detect CI environment for logging context
      const ciEnv = this.ciDetector.detect();
      if (ciEnv.provider !== 'unknown') {
        logger.info('CI environment detected', { provider: ciEnv.provider });
      }

      // Execute with timeout guard
      const result = await this.executeWithTimeout();

      const completedAt = new Date().toISOString();
      const duration = Date.now() - this.startTime;

      const headlessResult: HeadlessResult = {
        success: result.success,
        exitCode: result.success ? 0 : 1,
        goal: this.config.goal,
        startedAt,
        completedAt,
        duration,
        output: result.output,
        errors: this.errors,
      };

      this.emit('completed', headlessResult);
      return headlessResult;
    } catch (error: unknown) {
      const completedAt = new Date().toISOString();
      const duration = Date.now() - this.startTime;

      this.addError({
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        fatal: true,
        timestamp: new Date().toISOString(),
      });

      const failedResult: HeadlessResult = {
        success: false,
        exitCode: 4, // RUNTIME_ERROR
        goal: this.config.goal,
        startedAt,
        completedAt,
        duration,
        output: this.buildOutput(false),
        errors: this.errors,
      };

      this.emit('failed', failedResult);
      return failedResult;
    }
  }

  /**
   * Wraps goal execution with a timeout. If the timeout fires before the
   * goal completes, the result is marked as failed with a TIMEOUT error.
   */
  private async executeWithTimeout(): Promise<{
    success: boolean;
    output: HeadlessOutput;
  }> {
    return new Promise<{ success: boolean; output: HeadlessOutput }>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.addError({
            code: 'TIMEOUT',
            message: `Execution timed out after ${this.config.timeout}ms`,
            fatal: true,
            timestamp: new Date().toISOString(),
          });
          resolve({ success: false, output: this.buildOutput(false) });
        }, this.config.timeout);

        // Allow the process to exit even if the timer is still pending
        if (timer.unref) timer.unref();

        this.runGoal()
          .then((success) => {
            clearTimeout(timer);
            resolve({ success, output: this.buildOutput(success) });
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      },
    );
  }

  /**
   * Run the goal against the injected OrchestratorRunner.
   * When no runner is provided the goal succeeds in dry-run mode.
   */
  private async runGoal(): Promise<boolean> {
    if (this.runner) {
      try {
        await this.runner.start();
        await this.runner.executeGoal(this.config.goal);
        this.tasks.push({
          id: 'goal-1',
          team: 'orchestrator',
          status: 'completed',
          description: this.config.goal,
          duration: Date.now() - this.startTime,
        });
        return true;
      } catch (err: unknown) {
        this.tasks.push({
          id: 'goal-1',
          team: 'orchestrator',
          status: 'failed',
          description: this.config.goal,
          duration: Date.now() - this.startTime,
        });
        this.addError({
          code: 'GOAL_FAILED',
          message: err instanceof Error ? err.message : 'Goal execution failed',
          fatal: this.config.exitOnError,
          timestamp: new Date().toISOString(),
        });
        return false;
      }
    }

    // No runner provided — dry-run mode
    this.tasks.push({
      id: 'goal-1',
      team: 'orchestrator',
      status: 'completed',
      description: this.config.goal,
      duration: Date.now() - this.startTime,
    });
    return true;
  }

  /**
   * Build the structured output envelope from collected task results.
   */
  private buildOutput(success: boolean): HeadlessOutput {
    const metrics: HeadlessMetrics = {
      totalTasks: this.tasks.length,
      completedTasks: this.tasks.filter((t) => t.status === 'completed').length,
      failedTasks: this.tasks.filter((t) => t.status === 'failed').length,
      skippedTasks: this.tasks.filter((t) => t.status === 'skipped').length,
      totalDuration: Date.now() - this.startTime,
    };

    return {
      tasks: this.tasks,
      summary: success
        ? `Goal completed: ${metrics.completedTasks}/${metrics.totalTasks} tasks succeeded`
        : `Goal failed: ${metrics.failedTasks} task(s) failed out of ${metrics.totalTasks}`,
      metrics,
    };
  }

  private addError(error: HeadlessError): void {
    this.errors.push(error);
    this.emit('errorOccurred', error);
  }

  /**
   * Return the detected CI environment metadata.
   */
  getCIEnvironment(): CIEnvironment {
    return this.ciDetector.detect();
  }

  /**
   * Check whether execution is running inside a CI environment.
   */
  isCI(): boolean {
    return this.ciDetector.isCI();
  }

  /**
   * Release internal resources and remove all listeners.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.errors = [];
    this.tasks = [];
    this.removeAllListeners();
  }
}

/**
 * Factory function for HeadlessRunner.
 */
export function createHeadlessRunner(
  config: HeadlessConfig,
  runner?: RunnableRunner | null,
): HeadlessRunner {
  return new HeadlessRunner({ config, runner });
}
