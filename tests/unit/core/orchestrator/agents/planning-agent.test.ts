/**
 * Planning Agent Tests
 */

import { PlanningAgent, createPlanningAgent } from '../../../../../src/core/orchestrator/agents/planning-agent';
import type { PlanningOutput } from '../../../../../src/core/orchestrator/agents/planning-agent';
import type { DocumentQueue } from '../../../../../src/core/workspace/document-queue';
import type { TaskDocument } from '../../../../../src/core/workspace/task-document';

// ============================================================================
// Helpers
// ============================================================================

function makeMockQueue(): DocumentQueue {
  return {
    publish: jest.fn().mockImplementation(async (input: any) => ({
      metadata: { id: `task-${Date.now()}`, ...input },
      content: input.content || '',
    })),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getTask: jest.fn(),
  } as unknown as DocumentQueue;
}

function makeTask(overrides: Partial<{
  title: string;
  type: string;
  priority: string;
  content: string;
  tags: string[];
  id: string;
  projectId: string;
  files: Array<{ path: string; action: string; description?: string }>;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'planning',
      from: 'orchestrator',
      to: 'planning',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      projectId: overrides.projectId,
      files: overrides.files,
    },
    content: overrides.content || 'Implement a new feature',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('PlanningAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new PlanningAgent({ queue });
      expect(agent.teamType).toBe('planning');
      expect(agent.config.name).toBe('Planning Team');
      expect(agent.canHandle('planning')).toBe(true);
      expect(agent.canHandle('analysis')).toBe(true);
    });

    it('should accept custom config', () => {
      const agent = new PlanningAgent({
        queue,
        config: { name: 'Custom Planning' },
      });
      expect(agent.config.name).toBe('Custom Planning');
    });
  });

  // ==========================================================================
  // processTask - planning
  // ==========================================================================

  describe('processTask - planning', () => {
    it('should generate plan for feature request', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Add a new login feature' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const plan = result.result as PlanningOutput;
      expect(plan.title).toContain('Plan');
      expect(plan.tasks.length).toBeGreaterThan(0);
      // Feature requests generate design, implement, test, review tasks
      expect(plan.tasks.some((t) => t.type === 'feature')).toBe(true);
    });

    it('should generate plan for bug fix', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Fix the login bug that crashes on submit' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const plan = result.result as PlanningOutput;
      expect(plan.tasks.some((t) => t.type === 'bugfix')).toBe(true);
      expect(plan.tasks.some((t) => t.type === 'analysis')).toBe(true);
    });

    it('should generate generic plan for other content', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Review the architecture documentation' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const plan = result.result as PlanningOutput;
      expect(plan.tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('should use custom plan generator when provided', async () => {
      const customPlan: PlanningOutput = {
        title: 'Custom Plan',
        summary: 'Custom summary',
        tasks: [{ title: 'Custom Task', type: 'feature', targetTeam: 'development', description: 'Custom' }],
      };
      const agent = new PlanningAgent({
        queue,
        planGenerator: jest.fn().mockResolvedValue(customPlan),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(true);
      expect((result.result as PlanningOutput).title).toBe('Custom Plan');
    });
  });

  // ==========================================================================
  // processTask - analysis
  // ==========================================================================

  describe('processTask - analysis', () => {
    it('should handle analysis tasks', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'analysis', content: 'Analyze the system performance' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const analysis = result.result as any;
      expect(analysis.title).toContain('Analysis');
    });
  });

  // ==========================================================================
  // autoPublishTasks
  // ==========================================================================

  describe('autoPublishTasks', () => {
    it('should publish sub-tasks when enabled', async () => {
      const agent = new PlanningAgent({ queue, autoPublishTasks: true });
      await agent.start();

      const task = makeTask({ content: 'Build a new dashboard feature' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.outputTasks).toBeDefined();
      expect(result.outputTasks!.length).toBeGreaterThan(0);
      expect(queue.publish).toHaveBeenCalled();
    });

    it('should not publish sub-tasks when disabled', async () => {
      const agent = new PlanningAgent({ queue, autoPublishTasks: false });
      await agent.start();

      const task = makeTask({ content: 'Build a new feature' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.outputTasks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // extractKeyPoints (tested via plan output)
  // ==========================================================================

  describe('content parsing', () => {
    it('should extract risks from content', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: `Implement auth\n\nRisks:\n- Security vulnerability\n- Performance degradation`,
      });
      const result = await agent.processTask(task);
      const plan = result.result as PlanningOutput;

      expect(plan.risks).toBeDefined();
      expect(plan.risks!.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract assumptions from content', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: `Implement API\n\nAssumptions:\n- Users have valid tokens\n- Database is available`,
      });
      const result = await agent.processTask(task);
      const plan = result.result as PlanningOutput;

      expect(plan.assumptions).toBeDefined();
      expect(plan.assumptions!.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // setPlanGenerator
  // ==========================================================================

  describe('setPlanGenerator', () => {
    it('should override plan generation', async () => {
      const agent = new PlanningAgent({ queue });
      await agent.start();

      const customPlan: PlanningOutput = {
        title: 'Override Plan',
        summary: 'Overridden',
        tasks: [],
      };
      agent.setPlanGenerator(jest.fn().mockResolvedValue(customPlan));

      const result = await agent.processTask(makeTask());
      expect((result.result as PlanningOutput).title).toBe('Override Plan');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on generator error', async () => {
      const agent = new PlanningAgent({
        queue,
        planGenerator: jest.fn().mockRejectedValue(new Error('LLM failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createPlanningAgent', () => {
  it('should create PlanningAgent', () => {
    const queue = makeMockQueue();
    const agent = createPlanningAgent(queue);
    expect(agent).toBeInstanceOf(PlanningAgent);
    expect(agent.teamType).toBe('planning');
  });
});
