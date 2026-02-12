/**
 * Architecture Agent Tests
 */

import {
  ArchitectureAgent,
  createArchitectureAgent,
} from '../../../../../src/core/orchestrator/agents/architecture-agent';
import type { ArchitectureOutput } from '../../../../../src/core/orchestrator/agents/architecture-agent';
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
    files: Array<{ path: string; action: string; description?: string }>;
  }> = {}
): TaskDocument {
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
      files: overrides.files,
    },
    content: overrides.content || 'Design the system architecture',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('ArchitectureAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new ArchitectureAgent({ queue });
      expect(agent.teamType).toBe('design');
      expect(agent.config.name).toBe('Architecture Team');
      expect(agent.config.description).toBe('System design and architectural analysis');
    });

    it('should accept custom config', () => {
      const agent = new ArchitectureAgent({
        queue,
        config: { name: 'Custom Arch Team' },
      });
      expect(agent.config.name).toBe('Custom Arch Team');
    });

    it('should register handlers for planning and analysis task types', () => {
      const agent = new ArchitectureAgent({ queue });
      expect(agent.canHandle('planning')).toBe(true);
      expect(agent.canHandle('analysis')).toBe(true);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have system-design capability', () => {
      const agent = new ArchitectureAgent({ queue });
      const cap = agent.getCapability('planning');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('system-design');
      expect(cap!.priority).toBe(90);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should generate default architecture analysis', async () => {
      const agent = new ArchitectureAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Design a microservice architecture with middleware' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as ArchitectureOutput;
      expect(output.patterns).toContain('Microservices Architecture');
      expect(output.patterns).toContain('Middleware Pattern');
      expect(output.tradeoffs.length).toBeGreaterThan(0);
      expect(output.recommendation).toBeTruthy();
    });

    it('should extract components from bullet points', async () => {
      const agent = new ArchitectureAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: 'Components:\n- AuthService\n- UserService\n- DatabaseLayer',
      });
      const result = await agent.processTask(task);

      const output = result.result as ArchitectureOutput;
      expect(output.components.length).toBe(3);
      expect(output.components[0].name).toBe('AuthService');
    });

    it('should use custom analyze function when provided', async () => {
      const customOutput: ArchitectureOutput = {
        components: [{ name: 'Custom', responsibility: 'custom', dependencies: [] }],
        patterns: ['Custom Pattern'],
        tradeoffs: [],
        recommendation: 'Custom recommendation',
      };
      const agent = new ArchitectureAgent({
        queue,
        analyzeFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(true);
      expect((result.result as ArchitectureOutput).recommendation).toBe('Custom recommendation');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new ArchitectureAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setAnalyzeFunction
  // ==========================================================================

  describe('setAnalyzeFunction', () => {
    it('should override analysis function', async () => {
      const agent = new ArchitectureAgent({ queue });
      await agent.start();

      const customOutput: ArchitectureOutput = {
        components: [],
        patterns: ['Overridden'],
        tradeoffs: [],
        recommendation: 'Overridden',
      };
      agent.setAnalyzeFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as ArchitectureOutput).recommendation).toBe('Overridden');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on analyze function error', async () => {
      const agent = new ArchitectureAgent({
        queue,
        analyzeFunction: jest.fn().mockRejectedValue(new Error('Analysis failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createArchitectureAgent', () => {
  it('should create ArchitectureAgent', () => {
    const queue = makeMockQueue();
    const agent = createArchitectureAgent(queue);
    expect(agent).toBeInstanceOf(ArchitectureAgent);
    expect(agent.teamType).toBe('design');
  });
});
