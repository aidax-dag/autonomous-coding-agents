/**
 * Debugging Skill
 *
 * Analyzes errors and stack traces to identify root causes and suggest fixes.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

/**
 * A suggested fix for a debugging issue
 */
export interface SuggestedFix {
  description: string;
  file?: string;
  code?: string;
}

/**
 * Input for debugging skill
 */
export interface DebuggingSkillInput {
  /** Error message or description */
  error: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Additional context about the error */
  context?: string;
  /** Related file paths */
  files?: string[];
}

/**
 * Output from debugging skill
 */
export interface DebuggingSkillOutput {
  /** Identified root cause */
  rootCause: string;
  /** List of hypotheses considered */
  hypothesis: string[];
  /** Suggested fixes ordered by likelihood */
  suggestedFixes: SuggestedFix[];
  /** Confidence in the diagnosis (0-1) */
  confidence: number;
}

/**
 * Debugging skill — analyzes errors and suggests fixes
 */
export class DebuggingSkill
  implements ISkill<DebuggingSkillInput, DebuggingSkillOutput>
{
  readonly name = 'debugging';
  readonly description = 'Analyzes errors and stack traces to identify root causes and suggest fixes';
  readonly tags = ['debug', 'troubleshoot', 'error-analysis'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: DebuggingSkillInput,
    context: SkillContext,
  ) => Promise<DebuggingSkillOutput>;

  constructor(options?: {
    executor?: (
      input: DebuggingSkillInput,
      context: SkillContext,
    ) => Promise<DebuggingSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: DebuggingSkillInput): boolean {
    return typeof input.error === 'string' && input.error.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as DebuggingSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.error === 'string' &&
      typed.error.length > 0
    );
  }

  async execute(
    input: DebuggingSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<DebuggingSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: error message is required',
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
      const output: DebuggingSkillOutput = {
        rootCause: `Analysis pending for: ${input.error}`,
        hypothesis: ['Requires LLM analysis for hypothesis generation'],
        suggestedFixes: [
          {
            description: 'Review the error context and stack trace for detailed diagnosis',
          },
        ],
        confidence: 0,
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
export function createDebuggingSkill(options?: {
  executor?: (
    input: DebuggingSkillInput,
    context: SkillContext,
  ) => Promise<DebuggingSkillOutput>;
}): DebuggingSkill {
  return new DebuggingSkill(options);
}
