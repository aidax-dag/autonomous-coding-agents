/**
 * Hooks Module
 *
 * Provides hook registry, executor, and base implementation.
 *
 * @module core/hooks
 */

export { BaseHook } from './base-hook.js';
export { HookRegistry } from './hook-registry.js';
export { HookExecutor } from './hook-executor.js';

// Re-export interfaces for convenience
export {
  IHook,
  IHookRegistry,
  IHookExecutor,
  HookEvent,
  HookAction,
  HookContext,
  HookResult,
  HookConfig,
  HookCondition,
  HookExecutionOptions,
  HookResultReducer,
  HookExecutionRecord,
  BuiltinHookType,
} from '../interfaces/hook.interface.js';

// Context Monitor
export * from './context-monitor/index.js';

// Token Optimizer
export * from './token-optimizer/index.js';

// Session Recovery
export * from './session-recovery/index.js';

// Auto Compaction
export * from './auto-compaction/index.js';

// Code Quality
export * from './code-quality/index.js';

// MCP Health Monitor
export * from './mcp-health-monitor/index.js';

// Comment Checker
export * from './comment-checker/index.js';

// Todo Enforcer
export * from './todo-enforcer/index.js';

// Think Mode
export * from './think-mode/index.js';

// Confidence Check
export * from './confidence-check/index.js';

// Self Check
export * from './self-check/index.js';

// Error Learning
export * from './error-learning/index.js';

// Context Optimizer
export * from './context-optimizer/index.js';
