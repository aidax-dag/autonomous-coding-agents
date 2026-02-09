/**
 * Code Quality LLM Executor Tests
 */

import {
  CodeQualityPrompts,
  createTestGenerationLLMExecutor,
  createDeepReviewLLMExecutor,
  createRefactoringLLMExecutor,
  validateTestGenerationOutput,
  validateDeepReviewOutput,
  validateRefactoringOutput,
} from '../../../../../src/core/orchestrator/llm/code-quality-llm';
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
    content: overrides.content || 'Generate tests',
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

const validTestGenOutput = {
  summary: 'Generated 3 tests',
  tests: [
    {
      name: 'should validate input',
      type: 'unit' as const,
      code: 'test("validates", () => { expect(true).toBe(true); })',
      target: 'validateInput',
      filePath: 'src/utils.ts',
    },
  ],
  totalGenerated: 1,
  estimatedCoverage: { functions: 80, branches: 70, lines: 85 },
};

const validDeepReviewOutput = {
  summary: 'Code review completed',
  findings: [
    {
      type: 'pattern' as const,
      severity: 'minor' as const,
      category: 'Naming',
      message: 'Consider better naming',
      file: 'src/app.ts',
      lineStart: 10,
    },
  ],
  metrics: { complexity: 30, maintainability: 85, testability: 90, security: 95, overall: 80 },
  approved: true,
  reason: 'Looks good',
  actionItems: ['Fix naming conventions'],
};

const validRefactoringOutput = {
  summary: 'Refactoring analysis complete',
  suggestions: [
    {
      type: 'extract-method' as const,
      priority: 'medium' as const,
      target: { file: 'src/app.ts', lineStart: 10, lineEnd: 30 },
      reason: 'Method too long',
      description: 'Extract validation logic',
      effort: 'easy' as const,
      impact: 'localized' as const,
    },
  ],
  technicalDebtScore: 25,
  codeHealth: { duplications: 5, complexity: 20, coupling: 15, cohesion: 80 },
  prioritizedOrder: ['extract-method'],
};

// ============================================================================
// Tests
// ============================================================================

describe('CodeQualityPrompts', () => {
  describe('testGenerationUser', () => {
    it('should include task title and content', () => {
      const task = makeTask({ title: 'Auth Tests', content: 'Test the auth module' });
      const prompt = CodeQualityPrompts.testGenerationUser(task);

      expect(prompt).toContain('Auth Tests');
      expect(prompt).toContain('Test the auth module');
    });

    it('should include source code when provided', () => {
      const task = makeTask();
      const prompt = CodeQualityPrompts.testGenerationUser(task, 'function add(a, b) { return a + b; }');

      expect(prompt).toContain('Source Code to Test');
      expect(prompt).toContain('function add');
    });

    it('should include file list when available', () => {
      const task = makeTask({
        files: [
          { path: 'src/auth.ts', description: 'Auth module' },
          { path: 'src/utils.ts' },
        ],
      });
      const prompt = CodeQualityPrompts.testGenerationUser(task);

      expect(prompt).toContain('src/auth.ts');
      expect(prompt).toContain('Auth module');
      expect(prompt).toContain('src/utils.ts');
      expect(prompt).toContain('No description');
    });
  });

  describe('deepReviewUser', () => {
    it('should include task title and content', () => {
      const task = makeTask({ title: 'Security Review', content: 'Review auth flow' });
      const prompt = CodeQualityPrompts.deepReviewUser(task);

      expect(prompt).toContain('Security Review');
      expect(prompt).toContain('Review auth flow');
    });

    it('should include code to review', () => {
      const task = makeTask();
      const prompt = CodeQualityPrompts.deepReviewUser(task, 'const secret = "hardcoded";');

      expect(prompt).toContain('Code to Review');
      expect(prompt).toContain('hardcoded');
    });

    it('should include files under review', () => {
      const task = makeTask({ files: [{ path: 'src/login.ts' }] });
      const prompt = CodeQualityPrompts.deepReviewUser(task);

      expect(prompt).toContain('Files Under Review');
      expect(prompt).toContain('src/login.ts');
    });
  });

  describe('refactoringUser', () => {
    it('should include task title and content', () => {
      const task = makeTask({ title: 'Cleanup Utils', content: 'Refactor utility module' });
      const prompt = CodeQualityPrompts.refactoringUser(task);

      expect(prompt).toContain('Cleanup Utils');
      expect(prompt).toContain('Refactor utility module');
    });

    it('should include code to analyze', () => {
      const task = makeTask();
      const prompt = CodeQualityPrompts.refactoringUser(task, 'function doEverything() { /* 500 lines */ }');

      expect(prompt).toContain('Code to Analyze');
      expect(prompt).toContain('doEverything');
    });

    it('should include files to analyze', () => {
      const task = makeTask({ files: [{ path: 'src/utils.ts' }] });
      const prompt = CodeQualityPrompts.refactoringUser(task);

      expect(prompt).toContain('Files to Analyze');
      expect(prompt).toContain('src/utils.ts');
    });
  });

  describe('system prompts', () => {
    it('should have test generation system prompt', () => {
      expect(CodeQualityPrompts.testGenerationSystem).toContain('test engineer');
    });

    it('should have deep review system prompt', () => {
      expect(CodeQualityPrompts.deepReviewSystem).toContain('senior software architect');
    });

    it('should have refactoring system prompt', () => {
      expect(CodeQualityPrompts.refactoringSystem).toContain('refactoring expert');
    });
  });
});

