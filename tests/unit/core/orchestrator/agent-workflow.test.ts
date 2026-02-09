/**
 * Agent Workflow Tests
 */

import {
  AgentWorkflow,
  createAgentWorkflow,
  createMockWorkflow,
} from '../../../../src/core/orchestrator/agent-workflow';
import {
  RunnerStatus,
} from '../../../../src/core/orchestrator/orchestrator-runner';

// ============================================================================
// Mocks — created inside jest.mock factory to avoid hoisting issues
// ============================================================================

jest.mock('../../../../src/core/orchestrator/orchestrator-runner', () => {
  // Define RunnerStatus values directly (enum is compiled to string values)
  const RunnerStatusEnum = {
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    RUNNING: 'running',
    PAUSED: 'paused',
    STOPPING: 'stopping',
    STOPPED: 'stopped',
    ERROR: 'error',
  };

  const _mockStart = jest.fn().mockResolvedValue(undefined);
  const _mockStop = jest.fn().mockResolvedValue(undefined);
  const _mockDestroy = jest.fn().mockResolvedValue(undefined);
  const _mockGetStats = jest.fn().mockReturnValue({
    totalTasks: 0, completedTasks: 0, failedTasks: 0,
  });
  const _mockExecuteGoal = jest.fn().mockResolvedValue({
    success: true, goalId: 'goal-1', tasks: [], summary: 'Goal completed',
  });
  const _mockSubmitToTeam = jest.fn().mockImplementation(
    async (_team: string, name: string, content: string) => ({
      metadata: {
        id: `task-${Date.now()}`, title: name, type: 'feature',
        from: 'orchestrator', to: _team, priority: 'medium',
        status: 'pending', tags: [], files: [],
      },
      content,
    })
  );
  const _mockExecuteTask = jest.fn().mockResolvedValue({
    success: true, taskId: 'task-1', result: { summary: 'Done' },
    duration: 100, teamType: 'development',
  });

  const state = { currentStatus: RunnerStatusEnum.STOPPED };

  const mockRunner = {
    start: _mockStart,
    stop: _mockStop,
    destroy: _mockDestroy,
    getStats: _mockGetStats,
    executeGoal: _mockExecuteGoal,
    submitToTeam: _mockSubmitToTeam,
    executeTask: _mockExecuteTask,
    get currentStatus() { return state.currentStatus; },
  };

  return {
    RunnerStatus: RunnerStatusEnum,
    createOrchestratorRunner: jest.fn().mockReturnValue(mockRunner),
    createMockRunner: jest.fn().mockReturnValue(mockRunner),
    __mocks: {
      start: _mockStart,
      stop: _mockStop,
      destroy: _mockDestroy,
      getStats: _mockGetStats,
      executeGoal: _mockExecuteGoal,
      submitToTeam: _mockSubmitToTeam,
      executeTask: _mockExecuteTask,
      state,
    },
  };
});

