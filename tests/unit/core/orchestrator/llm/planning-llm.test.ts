/**
 * Planning LLM Executor Tests
 */

import {
  createPlanningLLMExecutor,
  validatePlanningOutput,
} from '../../../../../src/core/orchestrator/llm/planning-llm';
import { PlanningPrompts } from '../../../../../src/core/orchestrator/llm/prompt-templates';
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
      title: overrides.title || 'Planning Task',
      type: overrides.type || 'planning',
      from: 'orchestrator',
      to: 'planning',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: [],
    },
    content: overrides.content || 'Create implementation plan',
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

const validPlanningOutput = {
  title: 'Plan: Auth System',
  summary: 'Implementation plan for authentication',
  tasks: [
    {
      title: 'Design auth schema',
      type: 'design' as const,
      targetTeam: 'planning' as const,
      description: 'Design database schema for auth',
      dependencies: [],
      estimatedEffort: 'small' as const,
    },
    {
      title: 'Implement JWT middleware',
      type: 'feature' as const,
      targetTeam: 'backend' as const,
      description: 'Create JWT auth middleware',
      dependencies: ['Design auth schema'],
      estimatedEffort: 'medium' as const,
    },
  ],
  phases: [
    {
      name: 'Phase 1: Design',
      taskIndices: [0],
      description: 'Design phase',
    },
    {
      name: 'Phase 2: Implementation',
      taskIndices: [1],
      description: 'Implementation phase',
    },
  ],
  risks: ['Token expiry edge cases'],
  assumptions: ['Using JWT for auth'],
};

const validAnalysisOutput = {
  title: 'Analysis: Performance Audit',
  summary: 'Performance analysis completed',
  findings: ['Database queries are slow', 'No caching layer'],
  recommendations: ['Add Redis cache', 'Optimize queries'],
  risks: ['Migration complexity'],
  nextSteps: ['Profile hot paths', 'Benchmark cache layer'],
};

// ============================================================================
// Tests
// ============================================================================

describe('createPlanningLLMExecutor', () => {
  describe('planning tasks', () => {
    it('should handle planning task', async () => {
      const adapter = makeMockAdapter(validPlanningOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'planning' }));

      expect(adapter.execute).toHaveBeenCalledWith(
        PlanningPrompts.system,
        expect.any(String),
        expect.anything(),
      );
      expect(result.title).toBe('Plan: Auth System');
      expect(result.tasks).toHaveLength(2);
      expect(result.phases).toHaveLength(2);
    });

    it('should return parsed output directly', async () => {
      const adapter = makeMockAdapter(validPlanningOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask());

      expect(result).toEqual(validPlanningOutput);
    });

    it('should pass project context to prompt', async () => {
      const adapter = makeMockAdapter(validPlanningOutput);
      const executor = createPlanningLLMExecutor({
        adapter,
        projectContext: 'Monorepo with 5 packages',
      });

      await executor(makeTask());

      const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
      expect(userPrompt).toContain('Monorepo with 5 packages');
    });
  });

  describe('analysis tasks', () => {
    it('should handle analysis task type', async () => {
      const adapter = makeMockAdapter(validAnalysisOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'analysis' }));

      expect(adapter.execute).toHaveBeenCalledWith(
        PlanningPrompts.analysisSystem,
        expect.any(String),
        expect.anything(),
      );
      expect(result.title).toBe('Analysis: Performance Audit');
      expect(result.summary).toBe('Performance analysis completed');
    });

    it('should convert nextSteps to tasks', async () => {
      const adapter = makeMockAdapter(validAnalysisOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'analysis' }));

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Step 1: Profile hot paths');
      expect(result.tasks[0].type).toBe('analysis');
      expect(result.tasks[0].targetTeam).toBe('planning');
      expect(result.tasks[1].title).toBe('Step 2: Benchmark cache layer');
    });

    it('should map findings to assumptions', async () => {
      const adapter = makeMockAdapter(validAnalysisOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'analysis' }));

      expect(result.assumptions).toEqual(['Database queries are slow', 'No caching layer']);
    });

    it('should pass through risks', async () => {
      const adapter = makeMockAdapter(validAnalysisOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'analysis' }));

      expect(result.risks).toEqual(['Migration complexity']);
    });

    it('should handle empty nextSteps', async () => {
      const output = { ...validAnalysisOutput, nextSteps: undefined };
      const adapter = makeMockAdapter(output);
      const executor = createPlanningLLMExecutor({ adapter });

      const result = await executor(makeTask({ type: 'analysis' }));

      expect(result.tasks).toEqual([]);
    });
  });

  describe('non-analysis non-planning types', () => {
    it('should use planning system prompt for feature type', async () => {
      const adapter = makeMockAdapter(validPlanningOutput);
      const executor = createPlanningLLMExecutor({ adapter });

      await executor(makeTask({ type: 'feature' }));

      expect(adapter.execute).toHaveBeenCalledWith(
        PlanningPrompts.system,
        expect.any(String),
        expect.anything(),
      );
    });
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validatePlanningOutput', () => {
  it('should validate correct output', () => {
    const result = validatePlanningOutput(validPlanningOutput);
    expect(result.title).toBe('Plan: Auth System');
    expect(result.tasks).toHaveLength(2);
  });

  it('should reject invalid output', () => {
    expect(() => validatePlanningOutput({ bad: 'data' })).toThrow();
  });

  it('should reject output missing tasks', () => {
    expect(() => validatePlanningOutput({
      title: 'Plan',
      summary: 'test',
    })).toThrow();
  });

  it('should accept output with only required fields', () => {
    const minimal = {
      title: 'Minimal Plan',
      summary: 'Basic plan',
      tasks: [
        {
          title: 'Task 1',
          type: 'feature',
          targetTeam: 'development',
          description: 'Do something',
        },
      ],
    };
    const result = validatePlanningOutput(minimal);
    expect(result.title).toBe('Minimal Plan');
  });

  it('should reject invalid task type', () => {
    const invalid = {
      title: 'Bad Plan',
      summary: 'test',
      tasks: [
        {
          title: 'Task 1',
          type: 'invalid-type',
          targetTeam: 'development',
          description: 'Do something',
        },
      ],
    };
    expect(() => validatePlanningOutput(invalid)).toThrow();
  });

  it('should reject invalid targetTeam', () => {
    const invalid = {
      title: 'Bad Plan',
      summary: 'test',
      tasks: [
        {
          title: 'Task 1',
          type: 'feature',
          targetTeam: 'nonexistent-team',
          description: 'Do something',
        },
      ],
    };
    expect(() => validatePlanningOutput(invalid)).toThrow();
  });
});
