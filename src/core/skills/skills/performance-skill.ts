/**
 * Performance Skill
 *
 * Analyzes code for performance bottlenecks and optimization opportunities.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import { createSkillFallback } from '../skill-fallback';

/**
 * A performance finding
 */
export interface PerformanceFinding {
  file: string;
  issue: string;
  impact: string;
  suggestion: string;
}

/**
 * Input for performance skill
 */
export interface PerformanceSkillInput {
  /** File paths to analyze */
  files: string[];
  /** Metrics to evaluate */
  metrics?: Array<'time' | 'memory' | 'cpu' | 'io'>;
  /** Performance threshold (0-100) */
  threshold?: number;
}

/**
 * Output from performance skill
 */
export interface PerformanceSkillOutput {
  /** Performance findings */
  findings: PerformanceFinding[];
  /** Overall performance score (0-100, higher is better) */
  overallScore: number;
  /** Identified bottlenecks */
  bottlenecks: string[];
}

/**
 * Performance skill — analyzes code for bottlenecks and optimization opportunities
 */
export class PerformanceSkill
  implements ISkill<PerformanceSkillInput, PerformanceSkillOutput>
{
  readonly name = 'performance';
  readonly description = 'Analyzes code for performance bottlenecks and optimization opportunities';
  readonly tags = ['performance', 'optimization', 'profiling'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: PerformanceSkillInput,
    context: SkillContext,
  ) => Promise<PerformanceSkillOutput>;

  constructor(options?: {
    executor?: (
      input: PerformanceSkillInput,
      context: SkillContext,
    ) => Promise<PerformanceSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: PerformanceSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as PerformanceSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      Array.isArray(typed.files) &&
      typed.files.length > 0
    );
  }

  async execute(
    input: PerformanceSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<PerformanceSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: files array is required',
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return {
          success: true,
          output,
          duration: Date.now() - start,
        };
      }

      // Default stub output — no issues found
      const metrics = input.metrics ?? ['time', 'memory', 'cpu', 'io'];
      const fallback = createSkillFallback('performance', 'no_executor', {
        files: input.files,
        metrics,
      });

      const output: PerformanceSkillOutput = {
        findings: [],
        overallScore: 100,
        bottlenecks: [],
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { metricsAnalyzed: metrics, fallback },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }
}

/**
 * Factory function
 */
export function createPerformanceSkill(options?: {
  executor?: (
    input: PerformanceSkillInput,
    context: SkillContext,
  ) => Promise<PerformanceSkillOutput>;
}): PerformanceSkill {
  return new PerformanceSkill(options);
}
