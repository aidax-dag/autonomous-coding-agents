/**
 * Tool Executor Implementation
 *
 * Handles tool execution with error handling, retries, and caching.
 *
 * @module core/tools/tool-executor
 */

import { randomUUID } from 'node:crypto';
import {
  IToolRegistry,
  IToolExecutor,
  ToolResult,
  ToolExecutionOptions,
  ToolCall,
  ToolExecutionRecord,
  ToolError,
  RetryCondition,
} from '../interfaces/tool.interface.js';

/**
 * Default execution options
 *
 * Enhanced with exponential backoff and retry conditions.
 */
const DEFAULT_OPTIONS: Required<Omit<ToolExecutionOptions, 'onRetry' | 'concurrencyGroup'>> & {
  onRetry?: ToolExecutionOptions['onRetry'];
  concurrencyGroup?: string;
} = {
  timeout: 30000,
  retries: 0,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 30000,
  retryOn: 'recoverable',
  onRetry: undefined,
  dryRun: false,
  cache: false,
  cacheTTL: 60000,
  context: {},
  priority: 0,
  concurrencyGroup: undefined,
};

/**
 * Tool Executor Implementation
 *
 * Provides:
 * - Single tool execution with error handling
 * - Sequential and parallel execution of multiple tools
 * - Retry logic with exponential backoff
 * - Execution history tracking
 */
export class ToolExecutor implements IToolExecutor {
  private readonly history: ToolExecutionRecord[] = [];
  private readonly maxHistorySize: number;
  private readonly cache = new Map<string, { result: ToolResult; expiresAt: number }>();

  constructor(
    private readonly registry: IToolRegistry,
    options?: { maxHistorySize?: number }
  ) {
    this.maxHistorySize = options?.maxHistorySize ?? 1000;
  }

  /**
   * Execute a tool by name
   */
  async execute<T>(
    toolName: string,
    params: unknown,
    options?: ToolExecutionOptions
  ): Promise<ToolResult<T>> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      return this.createErrorResult(toolName, 'TOOL_NOT_FOUND', `Tool '${toolName}' not found`);
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    // Check cache
    if (opts.cache) {
      const cached = this.getCached<T>(toolName, params);
      if (cached) {
        return cached;
      }
    }

    // Dry run
    if (opts.dryRun) {
      const validation = tool.validate(params);
      return {
        success: validation.valid,
        data: undefined as T,
        error: validation.valid
          ? undefined
          : {
              code: 'VALIDATION_FAILED',
              message: 'Validation failed in dry run',
              details: { errors: validation.errors },
              recoverable: true,
            },
        metadata: {
          toolName,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
        },
      };
    }

