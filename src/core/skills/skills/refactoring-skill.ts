/**
 * Refactoring Skill
 *
 * Extracted from CodeQualityAgent — identifies code smells and suggests refactorings.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import type {
  RefactoringOutput,
  RefactoringSuggestion,
} from '../../orchestrator/agents/code-quality-agent';
import { createSkillFallback } from '../skill-fallback';

/**
 * Input for refactoring skill
 */
export interface RefactoringSkillInput {
  /** File paths to analyze for refactoring */
  files: string[];
  /** Types of refactoring to look for */
  refactoringTypes?: Array<RefactoringSuggestion['type']>;
  /** Minimum priority threshold */
  minPriority?: 'low' | 'medium' | 'high';
}

/**
 * Refactoring skill — identifies code smells and suggests improvements
 */
export class RefactoringSkill
  implements ISkill<RefactoringSkillInput, RefactoringOutput>
{
  readonly name = 'refactoring';
  readonly description = 'Identifies code smells and suggests refactoring improvements';
  readonly tags = ['refactoring', 'quality', 'analysis'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: RefactoringSkillInput,
    context: SkillContext,
  ) => Promise<RefactoringOutput>;

  constructor(options?: {
    executor?: (
      input: RefactoringSkillInput,
      context: SkillContext,
    ) => Promise<RefactoringOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: RefactoringSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as RefactoringSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      Array.isArray(typed.files) &&
      typed.files.length > 0
    );
  }

  async execute(
    input: RefactoringSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<RefactoringOutput>> {
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
      const fallback = createSkillFallback('refactoring', 'no_executor', {
        files: input.files,
      });

      const output: RefactoringOutput = {
        summary: `Analyzed ${input.files.length} file(s) for refactoring opportunities`,
        suggestions: [],
        technicalDebtScore: 0,
        codeHealth: { duplications: 0, complexity: 0, coupling: 0, cohesion: 100 },
        prioritizedOrder: [],
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { fallback },
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
export function createRefactoringSkill(options?: {
  executor?: (
    input: RefactoringSkillInput,
    context: SkillContext,
  ) => Promise<RefactoringOutput>;
}): RefactoringSkill {
  return new RefactoringSkill(options);
}
