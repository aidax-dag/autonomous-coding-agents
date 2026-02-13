/**
 * Deep Worker LLM Executor Tests
 *
 * Tests ExplorationExecutor and PlanningExecutor for the DeepWorker pipeline.
 */

import {
  createExplorationLLMExecutor,
  createSelfPlanningLLMExecutor,
  validateExplorationResult,
  validateSelfPlanResult,
} from '../../../../../src/core/orchestrator/llm/deep-worker-llm';
import type { DeepWorkerContext, ExplorationResult } from '../../../../../src/core/deep-worker/interfaces/deep-worker.interface';
import type { TeamAgentLLMAdapter } from '../../../../../src/core/orchestrator/llm/team-agent-llm';

// ============================================================================
// Helpers
// ============================================================================

function makeMockAdapter(parsedResult: unknown): TeamAgentLLMAdapter {
  return {
    execute: jest.fn().mockResolvedValue({ parsed: parsedResult }),
  } as unknown as TeamAgentLLMAdapter;
}

function makeContext(overrides: Partial<DeepWorkerContext> = {}): DeepWorkerContext {
  return {
    workspaceDir: '/tmp/test-workspace',
    taskDescription: 'Implement user authentication',
    projectContext: 'Node.js REST API project',
    ...overrides,
  };
}

// ============================================================================
// Fixtures
// ============================================================================

const validExplorationResult = {
  relevantFiles: ['src/auth.ts', 'src/middleware.ts'],
  patterns: ['Middleware Pattern', 'Repository Pattern'],
  dependencies: ['jsonwebtoken', 'bcrypt'],
  summary: 'Found auth-related files and middleware pattern',
};

const validSelfPlanResult = {
  steps: [
    {
      id: 'step-1',
      description: 'Explore auth patterns',
      type: 'explore' as const,
      dependencies: [],
      effort: 'small' as const,
      completed: false,
    },
    {
      id: 'step-2',
      description: 'Implement JWT middleware',
      type: 'implement' as const,
      dependencies: ['step-1'],
      effort: 'medium' as const,
      completed: false,
    },
    {
      id: 'step-3',
      description: 'Write auth tests',
      type: 'test' as const,
      dependencies: ['step-2'],
      effort: 'small' as const,
      completed: false,
    },
  ],
  summary: 'Plan: implement JWT auth with tests',
  totalEffort: 'medium' as const,
};

const explorationForPlanning: ExplorationResult = {
  relevantFiles: ['src/auth.ts'],
  patterns: ['Middleware Pattern'],
  dependencies: ['jsonwebtoken'],
  summary: 'Found auth module',
  duration: 150,
};

// ============================================================================
// Exploration Executor
// ============================================================================

describe('createExplorationLLMExecutor', () => {
  it('should call adapter.execute with exploration prompts', async () => {
    const adapter = makeMockAdapter(validExplorationResult);
    const executor = createExplorationLLMExecutor({ adapter });
    const context = makeContext();

    const result = await executor(context);

    expect(adapter.execute).toHaveBeenCalledWith(
      expect.stringContaining('code exploration specialist'),
      expect.stringContaining('Implement user authentication'),
      expect.anything(),
    );
    expect(result.relevantFiles).toEqual(['src/auth.ts', 'src/middleware.ts']);
    expect(result.patterns).toEqual(['Middleware Pattern', 'Repository Pattern']);
  });

  it('should include workspace directory in prompt', async () => {
    const adapter = makeMockAdapter(validExplorationResult);
    const executor = createExplorationLLMExecutor({ adapter });
    await executor(makeContext({ workspaceDir: '/my/project' }));

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('/my/project');
  });

  it('should include project context when provided', async () => {
    const adapter = makeMockAdapter(validExplorationResult);
    const executor = createExplorationLLMExecutor({ adapter });
    await executor(makeContext({ projectContext: 'Express.js backend' }));

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('Express.js backend');
  });

  it('should set duration from timing', async () => {
    const adapter = makeMockAdapter(validExplorationResult);
    const executor = createExplorationLLMExecutor({ adapter });
    const result = await executor(makeContext());

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });
});

// ============================================================================
// Self-Planning Executor
// ============================================================================

describe('createSelfPlanningLLMExecutor', () => {
  it('should call adapter.execute with planning prompts', async () => {
    const adapter = makeMockAdapter(validSelfPlanResult);
    const executor = createSelfPlanningLLMExecutor({ adapter });
    const context = makeContext();

    const result = await executor(context, explorationForPlanning);

    expect(adapter.execute).toHaveBeenCalledWith(
      expect.stringContaining('planning specialist'),
      expect.stringContaining('Implement user authentication'),
      expect.anything(),
    );
    expect(result.steps).toHaveLength(3);
    expect(result.totalEffort).toBe('medium');
  });

  it('should include exploration results in prompt', async () => {
    const adapter = makeMockAdapter(validSelfPlanResult);
    const executor = createSelfPlanningLLMExecutor({ adapter });
    await executor(makeContext(), explorationForPlanning);

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('Found auth module');
    expect(userPrompt).toContain('src/auth.ts');
    expect(userPrompt).toContain('Middleware Pattern');
    expect(userPrompt).toContain('jsonwebtoken');
  });

  it('should set duration from timing', async () => {
    const adapter = makeMockAdapter(validSelfPlanResult);
    const executor = createSelfPlanningLLMExecutor({ adapter });
    const result = await executor(makeContext(), explorationForPlanning);

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });

  it('should return all steps with correct structure', async () => {
    const adapter = makeMockAdapter(validSelfPlanResult);
    const executor = createSelfPlanningLLMExecutor({ adapter });
    const result = await executor(makeContext(), explorationForPlanning);

    expect(result.steps[0].id).toBe('step-1');
    expect(result.steps[0].type).toBe('explore');
    expect(result.steps[1].dependencies).toEqual(['step-1']);
    expect(result.steps[2].type).toBe('test');
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateExplorationResult', () => {
  it('should validate correct output', () => {
    const result = validateExplorationResult({
      ...validExplorationResult,
      duration: 100,
    });
    expect(result.relevantFiles).toHaveLength(2);
    expect(result.duration).toBe(100);
  });

  it('should default duration to 0 when missing', () => {
    const result = validateExplorationResult(validExplorationResult);
    expect(result.duration).toBe(0);
  });

  it('should reject invalid output', () => {
    expect(() => validateExplorationResult({ bad: 'data' })).toThrow();
  });
});

describe('validateSelfPlanResult', () => {
  it('should validate correct output', () => {
    const result = validateSelfPlanResult({
      ...validSelfPlanResult,
      duration: 200,
    });
    expect(result.steps).toHaveLength(3);
    expect(result.duration).toBe(200);
  });

  it('should default duration to 0 when missing', () => {
    const result = validateSelfPlanResult(validSelfPlanResult);
    expect(result.duration).toBe(0);
  });

  it('should reject invalid step types', () => {
    const invalid = {
      ...validSelfPlanResult,
      steps: [{ ...validSelfPlanResult.steps[0], type: 'invalid' }],
    };
    expect(() => validateSelfPlanResult(invalid)).toThrow();
  });
});