    // Validate
    const validation = tool.validate(params);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Parameter validation failed',
          details: { errors: validation.errors },
          recoverable: true,
        },
        metadata: {
          toolName,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
        },
      };
    }

    // Execute with retries and exponential backoff
    let lastError: Error | undefined;
    let lastToolError: ToolError | undefined;

    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        const result = await this.executeWithTimeout<T>(
          tool as { execute: (params: unknown, options?: ToolExecutionOptions) => Promise<ToolResult<T>> },
          params,
          opts
        );

        // Record history
        this.recordExecution(toolName, params, result, Date.now() - startTime);

        // Cache result
        if (opts.cache && result.success) {
          this.setCached(toolName, params, result, opts.cacheTTL);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        lastToolError = this.errorToToolError(lastError);

        // Check if we should retry
        if (attempt < opts.retries) {
          const shouldRetry = this.shouldRetry(lastToolError, opts.retryOn);

          if (shouldRetry) {
            // Calculate delay with exponential backoff
            const baseDelay = opts.retryDelay ?? DEFAULT_OPTIONS.retryDelay;
            const multiplier = opts.backoffMultiplier ?? DEFAULT_OPTIONS.backoffMultiplier;
            const maxDelay = opts.maxRetryDelay ?? DEFAULT_OPTIONS.maxRetryDelay;
            const calculatedDelay = baseDelay * Math.pow(multiplier, attempt);
            const actualDelay = Math.min(calculatedDelay, maxDelay);

            // Call retry callback if provided
            if (opts.onRetry) {
              opts.onRetry(attempt + 1, lastError, actualDelay);
            }

            await this.delay(actualDelay);
          } else {
            // Don't retry if condition not met
            break;
          }
        }
      }
    }

    // All retries failed or retry condition not met
    const result = this.createErrorResult<T>(
      toolName,
      lastToolError?.code ?? 'EXECUTION_FAILED',
      lastError?.message ?? 'Tool execution failed',
      {
        attempts: opts.retries + 1,
        lastError: lastToolError,
        recoverable: lastToolError?.recoverable ?? false,
      }
    );

    this.recordExecution(toolName, params, result, Date.now() - startTime, lastError);
    return result;
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeSequence(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of calls) {
      const result = await this.execute(call.toolName, call.params, call.options);
      results.push(result);

      // Stop on failure unless explicitly continuing
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    const promises = calls.map((call) =>
      this.execute(call.toolName, call.params, call.options)
    );

    return Promise.all(promises);
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): ToolExecutionRecord[] {
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
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    tool: { execute: (params: unknown, options?: ToolExecutionOptions) => Promise<ToolResult<T>> },
    params: unknown,
    options: ToolExecutionOptions
  ): Promise<ToolResult<T>> {
    const timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      tool
        .execute(params, options)
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
   * Create error result
   */
  private createErrorResult<T>(
    toolName: string,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): ToolResult<T> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        recoverable: true,
      },
      metadata: {
        toolName,
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Record execution in history
   */
  private recordExecution(
    toolName: string,
    params: unknown,
    result: ToolResult,
    duration: number,
    _error?: Error
  ): void {
    const record: ToolExecutionRecord = {
      id: randomUUID(),
      toolName,
      params,
      result,
      timestamp: new Date(),
      duration,
    };

    this.history.push(record);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get cached result
   */
  private getCached<T>(toolName: string, params: unknown): ToolResult<T> | undefined {
    const key = this.getCacheKey(toolName, params);
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.result,
        metadata: {
          ...cached.result.metadata,
          cached: true,
        },
      } as ToolResult<T>;
    }

    // Clean up expired entry
    if (cached) {
      this.cache.delete(key);
    }

    return undefined;
  }

  /**
   * Set cached result
   */
  private setCached(
    toolName: string,
    params: unknown,
    result: ToolResult,
    ttl: number
  ): void {
    const key = this.getCacheKey(toolName, params);
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Generate cache key
   */
  private getCacheKey(toolName: string, params: unknown): string {
    return `${toolName}:${JSON.stringify(params)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(
    error: ToolError,
    condition: RetryCondition | undefined
  ): boolean {
    if (!condition) return true;

    // Custom function condition
    if (typeof condition === 'function') {
      return condition(error);
    }

    switch (condition) {
      case 'always':
        return true;

      case 'timeout':
        return error.code === 'TIMEOUT' || error.message.toLowerCase().includes('timeout');

      case 'network':
        return (
          error.code === 'NETWORK_ERROR' ||
          error.code === 'CONNECTION_FAILED' ||
          error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('connection')
        );

      case 'recoverable':
        return error.recoverable;

      default:
        return error.recoverable;
    }
  }

  /**
   * Convert Error to ToolError
   */
  private errorToToolError(error: Error): ToolError {
    const message = error.message.toLowerCase();

    // Determine error type and recoverability
    let code = 'EXECUTION_ERROR';
    let recoverable = true;

    if (message.includes('timeout')) {
      code = 'TIMEOUT';
      recoverable = true;
    } else if (message.includes('network') || message.includes('connection')) {
      code = 'NETWORK_ERROR';
      recoverable = true;
    } else if (message.includes('not found')) {
      code = 'NOT_FOUND';
      recoverable = false;
    } else if (message.includes('permission') || message.includes('denied')) {
      code = 'PERMISSION_DENIED';
      recoverable = false;
    } else if (message.includes('invalid') || message.includes('validation')) {
      code = 'VALIDATION_ERROR';
      recoverable = false;
    } else if (message.includes('rate limit') || message.includes('throttle')) {
      code = 'RATE_LIMITED';
      recoverable = true;
    }

    return {
      code,
      message: error.message,
      recoverable,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }
}
