/**
 * Development LLM Executor Tests
 */

import {
  createDevelopmentLLMExecutor,
  validateDevelopmentOutput,
} from '../../../../../src/core/orchestrator/llm/development-llm';
import { DevelopmentPrompts } from '../../../../../src/core/orchestrator/llm/prompt-templates';
import type { TaskDocument } from '../../../../../src/core/workspace/task-document';
import type { TeamAgentLLMAdapter } from '../../../../../src/core/orchestrator/llm/team-agent-llm';

// ============================================================================
// Helpers
// ============================================================================

function makeTask(overrides: Partial<{
  title: string;
  type: string;
  content: string;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: 'task-1',
      title: overrides.title || 'Dev Task',
      type: overrides.type || 'feature',
      from: 'planning',
      to: 'development',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: [],
    },
    content: overrides.content || 'Implement feature',
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

const validFeatureOutput = {
  summary: 'Implemented auth module',
  filesModified: [
    { path: 'src/auth.ts', action: 'created' as const, description: 'Auth module' },
    { path: 'src/middleware.ts', action: 'modified' as const, description: 'Added auth middleware' },
  ],
  codeChanges: [
    {
      file: 'src/auth.ts',
      language: 'typescript',
      newCode: 'export function authenticate() {}',
      explanation: 'Basic auth function',
    },
  ],
  tests: ['auth.test.ts'],
  documentation: ['Updated API docs'],
  reviewNotes: ['Check token expiry logic'],
};

const validBugfixOutput = {
  summary: 'Fixed null pointer in login',
  rootCause: 'Missing null check on user object',
  filesModified: [
    { path: 'src/login.ts', action: 'modified' as const, description: 'Added null check' },
  ],
  codeChanges: [
    {
      file: 'src/login.ts',
      language: 'typescript',
      newCode: 'if (user) { /* ... */ }',
      explanation: 'Guard against null user',
    },
  ],
  tests: ['login.test.ts'],
  reviewNotes: ['Verify edge cases'],
};

const validRefactorOutput = {
  summary: 'Extracted validation logic',
  rationale: 'Improve testability and reuse',
  filesModified: [
    { path: 'src/utils.ts', action: 'created' as const, description: 'Validation utils' },
    { path: 'src/form.ts', action: 'modified' as const, description: 'Use extracted utils' },
  ],
  codeChanges: [
    {
      file: 'src/utils.ts',
      language: 'typescript',
      newCode: 'export function validate() {}',
      explanation: 'Extracted from form.ts',
    },
  ],
  improvements: ['Better separation of concerns'],
  reviewNotes: ['No behavior change expected'],
};

// ============================================================================
// Tests
// ============================================================================

describe('createDevelopmentLLMExecutor', () => {
  it('should handle feature task', async () => {
    const adapter = makeMockAdapter(validFeatureOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    const result = await executor(makeTask({ type: 'feature' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      DevelopmentPrompts.featureSystem,
      expect.any(String),
      expect.anything(),
    );
    expect(result.summary).toBe('Implemented auth module');
    expect(result.filesModified).toHaveLength(2);
  });

  it('should handle bugfix task with bugfix system prompt', async () => {
    const adapter = makeMockAdapter(validBugfixOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    await executor(makeTask({ type: 'bugfix' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      DevelopmentPrompts.bugfixSystem,
      expect.any(String),
      expect.anything(),
    );
  });

  it('should handle refactor task with refactor system prompt', async () => {
    const adapter = makeMockAdapter(validRefactorOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    await executor(makeTask({ type: 'refactor' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      DevelopmentPrompts.refactorSystem,
      expect.any(String),
      expect.anything(),
    );
  });

  it('should default to feature system prompt for unknown task types', async () => {
    const adapter = makeMockAdapter(validFeatureOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    await executor(makeTask({ type: 'other' }));

    expect(adapter.execute).toHaveBeenCalledWith(
      DevelopmentPrompts.featureSystem,
      expect.any(String),
      expect.anything(),
    );
  });

  it('should pass project context to prompt', async () => {
    const adapter = makeMockAdapter(validFeatureOutput);
    const executor = createDevelopmentLLMExecutor({
      adapter,
      projectContext: 'Node.js with Express',
    });

    await executor(makeTask());

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('Node.js with Express');
  });

  it('should strip explanation from codeChanges in output', async () => {
    const adapter = makeMockAdapter(validFeatureOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    const result = await executor(makeTask());

    // Output should include file, language, newCode but not explanation
    expect(result.codeChanges?.[0]).toEqual({
      file: 'src/auth.ts',
      language: 'typescript',
      newCode: 'export function authenticate() {}',
    });
  });

  it('should handle missing codeChanges', async () => {
    const output = { ...validFeatureOutput, codeChanges: undefined };
    const adapter = makeMockAdapter(output);
    const executor = createDevelopmentLLMExecutor({ adapter });

    const result = await executor(makeTask());

    expect(result.codeChanges).toBeUndefined();
  });

  it('should pass through tests and reviewNotes', async () => {
    const adapter = makeMockAdapter(validFeatureOutput);
    const executor = createDevelopmentLLMExecutor({ adapter });

    const result = await executor(makeTask());

    expect(result.tests).toEqual(['auth.test.ts']);
    expect(result.reviewNotes).toEqual(['Check token expiry logic']);
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateDevelopmentOutput', () => {
  it('should validate correct output', () => {
    const result = validateDevelopmentOutput(validFeatureOutput);
    expect(result.summary).toBe('Implemented auth module');
    expect(result.filesModified).toHaveLength(2);
  });

  it('should reject invalid output', () => {
    expect(() => validateDevelopmentOutput({ bad: 'data' })).toThrow();
  });

  it('should reject output missing filesModified', () => {
    expect(() => validateDevelopmentOutput({
      summary: 'test',
    })).toThrow();
  });

  it('should accept output with only required fields', () => {
    const minimal = {
      summary: 'Minimal output',
      filesModified: [
        { path: 'src/x.ts', action: 'created', description: 'New file' },
      ],
    };
    const result = validateDevelopmentOutput(minimal);
    expect(result.summary).toBe('Minimal output');
  });
});
