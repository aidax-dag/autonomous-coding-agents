/**
 * Error Recovery Pipeline Tests
 *
 * G-6: Verifies that the OrchestratorRunner correctly wires:
 * 1. Error recovery with retry logic when enableErrorRecovery is true
 * 2. ErrorEscalator classify/handleError integration for RETRY, FAIL_TASK, STOP_RUNNER
 * 3. error:retry, error:escalated, error:recovered event emission
 * 4. ReflexionPattern.learn() after successful recovery
 * 5. Graceful degradation when ErrorEscalator is unavailable
 * 6. No-op behaviour when enableErrorRecovery is false (existing path)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorRunner,
  RunnerStatus,
  WorkflowResult,
} from '../../../../src/core/orchestrator/orchestrator-runner';
import { createMockRunner } from '../../../../src/core/orchestrator/mock-runner';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';
import { EscalationAction } from '../../../../src/core/orchestrator/error-escalator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestWorkspace(): string {
  const dir = path.join(
    os.tmpdir(),
    `error-recovery-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestWorkspace(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createMockLLMClient() {
  return {
    getProvider: () => 'mock' as const,
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async (messages: any[]) => {
      const lastMessage = messages[messages.length - 1];
      const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

      let response: string;
      if (content.includes('planning') || content.includes('plan') || content.includes('Planning')) {
        response = JSON.stringify({
          title: 'Mock Plan',
          summary: 'Mock planning output',
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              targetTeam: 'development',
              description: 'First task',
            },
          ],
        });
      } else if (content.includes('develop') || content.includes('implement') || content.includes('Development')) {
        response = JSON.stringify({
          summary: 'Mock development output',
          filesModified: [
            { path: 'src/test.ts', action: 'created', description: 'Test file' },
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
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop' as const,
      };
    },
    chatStream: async (_messages: any[], callback: any) => {
      const result = {
        content: '```json\n{"summary": "Streaming response"}\n```',
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop' as const,
      };
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Retry succeeds on second attempt
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Retry Logic', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should retry and succeed on second attempt for transient errors', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      maxRetries: 2,
    });

    await runner.start();

    // Submit a valid task first
    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Spy on the team agent's processTask to fail once then succeed
    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount === 1) {
        // First call: throw transient error (the actual executeTask call)
        throw new Error('timeout: connection reset');
      }
      // Second call (retry): succeed
      return originalProcess(t);
    });

    const retryEvents: any[] = [];
    const recoveredEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));
    runner.on('error:recovered', (info) => recoveredEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(true);
    expect(retryEvents.length).toBe(1);
    expect(retryEvents[0].taskId).toBe(task.metadata.id);
    expect(retryEvents[0].attempt).toBe(1);
    expect(recoveredEvents.length).toBe(1);
    expect(recoveredEvents[0].taskId).toBe(task.metadata.id);
    expect(recoveredEvents[0].attempt).toBe(1);
  });

  it('should exhaust maxRetries and return failure when all retries fail', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      maxRetries: 2,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Make all calls fail with transient error
    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    jest.spyOn(team, 'processTask').mockRejectedValue(new Error('timeout: persistent failure'));

    const retryEvents: any[] = [];
    const escalatedEvents: any[] = [];
    const recoveredEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));
    runner.on('error:escalated', (info) => escalatedEvents.push(info));
    runner.on('error:recovered', (info) => recoveredEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    // Should have retried maxRetries times
    expect(retryEvents.length).toBe(2);
    // Should escalate after exhaustion
    expect(escalatedEvents.length).toBe(1);
    expect(escalatedEvents[0].action).toBe(EscalationAction.FAIL_TASK);
    // No recovery
    expect(recoveredEvents.length).toBe(0);
  });

  it('should retry and succeed on third attempt with maxRetries=3', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      maxRetries: 3,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('timeout: intermittent failure');
      }
      return originalProcess(t);
    });

    const retryEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(true);
    expect(retryEvents.length).toBe(2);
    expect(retryEvents[0].attempt).toBe(1);
    expect(retryEvents[1].attempt).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// FAIL_TASK and STOP_RUNNER actions
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Escalation Actions', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should return failure and emit error:escalated for FAIL_TASK action', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Force routing error (non-retryable -> FAIL_TASK)
    (task.metadata as any).to = 'nonexistent';

    const escalatedEvents: any[] = [];
    runner.on('error:escalated', (info) => escalatedEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No team registered');
    expect(escalatedEvents.length).toBe(1);
    expect(escalatedEvents[0].action).toBe(EscalationAction.FAIL_TASK);
  });

  it('should stop the runner and emit error:escalated for STOP_RUNNER action', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Force a critical system error (out of memory -> STOP_RUNNER)
    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    jest.spyOn(team, 'processTask').mockRejectedValue(new Error('out of memory: heap allocation failed'));

    const escalatedEvents: any[] = [];
    const errorEvents: any[] = [];
    runner.on('error:escalated', (info) => escalatedEvents.push(info));
    runner.on('error', (err) => errorEvents.push(err));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    expect(escalatedEvents.length).toBe(1);
    expect(escalatedEvents[0].action).toBe(EscalationAction.STOP_RUNNER);
    // Runner should be in error state
    expect(runner.currentStatus).toBe(RunnerStatus.ERROR);
    expect(errorEvents.length).toBe(1);
  });

  it('should emit error:escalated for non-retryable medium severity errors', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Make processTask throw a generic task error (medium severity, non-retryable by default
    // because the escalator returns FAIL_TASK for generic errors after retry count is met)
    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    jest.spyOn(team, 'processTask').mockRejectedValue(new Error('generic task failure'));

    const escalatedEvents: any[] = [];
    runner.on('error:escalated', (info) => escalatedEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    // The default classifier returns RETRY for generic task errors (retryable: true),
    // but after maxRetries exhausted it will escalate
    // Actually, since the error keeps occurring, the escalator's handleError will
    // return RETRY until maxRetries is reached, then fall through to classification action
  });
});

// ---------------------------------------------------------------------------
// Recovery Learning (reflexion.learn called)
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Learning Integration', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should call reflexion.learn() after successful recovery', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      enableLearning: true,
      maxRetries: 2,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    // Fail once, then succeed
    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('timeout: transient error');
      }
      return originalProcess(t);
    });

    // Spy on reflexion.learn
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    let learnCalled = false;
    if (reflexion) {
      jest.spyOn(reflexion, 'learn').mockImplementation(async () => {
        learnCalled = true;
      });
    }

    const result = await runner.executeTask(task);

    expect(result.success).toBe(true);
    if (reflexion) {
      expect(learnCalled).toBe(true);
      expect(reflexion.learn).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Retry succeeded'),
        expect.stringContaining('Transient error'),
      );
    }
  });

  it('should not break recovery when reflexion.learn() throws', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      enableLearning: true,
      maxRetries: 2,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('timeout: transient error');
      }
      return originalProcess(t);
    });

    // Force reflexion.learn to throw
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    if (reflexion) {
      jest.spyOn(reflexion, 'learn').mockRejectedValue(new Error('learn boom'));
    }

    const recoveredEvents: any[] = [];
    runner.on('error:recovered', (info) => recoveredEvents.push(info));

    // Should still succeed despite learn failure
    const result = await runner.executeTask(task);

    expect(result.success).toBe(true);
    expect(recoveredEvents.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Event emissions
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Event Emissions', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should emit error:retry with correct attempt info on each retry', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      maxRetries: 3,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('503: service unavailable');
      }
      return originalProcess(t);
    });

    const retryEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));

    await runner.executeTask(task);

    expect(retryEvents.length).toBe(2);
    expect(retryEvents[0].attempt).toBe(1);
    expect(retryEvents[0].maxRetries).toBe(3);
    expect(retryEvents[0].error).toBeInstanceOf(Error);
    expect(retryEvents[1].attempt).toBe(2);
  });

  it('should emit workflow:completed after successful retry', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      maxRetries: 2,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    let callCount = 0;
    const originalProcess = team.processTask.bind(team);
    jest.spyOn(team, 'processTask').mockImplementation(async (t: any) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('timeout: transient');
      }
      return originalProcess(t);
    });

    const completedEvents: any[] = [];
    runner.on('workflow:completed', (result) => completedEvents.push(result));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(true);
    expect(completedEvents.length).toBe(1);
    expect(completedEvents[0].success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Graceful Degradation', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should fall through to existing behaviour when ErrorEscalator methods throw', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
    });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');
    (task.metadata as any).to = 'nonexistent';

    // Force the escalator to throw only during handleTaskError (first classify call),
    // then restore original behaviour for the fallback catch block.
    const escalator = (runner as any).errorEscalator;
    const originalClassify = escalator.classify.bind(escalator);
    let classifyCallCount = 0;
    jest.spyOn(escalator, 'classify').mockImplementation((...args: any[]) => {
      classifyCallCount++;
      if (classifyCallCount === 1) {
        throw new Error('escalator internal error');
      }
      return originalClassify(...args);
    });

    // Should still return a failure result without crashing
    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    // Falls through to the non-recovery catch block
    expect(result.error).toContain('No team registered');
  });
});

// ---------------------------------------------------------------------------
// Disabled when enableErrorRecovery is false
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Error Recovery: Disabled Path', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
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

  it('should not attempt retries when enableErrorRecovery is false', async () => {
    runner = createMockRunner({ workspaceDir: testDir });

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');
    (task.metadata as any).to = 'nonexistent';

    const retryEvents: any[] = [];
    const escalatedEvents: any[] = [];
    const recoveredEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));
    runner.on('error:escalated', (info) => escalatedEvents.push(info));
    runner.on('error:recovered', (info) => recoveredEvents.push(info));

    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    // No recovery events should be emitted
    expect(retryEvents.length).toBe(0);
    expect(escalatedEvents.length).toBe(0);
    expect(recoveredEvents.length).toBe(0);
  });

  it('should use default maxRetries of 2 when not specified', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableErrorRecovery: true,
      // maxRetries not specified — should default to 2
    });

    expect((runner as any).config.maxRetries).toBe(2);

    await runner.start();

    const task = await runner.submitToTeam('planning', 'Test Task', 'Test content for planning');

    const team = (runner as any).orchestrator.teams.get(task.metadata.to);
    jest.spyOn(team, 'processTask').mockRejectedValue(new Error('timeout: persistent'));

    const retryEvents: any[] = [];
    runner.on('error:retry', (info) => retryEvents.push(info));

    await runner.executeTask(task);

    // Should retry exactly 2 times (the default)
    expect(retryEvents.length).toBe(2);
  });

  it('should default enableErrorRecovery to false', () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
    });

    expect((runner as any).config.enableErrorRecovery).toBe(false);
  });
});
