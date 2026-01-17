/**
 * Orchestrator Runner E2E Tests
 *
 * Integration tests for the OrchestratorRunner and AgentWorkflow classes.
 *
 * Feature: End-to-End Workflow Integration for Agent OS
 */

// Jest test file
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorRunner,
  createOrchestratorRunner,
  createMockRunner,
  RunnerStatus,
  AgentWorkflow,
  createAgentWorkflow,
  createMockWorkflow,
} from '@/core/orchestrator';
import { ILLMClient, LLMMessage, LLMCompletionResult } from '@/shared/llm';

/**
 * Create a test workspace directory
 */
function createTestWorkspace(): string {
  const testDir = path.join(os.tmpdir(), `orchestrator-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * Clean up test workspace
 */
function cleanupTestWorkspace(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a mock LLM client for testing
 */
function createMockLLMClient(): ILLMClient {
  return {
    getProvider: () => 'test-mock',
    getDefaultModel: () => 'test-model',
    getMaxContextLength: () => 100000,
    chat: jest.fn().mockImplementation(async (messages: LLMMessage[]): Promise<LLMCompletionResult> => {
      const lastMessage = messages[messages.length - 1];
      const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

      let response: string;
      if (content.includes('plan') || content.includes('Planning')) {
        response = JSON.stringify({
          title: 'Test Plan',
          summary: 'Planning completed successfully',
          tasks: [
            {
              title: 'Implement feature',
              type: 'feature',
              targetTeam: 'development',
              description: 'Implementation task',
            },
          ],
        });
      } else if (content.includes('develop') || content.includes('implement') || content.includes('Development')) {
        response = JSON.stringify({
          summary: 'Development completed',
          filesModified: [
            { path: 'src/feature.ts', action: 'created', description: 'Feature implementation' },
          ],
        });
      } else if (content.includes('test') || content.includes('qa') || content.includes('QA') || content.includes('Review')) {
        response = JSON.stringify({
          summary: 'QA completed',
          approved: true,
          testResults: { total: 5, passed: 5, failed: 0, skipped: 0, tests: [] },
          qualityScore: 95,
        });
      } else {
        response = JSON.stringify({ summary: 'Generic response' });
      }

      return {
        content: `\`\`\`json\n${response}\n\`\`\``,
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      };
    }),
    chatStream: jest.fn().mockImplementation(async (_messages, callback) => {
      const result: LLMCompletionResult = {
        content: '```json\n{"summary": "Streaming response"}\n```',
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      };
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    }),
  };
}

describe('OrchestratorRunner', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
  });

  afterEach(async () => {
    if (runner) {
      try {
        await runner.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestWorkspace(testDir);
  });

  describe('Lifecycle Management', () => {
    it('should start and stop successfully', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      expect(runner.currentStatus).toBe(RunnerStatus.IDLE);

      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.stop();
      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
    });

    it('should handle multiple start calls gracefully', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      await runner.start();
      await runner.start(); // Should not throw

      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    });

    it('should pause and resume correctly', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      await runner.pause();
      expect(runner.currentStatus).toBe(RunnerStatus.PAUSED);

      await runner.resume();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    });

    it('should track uptime', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(runner.uptime).toBeGreaterThan(0);
    });
  });

  describe('Goal Execution', () => {
    it('should execute a goal and return results', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      const result = await runner.executeGoal(
        'Test Feature',
        'Implement a test feature for planning workflow',
        { waitForCompletion: true }
      );

      expect(result.goalId).toBeDefined();
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.tasks.length).toBeGreaterThan(0);
    });

    it('should emit events during goal execution', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      const events: string[] = [];
      runner.on('goal:started', () => events.push('goal:started'));
      runner.on('goal:completed', () => events.push('goal:completed'));

      await runner.executeGoal('Test Goal', 'Test planning description');

      expect(events).toContain('goal:started');
      expect(events).toContain('goal:completed');
    });

    it('should throw when runner is not running', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      await expect(
        runner.executeGoal('Test', 'Description')
      ).rejects.toThrow('Runner is not running');
    });
  });

  describe('Task Submission', () => {
    it('should submit task to specific team', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      const task = await runner.submitToTeam(
        'planning',
        'Create Plan',
        'Plan for the planning task'
      );

      expect(task.metadata.to).toBe('planning');
      expect(task.metadata.type).toBe('planning');
    });

    it('should map team types to correct task types', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      const planningTask = await runner.submitToTeam('planning', 'Plan', 'Plan content');
      expect(planningTask.metadata.type).toBe('planning');

      const devTask = await runner.submitToTeam('development', 'Dev', 'Dev content');
      expect(devTask.metadata.type).toBe('feature');

      const qaTask = await runner.submitToTeam('qa', 'QA', 'QA content');
      expect(qaTask.metadata.type).toBe('test');
    });
  });

  describe('Statistics', () => {
    it('should provide runner statistics', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      const stats = runner.getStats();

      expect(stats.status).toBe(RunnerStatus.RUNNING);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.tasksExecuted).toBe(0);
      expect(stats.orchestratorStats).toBeDefined();
    });

    it('should track task results', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      await runner.start();

      await runner.executeGoal('Test', 'Test planning description');

      const stats = runner.getStats();
      expect(stats.tasksExecuted).toBeGreaterThan(0);
    });
  });

  describe('Custom LLM Client', () => {
    it('should work with custom LLM client', async () => {
      const mockClient = createMockLLMClient();

      runner = createOrchestratorRunner({
        llmClient: mockClient,
        workspaceDir: testDir,
        projectContext: 'Test project',
      });

      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.executeGoal('Test planning', 'Test planning description');

      expect(mockClient.chat).toHaveBeenCalled();
    });
  });
});