// ============================================================================
// Executor Functions
// ============================================================================

describe('createTestGenerationLLMExecutor', () => {
  it('should create executor that calls adapter and returns parsed output', async () => {
    const adapter = makeMockAdapter(validTestGenOutput);
    const executor = createTestGenerationLLMExecutor({ adapter });

    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      CodeQualityPrompts.testGenerationSystem,
      expect.any(String),
      expect.anything(),
    );
    expect(result.summary).toBe('Generated 3 tests');
    expect(result.totalGenerated).toBe(1);
  });

  it('should pass source code to prompt', async () => {
    const adapter = makeMockAdapter(validTestGenOutput);
    const executor = createTestGenerationLLMExecutor({
      adapter,
      sourceCode: 'function hello() {}',
    });

    await executor(makeTask());

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('function hello()');
  });
});

describe('createDeepReviewLLMExecutor', () => {
  it('should create executor that returns review output', async () => {
    const adapter = makeMockAdapter(validDeepReviewOutput);
    const executor = createDeepReviewLLMExecutor({ adapter });

    const result = await executor(makeTask({ type: 'review' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      CodeQualityPrompts.deepReviewSystem,
      expect.any(String),
      expect.anything(),
    );
    expect(result.approved).toBe(true);
    expect(result.metrics.overall).toBe(80);
  });

  it('should pass code to review', async () => {
    const adapter = makeMockAdapter(validDeepReviewOutput);
    const executor = createDeepReviewLLMExecutor({
      adapter,
      codeToReview: 'const x: any = null;',
    });

    await executor(makeTask({ type: 'review' }));

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('const x: any');
  });
});

describe('createRefactoringLLMExecutor', () => {
  it('should create executor that returns refactoring output', async () => {
    const adapter = makeMockAdapter(validRefactoringOutput);
    const executor = createRefactoringLLMExecutor({ adapter });

    const result = await executor(makeTask({ type: 'refactor' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      CodeQualityPrompts.refactoringSystem,
      expect.any(String),
      expect.anything(),
    );
    expect(result.technicalDebtScore).toBe(25);
  });

  it('should limit suggestions when maxSuggestions is set', async () => {
    const manyRefactoring = {
      ...validRefactoringOutput,
      suggestions: Array.from({ length: 15 }, (_, i) => ({
        ...validRefactoringOutput.suggestions[0],
        description: `Suggestion ${i}`,
      })),
    };

    const adapter = makeMockAdapter(manyRefactoring);
    const executor = createRefactoringLLMExecutor({ adapter, maxSuggestions: 5 });

    const result = await executor(makeTask({ type: 'refactor' }));
    expect(result.suggestions).toHaveLength(5);
  });

  it('should not limit suggestions when count is below max', async () => {
    const adapter = makeMockAdapter(validRefactoringOutput);
    const executor = createRefactoringLLMExecutor({ adapter, maxSuggestions: 10 });

    const result = await executor(makeTask({ type: 'refactor' }));
    expect(result.suggestions).toHaveLength(1);
  });

  it('should pass code to analyze', async () => {
    const adapter = makeMockAdapter(validRefactoringOutput);
    const executor = createRefactoringLLMExecutor({
      adapter,
      codeToAnalyze: 'function bigMethod() { /* long */ }',
    });

    await executor(makeTask({ type: 'refactor' }));

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('bigMethod');
  });
});

// ============================================================================
// Validation Functions
// ============================================================================

describe('validateTestGenerationOutput', () => {
  it('should validate correct output', () => {
    const result = validateTestGenerationOutput(validTestGenOutput);
    expect(result.summary).toBe('Generated 3 tests');
  });

  it('should reject invalid output', () => {
    expect(() => validateTestGenerationOutput({ bad: 'data' })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => validateTestGenerationOutput({
      summary: 'test',
      // missing tests, totalGenerated, estimatedCoverage
    })).toThrow();
  });
});

describe('validateDeepReviewOutput', () => {
  it('should validate correct output', () => {
    const result = validateDeepReviewOutput(validDeepReviewOutput);
    expect(result.approved).toBe(true);
  });

  it('should reject invalid output', () => {
    expect(() => validateDeepReviewOutput({ bad: 'data' })).toThrow();
  });
});

describe('validateRefactoringOutput', () => {
  it('should validate correct output', () => {
    const result = validateRefactoringOutput(validRefactoringOutput);
    expect(result.technicalDebtScore).toBe(25);
  });

  it('should reject invalid output', () => {
    expect(() => validateRefactoringOutput({ bad: 'data' })).toThrow();
  });
});
