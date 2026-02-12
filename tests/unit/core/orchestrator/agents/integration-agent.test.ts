/**
 * Integration Agent Tests
 */

import {
  IntegrationAgent,
  createIntegrationAgent,
} from '../../../../../src/core/orchestrator/agents/integration-agent';
import type { IntegrationOutput } from '../../../../../src/core/orchestrator/agents/integration-agent';
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

function makeTask(
  overrides: Partial<{
    title: string;
    type: string;
    priority: string;
    content: string;
    tags: string[];
    id: string;
  }> = {}
): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'test',
      from: 'development',
      to: 'code-quality',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
    },
    content: overrides.content || 'Verify integration between modules',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('IntegrationAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new IntegrationAgent({ queue });
      expect(agent.teamType).toBe('code-quality');
      expect(agent.config.name).toBe('Integration Team');
      expect(agent.config.description).toBe('Integration verification and connection testing');
    });

    it('should accept custom config', () => {
      const agent = new IntegrationAgent({
        queue,
        config: { name: 'Custom Integration' },
      });
      expect(agent.config.name).toBe('Custom Integration');
    });

    it('should register handlers for test and review task types', () => {
      const agent = new IntegrationAgent({ queue });
      expect(agent.canHandle('test')).toBe(true);
      expect(agent.canHandle('review')).toBe(true);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have integration-verification capability', () => {
      const agent = new IntegrationAgent({ queue });
      const cap = agent.getCapability('test');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('integration-verification');
      expect(cap!.priority).toBe(87);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should detect circular dependency issues', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Check for circular dependencies in module graph' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as IntegrationOutput;
      const circularIssue = output.issues.find((i) =>
        i.description.toLowerCase().includes('circular')
      );
      expect(circularIssue).toBeDefined();
      expect(circularIssue!.severity).toBe('critical');
      expect(output.healthStatus).toBe('unhealthy');
    });

    it('should detect connection/timeout issues', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Service timeout when connecting to database' });
      const result = await agent.processTask(task);

      const output = result.result as IntegrationOutput;
      const timeoutIssue = output.issues.find((i) => i.component === 'connectivity');
      expect(timeoutIssue).toBeDefined();
      expect(timeoutIssue!.severity).toBe('critical');
    });

    it('should detect deprecated API usage', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Module uses deprecated authentication API' });
      const result = await agent.processTask(task);

      const output = result.result as IntegrationOutput;
      const deprecatedIssue = output.issues.find((i) => i.component === 'api-compatibility');
      expect(deprecatedIssue).toBeDefined();
      expect(deprecatedIssue!.severity).toBe('info');
    });

    it('should analyze import connections', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: "import { AuthService } from './auth'\nimport { UserRepo } from './user'",
      });
      const result = await agent.processTask(task);

      const output = result.result as IntegrationOutput;
      expect(output.connections.length).toBe(2);
      expect(output.connections[0].protocol).toBe('import');
      expect(output.connections[0].status).toBe('connected');
    });

    it('should calculate coverage percentage', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: "import { A } from './a'\nimport { B } from './b'",
      });
      const result = await agent.processTask(task);

      const output = result.result as IntegrationOutput;
      expect(output.coverage).toBe(100); // All connections are 'connected'
    });

    it('should report healthy when no issues', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'All modules are properly connected and working' });
      const result = await agent.processTask(task);

      const output = result.result as IntegrationOutput;
      expect(output.healthStatus).toBe('healthy');
    });

    it('should use custom verify function when provided', async () => {
      const customOutput: IntegrationOutput = {
        connections: [{ source: 'A', target: 'B', status: 'connected' }],
        issues: [],
        coverage: 100,
        healthStatus: 'healthy',
        summary: 'Custom verification',
      };
      const agent = new IntegrationAgent({
        queue,
        verifyFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as IntegrationOutput).summary).toBe('Custom verification');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setVerifyFunction
  // ==========================================================================

  describe('setVerifyFunction', () => {
    it('should override verify function', async () => {
      const agent = new IntegrationAgent({ queue });
      await agent.start();

      const customOutput: IntegrationOutput = {
        connections: [],
        issues: [],
        coverage: 50,
        healthStatus: 'degraded',
        summary: 'Overridden',
      };
      agent.setVerifyFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as IntegrationOutput).summary).toBe('Overridden');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on verify function error', async () => {
      const agent = new IntegrationAgent({
        queue,
        verifyFunction: jest.fn().mockRejectedValue(new Error('Verify failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Verify failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createIntegrationAgent', () => {
  it('should create IntegrationAgent', () => {
    const queue = makeMockQueue();
    const agent = createIntegrationAgent(queue);
    expect(agent).toBeInstanceOf(IntegrationAgent);
    expect(agent.teamType).toBe('code-quality');
  });
});
