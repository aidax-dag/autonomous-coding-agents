/**
 * Refactoring Skill
 *
 * Extracted from CodeQualityAgent — identifies code smells and suggests refactorings.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import type {
  RefactoringOutput,
  RefactoringSuggestion,
} from '../../orchestrator/agents/code-quality-agent';
import { BaseSkill } from '../base-skill';

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
export class RefactoringSkill extends BaseSkill<RefactoringSkillInput, RefactoringOutput> {
  readonly name = 'refactoring';
  readonly description = 'Identifies code smells and suggests refactoring improvements';
  readonly tags = ['refactoring', 'quality', 'analysis'] as const;
  protected readonly validationError = 'Invalid input: files array is required';

  validate(input: RefactoringSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  protected createFallbackOutput(input: RefactoringSkillInput): RefactoringOutput {
    return {
      summary: `Analyzed ${input.files.length} file(s) for refactoring opportunities`,
      suggestions: [],
      technicalDebtScore: 0,
      codeHealth: { duplications: 0, complexity: 0, coupling: 0, cohesion: 100 },
      prioritizedOrder: [],
    };
  }

  protected createFallbackContext(input: RefactoringSkillInput): Record<string, unknown> {
    return {
      files: input.files,
    };
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
