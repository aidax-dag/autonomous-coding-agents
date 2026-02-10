/**
 * Test Generation Skill
 *
 * Extracted from CodeQualityAgent — generates unit/integration/e2e tests.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import type {
  TestGenerationOutput,
  GeneratedTestCase,
} from '../../orchestrator/agents/code-quality-agent';

/**
 * Input for test generation skill
 */
export interface TestGenerationSkillInput {
  /** Source file paths to generate tests for */
  sourceFiles: string[];
  /** Test types to generate */
  testTypes?: Array<'unit' | 'integration' | 'e2e'>;
  /** Testing framework (e.g., 'jest', 'mocha', 'vitest') */
  framework?: string;
  /** Target coverage percentage */
  targetCoverage?: number;
}

/**
 * Test generation skill — creates tests for source code
 */
export class TestGenerationSkill
  implements ISkill<TestGenerationSkillInput, TestGenerationOutput>
{
  readonly name = 'test-generation';
  readonly description = 'Generates unit, integration, and e2e tests for source code';
  readonly tags = ['testing', 'generation', 'quality'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: TestGenerationSkillInput,
    context: SkillContext,
  ) => Promise<TestGenerationOutput>;

  constructor(options?: {
    executor?: (
      input: TestGenerationSkillInput,
      context: SkillContext,
    ) => Promise<TestGenerationOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: TestGenerationSkillInput): boolean {
    return Array.isArray(input.sourceFiles) && input.sourceFiles.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as TestGenerationSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      Array.isArray(typed.sourceFiles) &&
      typed.sourceFiles.length > 0
    );
  }

  async execute(
    input: TestGenerationSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<TestGenerationOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: sourceFiles array is required',
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
      const tests: GeneratedTestCase[] = input.sourceFiles.map((file) => ({
        name: `test ${file}`,
        type: 'unit' as const,
        code: `describe('${file}', () => { it('should work', () => { expect(true).toBe(true); }); });`,
        target: file,
        filePath: file.replace(/\.ts$/, '.test.ts'),
      }));

      const output: TestGenerationOutput = {
        summary: `Generated ${tests.length} test(s)`,
        tests,
        totalGenerated: tests.length,
        estimatedCoverage: { functions: 0, branches: 0, lines: 0 },
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
export function createTestGenerationSkill(options?: {
  executor?: (
    input: TestGenerationSkillInput,
    context: SkillContext,
  ) => Promise<TestGenerationOutput>;
}): TestGenerationSkill {
  return new TestGenerationSkill(options);
}
