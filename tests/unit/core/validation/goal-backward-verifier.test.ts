/**
 * GoalBackwardVerifier Tests - TDD RED Phase
 *
 * F003-GoalBackwardVerifier: Goal-backward verification system
 * Tests written first following RED-GREEN TDD pattern
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  GoalBackwardVerifier,
  createGoalBackwardVerifier,
  PLACEHOLDER_PATTERNS,
  MIN_COMPLEXITY_THRESHOLDS,
} from '@/core/validation/goal-backward-verifier.js';

import {
  VerificationStage,
  type GoalDefinition,
  type IGoalBackwardVerifier,
} from '@/core/validation/interfaces/validation.interface.js';

// Test fixtures directory
const TEST_FIXTURES_DIR = '/tmp/goal-verifier-test';

describe('GoalBackwardVerifier', () => {
  let verifier: IGoalBackwardVerifier;

  beforeAll(async () => {
    // Create test fixtures directory
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test fixtures
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    verifier = createGoalBackwardVerifier({ projectRoot: TEST_FIXTURES_DIR });
  });

  describe('Basic Instantiation', () => {
    it('should create a GoalBackwardVerifier instance', () => {
      expect(verifier).toBeDefined();
      expect(verifier).toBeInstanceOf(GoalBackwardVerifier);
    });

    it('should have placeholder patterns defined', () => {
      expect(PLACEHOLDER_PATTERNS).toBeDefined();
      expect(Array.isArray(PLACEHOLDER_PATTERNS)).toBe(true);
      expect(PLACEHOLDER_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should have minimum complexity thresholds defined', () => {
      expect(MIN_COMPLEXITY_THRESHOLDS).toBeDefined();
      expect(MIN_COMPLEXITY_THRESHOLDS.minLines).toBeGreaterThan(0);
      expect(MIN_COMPLEXITY_THRESHOLDS.minFunctions).toBeGreaterThanOrEqual(0);
    });

    it('should use process.cwd() as default project root', () => {
      const defaultVerifier = createGoalBackwardVerifier();
      expect(defaultVerifier).toBeInstanceOf(GoalBackwardVerifier);
    });
  });

  describe('PLACEHOLDER_PATTERNS', () => {
    it('should detect // TODO pattern', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('// TODO: implement'));
      expect(hasMatch).toBe(true);
    });

    it('should detect // FIXME pattern', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('// FIXME: broken'));
      expect(hasMatch).toBe(true);
    });

    it('should detect // HACK pattern', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('// HACK: workaround'));
      expect(hasMatch).toBe(true);
    });

    it('should detect throw not implemented error', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p =>
        p.test('throw new Error("not implemented")')
      );
      expect(hasMatch).toBe(true);
    });

    it('should detect placeholder keyword', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('// placeholder'));
      expect(hasMatch).toBe(true);
    });

    it('should detect stub keyword', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('// stub function'));
      expect(hasMatch).toBe(true);
    });

    it('should detect NotImplementedError', () => {
      const hasMatch = PLACEHOLDER_PATTERNS.some(p => p.test('NotImplementedError'));
      expect(hasMatch).toBe(true);
    });
  });

  describe('verifyExists()', () => {
    beforeEach(async () => {
      // Create test files
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'existing-file.ts'), 'content');
      await fs.mkdir(path.join(TEST_FIXTURES_DIR, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'subdir', 'nested.ts'), 'content');
    });

    afterEach(async () => {
      // Cleanup
      await fs.rm(path.join(TEST_FIXTURES_DIR, 'existing-file.ts'), { force: true });
      await fs.rm(path.join(TEST_FIXTURES_DIR, 'subdir'), { recursive: true, force: true });
    });

    it('should return true when all files exist', async () => {
      const result = await verifier.verifyExists(['existing-file.ts']);
      expect(result).toBe(true);
    });

    it('should return true for nested paths', async () => {
      const result = await verifier.verifyExists(['subdir/nested.ts']);
      expect(result).toBe(true);
    });

    it('should return false when any file is missing', async () => {
      const result = await verifier.verifyExists([
        'existing-file.ts',
        'nonexistent-file.ts',
      ]);
      expect(result).toBe(false);
    });

    it('should return false when all files are missing', async () => {
      const result = await verifier.verifyExists(['nonexistent.ts']);
      expect(result).toBe(false);
    });

    it('should handle empty paths array', async () => {
      const result = await verifier.verifyExists([]);
      expect(result).toBe(true); // No files to check = all exist
    });

    it('should handle multiple existing files', async () => {
      const result = await verifier.verifyExists([
        'existing-file.ts',
        'subdir/nested.ts',
      ]);
      expect(result).toBe(true);
    });
  });

  describe('verifySubstantive()', () => {
    afterEach(async () => {
      // Cleanup test files
      const files = await fs.readdir(TEST_FIXTURES_DIR).catch(() => []);
      for (const file of files) {
        await fs.rm(path.join(TEST_FIXTURES_DIR, file), { recursive: true, force: true });
      }
    });

    it('should return false for file with TODO comment', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'todo-file.ts'),
        '// TODO: implement this\nexport function test() {}'
      );

      const result = await verifier.verifySubstantive(['todo-file.ts']);
      expect(result).toBe(false);
    });

    it('should return false for file with FIXME comment', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'fixme-file.ts'),
        '// FIXME: broken\nexport function test() {}'
      );

      const result = await verifier.verifySubstantive(['fixme-file.ts']);
      expect(result).toBe(false);
    });

    it('should return false for file with throw not implemented', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'not-impl.ts'),
        'export function test() { throw new Error("not implemented"); }'
      );

      const result = await verifier.verifySubstantive(['not-impl.ts']);
      expect(result).toBe(false);
    });

    it('should return false for file with too few lines', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'short-file.ts'),
        'export const x = 1;'
      );

      const result = await verifier.verifySubstantive(['short-file.ts']);
      expect(result).toBe(false);
    });

    it('should return true for real implementation', async () => {
      const realCode = `
import { something } from './module';

export interface Config {
  name: string;
  value: number;
}

export function calculate(a: number, b: number): number {
  if (a < 0 || b < 0) {
    throw new Error('Negative numbers not allowed');
  }
  return a + b;
}

export class Calculator {
  private result: number = 0;

  add(value: number): this {
    this.result += value;
    return this;
  }

  getResult(): number {
    return this.result;
  }
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'real-impl.ts'), realCode);

      const result = await verifier.verifySubstantive(['real-impl.ts']);
      expect(result).toBe(true);
    });

    it('should return false for nonexistent file', async () => {
      const result = await verifier.verifySubstantive(['nonexistent.ts']);
      expect(result).toBe(false);
    });

    it('should check all files and return false if any fails', async () => {
      const realCode = `
export function realFunction(a: number): number {
  const result = a * 2;
  if (result > 100) {
    return 100;
  }
  return result;
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'real.ts'), realCode);
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'placeholder.ts'),
        '// TODO: implement\nexport const x = 1;'
      );

      const result = await verifier.verifySubstantive(['real.ts', 'placeholder.ts']);
      expect(result).toBe(false);
    });
  });

  describe('verifyWired()', () => {
    afterEach(async () => {
      const files = await fs.readdir(TEST_FIXTURES_DIR).catch(() => []);
      for (const file of files) {
        await fs.rm(path.join(TEST_FIXTURES_DIR, file), { recursive: true, force: true });
      }
    });

    it('should return true when file is exported from index.ts', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'module.ts'),
        'export const value = 1;'
      );
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'index.ts'),
        "export { value } from './module';"
      );

      const result = await verifier.verifyWired(['module.ts']);
      expect(result).toBe(true);
    });

    it('should return true when file is imported elsewhere', async () => {
      await fs.mkdir(path.join(TEST_FIXTURES_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'src', 'module.ts'),
        'export const value = 1;'
      );
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'src', 'index.ts'),
        "export { value } from './module';"
      );

      const srcVerifier = createGoalBackwardVerifier({ projectRoot: TEST_FIXTURES_DIR });
      const result = await srcVerifier.verifyWired(['src/module.ts']);
      expect(result).toBe(true);
    });

    it('should handle files without index.ts gracefully', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'standalone.ts'),
        'export const value = 1;'
      );

      // Should not crash, may return true or false based on implementation
      const result = await verifier.verifyWired(['standalone.ts']);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('verify()', () => {
    afterEach(async () => {
      const files = await fs.readdir(TEST_FIXTURES_DIR).catch(() => []);
      for (const file of files) {
        await fs.rm(path.join(TEST_FIXTURES_DIR, file), { recursive: true, force: true });
      }
    });

    it('should return result with all three stages', async () => {
      const realCode = `
export function calculate(a: number, b: number): number {
  const sum = a + b;
  if (sum < 0) {
    throw new Error('Overflow');
  }
  return sum;
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'calc.ts'), realCode);
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'index.ts'),
        "export { calculate } from './calc';"
      );

      const goal: GoalDefinition = {
        description: 'Calculator module',
        expectedPaths: ['calc.ts'],
      };

      const result = await verifier.verify(goal);

      expect(result.stages).toHaveLength(3);
      expect(result.stages[0].stage).toBe(VerificationStage.EXISTS);
      expect(result.stages[1].stage).toBe(VerificationStage.SUBSTANTIVE);
      expect(result.stages[2].stage).toBe(VerificationStage.WIRED);
    });

    it('should pass all stages for valid implementation', async () => {
      const realCode = `
import { Config } from './types';

export interface Result {
  value: number;
  status: string;
}

export function process(config: Config): Result {
  if (!config.enabled) {
    return { value: 0, status: 'disabled' };
  }
  return { value: config.value * 2, status: 'success' };
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'processor.ts'), realCode);
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'index.ts'),
        "export { process } from './processor';"
      );

      const goal: GoalDefinition = {
        description: 'Processor module',
        expectedPaths: ['processor.ts'],
      };

      const result = await verifier.verify(goal);

      expect(result.passed).toBe(true);
      expect(result.stages.every(s => s.passed)).toBe(true);
    });

    it('should fail at EXISTS stage when file is missing', async () => {
      const goal: GoalDefinition = {
        description: 'Missing module',
        expectedPaths: ['nonexistent.ts'],
      };

      const result = await verifier.verify(goal);

      expect(result.passed).toBe(false);
      expect(result.stages[0].stage).toBe(VerificationStage.EXISTS);
      expect(result.stages[0].passed).toBe(false);
      // Should only have 1 stage since it fails early
      expect(result.stages.length).toBe(1);
    });

    it('should fail at SUBSTANTIVE stage for placeholder code', async () => {
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'placeholder.ts'),
        '// TODO: implement\nexport function test() {}'
      );

      const goal: GoalDefinition = {
        description: 'Placeholder module',
        expectedPaths: ['placeholder.ts'],
      };

      const result = await verifier.verify(goal);

      expect(result.passed).toBe(false);
      expect(result.stages[0].passed).toBe(true); // EXISTS passes
      expect(result.stages[1].stage).toBe(VerificationStage.SUBSTANTIVE);
      expect(result.stages[1].passed).toBe(false);
      // Should have 2 stages (stops after SUBSTANTIVE fails)
      expect(result.stages.length).toBe(2);
    });

    it('should include details and checkedPaths in stage results', async () => {
      const realCode = `
export class Service {
  private data: string[] = [];

  add(item: string): void {
    this.data.push(item);
  }

  getAll(): string[] {
    return [...this.data];
  }
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'service.ts'), realCode);
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'index.ts'),
        "export { Service } from './service';"
      );

      const goal: GoalDefinition = {
        description: 'Service module',
        expectedPaths: ['service.ts'],
      };

      const result = await verifier.verify(goal);

      result.stages.forEach(stage => {
        expect(stage).toHaveProperty('details');
        expect(typeof stage.details).toBe('string');
        expect(stage.details.length).toBeGreaterThan(0);
        expect(stage).toHaveProperty('checkedPaths');
        expect(stage.checkedPaths).toContain('service.ts');
      });
    });

    it('should handle multiple paths', async () => {
      const code1 = `
export function func1(x: number): number {
  const result = x * 2;
  return result > 0 ? result : 0;
}
`;
      const code2 = `
export function func2(y: string): string {
  const upper = y.toUpperCase();
  return upper.trim();
}
`;
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'module1.ts'), code1);
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, 'module2.ts'), code2);
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'index.ts'),
        "export { func1 } from './module1';\nexport { func2 } from './module2';"
      );

      const goal: GoalDefinition = {
        description: 'Multiple modules',
        expectedPaths: ['module1.ts', 'module2.ts'],
      };

      const result = await verifier.verify(goal);

      expect(result.passed).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create verifier with default options', () => {
      const instance = createGoalBackwardVerifier();
      expect(instance).toBeInstanceOf(GoalBackwardVerifier);
    });

    it('should create verifier with custom project root', () => {
      const instance = createGoalBackwardVerifier({ projectRoot: '/custom/path' });
      expect(instance).toBeInstanceOf(GoalBackwardVerifier);
    });

    it('should create verifier with custom placeholder patterns', () => {
      const customPatterns = [/CUSTOM_PLACEHOLDER/];
      const instance = createGoalBackwardVerifier({
        placeholderPatterns: customPatterns,
        projectRoot: TEST_FIXTURES_DIR,
      });
      expect(instance).toBeInstanceOf(GoalBackwardVerifier);
    });

    it('should create verifier with custom complexity thresholds', () => {
      const customThresholds = { minLines: 10, minFunctions: 2, minImports: 1 };
      const instance = createGoalBackwardVerifier({
        minComplexity: customThresholds,
        projectRoot: TEST_FIXTURES_DIR,
      });
      expect(instance).toBeInstanceOf(GoalBackwardVerifier);
    });
  });

  describe('Custom Configuration', () => {
    afterEach(async () => {
      const files = await fs.readdir(TEST_FIXTURES_DIR).catch(() => []);
      for (const file of files) {
        await fs.rm(path.join(TEST_FIXTURES_DIR, file), { recursive: true, force: true });
      }
    });

    it('should use custom placeholder patterns', async () => {
      const customPatterns = [/CUSTOM_MARKER/i];
      const customVerifier = createGoalBackwardVerifier({
        projectRoot: TEST_FIXTURES_DIR,
        placeholderPatterns: customPatterns,
      });

      // File with custom marker should fail
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'custom-marker.ts'),
        `
// CUSTOM_MARKER: needs work
export function test(a: number): number {
  return a * 2;
}
`
      );

      const result = await customVerifier.verifySubstantive(['custom-marker.ts']);
      expect(result).toBe(false);

      // File with standard TODO should pass (not in custom patterns)
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'standard-todo.ts'),
        `
// TODO: improve
export function test(a: number): number {
  return a * 2;
}
`
      );

      const result2 = await customVerifier.verifySubstantive(['standard-todo.ts']);
      expect(result2).toBe(true);
    });

    it('should use custom complexity thresholds', async () => {
      const strictVerifier = createGoalBackwardVerifier({
        projectRoot: TEST_FIXTURES_DIR,
        minComplexity: { minLines: 20, minFunctions: 3, minImports: 1 },
      });

      // Short file should fail with strict thresholds
      await fs.writeFile(
        path.join(TEST_FIXTURES_DIR, 'short.ts'),
        `
export function test(a: number): number {
  return a * 2;
}
`
      );

      const result = await strictVerifier.verifySubstantive(['short.ts']);
      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully in verifySubstantive', async () => {
      const result = await verifier.verifySubstantive(['nonexistent.ts']);
      expect(result).toBe(false);
    });

    it('should handle invalid paths gracefully', async () => {
      const result = await verifier.verifyExists(['../../../etc/passwd']);
      // Should handle path traversal attempts safely
      expect(typeof result).toBe('boolean');
    });
  });

  describe('VerificationStage Enum', () => {
    it('should have EXISTS stage', () => {
      expect(VerificationStage.EXISTS).toBe('exists');
    });

    it('should have SUBSTANTIVE stage', () => {
      expect(VerificationStage.SUBSTANTIVE).toBe('substantive');
    });

    it('should have WIRED stage', () => {
      expect(VerificationStage.WIRED).toBe('wired');
    });
  });
});
