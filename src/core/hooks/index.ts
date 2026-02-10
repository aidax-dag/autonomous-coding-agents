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

// Active hooks
export * from './confidence-check/index.js';
export * from './self-check/index.js';
export * from './error-learning/index.js';
export * from './context-optimizer/index.js';
export * from './sandbox-escalation/index.js';
