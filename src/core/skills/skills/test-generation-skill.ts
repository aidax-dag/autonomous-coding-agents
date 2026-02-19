/**
 * Test Generation Skill
 *
 * Extracted from CodeQualityAgent — generates unit/integration/e2e tests.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import type {
  TestGenerationOutput,
  GeneratedTestCase,
} from '../../orchestrator/agents/code-quality-agent';
import { BaseSkill } from '../base-skill';

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
export class TestGenerationSkill extends BaseSkill<TestGenerationSkillInput, TestGenerationOutput> {
  readonly name = 'test-generation';
  readonly description = 'Generates unit, integration, and e2e tests for source code';
  readonly tags = ['testing', 'generation', 'quality'] as const;
  protected readonly validationError = 'Invalid input: sourceFiles array is required';

  validate(input: TestGenerationSkillInput): boolean {
    return Array.isArray(input.sourceFiles) && input.sourceFiles.length > 0;
  }

  protected createFallbackOutput(input: TestGenerationSkillInput): TestGenerationOutput {
    const tests: GeneratedTestCase[] = input.sourceFiles.map((file) => ({
      name: `test ${file}`,
      type: 'unit' as const,
      code: `describe('${file}', () => { it('should work', () => { expect(true).toBe(true); }); });`,
      target: file,
      filePath: file.replace(/\.ts$/, '.test.ts'),
    }));

    return {
      summary: `Generated ${tests.length} test(s)`,
      tests,
      totalGenerated: tests.length,
      estimatedCoverage: { functions: 0, branches: 0, lines: 0 },
    };
  }

  protected createFallbackContext(input: TestGenerationSkillInput): Record<string, unknown> {
    return {
      sourceFiles: input.sourceFiles,
      testTypes: input.testTypes,
    };
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
