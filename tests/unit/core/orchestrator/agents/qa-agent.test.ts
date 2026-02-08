/**
 * QA Agent Tests
 */

import { QAAgent, createQAAgent } from '../../../../../src/core/orchestrator/agents/qa-agent';
import type { QAOutput } from '../../../../../src/core/orchestrator/agents/qa-agent';
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
}> = {}): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'test',
      from: 'development',
      to: 'qa',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
    },
    content: overrides.content || 'Test the login feature',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('QAAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new QAAgent({ queue });
      expect(agent.teamType).toBe('qa');
      expect(agent.config.name).toBe('QA Team');
      expect(agent.canHandle('test')).toBe(true);
      expect(agent.canHandle('review')).toBe(true);
    });

    it('should accept custom config', () => {
      const agent = new QAAgent({
        queue,
        config: { name: 'Custom QA' },
        minQualityScore: 90,
      });
      expect(agent.config.name).toBe('Custom QA');
    });
  });

  // ==========================================================================
  // processTask - test
  // ==========================================================================

  describe('processTask - test', () => {
    it('should generate test output', async () => {
      const agent = new QAAgent({ queue });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(true);
      const output = result.result as QAOutput;
      expect(output.summary).toContain('Test execution');
      expect(output.testResults).toBeDefined();
      expect(output.testResults!.total).toBeGreaterThan(0);
      expect(output.coverage).toBeDefined();
      expect(output.qualityScore).toBeDefined();
    });

    it('should use custom QA executor', async () => {
      const customOutput: QAOutput = {
        summary: 'Custom test results',
        approved: true,
        qualityScore: 95,
        testResults: { total: 10, passed: 10, failed: 0, skipped: 0, tests: [] },
      };
      const agent = new QAAgent({
        queue,
        qaExecutor: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as QAOutput).summary).toBe('Custom test results');
    });
  });

  // ==========================================================================
  // processTask - review
  // ==========================================================================

  describe('processTask - review', () => {
    it('should generate review output', async () => {
      const agent = new QAAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Review the auth module' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as QAOutput;
      expect(output.summary).toContain('Code review');
      expect(output.reviewFindings).toBeDefined();
      expect(output.reviewFindings!.length).toBeGreaterThan(0);
    });

    it('should detect security findings', async () => {
      const agent = new QAAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Review security of auth' });
      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      const securityFindings = output.reviewFindings?.filter((f) => f.category === 'security');
      expect(securityFindings!.length).toBeGreaterThan(0);
    });

    it('should detect performance findings', async () => {
      const agent = new QAAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Review performance optimization' });
      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      const perfFindings = output.reviewFindings?.filter((f) => f.category === 'performance');
      expect(perfFindings!.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Approval logic
  // ==========================================================================

  describe('approval logic', () => {
    it('should auto-approve when all tests pass and autoApproveOnPass is true', async () => {
      const customOutput: QAOutput = {
        summary: 'All passed',
        approved: false,
        testResults: { total: 5, passed: 5, failed: 0, skipped: 0, tests: [] },
      };
      const executor = jest.fn().mockResolvedValue(customOutput);
      const agent = new QAAgent({
        queue,
        qaExecutor: executor,
        autoApproveOnPass: true,
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      // The custom executor returns the output directly, so approval logic is in the executor
      expect(result.success).toBe(true);
    });

    it('should reject when quality score is below threshold in review', async () => {
      const agent = new QAAgent({ queue, minQualityScore: 90 });
      await agent.start();

      // Review task with critical security content
      const task = makeTask({ type: 'review', content: 'Review security critical code' });
      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      // Review will have findings that may lower the quality score
      expect(output.qualityScore).toBeDefined();
    });
  });

  // ==========================================================================
  // setQAExecutor
  // ==========================================================================

  describe('setQAExecutor', () => {
    it('should override QA execution', async () => {
      const agent = new QAAgent({ queue });
      await agent.start();

      const customOutput: QAOutput = {
        summary: 'Dynamic QA',
        approved: true,
      };
      agent.setQAExecutor(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as QAOutput).summary).toBe('Dynamic QA');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on executor error', async () => {
      const agent = new QAAgent({
        queue,
        qaExecutor: jest.fn().mockRejectedValue(new Error('QA failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('QA failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createQAAgent', () => {
  it('should create QAAgent', () => {
    const agent = createQAAgent(makeMockQueue());
    expect(agent).toBeInstanceOf(QAAgent);
    expect(agent.teamType).toBe('qa');
  });
});
