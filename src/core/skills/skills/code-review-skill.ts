/**
 * Code Review Skill
 *
 * Extracted from CodeQualityAgent — deep code review with pattern/security/perf analysis.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import type {
  CodeReviewFinding,
  DeepReviewOutput,
} from '../../orchestrator/agents/code-quality-agent';

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
export class CodeReviewSkill
  implements ISkill<CodeReviewSkillInput, DeepReviewOutput>
{
  readonly name = 'code-review';
  readonly description = 'Deep code review analyzing patterns, security, performance, and best practices';
  readonly tags = ['review', 'quality', 'security', 'analysis'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: CodeReviewSkillInput,
    context: SkillContext,
  ) => Promise<DeepReviewOutput>;

  constructor(options?: {
    executor?: (
      input: CodeReviewSkillInput,
      context: SkillContext,
    ) => Promise<DeepReviewOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: CodeReviewSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as CodeReviewSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      Array.isArray(typed.files) &&
      typed.files.length > 0
    );
  }

  async execute(
    input: CodeReviewSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<DeepReviewOutput>> {
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

      // Default stub output
      const findings: CodeReviewFinding[] = input.files.map((file) => ({
        type: 'best-practice' as const,
        severity: 'suggestion' as const,
        category: 'review',
        message: `Review pending for ${file}`,
        file,
        lineStart: 1,
      }));

      const output: DeepReviewOutput = {
        summary: `Review of ${input.files.length} file(s)`,
        findings,
        metrics: { complexity: 0, maintainability: 100, testability: 100, security: 100, overall: 100 },
        approved: true,
        reason: 'Stub review — no LLM executor configured',
        actionItems: [],
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
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
export function createCodeReviewSkill(options?: {
  executor?: (
    input: CodeReviewSkillInput,
    context: SkillContext,
  ) => Promise<DeepReviewOutput>;
}): CodeReviewSkill {
  return new CodeReviewSkill(options);
}
