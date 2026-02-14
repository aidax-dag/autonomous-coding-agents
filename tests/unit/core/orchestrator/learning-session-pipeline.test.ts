/**
 * Learning <-> Session Pipeline Tests
 *
 * G-3: Verifies that the OrchestratorRunner correctly wires:
 * 1. SessionManager lifecycle (start/end session) to runner start/stop
 * 2. ReflexionPattern error lookup in the executeTask catch block
 * 3. learning:solution-found event emission when a cached solution exists
 * 4. Graceful degradation when learning/session modules are unavailable or fail
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorRunner,
  RunnerStatus,
} from '../../../../src/core/orchestrator/orchestrator-runner';
import { createMockRunner } from '../../../../src/core/orchestrator/mock-runner';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';

function createTestWorkspace(): string {
  const dir = path.join(
    os.tmpdir(),
    `learning-session-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

// ---------------------------------------------------------------------------
// Session Lifecycle Wiring
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Session Lifecycle Wiring', () => {
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

  it('should start a session when enableSession is true', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
    });

    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

    // Verify a session was started by checking the SessionManager
    const registry = ServiceRegistry.getInstance();
    const sessionManager = registry.getSessionManager();
    if (sessionManager) {
      // getActiveSession should return a non-null value
      const activeSession = sessionManager.getActiveSession();
      expect(activeSession).toBeTruthy();
    }

    // Verify the runner stored the sessionId
    expect((runner as any).lifecycle.getSessionId()).toBeTruthy();
  });

  it('should end the session when stop() is called', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
    });

    await runner.start();
    const sessionId = (runner as any).lifecycle.getSessionId();
    expect(sessionId).toBeTruthy();

    await runner.stop();

    // currentSessionId should be cleared
    expect((runner as any).lifecycle.getSessionId()).toBeNull();
  });

  it('should end the session when destroy() is called', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
    });

    await runner.start();
    expect((runner as any).lifecycle.getSessionId()).toBeTruthy();

    await runner.destroy();

    // Prevent afterEach from calling destroy again
    runner = undefined as any;
  });

  it('should not start a session when enableSession is false', async () => {
    runner = createMockRunner({ workspaceDir: testDir });

    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

    // currentSessionId should remain null
    expect((runner as any).lifecycle.getSessionId()).toBeNull();
  });

  it('should not break start() when session start fails', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
    });

    // Force SessionManager.startSession to throw
    const registry = ServiceRegistry.getInstance();
    const origGetSessionManager = registry.getSessionManager.bind(registry);
    jest.spyOn(registry, 'getSessionManager').mockImplementation(() => {
      const mgr = origGetSessionManager();
      if (mgr) {
        jest.spyOn(mgr, 'startSession').mockRejectedValueOnce(new Error('session start boom'));
      }
      return mgr;
    });

    // start() should still succeed
    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    // Session ID should remain null since start failed
    expect((runner as any).lifecycle.getSessionId()).toBeNull();
  });

  it('should not break stop() when session end fails', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
    });

    await runner.start();
    const sessionId = (runner as any).lifecycle.getSessionId();
    expect(sessionId).toBeTruthy();

    // Force SessionManager.endSession to throw
    const registry = ServiceRegistry.getInstance();
    const sessionManager = registry.getSessionManager();
    if (sessionManager) {
      jest.spyOn(sessionManager, 'endSession').mockRejectedValueOnce(new Error('session end boom'));
    }

    // stop() should still succeed
    await runner.stop();
    expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
    // currentSessionId should still be cleared
    expect((runner as any).lifecycle.getSessionId()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Learning: Reflexion Lookup on Task Error
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Learning Error Lookup', () => {
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

  it('should emit learning:solution-found when a cached solution exists for an error', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableLearning: true,
    });

    await runner.start();

    // Teach the reflexion pattern a solution
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    expect(reflexion).toBeTruthy();

    // Learn a solution for a specific error
    const testError = new Error('No team registered for type: nonexistent');
    await reflexion!.learn(testError, 'Register the team before submitting', 'Missing team registration');

    // Listen for the event
    const solutionEvents: any[] = [];
    runner.on('learning:solution-found', (info) => {
      solutionEvents.push(info);
    });

    // Submit a task that will fail with the same error signature
    const task = await runner.submitToTeam(
      'planning',
      'Test Task',
      'Test content',
    );

    // Force the team lookup to fail by using a nonexistent team type
    (task.metadata as any).to = 'nonexistent';
    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);

    // The learning:solution-found event should have been emitted
    expect(solutionEvents.length).toBe(1);
    expect(solutionEvents[0].taskId).toBe(task.metadata.id);
    expect(solutionEvents[0].solution).toBeDefined();
  });

  it('should not emit learning:solution-found when no cached solution exists', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableLearning: true,
    });

    await runner.start();

    // Mock lookup to return null (no cached solution)
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    if (reflexion) {
      jest.spyOn(reflexion, 'lookup').mockResolvedValue(null);
    }

    const solutionEvents: any[] = [];
    runner.on('learning:solution-found', (info) => {
      solutionEvents.push(info);
    });

    // Submit a task that will fail, but no solution is cached
    const task = await runner.submitToTeam(
      'planning',
      'Test Task',
      'Test content',
    );
    (task.metadata as any).to = 'nonexistent';
    await runner.executeTask(task);

    // No event should be emitted
    expect(solutionEvents.length).toBe(0);
  });

  it('should not attempt learning lookup when enableLearning is false', async () => {
    runner = createMockRunner({ workspaceDir: testDir });

    await runner.start();

    const solutionEvents: any[] = [];
    runner.on('learning:solution-found', (info) => {
      solutionEvents.push(info);
    });

    // Submit a task that will fail
    const task = await runner.submitToTeam(
      'planning',
      'Test Task',
      'Test content',
    );
    (task.metadata as any).to = 'nonexistent';
    await runner.executeTask(task);

    // No event should be emitted since learning is disabled
    expect(solutionEvents.length).toBe(0);
  });

  it('should not break task execution when reflexion lookup throws', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableLearning: true,
    });

    await runner.start();

    // Force the reflexion lookup to throw
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    if (reflexion) {
      jest.spyOn(reflexion, 'lookup').mockRejectedValueOnce(new Error('lookup boom'));
    }

    // Task execution should still complete normally (fail due to nonexistent team, not crash)
    const task = await runner.submitToTeam(
      'planning',
      'Test Task',
      'Test content',
    );
    (task.metadata as any).to = 'nonexistent';
    const result = await runner.executeTask(task);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No team registered');
  });
});

// ---------------------------------------------------------------------------
// Combined: Session + Learning together
// ---------------------------------------------------------------------------

describe('OrchestratorRunner – Combined Session + Learning Pipeline', () => {
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

  it('should start session and support learning lookup in one lifecycle', async () => {
    runner = new OrchestratorRunner({
      llmClient: createMockLLMClient(),
      workspaceDir: testDir,
      enableSession: true,
      enableLearning: true,
    });

    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

    // Verify session was started
    expect((runner as any).lifecycle.getSessionId()).toBeTruthy();

    // Teach a solution
    const registry = ServiceRegistry.getInstance();
    const reflexion = registry.getReflexionPattern();
    const testError = new Error('No team registered for type: nonexistent');
    await reflexion!.learn(testError, 'Register team first', 'Missing team');

    // Listen for learning event
    const solutionEvents: any[] = [];
    runner.on('learning:solution-found', (info) => {
      solutionEvents.push(info);
    });

    // Trigger error
    const task = await runner.submitToTeam('planning', 'Test', 'Content');
    (task.metadata as any).to = 'nonexistent';
    await runner.executeTask(task);

    expect(solutionEvents.length).toBe(1);

    // Stop runner
    await runner.stop();
    expect((runner as any).lifecycle.getSessionId()).toBeNull();
    expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
  });
});

// ---------------------------------------------------------------------------
// Helper: Simple mock LLM client
// ---------------------------------------------------------------------------

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
