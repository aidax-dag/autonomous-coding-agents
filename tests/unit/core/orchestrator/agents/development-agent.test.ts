/**
 * Development Agent Tests
 */

import {
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,
} from '../../../../../src/core/orchestrator/agents/development-agent';
import type { DevelopmentOutput } from '../../../../../src/core/orchestrator/agents/development-agent';
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
  files: Array<{ path: string; action: string; description?: string }>;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'feature',
      from: 'orchestrator',
      to: 'development',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      files: overrides.files || [],
    },
    content: overrides.content || 'Implement a new feature',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('DevelopmentAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should default to development team type', () => {
      const agent = new DevelopmentAgent({ queue });
      expect(agent.teamType).toBe('development');
    });

    it('should set frontend team type for frontend specialization', () => {
      const agent = new DevelopmentAgent({ queue, specialization: 'frontend' });
      expect(agent.teamType).toBe('frontend');
    });

    it('should set backend team type for backend specialization', () => {
      const agent = new DevelopmentAgent({ queue, specialization: 'backend' });
      expect(agent.teamType).toBe('backend');
    });

    it('should handle feature, bugfix, refactor task types', () => {
      const agent = new DevelopmentAgent({ queue });
      expect(agent.canHandle('feature')).toBe(true);
      expect(agent.canHandle('bugfix')).toBe(true);
      expect(agent.canHandle('refactor')).toBe(true);
    });
  });

  // ==========================================================================
  // Accessors
  // ==========================================================================

  describe('accessors', () => {
    it('should return specialization', () => {
      const agent = new DevelopmentAgent({ queue, specialization: 'frontend' });
      expect(agent.getSpecialization()).toBe('frontend');
    });

    it('should return default specialization', () => {
      const agent = new DevelopmentAgent({ queue });
      expect(agent.getSpecialization()).toBe('fullstack');
    });

    it('should return supported languages', () => {
      const agent = new DevelopmentAgent({ queue });
      expect(agent.getSupportedLanguages()).toContain('typescript');
    });

    it('should accept custom languages', () => {
      const agent = new DevelopmentAgent({ queue, supportedLanguages: ['rust', 'go'] });
      expect(agent.getSupportedLanguages()).toEqual(['rust', 'go']);
    });
  });

  // ==========================================================================
  // processTask - feature
  // ==========================================================================

  describe('processTask - feature', () => {
    it('should process feature task with default output', async () => {
      const agent = new DevelopmentAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Implemented');
    });

    it('should use custom code executor', async () => {
      const customOutput: DevelopmentOutput = {
        summary: 'Custom implementation',
        filesModified: [{ path: 'src/app.ts', action: 'modified', description: 'Updated' }],
      };
      const agent = new DevelopmentAgent({
        queue,
        codeExecutor: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as DevelopmentOutput).summary).toBe('Custom implementation');
    });

    it('should include file refs from task metadata', async () => {
      const agent = new DevelopmentAgent({ queue });
      await agent.start();

      const task = makeTask({
        files: [
          { path: 'src/auth.ts', action: 'modify', description: 'Add auth logic' },
          { path: 'src/types.ts', action: 'create', description: 'Add types' },
        ],
      });
      const result = await agent.processTask(task);
      const output = result.result as DevelopmentOutput;
      expect(output.filesModified).toHaveLength(2);
    });
  });

  // ==========================================================================
  // processTask - bugfix
  // ==========================================================================

  describe('processTask - bugfix', () => {
    it('should process bugfix task', async () => {
      const agent = new DevelopmentAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'bugfix' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Fixed');
      expect(output.tests).toBeDefined();
    });
  });

  // ==========================================================================
  // processTask - refactor
  // ==========================================================================

  describe('processTask - refactor', () => {
    it('should process refactor task', async () => {
      const agent = new DevelopmentAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'refactor' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Refactored');
      expect(output.reviewNotes).toContain('No functional changes expected');
    });
  });

  // ==========================================================================
  // autoCreateReview
  // ==========================================================================

  describe('autoCreateReview', () => {
    it('should create review task when enabled', async () => {
      const agent = new DevelopmentAgent({ queue, autoCreateReview: true });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.outputTasks).toBeDefined();
      expect(result.outputTasks!.length).toBeGreaterThan(0);
      expect(queue.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'review',
        to: 'code-quality',
      }));
    });

    it('should not create review task when disabled', async () => {
      const agent = new DevelopmentAgent({ queue, autoCreateReview: false });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.outputTasks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on executor error', async () => {
      const agent = new DevelopmentAgent({
        queue,
        codeExecutor: jest.fn().mockRejectedValue(new Error('Execution failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });
  });

  // ==========================================================================
  // setCodeExecutor
  // ==========================================================================

  describe('setCodeExecutor', () => {
    it('should override code execution', async () => {
      const agent = new DevelopmentAgent({ queue });
      await agent.start();

      const customOutput: DevelopmentOutput = {
        summary: 'Dynamic executor',
        filesModified: [],
      };
      agent.setCodeExecutor(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as DevelopmentOutput).summary).toBe('Dynamic executor');
    });
  });
});

// ============================================================================
// Factory Functions
// ============================================================================

describe('factory functions', () => {
  it('createDevelopmentAgent should create fullstack agent', () => {
    const agent = createDevelopmentAgent(makeMockQueue());
    expect(agent).toBeInstanceOf(DevelopmentAgent);
    expect(agent.teamType).toBe('development');
  });

  it('createFrontendAgent should create frontend agent', () => {
    const agent = createFrontendAgent(makeMockQueue());
    expect(agent.teamType).toBe('frontend');
    expect(agent.getSupportedLanguages()).toContain('css');
  });

  it('createBackendAgent should create backend agent', () => {
    const agent = createBackendAgent(makeMockQueue());
    expect(agent.teamType).toBe('backend');
    expect(agent.getSupportedLanguages()).toContain('go');
  });
});
