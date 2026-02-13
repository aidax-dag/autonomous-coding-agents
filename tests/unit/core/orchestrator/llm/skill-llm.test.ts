/**
 * Skill LLM Executor Tests
 *
 * Tests all 8 skill LLM executor factories:
 * - Planning, CodeReview, TestGeneration, Refactoring (reusing agent schemas)
 * - SecurityScan, Debugging, Documentation, Performance (new schemas)
 */

import {
  createPlanningSkillLLMExecutor,
  createCodeReviewSkillLLMExecutor,
  createTestGenerationSkillLLMExecutor,
  createRefactoringSkillLLMExecutor,
  createSecurityScanSkillLLMExecutor,
  createDebuggingSkillLLMExecutor,
  createDocumentationSkillLLMExecutor,
  createPerformanceSkillLLMExecutor,
} from '@/core/orchestrator/llm/skill-llm';
import type { TeamAgentLLMAdapter } from '@/core/orchestrator/llm/team-agent-llm';
import type { SkillContext } from '@/core/skills/interfaces/skill.interface';

// ============================================================================
// Mock Adapter
// ============================================================================

function createMockAdapter(parsedResponse: unknown): TeamAgentLLMAdapter {
  return {
    execute: jest.fn().mockResolvedValue({
      parsed: parsedResponse,
      raw: JSON.stringify(parsedResponse),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'mock-model',
    }),
  } as unknown as TeamAgentLLMAdapter;
}

const defaultContext: SkillContext = {
  workspaceDir: '/test/workspace',
  projectContext: 'Test project context',
};

// ============================================================================
// Planning Skill Executor
// ============================================================================

