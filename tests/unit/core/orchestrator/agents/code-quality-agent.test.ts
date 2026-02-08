/**
 * Code Quality Agent Tests
 */

import {
  CodeQualityAgent,
  createCodeQualityAgent,
} from '../../../../../src/core/orchestrator/agents/code-quality-agent';
import type {
  TestGenerationOutput,
  DeepReviewOutput,
  RefactoringOutput,
} from '../../../../../src/core/orchestrator/agents/code-quality-agent';
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
  content: string;
  files: Array<{ path: string; action: string; description?: string }>;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'test',
      from: 'development',
      to: 'qa',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: overrides.files || [],
    },
    content: overrides.content || 'Review the code',
  } as unknown as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('CodeQualityAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new CodeQualityAgent({ queue });
      expect(agent.teamType).toBe('qa');
      expect(agent.config.name).toBe('Code Quality Team');
      expect(agent.canHandle('test')).toBe(true);
      expect(agent.canHandle('review')).toBe(true);
      expect(agent.canHandle('refactor')).toBe(true);
    });
  });

  // ==========================================================================
  // processTask - test generation
  // ==========================================================================

  describe('processTask - test generation', () => {
    it('should generate tests from file references', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({
        type: 'test',
        files: [
          { path: 'src/auth.ts', action: 'modify' },
          { path: 'src/utils.ts', action: 'modify' },
        ],
      });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as TestGenerationOutput;
      expect(output.tests).toHaveLength(2);
      expect(output.totalGenerated).toBe(2);
      expect(output.estimatedCoverage).toBeDefined();
    });

    it('should use custom test generator', async () => {
      const customOutput: TestGenerationOutput = {
        summary: 'Custom tests',
        tests: [],
        totalGenerated: 0,
        estimatedCoverage: { functions: 80, branches: 70, lines: 85 },
      };
      const agent = new CodeQualityAgent({
        queue,
        testGenerator: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as TestGenerationOutput).summary).toBe('Custom tests');
    });

    it('should handle empty file list', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'test' }));
      const output = result.result as TestGenerationOutput;
      expect(output.tests).toHaveLength(0);
      expect(output.totalGenerated).toBe(0);
    });
  });

  // ==========================================================================
  // processTask - deep review
  // ==========================================================================

  describe('processTask - deep review', () => {
    it('should perform deep review', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Review this code' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DeepReviewOutput;
      expect(output.summary).toContain('Deep code review');
      expect(output.metrics).toBeDefined();
      expect(output.metrics.overall).toBeDefined();
      expect(typeof output.approved).toBe('boolean');
    });

    it('should detect "any" type usage', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Using any type for flexibility' });
      const result = await agent.processTask(task);
      const output = result.result as DeepReviewOutput;

      expect(output.findings.some((f) => f.message.includes('any'))).toBe(true);
    });

    it('should detect console.log usage', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'review', content: 'Added console.log for debugging' });
      const result = await agent.processTask(task);
      const output = result.result as DeepReviewOutput;

      expect(output.findings.some((f) => f.category === 'Logging')).toBe(true);
    });

    it('should use custom deep reviewer', async () => {
      const customOutput: DeepReviewOutput = {
        summary: 'Custom review',
        findings: [],
        metrics: { complexity: 50, maintainability: 90, testability: 85, security: 95, overall: 80 },
        approved: true,
        reason: 'Looks good',
        actionItems: [],
      };
      const agent = new CodeQualityAgent({
        queue,
        deepReviewer: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'review' }));
      expect((result.result as DeepReviewOutput).summary).toBe('Custom review');
    });
  });

  // ==========================================================================
  // processTask - refactoring
  // ==========================================================================

  describe('processTask - refactoring', () => {
    it('should analyze refactoring opportunities', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'refactor', content: 'Refactor the utils module' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as RefactoringOutput;
      expect(output.summary).toContain('Refactoring analysis');
      expect(output.codeHealth).toBeDefined();
      expect(output.technicalDebtScore).toBeDefined();
    });

    it('should detect complex conditionals', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const task = makeTask({
        type: 'refactor',
        content: 'if (a) { } else if (b) { } else { }',
      });
      const result = await agent.processTask(task);
      const output = result.result as RefactoringOutput;

      expect(output.suggestions.some((s) => s.type === 'decompose-conditional')).toBe(true);
    });

    it('should use custom refactoring analyzer', async () => {
      const customOutput: RefactoringOutput = {
        summary: 'Custom analysis',
        suggestions: [],
        technicalDebtScore: 10,
        codeHealth: { duplications: 5, complexity: 10, coupling: 15, cohesion: 90 },
        prioritizedOrder: [],
      };
      const agent = new CodeQualityAgent({
        queue,
        refactoringAnalyzer: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'refactor' }));
      expect((result.result as RefactoringOutput).summary).toBe('Custom analysis');
    });
  });

  // ==========================================================================
  // Setter methods
  // ==========================================================================

  describe('setter methods', () => {
    it('should set test generator at runtime', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const customOutput: TestGenerationOutput = {
        summary: 'Runtime generator',
        tests: [],
        totalGenerated: 0,
        estimatedCoverage: { functions: 100, branches: 100, lines: 100 },
      };
      agent.setTestGenerator(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as TestGenerationOutput).summary).toBe('Runtime generator');
    });

    it('should set deep reviewer at runtime', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const customOutput: DeepReviewOutput = {
        summary: 'Runtime reviewer',
        findings: [],
        metrics: { complexity: 0, maintainability: 100, testability: 100, security: 100, overall: 100 },
        approved: true,
        reason: 'Perfect',
        actionItems: [],
      };
      agent.setDeepReviewer(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask({ type: 'review' }));
      expect((result.result as DeepReviewOutput).summary).toBe('Runtime reviewer');
    });

    it('should set refactoring analyzer at runtime', async () => {
      const agent = new CodeQualityAgent({ queue });
      await agent.start();

      const customOutput: RefactoringOutput = {
        summary: 'Runtime analyzer',
        suggestions: [],
        technicalDebtScore: 0,
        codeHealth: { duplications: 0, complexity: 0, coupling: 0, cohesion: 100 },
        prioritizedOrder: [],
      };
      agent.setRefactoringAnalyzer(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask({ type: 'refactor' }));
      expect((result.result as RefactoringOutput).summary).toBe('Runtime analyzer');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle test generator error', async () => {
      const agent = new CodeQualityAgent({
        queue,
        testGenerator: jest.fn().mockRejectedValue(new Error('Generator failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Generator failed');
    });

    it('should handle reviewer error', async () => {
      const agent = new CodeQualityAgent({
        queue,
        deepReviewer: jest.fn().mockRejectedValue(new Error('Review failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask({ type: 'review' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Review failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createCodeQualityAgent', () => {
  it('should create CodeQualityAgent', () => {
    const agent = createCodeQualityAgent(makeMockQueue());
    expect(agent).toBeInstanceOf(CodeQualityAgent);
  });
});
