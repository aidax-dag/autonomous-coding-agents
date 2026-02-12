/**
 * Hook Executor Implementation
 *
 * Handles hook execution with error handling and result aggregation.
 *
 * @module core/hooks/hook-executor
 */

import { randomUUID } from 'node:crypto';
import {
  IHook,
  IHookRegistry,
  IHookExecutor,
  HookEvent,
  HookContext,
  HookResult,
  HookAction,
  HookExecutionOptions,
  HookResultReducer,
  HookExecutionRecord,
} from '../interfaces/hook.interface';

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: Required<HookExecutionOptions> = {
  timeout: 5000,
  stopOnError: false,
  stopOnAction: [HookAction.ABORT],
  parallel: false,
  metadata: {},
};

/**
 * Hook Executor Implementation
 *
 * Provides:
 * - Sequential and parallel hook execution
 * - Error handling and timeout management
 * - Result aggregation and reduction
 * - Execution history tracking
 */
export class HookExecutor implements IHookExecutor {
  private readonly history: HookExecutionRecord[] = [];
  private readonly maxHistorySize: number;

  constructor(
    private readonly registry: IHookRegistry,
    options?: { maxHistorySize?: number }
  ) {
    this.maxHistorySize = options?.maxHistorySize ?? 500;
  }

  /**
   * Execute all hooks for an event
   */
  async executeHooks<TContext, TResult>(
    event: HookEvent,
    context: TContext,
    options?: HookExecutionOptions
  ): Promise<HookResult<TResult>[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const hooks = this.registry.getByEvent(event).filter((hook) => hook.isEnabled());

    if (hooks.length === 0) {
      return [];
    }

    const hookContext: HookContext<TContext> = {
      event,
      timestamp: new Date(),
      source: 'hook-executor',
      data: context,
      metadata: opts.metadata,
    };

    if (opts.parallel) {
      return this.executeParallel<TContext, TResult>(hooks, hookContext, opts);
    } else {
      return this.executeSequential<TContext, TResult>(hooks, hookContext, opts);
    }
  }

  /**
   * Execute hooks and reduce to final result
   */
  async executeAndReduce<TContext, TResult>(
    event: HookEvent,
    context: TContext,
    reducer: HookResultReducer<TResult>,
    options?: HookExecutionOptions
  ): Promise<TResult> {
    const results = await this.executeHooks<TContext, unknown>(event, context, options);

    let accumulator: TResult | undefined;
    for (let i = 0; i < results.length; i++) {
      accumulator = reducer(accumulator, results[i], i);
    }

    return accumulator as TResult;
  }

  /**
   * Execute hooks until one returns specified action
   */
  async executeUntilAction<TContext>(
    event: HookEvent,
    context: TContext,
    action: HookAction,
    options?: HookExecutionOptions
  ): Promise<HookResult | undefined> {
    const opts = { ...DEFAULT_OPTIONS, ...options, stopOnAction: [action] };
    const hooks = this.registry.getByEvent(event).filter((hook) => hook.isEnabled());

    const hookContext: HookContext<TContext> = {
      event,
      timestamp: new Date(),
      source: 'hook-executor',
      data: context,
      metadata: opts.metadata,
    };

    for (const hook of hooks) {
      if (!hook.shouldRun(hookContext)) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(hook, hookContext, opts.timeout);
        this.recordExecution(hook.name, event, hookContext, result);

        if (result.action === action) {
          return result;
        }
      } catch (error) {
        if (opts.stopOnError) {
          throw error;
        }
      }
    }

    return undefined;
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): HookExecutionRecord[] {
    const records = [...this.history].reverse();
    return limit ? records.slice(0, limit) : records;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Execute hooks sequentially
   */
  private async executeSequential<TContext, TResult>(
    hooks: IHook[],
    context: HookContext<TContext>,
    options: Required<HookExecutionOptions>
  ): Promise<HookResult<TResult>[]> {
    const results: HookResult<TResult>[] = [];
    let currentContext = context;

    for (const hook of hooks) {
      if (!hook.shouldRun(currentContext)) {
        continue;
      }

      const startTime = Date.now();
      try {
        const result = await this.executeWithTimeout(hook, currentContext, options.timeout);
        results.push(result as HookResult<TResult>);

        this.recordExecution(
          hook.name,
          context.event,
          currentContext,
          result,
          Date.now() - startTime
        );

        // Check stop conditions
        if (options.stopOnAction.includes(result.action)) {
          break;
        }

        // Update context if modified
        if (result.action === HookAction.MODIFY && result.data !== undefined) {
          currentContext = {
            ...currentContext,
            data: result.data as TContext,
            previousResults: results,
          };
        }
      } catch (error) {
        const errResult: HookResult<TResult> = {
          action: HookAction.CONTINUE,
          message: `Hook execution failed: ${(error as Error).message}`,
          metadata: { error: (error as Error).message },
        };

        results.push(errResult);
        this.recordExecution(
          hook.name,
          context.event,
          currentContext,
          errResult,
          Date.now() - startTime,
          error as Error
        );

        if (options.stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute hooks in parallel
   */
  private async executeParallel<TContext, TResult>(
    hooks: IHook[],
    context: HookContext<TContext>,
    options: Required<HookExecutionOptions>
  ): Promise<HookResult<TResult>[]> {
    const executableHooks = hooks.filter((hook) => hook.shouldRun(context));

    const promises = executableHooks.map(async (hook) => {
      const startTime = Date.now();
      try {
        const result = await this.executeWithTimeout(hook, context, options.timeout);
        this.recordExecution(
          hook.name,
          context.event,
          context,
          result,
          Date.now() - startTime
        );
        return result as HookResult<TResult>;
      } catch (error) {
        const errResult: HookResult<TResult> = {
          action: HookAction.CONTINUE,
          message: `Hook execution failed: ${(error as Error).message}`,
          metadata: { error: (error as Error).message },
        };

        this.recordExecution(
          hook.name,
          context.event,
          context,
          errResult,
          Date.now() - startTime,
          error as Error
        );

        if (options.stopOnError) {
          throw error;
        }

        return errResult;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute hook with timeout
   */
  private executeWithTimeout<TContext>(
    hook: IHook<TContext>,
    context: HookContext<TContext>,
    timeout: number
  ): Promise<HookResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook '${hook.name}' execution timed out after ${timeout}ms`));
      }, timeout);

      hook
        .execute(context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Record execution in history
   */
  private recordExecution(
    hookName: string,
    event: HookEvent,
    context: unknown,
    result: HookResult,
    duration: number = 0,
    error?: Error
  ): void {
    const record: HookExecutionRecord = {
      id: randomUUID(),
      hookName,
      event,
      context,
      result,
      timestamp: new Date(),
      duration,
      error,
    };

    this.history.push(record);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}
