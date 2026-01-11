/**
 * Base Hook Implementation
 *
 * Abstract base class for implementing hooks with common functionality.
 *
 * @module core/hooks/base-hook
 */

import {
  IHook,
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
  HookAction,
  HookCondition,
} from '../interfaces/hook.interface.js';

/**
 * Abstract base class for hooks
 *
 * Provides common functionality for hook implementations:
 * - Condition checking
 * - Enable/disable management
 * - Configuration handling
 *
 * @abstract
 */
export abstract class BaseHook<TContext = unknown, TResult = unknown>
  implements IHook<TContext, TResult>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly event: HookEvent;

  readonly priority: number;
  protected enabled: boolean;
  protected readonly timeout: number;
  protected readonly retryOnError: boolean;
  protected readonly conditions: HookCondition[];

  constructor(config?: Partial<HookConfig>) {
    this.priority = config?.priority ?? 100;
    this.enabled = config?.enabled ?? true;
    this.timeout = config?.timeout ?? 5000;
    this.retryOnError = config?.retryOnError ?? false;
    this.conditions = config?.conditions ?? [];
  }

  /**
   * Execute the hook - must be implemented by subclasses
   */
  abstract execute(context: HookContext<TContext>): Promise<HookResult<TResult>>;

  /**
   * Check if hook should run for given context
   */
  shouldRun(context: HookContext<TContext>): boolean {
    // Check if enabled
    if (!this.enabled) {
      return false;
    }

    // Check event match
    if (context.event !== this.event && this.event !== HookEvent.CUSTOM) {
      return false;
    }

    // Check conditions
    if (this.conditions.length > 0) {
      return this.evaluateConditions(context);
    }

    return true;
  }

  /**
   * Enable the hook
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the hook
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if hook is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get hook configuration
   */
  getConfig(): HookConfig {
    return {
      name: this.name,
      description: this.description,
      event: this.event,
      priority: this.priority,
      enabled: this.enabled,
      timeout: this.timeout,
      retryOnError: this.retryOnError,
      conditions: this.conditions,
    };
  }

  /**
   * Create a continue result
   */
  protected continue(data?: TResult, message?: string): HookResult<TResult> {
    return {
      action: HookAction.CONTINUE,
      data,
      message,
    };
  }

  /**
   * Create a skip result
   */
  protected skip(message?: string): HookResult<TResult> {
    return {
      action: HookAction.SKIP,
      message,
    };
  }

  /**
   * Create a retry result
   */
  protected retry(message?: string): HookResult<TResult> {
    return {
      action: HookAction.RETRY,
      message,
    };
  }

  /**
   * Create an abort result
   */
  protected abort(message: string): HookResult<TResult> {
    return {
      action: HookAction.ABORT,
      message,
    };
  }

  /**
   * Create a modify result
   */
  protected modify(data: TResult, message?: string): HookResult<TResult> {
    return {
      action: HookAction.MODIFY,
      data,
      message,
    };
  }

  /**
   * Evaluate conditions against context
   */
  private evaluateConditions(context: HookContext<TContext>): boolean {
    const data = context.data as Record<string, unknown>;

    return this.conditions.every((condition) => {
      const value = this.getNestedValue(data, condition.field);
      return this.evaluateCondition(condition, value);
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: HookCondition, value: unknown): boolean {
    const { operator, value: expected } = condition;

    switch (operator) {
      case 'eq':
        return value === expected;
      case 'ne':
        return value !== expected;
      case 'gt':
        return typeof value === 'number' && typeof expected === 'number' && value > expected;
      case 'gte':
        return typeof value === 'number' && typeof expected === 'number' && value >= expected;
      case 'lt':
        return typeof value === 'number' && typeof expected === 'number' && value < expected;
      case 'lte':
        return typeof value === 'number' && typeof expected === 'number' && value <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(value);
      case 'nin':
        return Array.isArray(expected) && !expected.includes(value);
      case 'regex':
        return typeof value === 'string' && typeof expected === 'string' && new RegExp(expected).test(value);
      default:
        return true;
    }
  }
}