describe('AgentWorkflow', () => {
  let testDir: string;
  let workflow: AgentWorkflow;

  beforeEach(() => {
    testDir = createTestWorkspace();
  });

  afterEach(async () => {
    if (workflow) {
      try {
        await workflow.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestWorkspace(testDir);
  });

  describe('Workflow Lifecycle', () => {
    it('should start and stop workflow system', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      expect(workflow.status).toBe(RunnerStatus.IDLE);

      await workflow.start();
      expect(workflow.status).toBe(RunnerStatus.RUNNING);

      await workflow.stop();
      expect(workflow.status).toBe(RunnerStatus.STOPPED);
    });

    it('should auto-start when running workflow', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      // Should auto-start
      await workflow.runFeatureWorkflow('Test Feature', 'Feature description');

      expect(workflow.status).toBe(RunnerStatus.RUNNING);
    });
  });

  describe('Feature Workflow', () => {
    it('should execute feature workflow with all steps', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runFeatureWorkflow(
        'User Authentication',
        'Implement user authentication system'
      );

      expect(result.workflowType).toBe('feature');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.summary.toLowerCase()).toContain('feature');
    });

    it('should skip planning when option is set', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runFeatureWorkflow(
        'Quick Feature',
        'Simple feature',
        { skipPlanning: true }
      );

      // Should have fewer steps (no planning)
      const planningStep = result.steps.find((s) => s.step === 'Planning');
      expect(planningStep).toBeUndefined();
    });

    it('should skip QA when option is set', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runFeatureWorkflow(
        'No QA Feature',
        'Feature without QA',
        { skipQA: true }
      );

      const qaStep = result.steps.find((s) => s.step === 'QA');
      expect(qaStep).toBeUndefined();
    });
  });

  describe('Bugfix Workflow', () => {
    it('should execute bugfix workflow', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runBugfixWorkflow(
        'Fix Login Bug',
        'Users cannot login with special characters in password'
      );

      expect(result.workflowType).toBe('bugfix');
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should skip planning by default for bugfixes', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runBugfixWorkflow(
        'Quick Fix',
        'Simple bug fix'
      );

      const planningStep = result.steps.find((s) => s.step === 'Planning');
      expect(planningStep).toBeUndefined();
    });
  });

  describe('Refactor Workflow', () => {
    it('should execute refactor workflow', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runRefactorWorkflow(
        'Refactor Auth Module',
        'Extract authentication logic into separate module'
      );

      expect(result.workflowType).toBe('refactor');
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Test Workflow', () => {
    it('should execute test creation workflow', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runTestWorkflow(
        'Unit Tests for Auth',
        'Create comprehensive unit tests for authentication module'
      );

      expect(result.workflowType).toBe('test');
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Review Workflow', () => {
    it('should execute review workflow', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runReviewWorkflow(
        'Code Review PR #123',
        'Review changes in authentication module'
      );

      expect(result.workflowType).toBe('review');
      // Review should skip planning
      const planningStep = result.steps.find((s) => s.step === 'Planning');
      expect(planningStep).toBeUndefined();
    });
  });

  describe('Full Cycle Workflow', () => {
    it('should execute full development cycle', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runFullCycleWorkflow(
        'Complete Feature',
        'Full cycle development of new feature'
      );

      expect(result.workflowType).toBe('full-cycle');
      expect(result.steps.length).toBeGreaterThanOrEqual(2); // At least dev + QA
    });
  });

  describe('Custom Workflow', () => {
    it('should execute custom workflow steps', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.runCustomWorkflow('Custom Workflow', [
        { name: 'Step 1', team: 'planning', content: 'Plan something' },
        { name: 'Step 2', team: 'development', content: 'Implement something' },
      ]);

      expect(result.workflowType).toBe('custom');
      expect(result.steps.length).toBe(2);
      expect(result.steps[0].step).toBe('Step 1');
      expect(result.steps[1].step).toBe('Step 2');
    });
  });

  describe('Events', () => {
    it('should emit step events', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const events: string[] = [];
      workflow.on('step:started', (step) => events.push(`started:${step}`));
      workflow.on('step:completed', (result) => events.push(`completed:${result.step}`));
      workflow.on('workflow:completed', () => events.push('workflow:completed'));

      await workflow.runFeatureWorkflow('Test', 'Test description');

      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain('workflow:completed');
    });
  });

  describe('Statistics', () => {
    it('should provide workflow statistics', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });
      await workflow.start();

      const stats = workflow.getStats();

      expect(stats.status).toBe(RunnerStatus.RUNNING);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Goal Execution', () => {
    it('should execute single goal', async () => {
      workflow = createMockWorkflow({ workspaceDir: testDir });

      const result = await workflow.executeGoal(
        'Single Goal',
        'Execute a single planning goal'
      );

      expect(result.goalId).toBeDefined();
    });
  });

  describe('Custom LLM Client', () => {
    it('should work with custom LLM client', async () => {
      const mockClient = createMockLLMClient();

      workflow = createAgentWorkflow({
        llmClient: mockClient,
        workspaceDir: testDir,
        projectContext: 'Custom project',
      });

      const result = await workflow.runFeatureWorkflow(
        'LLM Feature',
        'Feature using custom LLM'
      );

      expect(result.success).toBeDefined();
      expect(mockClient.chat).toHaveBeenCalled();
    });
  });
});