function getRunnerMocks() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../../../src/core/orchestrator/orchestrator-runner');
  return mod.__mocks as {
    start: jest.Mock;
    stop: jest.Mock;
    destroy: jest.Mock;
    getStats: jest.Mock;
    executeGoal: jest.Mock;
    submitToTeam: jest.Mock;
    executeTask: jest.Mock;
    state: { currentStatus: RunnerStatus };
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createWorkflow(): AgentWorkflow {
  return new AgentWorkflow({ workspaceDir: '/tmp/test' });
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentWorkflow', () => {
  let mocks: ReturnType<typeof getRunnerMocks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = getRunnerMocks();
    mocks.state.currentStatus = RunnerStatus.STOPPED;
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(undefined);
    mocks.executeTask.mockResolvedValue({
      success: true,
      taskId: 'task-1',
      result: { summary: 'Done' },
      duration: 100,
      teamType: 'development',
    });
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config (mock runner)', () => {
      const workflow = new AgentWorkflow();
      expect(workflow).toBeDefined();
    });

    it('should create with LLM client (real runner)', () => {
      const mockLLM = { chat: jest.fn() };
      const workflow = new AgentWorkflow({ llmClient: mockLLM as any });
      expect(workflow).toBeDefined();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should start the runner', async () => {
      const workflow = createWorkflow();
      await workflow.start();

      expect(mocks.start).toHaveBeenCalledTimes(1);
    });

    it('should not start again if already started', async () => {
      const workflow = createWorkflow();
      await workflow.start();
      await workflow.start();

      expect(mocks.start).toHaveBeenCalledTimes(1);
    });

    it('should stop the runner', async () => {
      const workflow = createWorkflow();
      await workflow.start();
      await workflow.stop();

      expect(mocks.stop).toHaveBeenCalledTimes(1);
    });

    it('should not stop if not started', async () => {
      const workflow = createWorkflow();
      await workflow.stop();

      expect(mocks.stop).not.toHaveBeenCalled();
    });

    it('should report current status', async () => {
      const workflow = createWorkflow();
      mocks.state.currentStatus = RunnerStatus.RUNNING;
      expect(workflow.status).toBe(RunnerStatus.RUNNING);
    });

    it('should destroy and cleanup', async () => {
      const workflow = createWorkflow();
      await workflow.start();
      await workflow.destroy();

      expect(mocks.stop).toHaveBeenCalled();
      expect(mocks.destroy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Feature Workflow
  // ==========================================================================

  describe('runFeatureWorkflow', () => {
    it('should run planning → development → QA steps', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runFeatureWorkflow('Add Auth', 'Implement auth system');

      expect(result.success).toBe(true);
      expect(result.workflowType).toBe('feature');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].step).toBe('Planning');
      expect(result.steps[1].step).toBe('Development');
      expect(result.steps[2].step).toBe('QA');
    });

    it('should skip planning when option set', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runFeatureWorkflow('Add Auth', 'Implement auth', {
        skipPlanning: true,
      });

      expect(result.steps[0].step).toBe('Development');
      expect(result.steps).toHaveLength(2);
    });

    it('should skip QA when option set', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runFeatureWorkflow('Add Auth', 'Implement auth', {
        skipQA: true,
      });

      expect(result.steps[result.steps.length - 1].step).toBe('Development');
    });

    it('should auto-start if not started', async () => {
      const workflow = createWorkflow();
      await workflow.runFeatureWorkflow('Title', 'Desc');

      expect(mocks.start).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Bugfix Workflow
  // ==========================================================================

  describe('runBugfixWorkflow', () => {
    it('should skip planning by default', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runBugfixWorkflow('Fix login', 'Login fails on mobile');

      expect(result.workflowType).toBe('bugfix');
      expect(result.steps[0].step).toBe('Development');
    });

    it('should include planning when explicitly requested', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runBugfixWorkflow('Fix login', 'Login fails', {
        skipPlanning: false,
      });

      expect(result.steps[0].step).toBe('Planning');
    });
  });

  // ==========================================================================
  // Refactor Workflow
  // ==========================================================================

  describe('runRefactorWorkflow', () => {
    it('should run full workflow', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runRefactorWorkflow('Cleanup utils', 'Refactor utils');

      expect(result.workflowType).toBe('refactor');
      expect(result.steps).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Test Workflow
  // ==========================================================================

  describe('runTestWorkflow', () => {
    it('should run test creation workflow', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runTestWorkflow('Test Auth', 'Create auth tests');

      expect(result.workflowType).toBe('test');
      expect(result.steps).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Review Workflow
  // ==========================================================================

  describe('runReviewWorkflow', () => {
    it('should run QA-only workflow', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runReviewWorkflow('Review PR', 'Review code changes');

      expect(result.workflowType).toBe('review');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].step).toBe('Review');
    });
  });

  // ==========================================================================
  // Full Cycle Workflow
  // ==========================================================================

  describe('runFullCycleWorkflow', () => {
    it('should run complete cycle', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runFullCycleWorkflow('Big Feature', 'Full lifecycle');

      expect(result.workflowType).toBe('full-cycle');
      expect(result.steps).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Custom Workflow
  // ==========================================================================

  describe('runCustomWorkflow', () => {
    it('should run custom steps', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runCustomWorkflow('Custom', [
        { name: 'Step 1', team: 'planning', content: 'Plan it' },
        { name: 'Step 2', team: 'development', content: 'Build it' },
      ]);

      expect(result.workflowType).toBe('custom');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].step).toBe('Step 1');
      expect(result.steps[1].step).toBe('Step 2');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should stop on first failed step', async () => {
      mocks.executeTask
        .mockResolvedValueOnce({ success: true, taskId: 't1', result: {}, duration: 10 })
        .mockResolvedValueOnce({ success: false, taskId: 't2', error: 'Build failed', duration: 10 });

      const workflow = createWorkflow();
      const result = await workflow.runFeatureWorkflow('Fail', 'Will fail');

      expect(result.success).toBe(false);
      // Should stop after the failed step
      const failedIdx = result.steps.findIndex(s => !s.success);
      expect(failedIdx).toBeGreaterThan(0);
      expect(result.steps.length).toBe(failedIdx + 1);
    });

    it('should handle executeStep exception', async () => {
      mocks.submitToTeam.mockRejectedValueOnce(new Error('Submit failed'));

      const workflow = createWorkflow();
      const result = await workflow.runReviewWorkflow('Review', 'Code review');

      expect(result.success).toBe(false);
      expect(result.steps[0].error).toContain('Submit failed');
    });

    it('should throw when runner.start fails', async () => {
      mocks.start.mockRejectedValueOnce(new Error('Start failed'));

      const workflow = createWorkflow();
      await expect(workflow.runFeatureWorkflow('Fail', 'Will fail')).rejects.toThrow('Start failed');
    });
  });

  // ==========================================================================
  // Events
  // ==========================================================================

  describe('events', () => {
    it('should emit step events', async () => {
      const workflow = createWorkflow();
      const started: string[] = [];
      const completed: string[] = [];

      workflow.on('step:started', (step) => started.push(step));
      workflow.on('step:completed', (result) => completed.push(result.step));

      await workflow.runReviewWorkflow('Review', 'Code review');

      expect(started).toContain('Review');
      expect(completed).toContain('Review');
    });

    it('should emit workflow:completed event', async () => {
      const workflow = createWorkflow();
      const handler = jest.fn();
      workflow.on('workflow:completed', handler);

      await workflow.runReviewWorkflow('Review', 'Code review');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        workflowType: 'review',
      }));
    });
  });

  // ==========================================================================
  // executeGoal
  // ==========================================================================

  describe('executeGoal', () => {
    it('should delegate to runner', async () => {
      const workflow = createWorkflow();
      const result = await workflow.executeGoal('Goal', 'Description');

      expect(mocks.executeGoal).toHaveBeenCalledWith('Goal', 'Description');
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should delegate to runner', () => {
      const workflow = createWorkflow();
      workflow.getStats();

      expect(mocks.getStats).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Summary generation
  // ==========================================================================

  describe('summary generation', () => {
    it('should generate success summary', async () => {
      const workflow = createWorkflow();
      const result = await workflow.runReviewWorkflow('PR Review', 'Review code');

      expect(result.summary).toContain('Review');
      expect(result.summary).toContain('PR Review');
      expect(result.summary).toContain('completed successfully');
    });

    it('should generate failure summary', async () => {
      mocks.executeTask.mockResolvedValueOnce({
        success: false, taskId: 't1', error: 'Fail', duration: 10,
      });

      const workflow = createWorkflow();
      const result = await workflow.runReviewWorkflow('PR Review', 'Review code');

      expect(result.summary).toContain('failed');
    });
  });
});

// ============================================================================
// Factory Functions
// ============================================================================

describe('factory functions', () => {
  it('createAgentWorkflow should create workflow', () => {
    const workflow = createAgentWorkflow();
    expect(workflow).toBeInstanceOf(AgentWorkflow);
  });

  it('createMockWorkflow should create workflow', () => {
    const workflow = createMockWorkflow({ workspaceDir: '/tmp/test' });
    expect(workflow).toBeInstanceOf(AgentWorkflow);
  });
});
