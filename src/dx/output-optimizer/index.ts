/**
 * Output Optimizer Module
 *
 * Token-aware output optimization for LLM operations.
 *
 * @module dx/output-optimizer
 *
 * @deprecated This module is deprecated. For new code, use the unified
 * ContextManager from `@/core/context` instead:
 * ```typescript
 * import { ContextManager, createContextManager } from '@/core/context';
 * const ctx = createContextManager();
 * const result = await ctx.optimizeOutput(output);
 * ```
 * This module will be removed in a future version.
 */

export * from './interfaces/output-optimizer.interface.js';
export * from './impl/output-optimizer.impl.js';
