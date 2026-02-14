/**
 * Autonomous Debugging Loop
 *
 * Orchestrates the debugging cycle: detect error -> analyze root cause ->
 * generate hypotheses -> test fixes -> learn from outcomes.
 *
 * Emits events at each stage for observability:
 * - 'hypothesis:generated' - when hypotheses are created
 * - 'hypothesis:testing'   - when a hypothesis test begins
 * - 'hypothesis:result'    - when a hypothesis test completes
 * - 'diagnosis:complete'   - when the full diagnosis finishes
 * - 'fix:applied'          - when a successful fix is found
 *
 * @module core/debugging/debugging-loop
 */

import { EventEmitter } from 'events';
import type {
  DebuggingContext,
  DebuggingAttempt,
  DebuggingResult,
  DebuggingLoopConfig,
  Hypothesis,
} from './types';
import { DEFAULT_DEBUGGING_CONFIG } from './types';
import { HypothesisGenerator } from './hypothesis-generator';

// ============================================================================
// Types for fix application (injectable for testability)
// ============================================================================

/**
 * Strategy for applying and verifying a fix. Consumers can inject custom
 * implementations; the default returns false (no-op) for safety.
 */
export interface FixStrategy {
  /** Attempt to apply the suggested fix. Returns true if the fix was applied. */
  applyFix(hypothesis: Hypothesis): Promise<boolean>;
  /** Verify that the fix resolved the original error. Returns true if verified. */
  verifyFix(hypothesis: Hypothesis, context: DebuggingContext): Promise<boolean>;
}

/**
 * Default fix strategy: always reports failure.
 * Real implementations should override this with actual fix/verify logic.
 */
const DEFAULT_FIX_STRATEGY: FixStrategy = {
  applyFix: async () => false,
  verifyFix: async () => false,
};

// ============================================================================
// Learning callback (injectable for testability)
// ============================================================================

/**
 * Callback invoked when the loop wants to record a learning outcome.
 */
export type LearnCallback = (
  error: Error,
  rootCause: string,
  fix: string,
) => Promise<void>;

// ============================================================================
// DebuggingLoop
// ============================================================================

/**
 * The autonomous debugging loop. Given a DebuggingContext, it generates
 * hypotheses, tests them in confidence order, and returns the result.
 *
 * @example
 * ```typescript
 * const loop = new DebuggingLoop({ maxDepth: 3, timeoutMs: 30000 });
 * loop.on('fix:applied', (h) => console.log('Fixed:', h.description));
 *
 * const result = await loop.diagnose(context);
 * if (result.successfulFix) {
 *   console.log('Root cause:', result.rootCause);
 * }
 * ```
 */
export class DebuggingLoop extends EventEmitter {
  private readonly config: DebuggingLoopConfig;
  private readonly generator: HypothesisGenerator;
  private readonly fixStrategy: FixStrategy;
  private readonly learnCallback: LearnCallback | null;

