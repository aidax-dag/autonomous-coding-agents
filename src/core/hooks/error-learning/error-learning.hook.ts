/**
 * Error Learning Hook
 *
 * Learns from task errors via ReflexionPattern and SolutionsCache.
 * On error: looks up known solutions, learns new patterns from unknown errors.
 *
 * @module core/hooks/error-learning
 */

import { BaseHook } from '../base-hook';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface';
import type { TaskDocument } from '../../workspace/task-document';
import type { ReflexionPattern } from '../../learning/reflexion-pattern';
import type { SolutionsCache } from '../../learning/solutions-cache';

/**
 * Context passed to TASK_ERROR hooks
 */
export interface TaskErrorContext {
  task: TaskDocument;
  error: Error;
  /** Error classification from ErrorEscalator (when available) */
  classification?: {
    severity: string;
    category: string;
    retryable: boolean;
  };
}

/**
 * Classify an error into a category for the learning system
 */
function classifyError(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('syntax') || message.includes('parse')) return 'SYNTAX';
  if (message.includes('type') || message.includes('cannot read propert')) return 'TYPE';
  if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) return 'NETWORK';
  if (message.includes('enoent') || message.includes('file') || message.includes('path')) return 'FILE';
  if (message.includes('timeout')) return 'RUNTIME';
  if (message.includes('validation') || message.includes('invalid')) return 'VALIDATION';
  if (message.includes('auth') || message.includes('permission') || message.includes('forbidden')) return 'AUTH';
  if (message.includes('config') || message.includes('env')) return 'CONFIG';

  return 'RUNTIME';
}

/**
 * ErrorLearningHook
 *
 * Runs on task error to learn from failures.
 * Always continues - learning failures must never block the pipeline.
 */
export class ErrorLearningHook extends BaseHook<TaskErrorContext> {
  readonly name = 'error-learning';
  readonly description = 'Learn from task errors via ReflexionPattern';
  readonly event = HookEvent.TASK_ERROR;

  private readonly reflexion: ReflexionPattern;
  private readonly solutionsCache: SolutionsCache | null;

  constructor(
    reflexion: ReflexionPattern,
    solutionsCache: SolutionsCache | null,
    config?: Partial<HookConfig>
  ) {
    super({ priority: 100, ...config });
    this.reflexion = reflexion;
    this.solutionsCache = solutionsCache;
  }

  async execute(context: HookContext<TaskErrorContext>): Promise<HookResult> {
    try {
      const { error } = context.data;

      // Look up existing solution
      const known = await this.reflexion.lookup(error);

      if (known) {
        return this.continue(
          null,
          `Known error pattern: ${known.solution} (prevention: ${known.prevention.join(', ')})`
        );
      }

      // Unknown error - learn from it (prefer ErrorEscalator classification if available)
      const rootCause = context.data.classification?.category || classifyError(error);
      await this.reflexion.learn(error, 'pending', rootCause);

      // Also cache for fast lookup
      if (this.solutionsCache) {
        try {
          await this.solutionsCache.set({
            signature: error.message,
            solution: 'pending',
            rootCause,
            prevention: [],
            errorType: rootCause,
            errorMessagePattern: error.message,
            hits: 1,
            successCount: 0,
            failureCount: 0,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
          });
        } catch {
          // Cache failure is non-critical
        }
      }

      return this.continue(null, `New error learned: ${rootCause} - ${error.message}`);
    } catch {
      // Learning failure must never block the pipeline
      return this.continue();
    }
  }
}
