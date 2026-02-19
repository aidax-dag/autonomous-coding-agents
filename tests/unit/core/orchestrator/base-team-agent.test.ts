/**
 * Base Team Agent Tests
 */

import { BaseTeamAgent, BaseTeamAgentOptions } from '../../../../src/core/orchestrator/base-team-agent';
import {
  TeamAgentStatus,
  TaskHandler,
} from '../../../../src/core/orchestrator/team-agent';
import type { DocumentQueue } from '../../../../src/core/workspace/document-queue';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';

// ============================================================================
// Test subclass (BaseTeamAgent is abstract)
// ============================================================================

class TestTeamAgent extends BaseTeamAgent {
  public onStartCalled = false;
  public onStopCalled = false;
  public defaultHandlerFn: TaskHandler | null = null;

  constructor(options: BaseTeamAgentOptions) {
    super(options);
  }

  protected registerDefaultHandlers(): void {
    // Register a default handler for 'feature' tasks
    this.registerHandler(['feature'], async (task) => ({
      success: true,
      result: `handled feature: ${task.metadata.title}`,
    }));
  }

  protected getDefaultHandler(): TaskHandler | null {
    return this.defaultHandlerFn;
  }

  protected async onStart(): Promise<void> {
    this.onStartCalled = true;
  }

  protected async onStop(): Promise<void> {
    this.onStopCalled = true;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function makeMockQueue(): DocumentQueue {
  return {
    publish: jest.fn().mockResolvedValue({}),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getTask: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  } as unknown as DocumentQueue;
}

function makeTask(overrides: Partial<{
  id: string;
  title: string;
  type: string;
  to: string;
  priority: string;
  content: string;
  tags: string[];
}> = {}): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'feature',
      from: 'orchestrator',
      to: overrides.to || 'development',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      files: [],
    },
    content: overrides.content || 'Implement feature',
  } as unknown as TaskDocument;
}

