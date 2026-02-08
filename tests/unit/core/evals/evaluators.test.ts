/**
 * Evaluator Unit Tests
 */

import {
  CodeQualityEvaluator,
  TaskCompletionEvaluator,
  ToolUsageEvaluator,
  type EvalContext,
  type EvalDefinition,
} from '../../../../src/core/evals/index.js';

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  const defaultDef: EvalDefinition = {
    id: 'test',
    name: 'Test',
    category: 'code_quality',
    severity: 'ALWAYS_PASSES',
    timeout: 30000,
    input: { prompt: 'test' },
    expectedBehavior: {},
  };

  return {
    definition: defaultDef,
    output: '',
    toolCalls: [],
    filesModified: [],
    duration: 100,
    workspaceDir: '/tmp/test',
    ...overrides,
  };
}

describe('CodeQualityEvaluator', () => {
  const evaluator = new CodeQualityEvaluator();

  it('should pass when output matches expected patterns', async () => {
    const ctx = makeContext({
      output: 'function validateEmail(email: string) { return /@/.test(email); }',
      definition: {
        ...makeContext().definition,
        expectedBehavior: {
          outputContains: ['function', 'email'],
          outputExcludes: ['TODO'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should fail when output contains excluded pattern', async () => {
    const ctx = makeContext({
      output: '// TODO: implement validation\nfunction stub() {}',
      definition: {
        ...makeContext().definition,
        expectedBehavior: {
          outputExcludes: ['TODO'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(false);
  });

  it('should detect TODO/FIXME in code blocks', async () => {
    const ctx = makeContext({
      output: '```typescript\n// TODO: fix this\nfunction broken() {}\n```',
      definition: {
        ...makeContext().definition,
        expectedBehavior: {},
      },
    });

    const result = await evaluator.evaluate(ctx);
    const todoAssertion = result.assertions.find((a) => a.check.includes('TODO'));
    expect(todoAssertion).toBeDefined();
    expect(todoAssertion!.passed).toBe(false);
  });

  it('should check files modified', async () => {
    const ctx = makeContext({
      filesModified: ['src/index.ts'],
      definition: {
        ...makeContext().definition,
        expectedBehavior: {
          filesModified: ['src/index.ts', 'src/missing.ts'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.score).toBe(0.5);
  });

  it('should pass with minScore threshold', async () => {
    const ctx = makeContext({
      output: 'function test() {}',
      definition: {
        ...makeContext().definition,
        expectedBehavior: {
          outputContains: ['function', 'missing_pattern'],
          minScore: 0.5,
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.5);
  });
});

describe('TaskCompletionEvaluator', () => {
  const evaluator = new TaskCompletionEvaluator();

  it('should pass for non-empty relevant output', async () => {
    const ctx = makeContext({
      output: 'Binary search works by dividing a sorted array in half.',
      definition: {
        ...makeContext().definition,
        category: 'task_completion',
        expectedBehavior: {
          outputContains: ['binary|search'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('should fail for empty output', async () => {
    const ctx = makeContext({
      output: '',
      definition: {
        ...makeContext().definition,
        category: 'task_completion',
        expectedBehavior: {},
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(false);
  });

  it('should check timeout compliance', async () => {
    const ctx = makeContext({
      output: 'Done.',
      duration: 60000,
      definition: {
        ...makeContext().definition,
        category: 'task_completion',
        timeout: 30000,
        expectedBehavior: {},
      },
    });

    const result = await evaluator.evaluate(ctx);
    const timeoutAssertion = result.assertions.find((a) => a.check.includes('timeout'));
    expect(timeoutAssertion).toBeDefined();
    expect(timeoutAssertion!.passed).toBe(false);
  });
});

describe('ToolUsageEvaluator', () => {
  const evaluator = new ToolUsageEvaluator();

  it('should pass when required tools are called', async () => {
    const ctx = makeContext({
      toolCalls: [
        { name: 'read_file', args: { path: 'test.ts' }, timestamp: Date.now() },
        { name: 'search_files', args: { query: 'test' }, timestamp: Date.now() },
      ],
      definition: {
        ...makeContext().definition,
        category: 'tool_usage',
        expectedBehavior: {
          toolsCalled: ['read_file', 'search_files'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should fail when required tool is not called', async () => {
    const ctx = makeContext({
      toolCalls: [],
      definition: {
        ...makeContext().definition,
        category: 'tool_usage',
        expectedBehavior: {
          toolsCalled: ['read_file'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(false);
  });

  it('should fail when forbidden tool is called', async () => {
    const ctx = makeContext({
      toolCalls: [
        { name: 'delete_file', args: { path: 'important.ts' }, timestamp: Date.now() },
      ],
      definition: {
        ...makeContext().definition,
        category: 'tool_usage',
        expectedBehavior: {
          toolsNotCalled: ['delete_file'],
        },
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(false);
  });

  it('should pass when no assertions needed', async () => {
    const ctx = makeContext({
      toolCalls: [],
      definition: {
        ...makeContext().definition,
        category: 'tool_usage',
        expectedBehavior: {},
      },
    });

    const result = await evaluator.evaluate(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });
});
