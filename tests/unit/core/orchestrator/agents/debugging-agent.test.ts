/**
 * Debugging Agent Tests
 */

import {
  DebuggingAgent,
  createDebuggingAgent,
} from '../../../../../src/core/orchestrator/agents/debugging-agent';
import type { DebuggingOutput } from '../../../../../src/core/orchestrator/agents/debugging-agent';
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
      type: overrides.type || 'bugfix',
      from: 'development',
      to: 'issue-response',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
    },
    content: overrides.content || 'Debug the login crash issue',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('DebuggingAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new DebuggingAgent({ queue });
      expect(agent.teamType).toBe('issue-response');
      expect(agent.config.name).toBe('Debugging Team');
      expect(agent.config.description).toBe('Root cause analysis and systematic debugging');
    });

    it('should accept custom config', () => {
      const agent = new DebuggingAgent({
        queue,
        config: { name: 'Custom Debug Team' },
      });
      expect(agent.config.name).toBe('Custom Debug Team');
    });

    it('should register handlers for bugfix and analysis task types', () => {
      const agent = new DebuggingAgent({ queue });
      expect(agent.canHandle('bugfix')).toBe(true);
      expect(agent.canHandle('analysis')).toBe(true);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have root-cause-analysis capability', () => {
      const agent = new DebuggingAgent({ queue });
      const cap = agent.getCapability('bugfix');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('root-cause-analysis');
      expect(cap!.priority).toBe(88);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should generate hypotheses for crash-related content', async () => {
      const agent = new DebuggingAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Application crash when submitting form' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DebuggingOutput;
      expect(output.hypotheses.length).toBeGreaterThan(0);
      const crashHypothesis = output.hypotheses.find((h) =>
        h.description.toLowerCase().includes('crash')
      );
      expect(crashHypothesis).toBeDefined();
      expect(output.suggestedFix).toBeTruthy();
      expect(output.nextSteps).toBeDefined();
      expect(output.nextSteps!.length).toBeGreaterThan(0);
    });

    it('should generate hypotheses for null/undefined issues', async () => {
      const agent = new DebuggingAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'TypeError: Cannot read property of null' });
      const result = await agent.processTask(task);

      const output = result.result as DebuggingOutput;
      const nullHypothesis = output.hypotheses.find((h) =>
        h.description.toLowerCase().includes('null')
      );
      expect(nullHypothesis).toBeDefined();
      expect(nullHypothesis!.confidence).toBeGreaterThan(0.5);
    });

    it('should collect evidence from error messages', async () => {
      const agent = new DebuggingAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: 'Error: Connection refused\nat module.connect()',
      });
      const result = await agent.processTask(task);

      const output = result.result as DebuggingOutput;
      expect(output.evidence.length).toBeGreaterThan(0);
      const errorEvidence = output.evidence.find((e) => e.source === 'error-message');
      expect(errorEvidence).toBeDefined();
      expect(errorEvidence!.relevance).toBe('high');
    });

    it('should use custom debug function when provided', async () => {
      const customOutput: DebuggingOutput = {
        rootCause: 'Custom root cause',
        hypotheses: [{ description: 'Custom hypothesis', confidence: 0.9, verified: true }],
        evidence: [],
        suggestedFix: 'Custom fix',
      };
      const agent = new DebuggingAgent({
        queue,
        debugFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(true);
      expect((result.result as DebuggingOutput).rootCause).toBe('Custom root cause');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new DebuggingAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setDebugFunction
  // ==========================================================================

  describe('setDebugFunction', () => {
    it('should override debug function', async () => {
      const agent = new DebuggingAgent({ queue });
      await agent.start();

      const customOutput: DebuggingOutput = {
        rootCause: 'Overridden root cause',
        hypotheses: [],
        evidence: [],
        suggestedFix: 'Overridden fix',
      };
      agent.setDebugFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as DebuggingOutput).rootCause).toBe('Overridden root cause');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on debug function error', async () => {
      const agent = new DebuggingAgent({
        queue,
        debugFunction: jest.fn().mockRejectedValue(new Error('Debug failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Debug failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createDebuggingAgent', () => {
  it('should create DebuggingAgent', () => {
    const queue = makeMockQueue();
    const agent = createDebuggingAgent(queue);
    expect(agent).toBeInstanceOf(DebuggingAgent);
    expect(agent.teamType).toBe('issue-response');
  });
});
