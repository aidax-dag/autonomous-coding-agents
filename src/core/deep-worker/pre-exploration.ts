/**
 * Pre-Exploration
 *
 * Explores the task context before starting work. Identifies relevant files,
 * patterns, and dependencies to inform the planning phase.
 *
 * @module core/deep-worker
 */

import type {
  IPreExploration,
  DeepWorkerContext,
  ExplorationResult,
} from './interfaces/deep-worker.interface';

/**
 * Exploration executor — pluggable function for actual exploration logic
 */
export type ExplorationExecutor = (
  context: DeepWorkerContext,
) => Promise<ExplorationResult>;

/**
 * PreExploration options
 */
export interface PreExplorationOptions {
  /** Custom executor (for LLM-backed exploration) */
  executor?: ExplorationExecutor;
  /** Maximum files to include in results */
  maxFiles?: number;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Default pre-exploration implementation
 */
export class PreExploration implements IPreExploration {
  private readonly executor?: ExplorationExecutor;
  private readonly maxFiles: number;
  private readonly timeout: number;

  constructor(options: PreExplorationOptions = {}) {
    this.executor = options.executor;
    this.maxFiles = options.maxFiles ?? 50;
    this.timeout = options.timeout ?? 30000;
  }

  async explore(context: DeepWorkerContext): Promise<ExplorationResult> {
    const start = Date.now();

    if (this.executor) {
      let timer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Exploration timed out after ${this.timeout}ms`)),
          this.timeout,
        );
      });

      try {
        const result = await Promise.race([
          this.executor(context),
          timeoutPromise,
        ]);

        return {
          ...result,
          relevantFiles: result.relevantFiles.slice(0, this.maxFiles),
          duration: Date.now() - start,
        };
      } finally {
        clearTimeout(timer!);
      }
    }

    // Default stub: return minimal exploration result
    return {
      relevantFiles: [],
      patterns: [],
      dependencies: [],
      summary: `Exploration of: ${context.taskDescription}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Factory function
 */
export function createPreExploration(
  options?: PreExplorationOptions,
): PreExploration {
  return new PreExploration(options);
}
