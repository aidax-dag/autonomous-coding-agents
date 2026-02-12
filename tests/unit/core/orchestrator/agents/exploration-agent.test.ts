/**
 * Exploration Agent Tests
 */

import {
  ExplorationAgent,
  createExplorationAgent,
} from '../../../../../src/core/orchestrator/agents/exploration-agent';
import type { ExplorationOutput } from '../../../../../src/core/orchestrator/agents/exploration-agent';
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
      type: overrides.type || 'analysis',
      from: 'orchestrator',
      to: 'development',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      files: overrides.files,
    },
    content: overrides.content || 'Explore the codebase structure',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('ExplorationAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new ExplorationAgent({ queue });
      expect(agent.teamType).toBe('development');
      expect(agent.config.name).toBe('Exploration Team');
      expect(agent.config.description).toBe('Codebase exploration and pattern discovery');
    });

    it('should accept custom config', () => {
      const agent = new ExplorationAgent({
        queue,
        config: { name: 'Custom Explorer' },
      });
      expect(agent.config.name).toBe('Custom Explorer');
    });

    it('should register handlers for analysis and planning task types', () => {
      const agent = new ExplorationAgent({ queue });
      expect(agent.canHandle('analysis')).toBe(true);
      expect(agent.canHandle('planning')).toBe(true);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have codebase-exploration capability', () => {
      const agent = new ExplorationAgent({ queue });
      const cap = agent.getCapability('analysis');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('codebase-exploration');
      expect(cap!.priority).toBe(85);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should extract symbols from TypeScript-like content', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: [
          'export function getUserData() {}',
          'export class AuthService {}',
          'export interface IUserRepository {}',
          'function internalHelper() {}',
        ].join('\n'),
      });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as ExplorationOutput;
      expect(output.symbols.length).toBe(4);

      const funcSymbol = output.symbols.find((s) => s.name === 'getUserData');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.type).toBe('function');
      expect(funcSymbol!.exported).toBe(true);

      const classSymbol = output.symbols.find((s) => s.name === 'AuthService');
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.type).toBe('class');

      const ifaceSymbol = output.symbols.find((s) => s.name === 'IUserRepository');
      expect(ifaceSymbol).toBeDefined();
      expect(ifaceSymbol!.type).toBe('interface');

      const internalSymbol = output.symbols.find((s) => s.name === 'internalHelper');
      expect(internalSymbol).toBeDefined();
      expect(internalSymbol!.exported).toBe(false);
    });

    it('should detect code patterns from content', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: 'This module uses the factory pattern and dependency injection for middleware',
      });
      const result = await agent.processTask(task);

      const output = result.result as ExplorationOutput;
      expect(output.patterns).toContain('Factory Pattern');
      expect(output.patterns).toContain('Dependency Injection');
      expect(output.patterns).toContain('Middleware Pattern');
    });

    it('should map files with correct types', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const task = makeTask({
        files: [
          { path: 'src/auth.ts', action: 'read' },
          { path: 'src/app.py', action: 'read' },
          { path: 'config.json', action: 'read' },
        ],
      });
      const result = await agent.processTask(task);

      const output = result.result as ExplorationOutput;
      expect(output.files.length).toBe(3);
      expect(output.files[0].type).toBe('typescript');
      expect(output.files[1].type).toBe('python');
      expect(output.files[2].type).toBe('json');
    });

    it('should generate exploration summary', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const result = await agent.processTask(makeTask());
      const output = result.result as ExplorationOutput;
      expect(output.summary).toContain('Exploration completed');
    });

    it('should use custom explore function when provided', async () => {
      const customOutput: ExplorationOutput = {
        files: [{ path: 'custom.ts', type: 'typescript' }],
        symbols: [],
        patterns: ['Custom Pattern'],
        summary: 'Custom exploration',
      };
      const agent = new ExplorationAgent({
        queue,
        exploreFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as ExplorationOutput).summary).toBe('Custom exploration');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setExploreFunction
  // ==========================================================================

  describe('setExploreFunction', () => {
    it('should override explore function', async () => {
      const agent = new ExplorationAgent({ queue });
      await agent.start();

      const customOutput: ExplorationOutput = {
        files: [],
        symbols: [],
        patterns: [],
        summary: 'Overridden',
      };
      agent.setExploreFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as ExplorationOutput).summary).toBe('Overridden');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on explore function error', async () => {
      const agent = new ExplorationAgent({
        queue,
        exploreFunction: jest.fn().mockRejectedValue(new Error('Explore failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Explore failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createExplorationAgent', () => {
  it('should create ExplorationAgent', () => {
    const queue = makeMockQueue();
    const agent = createExplorationAgent(queue);
    expect(agent).toBeInstanceOf(ExplorationAgent);
    expect(agent.teamType).toBe('development');
  });
});