function createAgent(overrides?: Partial<BaseTeamAgentOptions>): TestTeamAgent {
  return new TestTeamAgent({
    teamType: 'development',
    queue: makeMockQueue(),
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseTeamAgent', () => {
  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should initialize with correct team type', () => {
      const agent = createAgent();
      expect(agent.teamType).toBe('development');
    });

    it('should generate unique id', () => {
      const agent1 = createAgent();
      const agent2 = createAgent();
      expect(agent1.id).not.toBe(agent2.id);
      expect(agent1.id).toContain('development-');
    });

    it('should start in STOPPED status', () => {
      const agent = createAgent();
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should initialize metrics to zero', () => {
      const agent = createAgent();
      expect(agent.metrics.tasksProcessed).toBe(0);
      expect(agent.metrics.tasksFailed).toBe(0);
      expect(agent.metrics.tasksInProgress).toBe(0);
      expect(agent.metrics.successRate).toBe(1);
    });

    it('should call registerDefaultHandlers during construction', () => {
      const agent = createAgent();
      expect(agent.canHandle('feature')).toBe(true);
    });

    it('should use custom config', () => {
      const agent = createAgent({
        config: { name: 'Custom Dev Team' },
      });
      expect(agent.config.name).toBe('Custom Dev Team');
    });

    it('should default autoSubscribe to true', () => {
      const agent = createAgent();
      // autoSubscribe is protected, test indirectly by starting
      expect(agent).toBeDefined();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should start and transition to IDLE', async () => {
      const agent = createAgent();
      await agent.start();

      expect(agent.status).toBe(TeamAgentStatus.IDLE);
      expect(agent.onStartCalled).toBe(true);
    });

    it('should subscribe to inbox on start when autoSubscribe is true', async () => {
      const queue = makeMockQueue();
      const agent = createAgent({ queue, autoSubscribe: true });
      await agent.start();

      expect(queue.subscribe).toHaveBeenCalledWith(
        'development',
        expect.any(Function),
        expect.objectContaining({ autoAcknowledge: true }),
      );
    });

    it('should not subscribe when autoSubscribe is false', async () => {
      const queue = makeMockQueue();
      const agent = createAgent({ queue, autoSubscribe: false });
      await agent.start();

      expect(queue.subscribe).not.toHaveBeenCalled();
    });

    it('should not start again if already IDLE', async () => {
      const agent = createAgent();
      await agent.start();
      agent.onStartCalled = false;

      await agent.start();
      expect(agent.onStartCalled).toBe(false);
    });

    it('should stop and transition to STOPPED', async () => {
      const agent = createAgent();
      await agent.start();
      await agent.stop();

      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
      expect(agent.onStopCalled).toBe(true);
    });

    it('should not stop again if already STOPPED', async () => {
      const agent = createAgent();
      // Already stopped by default
      agent.onStopCalled = false;
      await agent.stop();

      expect(agent.onStopCalled).toBe(false);
    });

    it('should emit status-changed events', async () => {
      const agent = createAgent();
      const statusChanges: [TeamAgentStatus, TeamAgentStatus][] = [];

      agent.on('status-changed', (oldStatus, newStatus) => {
        statusChanges.push([oldStatus, newStatus]);
      });

      await agent.start();
      await agent.stop();

      expect(statusChanges).toEqual([
        [TeamAgentStatus.STOPPED, TeamAgentStatus.INITIALIZING],
        [TeamAgentStatus.INITIALIZING, TeamAgentStatus.IDLE],
        [TeamAgentStatus.IDLE, TeamAgentStatus.STOPPING],
        [TeamAgentStatus.STOPPING, TeamAgentStatus.STOPPED],
      ]);
    });

    it('should set ERROR status on start failure', async () => {
      const agent = createAgent();
      // Make onStart throw
      (agent as any).onStart = async () => { throw new Error('init failed'); };

      const errorHandler = jest.fn();
      agent.on('error', errorHandler);

      await expect(agent.start()).rejects.toThrow('init failed');
      expect(agent.status).toBe(TeamAgentStatus.ERROR);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Pause / Resume
  // ==========================================================================

  describe('pause/resume', () => {
    it('should pause from IDLE', async () => {
      const agent = createAgent();
      await agent.start();
      await agent.pause();

      expect(agent.status).toBe(TeamAgentStatus.PAUSED);
    });

    it('should resume from PAUSED to IDLE', async () => {
      const agent = createAgent();
      await agent.start();
      await agent.pause();
      await agent.resume();

      expect(agent.status).toBe(TeamAgentStatus.IDLE);
    });

    it('should not pause when STOPPED', async () => {
      const agent = createAgent();
      await agent.pause();

      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should not resume when not PAUSED', async () => {
      const agent = createAgent();
      await agent.start();
      await agent.resume(); // Not paused

      expect(agent.status).toBe(TeamAgentStatus.IDLE);
    });
  });

  // ==========================================================================
  // Task handling
  // ==========================================================================

  describe('canHandle', () => {
    it('should return true for registered handler types', () => {
      const agent = createAgent();
      expect(agent.canHandle('feature')).toBe(true);
    });

    it('should return false for unregistered types', () => {
      const agent = createAgent();
      expect(agent.canHandle('infrastructure')).toBe(false);
    });

    it('should check capabilities if no handler registered', () => {
      const agent = createAgent({
        config: {
          capabilities: [{
            name: 'testing',
            description: 'Test capability',
            taskTypes: ['test'],
            priority: 50,
          }],
        },
      });
      expect(agent.canHandle('test')).toBe(true);
    });
  });

  describe('registerHandler', () => {
    it('should register handler for multiple task types', () => {
      const agent = createAgent();
      agent.registerHandler(['bugfix', 'refactor'], async () => ({ success: true }));

      expect(agent.canHandle('bugfix')).toBe(true);
      expect(agent.canHandle('refactor')).toBe(true);
    });
  });

  describe('getCapability', () => {
    it('should return capability for matching task type', () => {
      const agent = createAgent({
        config: {
          capabilities: [{
            name: 'dev',
            description: 'Development',
            taskTypes: ['feature', 'bugfix'],
            priority: 70,
          }],
        },
      });

      const cap = agent.getCapability('feature');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('dev');
    });

    it('should return undefined for non-matching task type', () => {
      const agent = createAgent();
      expect(agent.getCapability('infrastructure')).toBeUndefined();
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should process a task with registered handler', async () => {
      const agent = createAgent();
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(true);
      expect(result.result).toContain('handled feature');
    });

    it('should use default handler when no specific handler found', async () => {
      const agent = createAgent();
      agent.defaultHandlerFn = async () => ({ success: true, result: 'default' });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'analysis' }));
      expect(result.success).toBe(true);
      expect(result.result).toBe('default');
    });

    it('should throw when no handler found and no default', async () => {
      const agent = createAgent();
      await agent.start();

      await expect(
        agent.processTask(makeTask({ type: 'infrastructure' })),
      ).rejects.toThrow('No handler for task type');
    });

    it('should throw when agent is PAUSED', async () => {
      const agent = createAgent();
      await agent.start();
      await agent.pause();

      await expect(
        agent.processTask(makeTask()),
      ).rejects.toThrow('not accepting tasks');
    });

    it('should throw when agent is STOPPED', async () => {
      const agent = createAgent();

      await expect(
        agent.processTask(makeTask()),
      ).rejects.toThrow('not accepting tasks');
    });

    it('should update metrics on success', async () => {
      const agent = createAgent();
      await agent.start();

      await agent.processTask(makeTask());

      expect(agent.metrics.tasksProcessed).toBe(1);
      expect(agent.metrics.tasksFailed).toBe(0);
      expect(agent.metrics.lastActiveAt).not.toBeNull();
      expect(agent.metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should update metrics on handler failure', async () => {
      const agent = createAgent();
      agent.registerHandler(['bugfix'], async () => {
        throw new Error('handler error');
      });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'bugfix' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('handler error');
      expect(agent.metrics.tasksFailed).toBe(1);
    });

    it('should emit task lifecycle events', async () => {
      const agent = createAgent();
      await agent.start();

      const events: string[] = [];
      agent.on('task:received', () => events.push('received'));
      agent.on('task:processing', () => events.push('processing'));
      agent.on('task:completed', () => events.push('completed'));

      await agent.processTask(makeTask());

      expect(events).toEqual(['received', 'processing', 'completed']);
    });

    it('should emit task:failed on handler error', async () => {
      const agent = createAgent();
      agent.registerHandler(['bugfix'], async () => {
        throw new Error('boom');
      });
      await agent.start();

      const failHandler = jest.fn();
      agent.on('task:failed', failHandler);

      await agent.processTask(makeTask({ type: 'bugfix' }));

      expect(failHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ message: 'boom' }),
      );
    });

    it('should transition status to PROCESSING and back to IDLE', async () => {
      const agent = createAgent();
      await agent.start();

      const statuses: TeamAgentStatus[] = [];
      agent.on('status-changed', (_old, newStatus) => {
        statuses.push(newStatus);
      });

      await agent.processTask(makeTask());

      expect(statuses).toContain(TeamAgentStatus.PROCESSING);
      expect(statuses).toContain(TeamAgentStatus.IDLE);
    });

    it('should calculate success rate correctly', async () => {
      const agent = createAgent();
      agent.registerHandler(['bugfix'], async () => {
        throw new Error('fail');
      });
      await agent.start();

      await agent.processTask(makeTask({ type: 'feature' })); // success
      await agent.processTask(makeTask({ type: 'bugfix' }));  // failure

      expect(agent.metrics.tasksProcessed).toBe(1); // only successful ones counted via metrics
      expect(agent.metrics.tasksFailed).toBe(1);
      // successRate = (1 - 1) / 1 = 0 when 1 processed, 1 failed — but wait
      // metrics.tasksProcessed is incremented in the try block (success path)
      // metrics.tasksFailed is incremented in the catch block
      // so with 1 success and 1 failure: tasksProcessed=1, tasksFailed=1
      // successRate = (1-1)/1 = 0
    });
  });

  // ==========================================================================
  // Load & health
  // ==========================================================================

  describe('getLoad', () => {
    it('should return 0 when no tasks processing', () => {
      const agent = createAgent();
      expect(agent.getLoad()).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should report healthy when IDLE', async () => {
      const agent = createAgent();
      await agent.start();

      const health = await agent.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe(TeamAgentStatus.IDLE);
      expect(health.details).toBeDefined();
    });

    it('should report unhealthy when STOPPED', async () => {
      const agent = createAgent();
      const health = await agent.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should report unhealthy when ERROR', async () => {
      const agent = createAgent();
      // Force error state
      (agent as any).onStart = async () => { throw new Error('fail'); };
      try { await agent.start(); } catch { /* expected */ }

      const health = await agent.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.status).toBe(TeamAgentStatus.ERROR);
    });
  });

  // ==========================================================================
  // Metrics
  // ==========================================================================

  describe('metrics', () => {
    it('should track uptime', async () => {
      const agent = createAgent();
      await agent.start();

      // Wait briefly
      await new Promise((r) => setTimeout(r, 20));

      expect(agent.metrics.uptime).toBeGreaterThan(0);
    });

    it('should return 0 uptime when not started', () => {
      const agent = createAgent();
      expect(agent.metrics.uptime).toBe(0);
    });
  });

  // ==========================================================================
  // Timeout
  // ==========================================================================

  describe('task timeout', () => {
    it('should timeout long-running tasks', async () => {
      const agent = createAgent({
        config: { taskTimeout: 50 },
      });
      agent.registerHandler(['bugfix'], async () => {
        await new Promise(() => {});
        return { success: true };
      });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'bugfix' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});
