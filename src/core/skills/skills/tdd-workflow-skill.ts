/**
 * TDD Workflow Skill
 *
 * Implements test-driven development workflow: write tests first, then implementation.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

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
export class TddWorkflowSkill
  implements ISkill<TddWorkflowSkillInput, TddWorkflowSkillOutput>
{
  readonly name = 'tdd-workflow';
  readonly description = 'Implements test-driven development workflow with Red-Green-Refactor cycle';
  readonly tags = ['tdd', 'testing', 'workflow'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: TddWorkflowSkillInput,
    context: SkillContext,
  ) => Promise<TddWorkflowSkillOutput>;

  constructor(options?: {
    executor?: (
      input: TddWorkflowSkillInput,
      context: SkillContext,
    ) => Promise<TddWorkflowSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: TddWorkflowSkillInput): boolean {
    return typeof input.feature === 'string' && input.feature.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as TddWorkflowSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.feature === 'string' &&
      typed.feature.length > 0
    );
  }

  async execute(
    input: TddWorkflowSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<TddWorkflowSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: feature description is required',
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
      const framework = input.framework ?? 'jest';
      const output: TddWorkflowSkillOutput = {
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
export function createTddWorkflowSkill(options?: {
  executor?: (
    input: TddWorkflowSkillInput,
    context: SkillContext,
  ) => Promise<TddWorkflowSkillOutput>;
}): TddWorkflowSkill {
  return new TddWorkflowSkill(options);
}
