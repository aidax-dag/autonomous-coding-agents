/**
 * Performance Skill
 *
 * Analyzes code for performance bottlenecks and optimization opportunities.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

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
export class PerformanceSkill extends BaseSkill<PerformanceSkillInput, PerformanceSkillOutput> {
  readonly name = 'performance';
  readonly description = 'Analyzes code for performance bottlenecks and optimization opportunities';
  readonly tags = ['performance', 'optimization', 'profiling'] as const;
  protected readonly validationError = 'Invalid input: files array is required';

  validate(input: PerformanceSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  protected createFallbackOutput(_input: PerformanceSkillInput): PerformanceSkillOutput {
    return {
      findings: [],
      overallScore: 100,
      bottlenecks: [],
    };
  }

  protected createFallbackContext(input: PerformanceSkillInput): Record<string, unknown> {
    const metrics = input.metrics ?? ['time', 'memory', 'cpu', 'io'];
    return { files: input.files, metrics };
  }

  protected createExtraMetadata(input: PerformanceSkillInput): Record<string, unknown> {
    const metrics = input.metrics ?? ['time', 'memory', 'cpu', 'io'];
    return { metricsAnalyzed: metrics };
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
