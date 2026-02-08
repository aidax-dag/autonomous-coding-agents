/**
 * Context Optimizer Hook
 *
 * Post-execution hook that optimizes output based on context budget.
 * When context quality degrades, compresses output to conserve tokens.
 *
 * @module core/hooks/context-optimizer
 */

import { BaseHook } from '../base-hook.js';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface.js';
import type { ContextManager } from '../../context/context-manager.js';
import type { TaskAfterContext } from '../self-check/self-check.hook.js';

/**
 * ContextOptimizerHook
 *
 * Runs after task execution (lower priority than SelfCheckHook).
 * When context quality is degrading, optimizes output to reduce token usage.
 */
export class ContextOptimizerHook extends BaseHook<TaskAfterContext> {
  readonly name = 'context-optimizer';
  readonly description = 'Optimize output based on context budget';
  readonly event = HookEvent.TASK_AFTER;

  private readonly contextManager: ContextManager;

  constructor(contextManager: ContextManager, config?: Partial<HookConfig>) {
    super({ priority: 50, ...config });
    this.contextManager = contextManager;
  }

  async execute(context: HookContext<TaskAfterContext>): Promise<HookResult> {
    try {
      const qualityLevel = this.contextManager.getQualityLevel();

      // No optimization needed at peak/good quality
      if (qualityLevel === 'peak' || qualityLevel === 'good') {
        return this.continue();
      }

      // At degrading/poor quality, try to compress output
      const { result } = context.data;
      const output = typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result);

      if (!output) {
        return this.continue();
      }

      const compressed = await this.contextManager.optimizeOutput(output);

      if (compressed && compressed.compressed !== output) {
        return this.modify(
          { ...context.data, result: { ...result, result: compressed.compressed } } as unknown as TaskAfterContext,
          `Context quality ${qualityLevel}: output optimized (${compressed.originalTokens} → ${compressed.compressedTokens} tokens)`
        );
      }

      return this.continue();
    } catch {
      // Optimization failure should not affect the pipeline
      return this.continue();
    }
  }
}
