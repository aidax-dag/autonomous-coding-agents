/**
 * Code Review Skill
 *
 * Extracted from CodeQualityAgent — deep code review with pattern/security/perf analysis.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import type {
  CodeReviewFinding,
  DeepReviewOutput,
} from '../../orchestrator/agents/code-quality-agent';
import { BaseSkill } from '../base-skill';

/**
 * Input for code review skill
 */
export interface CodeReviewSkillInput {
  /** File paths to review */
  files: string[];
  /** Focus areas */
  focus?: Array<'pattern' | 'security' | 'performance' | 'maintainability' | 'best-practice'>;
  /** Severity threshold (only report findings at or above this level) */
  minSeverity?: 'suggestion' | 'minor' | 'major' | 'critical';
}

/**
 * Code review skill — analyzes code for patterns, security, performance issues
 */
export class CodeReviewSkill extends BaseSkill<CodeReviewSkillInput, DeepReviewOutput> {
  readonly name = 'code-review';
  readonly description = 'Deep code review analyzing patterns, security, performance, and best practices';
  readonly tags = ['review', 'quality', 'security', 'analysis'] as const;
  protected readonly validationError = 'Invalid input: files array is required';

  validate(input: CodeReviewSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  protected createFallbackOutput(input: CodeReviewSkillInput): DeepReviewOutput {
    const findings: CodeReviewFinding[] = input.files.map((file) => ({
      type: 'best-practice' as const,
      severity: 'suggestion' as const,
      category: 'review',
      message: `Review pending for ${file}`,
      file,
      lineStart: 1,
    }));

    return {
      summary: `Review of ${input.files.length} file(s)`,
      findings,
      metrics: { complexity: 0, maintainability: 100, testability: 100, security: 100, overall: 100 },
      approved: true,
      reason: 'Stub review — no LLM executor configured',
      actionItems: [],
    };
  }

  protected createFallbackContext(input: CodeReviewSkillInput): Record<string, unknown> {
    return {
      files: input.files,
      focus: input.focus,
    };
  }
}

/**
 * Factory function
 */
export function createCodeReviewSkill(options?: {
  executor?: (
    input: CodeReviewSkillInput,
    context: SkillContext,
  ) => Promise<DeepReviewOutput>;
}): CodeReviewSkill {
  return new CodeReviewSkill(options);
}
