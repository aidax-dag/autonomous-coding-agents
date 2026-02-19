/**
 * TDD Workflow Skill
 *
 * Implements test-driven development workflow: write tests first, then implementation.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

/**
 * A generated test case in TDD workflow
 */
export interface TddTestCase {
  name: string;
  description: string;
  code: string;
}

/**
 * Input for TDD workflow skill
 */
export interface TddWorkflowSkillInput {
  /** Feature to implement */
  feature: string;
  /** Related file paths */
  files?: string[];
  /** Testing framework to use */
  framework?: string;
}

/**
 * Output from TDD workflow skill
 */
export interface TddWorkflowSkillOutput {
  /** Generated test cases (Red phase) */
  tests: TddTestCase[];
  /** Implementation code (Green phase) */
  implementation: string;
  /** Refactoring suggestions (Refactor phase) */
  refactorSuggestions: string[];
}

/**
 * TDD workflow skill — implements test-driven development cycles
 */
export class TddWorkflowSkill extends BaseSkill<TddWorkflowSkillInput, TddWorkflowSkillOutput> {
  readonly name = 'tdd-workflow';
  readonly description = 'Implements test-driven development workflow with Red-Green-Refactor cycle';
  readonly tags = ['tdd', 'testing', 'workflow'] as const;
  protected readonly validationError = 'Invalid input: feature description is required';

  validate(input: TddWorkflowSkillInput): boolean {
    return typeof input.feature === 'string' && input.feature.length > 0;
  }

  protected createFallbackOutput(input: TddWorkflowSkillInput): TddWorkflowSkillOutput {
    const framework = input.framework ?? 'jest';

    return {
      tests: [
        {
          name: `test ${input.feature}`,
          description: `Verify ${input.feature} works correctly`,
          code: `describe('${input.feature}', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});`,
        },
      ],
      implementation: `// Implementation stub for: ${input.feature}\n// Framework: ${framework}`,
      refactorSuggestions: [],
    };
  }
}

/**
 * Factory function
 */
export function createTddWorkflowSkill(options?: {
  executor?: (
    input: TddWorkflowSkillInput,
    context: SkillContext,
  ) => Promise<TddWorkflowSkillOutput>;
}): TddWorkflowSkill {
  return new TddWorkflowSkill(options);
}
