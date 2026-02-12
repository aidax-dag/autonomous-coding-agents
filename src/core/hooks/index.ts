/**
 * Hooks Module
 *
 * Provides hook registry, executor, and base implementation.
 *
 * @module core/hooks
 */

export { BaseHook } from './base-hook';
export { HookRegistry } from './hook-registry';
export { HookExecutor } from './hook-executor';

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
} from '../interfaces/hook.interface';

// Active hooks
export * from './confidence-check/index';
export * from './self-check/index';
export * from './error-learning/index';
export * from './context-optimizer/index';
export * from './sandbox-escalation/index';
export * from './code-quality/index';
