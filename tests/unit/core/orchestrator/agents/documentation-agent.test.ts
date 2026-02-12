/**
 * Documentation Agent Tests
 */

import {
  DocumentationAgent,
  createDocumentationAgent,
} from '../../../../../src/core/orchestrator/agents/documentation-agent';
import type { DocumentationOutput } from '../../../../../src/core/orchestrator/agents/documentation-agent';
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
      type: overrides.type || 'documentation',
      from: 'orchestrator',
      to: 'planning',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      files: overrides.files,
    },
    content: overrides.content || 'Document the authentication module',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('DocumentationAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new DocumentationAgent({ queue });
      expect(agent.teamType).toBe('planning');
      expect(agent.config.name).toBe('Documentation Team');
      expect(agent.config.description).toBe('Documentation generation and maintenance');
    });

    it('should accept custom config', () => {
      const agent = new DocumentationAgent({
        queue,
        config: { name: 'Custom Docs Team' },
      });
      expect(agent.config.name).toBe('Custom Docs Team');
    });

    it('should register handlers for documentation and planning task types', () => {
      const agent = new DocumentationAgent({ queue });
      expect(agent.canHandle('documentation')).toBe(true);
      expect(agent.canHandle('planning')).toBe(true);
    });

    it('should accept custom default format', () => {
      const agent = new DocumentationAgent({ queue, defaultFormat: 'html' });
      expect(agent.getDefaultFormat()).toBe('html');
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have documentation-generation capability', () => {
      const agent = new DocumentationAgent({ queue });
      const cap = agent.getCapability('documentation');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('documentation-generation');
      expect(cap!.priority).toBe(80);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should generate documentation with overview section', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Document the user authentication system' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DocumentationOutput;
      expect(output.sections.length).toBeGreaterThan(0);
      const overview = output.sections.find((s) => s.type === 'overview');
      expect(overview).toBeDefined();
      expect(output.format).toBe('markdown');
    });

    it('should detect API-related content and add API section', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Document the REST API endpoints for user management' });
      const result = await agent.processTask(task);

      const output = result.result as DocumentationOutput;
      const apiSection = output.sections.find((s) => s.type === 'api');
      expect(apiSection).toBeDefined();
    });

    it('should detect example-related content and add examples section', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const task = makeTask({
        content: 'Document with usage examples for the SDK',
      });
      const result = await agent.processTask(task);

      const output = result.result as DocumentationOutput;
      const exampleSection = output.sections.find((s) => s.type === 'example');
      expect(exampleSection).toBeDefined();
    });

    it('should track covered files', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const task = makeTask({
        files: [
          { path: 'src/auth.ts', action: 'read' },
          { path: 'src/user.ts', action: 'read' },
        ],
      });
      const result = await agent.processTask(task);

      const output = result.result as DocumentationOutput;
      expect(output.coveredFiles).toBeDefined();
      expect(output.coveredFiles!.length).toBe(2);
      expect(output.coveredFiles).toContain('src/auth.ts');
    });

    it('should use custom generate function when provided', async () => {
      const customOutput: DocumentationOutput = {
        sections: [{ title: 'Custom', content: 'Custom docs', type: 'overview' }],
        summary: 'Custom summary',
        format: 'html',
      };
      const agent = new DocumentationAgent({
        queue,
        generateFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as DocumentationOutput).summary).toBe('Custom summary');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setGenerateFunction
  // ==========================================================================

  describe('setGenerateFunction', () => {
    it('should override generate function', async () => {
      const agent = new DocumentationAgent({ queue });
      await agent.start();

      const customOutput: DocumentationOutput = {
        sections: [],
        summary: 'Overridden',
        format: 'jsdoc',
      };
      agent.setGenerateFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as DocumentationOutput).summary).toBe('Overridden');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on generate function error', async () => {
      const agent = new DocumentationAgent({
        queue,
        generateFunction: jest.fn().mockRejectedValue(new Error('Docs failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Docs failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createDocumentationAgent', () => {
  it('should create DocumentationAgent', () => {
    const queue = makeMockQueue();
    const agent = createDocumentationAgent(queue);
    expect(agent).toBeInstanceOf(DocumentationAgent);
    expect(agent.teamType).toBe('planning');
  });
});