  constructor(
    config?: Partial<DebuggingLoopConfig>,
    fixStrategy?: FixStrategy,
    learnCallback?: LearnCallback,
  ) {
    super();
    this.config = { ...DEFAULT_DEBUGGING_CONFIG, ...config };
    this.generator = new HypothesisGenerator();
    this.fixStrategy = fixStrategy ?? DEFAULT_FIX_STRATEGY;
    this.learnCallback = learnCallback ?? null;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Run the full debugging diagnosis loop.
   *
   * 1. Generate hypotheses from context
   * 2. Rank by confidence, filter by minimum threshold
   * 3. For each hypothesis up to maxDepth:
   *    a. Test the hypothesis
   *    b. If successful, record and return immediately
   *    c. If timed out, stop early
   * 4. Return the full result with all attempts
   */
  async diagnose(context: DebuggingContext): Promise<DebuggingResult> {
    const startTime = Date.now();
    const attempts: DebuggingAttempt[] = [];

    // Step 1: Generate hypotheses
    const rawHypotheses = this.generator.generateHypotheses(context);

    // Step 2: Rank and filter
    const ranked = this.generator.rankByConfidence(rawHypotheses);
    const filtered = this.generator.filterByMinConfidence(
      ranked,
      this.config.minConfidence,
    );

    this.emit('hypothesis:generated', filtered);

    // Handle empty hypotheses case
    if (filtered.length === 0) {
      const result = this.buildResult(
        context.taskId,
        null,
        null,
        attempts,
        startTime,
        false,
      );
      this.emit('diagnosis:complete', result);
      return result;
    }

    // Step 3: Test hypotheses up to maxDepth
    const maxTests = Math.min(filtered.length, this.config.maxDepth);
    let successfulHypothesis: Hypothesis | null = null;

    for (let i = 0; i < maxTests; i++) {
      // Check timeout before testing
      if (this.isTimedOut(startTime)) {
        break;
      }

      const hypothesis = filtered[i];
      this.emit('hypothesis:testing', hypothesis);

      const attempt = await this.runHypothesisTest(hypothesis, context);
      attempts.push(attempt);

      this.emit('hypothesis:result', { hypothesis, attempt });

      if (attempt.result === 'success') {
        successfulHypothesis = hypothesis;
        this.emit('fix:applied', hypothesis);
        break;
      }
    }

    // Step 4: Build result
    const rootCause = successfulHypothesis?.description ?? null;
    let learned = false;

    // Auto-learn if configured and we found a fix
    if (this.config.autoLearn && successfulHypothesis && this.learnCallback) {
      try {
        await this.learnCallback(
          context.error,
          successfulHypothesis.description,
          successfulHypothesis.suggestedFix,
        );
        learned = true;
      } catch {
        // Learning failure should not break the debugging loop
        learned = false;
      }
    }

    const result = this.buildResult(
      context.taskId,
      rootCause,
      successfulHypothesis,
      attempts,
      startTime,
      learned,
    );

    this.emit('diagnosis:complete', result);
    return result;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Test a single hypothesis by applying the fix and verifying the result.
   */
  private async runHypothesisTest(
    hypothesis: Hypothesis,
    context: DebuggingContext,
  ): Promise<DebuggingAttempt> {
    const testStart = Date.now();
    const evidence: string[] = [];

    try {
      // Attempt to apply the fix
      const applied = await this.fixStrategy.applyFix(hypothesis);
      evidence.push(applied ? 'Fix applied successfully' : 'Fix application failed');

      if (!applied) {
        return {
          hypothesis: hypothesis.description,
          action: hypothesis.suggestedFix,
          result: 'failure',
          evidence,
          duration: Date.now() - testStart,
        };
      }

      // Verify the fix
      const verified = await this.fixStrategy.verifyFix(hypothesis, context);
      evidence.push(verified ? 'Fix verified successfully' : 'Fix verification failed');

      return {
        hypothesis: hypothesis.description,
        action: hypothesis.suggestedFix,
        result: verified ? 'success' : 'failure',
        evidence,
        duration: Date.now() - testStart,
      };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      evidence.push(`Error during hypothesis test: ${errMessage}`);

      return {
        hypothesis: hypothesis.description,
        action: hypothesis.suggestedFix,
        result: 'inconclusive',
        evidence,
        duration: Date.now() - testStart,
      };
    }
  }

  /**
   * Check whether the debugging session has exceeded the timeout.
   */
  private isTimedOut(startTime: number): boolean {
    return Date.now() - startTime >= this.config.timeoutMs;
  }

  /**
   * Build the final DebuggingResult.
   */
  private buildResult(
    taskId: string,
    rootCause: string | null,
    successfulFix: Hypothesis | null,
    attempts: DebuggingAttempt[],
    startTime: number,
    learned: boolean,
  ): DebuggingResult {
    return {
      taskId,
      rootCause,
      hypothesesTested: attempts.length,
      successfulFix,
      attempts,
      totalDuration: Date.now() - startTime,
      learned,
    };
  }
}
