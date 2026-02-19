/**
 * Debugging Skill
 *
 * Analyzes errors and stack traces to identify root causes and suggest fixes.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

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
export class DebuggingSkill extends BaseSkill<DebuggingSkillInput, DebuggingSkillOutput> {
  readonly name = 'debugging';
  readonly description = 'Analyzes errors and stack traces to identify root causes and suggest fixes';
  readonly tags = ['debug', 'troubleshoot', 'error-analysis'] as const;
  protected readonly validationError = 'Invalid input: error message is required';

  validate(input: DebuggingSkillInput): boolean {
    return typeof input.error === 'string' && input.error.length > 0;
  }

  protected createFallbackOutput(input: DebuggingSkillInput): DebuggingSkillOutput {
    return {
      rootCause: `Analysis pending for: ${input.error}`,
      hypothesis: ['Requires LLM analysis for hypothesis generation'],
      suggestedFixes: [
        {
          description: 'Review the error context and stack trace for detailed diagnosis',
        },
      ],
      confidence: 0,
    };
  }

  protected createFallbackContext(input: DebuggingSkillInput): Record<string, unknown> {
    return { error: input.error, hasStackTrace: !!input.stackTrace };
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