describe('Integration: OrchestratorRunner + AgentWorkflow', () => {
  let testDir: string;
  let workflow: AgentWorkflow;

  beforeEach(() => {
    testDir = createTestWorkspace();
  });

  afterEach(async () => {
    if (workflow) {
      try {
        await workflow.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestWorkspace(testDir);
  });

  it('should complete a full feature development workflow', async () => {
    workflow = createMockWorkflow({ workspaceDir: testDir });

    const result = await workflow.runFeatureWorkflow(
      'User Profile Page',
      'Create a user profile page with editing capabilities'
    );

    expect(result.success).toBeDefined();
    expect(result.workflowType).toBe('feature');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it('should handle multiple sequential workflows', async () => {
    workflow = createMockWorkflow({ workspaceDir: testDir });

    const result1 = await workflow.runFeatureWorkflow('Feature 1', 'First feature planning');
    const result2 = await workflow.runBugfixWorkflow('Fix 1', 'First bugfix');
    const result3 = await workflow.runReviewWorkflow('Review 1', 'First review');

    expect(result1.workflowType).toBe('feature');
    expect(result2.workflowType).toBe('bugfix');
    expect(result3.workflowType).toBe('review');
  });

  it('should track cumulative statistics', async () => {
    workflow = createMockWorkflow({ workspaceDir: testDir });

    await workflow.runFeatureWorkflow('Feature', 'Feature planning desc');
    await workflow.runBugfixWorkflow('Fix', 'Bug fix desc');

    const stats = workflow.getStats();
    expect(stats.tasksExecuted).toBeGreaterThan(0);
  });
});
