/**
 * Context Manager Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Provides context propagation using AsyncLocalStorage
 *
 * @module core/logging
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { IContextManager, LogContext } from './logging.interface.js';

/**
 * Context Manager using AsyncLocalStorage for automatic context propagation
 */
export class ContextManager implements IContextManager {
  private storage: AsyncLocalStorage<LogContext>;
  private disposed = false;

  constructor() {
    this.storage = new AsyncLocalStorage<LogContext>();
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    this.ensureNotDisposed();
    return this.storage.getStore() ?? {};
  }

  /**
   * Set context for current execution scope
   * @param context Context to set
   */
  setContext(context: LogContext): void {
    this.ensureNotDisposed();

    const store = this.storage.getStore();
    if (store) {
      // Merge into existing context
      Object.assign(store, context);
    } else {
      // Run in new context - this only works at the start of an async operation
      this.storage.enterWith(context);
    }
  }

  /**
   * Run function with context
   * @param context Context to use
   * @param fn Function to run
   */
  runWithContext<T>(context: LogContext, fn: () => T): T {
    this.ensureNotDisposed();

    const currentContext = this.getContext();
    const mergedContext = { ...currentContext, ...context };

    return this.storage.run(mergedContext, fn);
  }

  /**
   * Run async function with context
   * @param context Context to use
   * @param fn Async function to run
   */
  async runWithContextAsync<T>(context: LogContext, fn: () => Promise<T>): Promise<T> {
    this.ensureNotDisposed();

    const currentContext = this.getContext();
    const mergedContext = { ...currentContext, ...context };

    return this.storage.run(mergedContext, fn);
  }

  /**
   * Merge context into current context
   * @param context Context to merge
   */
  mergeContext(context: LogContext): void {
    this.ensureNotDisposed();

    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, context);
    } else {
      this.storage.enterWith({ ...context });
    }
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.ensureNotDisposed();
    this.storage.enterWith({});
  }

  /**
   * Create new request ID
   */
  createRequestId(): string {
    return `req_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
  }

  /**
   * Create new trace ID
   */
  createTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Create new span ID
   */
  createSpanId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }

  /**
   * Dispose the context manager
   */
  dispose(): void {
    this.disposed = true;
    this.storage.disable();
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ContextManager has been disposed');
    }
  }
}

/**
 * Global context manager instance
 */
let globalContextManager: ContextManager | null = null;

/**
 * Get global context manager instance
 */
export function getContextManager(): IContextManager {
  if (!globalContextManager) {
    globalContextManager = new ContextManager();
  }
  return globalContextManager;
}

/**
 * Reset global context manager (for testing)
 */
export function resetContextManager(): void {
  if (globalContextManager) {
    globalContextManager.dispose();
    globalContextManager = null;
  }
}

/**
 * Context propagation decorators and utilities
 */
export const ContextPropagation = {
  /**
   * Wrap function with context propagation
   * @param context Context to propagate
   * @param fn Function to wrap
   */
  wrap<T extends (...args: unknown[]) => unknown>(context: LogContext, fn: T): T {
    const contextManager = getContextManager();
    return ((...args: Parameters<T>): ReturnType<T> => {
      return contextManager.runWithContext(context, () => fn(...args)) as ReturnType<T>;
    }) as T;
  },

  /**
   * Wrap async function with context propagation
   * @param context Context to propagate
   * @param fn Async function to wrap
   */
  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(context: LogContext, fn: T): T {
    const contextManager = getContextManager();
    return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      return contextManager.runWithContextAsync(context, () =>
        fn(...args)
      ) as Promise<Awaited<ReturnType<T>>>;
    }) as T;
  },

  /**
   * Create context for agent execution
   * @param agentType Agent type
   * @param agentId Agent ID
   */
  forAgent(agentType: string, agentId: string): LogContext {
    const contextManager = getContextManager();
    return {
      agentType,
      agentId,
      spanId: contextManager.createSpanId(),
    };
  },

  /**
   * Create context for task execution
   * @param taskId Task ID
   * @param taskType Task type
   */
  forTask(taskId: string, taskType?: string): LogContext {
    const contextManager = getContextManager();
    return {
      taskId,
      operation: taskType,
      spanId: contextManager.createSpanId(),
    };
  },

  /**
   * Create context for workflow execution
   * @param workflowId Workflow ID
   * @param executionId Execution ID
   */
  forWorkflow(workflowId: string, executionId: string): LogContext {
    const contextManager = getContextManager();
    return {
      workflowId,
      executionId,
      spanId: contextManager.createSpanId(),
    };
  },

  /**
   * Create context for tool invocation
   * @param toolName Tool name
   */
  forTool(toolName: string): LogContext {
    const contextManager = getContextManager();
    return {
      toolName,
      spanId: contextManager.createSpanId(),
    };
  },

  /**
   * Create context for hook execution
   * @param hookName Hook name
   */
  forHook(hookName: string): LogContext {
    const contextManager = getContextManager();
    return {
      hookName,
      spanId: contextManager.createSpanId(),
    };
  },

  /**
   * Create context for API request
   * @param requestId Request ID
   * @param method HTTP method
   * @param path Request path
   */
  forRequest(requestId: string, method: string, path: string): LogContext {
    const contextManager = getContextManager();
    return {
      requestId,
      operation: `${method} ${path}`,
      traceId: contextManager.createTraceId(),
      spanId: contextManager.createSpanId(),
    };
  },
};
