/**
 * QA LLM Executor Tests
 */

import {
  createQALLMExecutor,
  validateQAOutput,
  createTestResult,
} from '../../../../../src/core/orchestrator/llm/qa-llm';
import type { TaskDocument } from '../../../../../src/core/workspace/task-document';
import type { TeamAgentLLMAdapter } from '../../../../../src/core/orchestrator/llm/team-agent-llm';

// ============================================================================
// Helpers
// ============================================================================

function makeTask(overrides: Partial<{
  title: string;
  type: string;
  content: string;
  files: Array<{ path: string; description?: string }>;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'test',
      from: 'development',
      to: 'qa',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: overrides.files || [],
    },
    content: overrides.content || 'Run QA checks',
  } as unknown as TaskDocument;
}

function makeMockAdapter(parsedResult: unknown): TeamAgentLLMAdapter {
  return {
    execute: jest.fn().mockResolvedValue({ parsed: parsedResult }),
  } as unknown as TeamAgentLLMAdapter;
}

// ============================================================================
// Valid Output Fixtures
// ============================================================================

const validTestOutput = {
  summary: 'All tests passed',
  testResults: {
    total: 5,
    passed: 5,
    failed: 0,
    skipped: 0,
    tests: [
      { name: 'should validate input', status: 'passed' as const, duration: 50 },
      { name: 'should reject invalid', status: 'passed' as const, duration: 30 },
    ],
  },
  coverage: { lines: 90, branches: 80, functions: 95, statements: 88 },
  qualityScore: 85,
  recommendations: ['Add edge case tests'],
  approved: true,
  reason: 'All checks passed',
};

const validReviewOutput = {
  summary: 'Code review completed',
  reviewFindings: [
    {
      severity: 'minor' as const,
      category: 'style',
      message: 'Use const instead of let',
      file: 'src/app.ts',
      line: 10,
    },
  ],
  qualityScore: 80,
  recommendations: ['Fix style issues'],
  approved: true,
  reason: 'Minor issues only',
};

// ============================================================================
// Tests
// ============================================================================

describe('createQALLMExecutor', () => {
  describe('review tasks', () => {
    it('should handle review task type', async () => {
      const adapter = makeMockAdapter(validReviewOutput);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'review' }));

      expect(result.summary).toBe('Code review completed');
      expect(result.approved).toBe(true);
      expect(result.reviewFindings).toHaveLength(1);
    });

    it('should pass code to review prompt', async () => {
      const adapter = makeMockAdapter(validReviewOutput);
      const executor = createQALLMExecutor({
        adapter,
        codeToReview: 'function broken() {}',
      });

      await executor(makeTask({ type: 'review' }));

      const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
      expect(userPrompt).toContain('function broken()');
    });
  });

  describe('test tasks', () => {
    it('should handle test task type', async () => {
      const adapter = makeMockAdapter(validTestOutput);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      expect(result.summary).toBe('All tests passed');
      expect(result.testResults?.total).toBe(5);
      expect(result.coverage?.lines).toBe(90);
    });

    it('should pass project context to prompt', async () => {
      const adapter = makeMockAdapter(validTestOutput);
      const executor = createQALLMExecutor({
        adapter,
        projectContext: 'TypeScript project with Jest',
      });

      await executor(makeTask({ type: 'test' }));

      const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
      expect(userPrompt).toContain('TypeScript project with Jest');
    });

    it('should approve when tests pass and quality is above threshold', async () => {
      const output = { ...validTestOutput, approved: undefined as unknown as boolean };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter, minQualityScore: 80 });

      const result = await executor(makeTask({ type: 'test' }));

      // qualityScore=85 >= minQualityScore=80, failed=0 → approved
      expect(result.approved).toBe(true);
    });

    it('should reject when quality is below threshold', async () => {
      const output = {
        ...validTestOutput,
        qualityScore: 50,
        approved: undefined as unknown as boolean,
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter, minQualityScore: 70 });

      const result = await executor(makeTask({ type: 'test' }));

      // qualityScore=50 < 70 → not approved
      expect(result.approved).toBe(false);
    });

    it('should reject when tests fail', async () => {
      const output = {
        ...validTestOutput,
        testResults: { ...validTestOutput.testResults, failed: 2 },
        qualityScore: 90,
        approved: undefined as unknown as boolean,
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      // failed > 0 → not approved even with high quality score
      expect(result.approved).toBe(false);
    });

    it('should use explicit approved value when provided', async () => {
      const output = {
        ...validTestOutput,
        testResults: { ...validTestOutput.testResults, failed: 2 },
        qualityScore: 50,
        approved: true, // explicit override
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      expect(result.approved).toBe(true);
    });

    it('should default quality score to 0 when missing', async () => {
      const output = {
        ...validTestOutput,
        qualityScore: undefined,
        approved: undefined as unknown as boolean,
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      expect(result.qualityScore).toBe(0);
    });

    it('should provide default reason', async () => {
      const output = {
        ...validTestOutput,
        reason: undefined,
        approved: true,
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      expect(result.reason).toBe('All checks passed');
    });

    it('should provide failure reason when not approved', async () => {
      const output = {
        ...validTestOutput,
        reason: undefined,
        approved: undefined as unknown as boolean,
        qualityScore: 30,
      };
      const adapter = makeMockAdapter(output);
      const executor = createQALLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'test' }));

      expect(result.reason).toBe('Quality requirements not met');
    });
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateQAOutput', () => {
  it('should validate test output', () => {
    const result = validateQAOutput(validTestOutput);
    expect(result.summary).toBe('All tests passed');
  });

  it('should validate review output', () => {
    const result = validateQAOutput(validReviewOutput);
    expect(result.summary).toBe('Code review completed');
  });

  it('should reject invalid output', () => {
    expect(() => validateQAOutput({ bad: 'data' })).toThrow();
  });

  it('should reject output missing required fields', () => {
    expect(() => validateQAOutput({ summary: 'test' })).toThrow();
  });
});

// ============================================================================
// createTestResult
// ============================================================================

describe('createTestResult', () => {
  it('should create passed test result', () => {
    const result = createTestResult('my-test', 'passed');
    expect(result.name).toBe('my-test');
    expect(result.status).toBe('passed');
    expect(result.duration).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should create failed test result with options', () => {
    const result = createTestResult('fail-test', 'failed', {
      duration: 200,
      error: 'assertion failed',
    });
    expect(result.status).toBe('failed');
    expect(result.duration).toBe(200);
    expect(result.error).toBe('assertion failed');
  });

  it('should create skipped test result', () => {
    const result = createTestResult('skip-test', 'skipped');
    expect(result.status).toBe('skipped');
  });
});