describe('createPlanningSkillLLMExecutor', () => {
  const mockOutput = {
    title: 'Plan: Test Goal',
    summary: 'Test plan summary',
    tasks: [
      {
        title: 'Task 1',
        type: 'feature',
        targetTeam: 'development',
        description: 'Test task',
        estimatedEffort: 'medium',
      },
    ],
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPlanningSkillLLMExecutor({ adapter });
    await executor({ goal: 'Build a feature' }, defaultContext);

    expect(adapter.execute).toHaveBeenCalledTimes(1);
    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('planning expert');
  });

  it('should include goal in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPlanningSkillLLMExecutor({ adapter });
    await executor({ goal: 'Build authentication system' }, defaultContext);

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('Build authentication system');
  });

  it('should include constraints and maxTasks in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPlanningSkillLLMExecutor({ adapter });
    await executor(
      { goal: 'Test', constraints: ['No external deps'], maxTasks: 5 },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('No external deps');
    expect(userPrompt).toContain('Maximum 5');
  });

  it('should include projectContext from options', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPlanningSkillLLMExecutor({
      adapter,
      projectContext: 'Custom project context',
    });
    await executor({ goal: 'Test' }, { workspaceDir: '/test' });

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('Custom project context');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPlanningSkillLLMExecutor({ adapter });
    const result = await executor({ goal: 'Test' }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Code Review Skill Executor
// ============================================================================

describe('createCodeReviewSkillLLMExecutor', () => {
  const mockOutput = {
    summary: 'Review summary',
    findings: [],
    metrics: { complexity: 50, maintainability: 80, testability: 70, security: 90, overall: 72 },
    approved: true,
    reason: 'Code looks good',
    actionItems: [],
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createCodeReviewSkillLLMExecutor({ adapter });
    await executor({ files: ['src/index.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('code reviewer');
  });

  it('should include files in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createCodeReviewSkillLLMExecutor({ adapter });
    await executor({ files: ['src/auth.ts', 'src/login.ts'] }, defaultContext);

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/auth.ts');
    expect(userPrompt).toContain('src/login.ts');
  });

  it('should include focus areas in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createCodeReviewSkillLLMExecutor({ adapter });
    await executor(
      { files: ['test.ts'], focus: ['security', 'performance'] },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('security');
    expect(userPrompt).toContain('performance');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createCodeReviewSkillLLMExecutor({ adapter });
    const result = await executor({ files: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Test Generation Skill Executor
// ============================================================================

describe('createTestGenerationSkillLLMExecutor', () => {
  const mockOutput = {
    summary: 'Generated 5 tests',
    tests: [
      {
        name: 'test_login',
        type: 'unit',
        code: 'test("login", () => {})',
        target: 'login',
        filePath: 'tests/login.test.ts',
      },
    ],
    totalGenerated: 1,
    estimatedCoverage: { functions: 80, branches: 60, lines: 75 },
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createTestGenerationSkillLLMExecutor({ adapter });
    await executor({ sourceFiles: ['src/auth.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('test engineering expert');
  });

  it('should include sourceFiles in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createTestGenerationSkillLLMExecutor({ adapter });
    await executor({ sourceFiles: ['src/auth.ts', 'src/login.ts'] }, defaultContext);

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/auth.ts');
    expect(userPrompt).toContain('src/login.ts');
  });

  it('should include framework and targetCoverage in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createTestGenerationSkillLLMExecutor({ adapter });
    await executor(
      { sourceFiles: ['test.ts'], framework: 'jest', targetCoverage: 90 },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('jest');
    expect(userPrompt).toContain('90%');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createTestGenerationSkillLLMExecutor({ adapter });
    const result = await executor({ sourceFiles: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Refactoring Skill Executor
// ============================================================================

describe('createRefactoringSkillLLMExecutor', () => {
  const mockOutput = {
    summary: 'Found 3 refactoring opportunities',
    suggestions: [],
    technicalDebtScore: 45,
    codeHealth: { duplications: 20, complexity: 60, coupling: 30, cohesion: 70 },
    prioritizedOrder: [],
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createRefactoringSkillLLMExecutor({ adapter });
    await executor({ files: ['src/index.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('refactoring expert');
  });

  it('should include files in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createRefactoringSkillLLMExecutor({ adapter });
    await executor({ files: ['src/big-file.ts'] }, defaultContext);

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/big-file.ts');
  });

  it('should include refactoringTypes and minPriority in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createRefactoringSkillLLMExecutor({ adapter });
    await executor(
      { files: ['test.ts'], refactoringTypes: ['extract-method', 'rename'], minPriority: 'high' },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('extract-method');
    expect(userPrompt).toContain('high');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createRefactoringSkillLLMExecutor({ adapter });
    const result = await executor({ files: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Security Scan Skill Executor
// ============================================================================

describe('createSecurityScanSkillLLMExecutor', () => {
  const mockOutput = {
    findings: [
      { file: 'src/auth.ts', line: 42, severity: 'high', category: 'injection', message: 'SQL injection risk' },
    ],
    summary: 'Found 1 high severity issue',
    score: 70,
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createSecurityScanSkillLLMExecutor({ adapter });
    await executor({ files: ['src/auth.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('security analyst');
  });

  it('should include files and checks in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createSecurityScanSkillLLMExecutor({ adapter });
    await executor(
      { files: ['src/api.ts'], checks: ['injection', 'xss'] },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/api.ts');
    expect(userPrompt).toContain('injection');
    expect(userPrompt).toContain('xss');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createSecurityScanSkillLLMExecutor({ adapter });
    const result = await executor({ files: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Debugging Skill Executor
// ============================================================================

describe('createDebuggingSkillLLMExecutor', () => {
  const mockOutput = {
    rootCause: 'Null pointer dereference',
    hypothesis: ['Uninitialized variable', 'Race condition'],
    suggestedFixes: [
      { description: 'Add null check', file: 'src/app.ts', code: 'if (x != null)' },
    ],
    confidence: 0.85,
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDebuggingSkillLLMExecutor({ adapter });
    await executor({ error: 'TypeError: Cannot read property' }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('debugging expert');
  });

  it('should include error and stackTrace in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDebuggingSkillLLMExecutor({ adapter });
    await executor(
      {
        error: 'TypeError: Cannot read property',
        stackTrace: 'at line 42 in app.ts',
        context: 'Happens during login',
        files: ['src/app.ts'],
      },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('TypeError: Cannot read property');
    expect(userPrompt).toContain('at line 42 in app.ts');
    expect(userPrompt).toContain('Happens during login');
    expect(userPrompt).toContain('src/app.ts');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDebuggingSkillLLMExecutor({ adapter });
    const result = await executor({ error: 'Test error' }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Documentation Skill Executor
// ============================================================================

describe('createDocumentationSkillLLMExecutor', () => {
  const mockOutput = {
    documents: [
      { path: 'docs/auth.md', content: '# Authentication\n...', format: 'markdown' },
    ],
    summary: 'Generated 1 document',
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDocumentationSkillLLMExecutor({ adapter });
    await executor({ files: ['src/auth.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('documentation expert');
  });

  it('should include files, format, and scope in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDocumentationSkillLLMExecutor({ adapter });
    await executor(
      { files: ['src/auth.ts'], format: 'jsdoc', scope: 'api' },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/auth.ts');
    expect(userPrompt).toContain('jsdoc');
    expect(userPrompt).toContain('api');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createDocumentationSkillLLMExecutor({ adapter });
    const result = await executor({ files: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Performance Skill Executor
// ============================================================================

describe('createPerformanceSkillLLMExecutor', () => {
  const mockOutput = {
    findings: [
      { file: 'src/data.ts', issue: 'O(n^2) loop', impact: 'high', suggestion: 'Use a Set for lookup' },
    ],
    overallScore: 65,
    bottlenecks: ['Nested loop in processData()'],
  };

  it('should call adapter.execute with correct system prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPerformanceSkillLLMExecutor({ adapter });
    await executor({ files: ['src/data.ts'] }, defaultContext);

    const [systemPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('performance engineer');
  });

  it('should include files and metrics in user prompt', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPerformanceSkillLLMExecutor({ adapter });
    await executor(
      { files: ['src/data.ts'], metrics: ['time', 'memory'], threshold: 80 },
      defaultContext,
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('src/data.ts');
    expect(userPrompt).toContain('time');
    expect(userPrompt).toContain('memory');
    expect(userPrompt).toContain('80');
  });

  it('should return parsed output directly', async () => {
    const adapter = createMockAdapter(mockOutput);
    const executor = createPerformanceSkillLLMExecutor({ adapter });
    const result = await executor({ files: ['test.ts'] }, defaultContext);

    expect(result).toEqual(mockOutput);
  });
});

// ============================================================================
// Cross-cutting concerns
// ============================================================================

describe('Skill LLM Executor cross-cutting', () => {
  it('should use context.projectContext when options.projectContext is absent', async () => {
    const mockOutput = { rootCause: 'test', hypothesis: [], suggestedFixes: [], confidence: 0.5 };
    const adapter = createMockAdapter(mockOutput);
    const executor = createDebuggingSkillLLMExecutor({ adapter });

    await executor(
      { error: 'Error' },
      { workspaceDir: '/test', projectContext: 'From context' },
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('From context');
  });

  it('should prefer options.projectContext over context.projectContext', async () => {
    const mockOutput = { rootCause: 'test', hypothesis: [], suggestedFixes: [], confidence: 0.5 };
    const adapter = createMockAdapter(mockOutput);
    const executor = createDebuggingSkillLLMExecutor({
      adapter,
      projectContext: 'From options',
    });

    await executor(
      { error: 'Error' },
      { workspaceDir: '/test', projectContext: 'From context' },
    );

    const [, userPrompt] = (adapter.execute as jest.Mock).mock.calls[0];
    expect(userPrompt).toContain('From options');
  });
});
