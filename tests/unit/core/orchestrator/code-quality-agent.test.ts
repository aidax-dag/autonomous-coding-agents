/**
 * Code Quality Agent Tests
 *
 * Tests for CodeQualityAgent including test generation, deep review, and refactoring.
 */

import {
  CodeQualityAgent,
  createCodeQualityAgent,
  TestGenerationOutput,
  DeepReviewOutput,
  RefactoringOutput,
} from '../../../../src/core/orchestrator/agents/code-quality-agent';
import { DocumentQueue } from '../../../../src/core/workspace/document-queue';
import { WorkspaceManager } from '../../../../src/core/workspace/workspace-manager';
import { createTask } from '../../../../src/core/workspace/task-document';
import { TeamAgentStatus, TeamCapability } from '../../../../src/core/orchestrator/team-agent';

// Mock workspace
jest.mock('../../../../src/core/workspace/workspace-manager');
jest.mock('../../../../src/core/workspace/document-queue');

describe('CodeQualityAgent', () => {
  let agent: CodeQualityAgent;
  let mockQueue: jest.Mocked<DocumentQueue>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorkspace = new WorkspaceManager({ baseDir: '/test' }) as jest.Mocked<WorkspaceManager>;
    mockQueue = new DocumentQueue(mockWorkspace) as jest.Mocked<DocumentQueue>;

    // Setup mock methods
    mockQueue.subscribe = jest.fn();
    mockQueue.publish = jest.fn().mockResolvedValue(undefined);
    mockQueue.acknowledge = jest.fn().mockResolvedValue(undefined);

    agent = createCodeQualityAgent(mockQueue);
  });

  afterEach(async () => {
    if (agent) {
      await agent.stop();
    }
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      expect(agent).toBeInstanceOf(CodeQualityAgent);
    });

    it('should have correct default capabilities', () => {
      const config = agent.config;
      expect(config.name).toBe('Code Quality Team');
      expect(config.capabilities).toHaveLength(3);
      expect(config.capabilities?.map((c: TeamCapability) => c.name)).toEqual([
        'test-generation',
        'deep-review',
        'refactoring',
      ]);
    });

    it('should create agent with custom config', () => {
      const customAgent = createCodeQualityAgent(mockQueue, {
        config: {
          name: 'Custom QA Team',
          maxConcurrentTasks: 5,
        },
      });
      expect(customAgent.config.name).toBe('Custom QA Team');
    });
  });

  describe('setTestGenerator', () => {
    it('should allow setting custom test generator', async () => {
      const mockGenerator = jest.fn().mockResolvedValue({
        summary: 'Custom tests generated',
        tests: [],
        totalGenerated: 0,
        estimatedCoverage: { functions: 80, branches: 70, lines: 75 },
      } as TestGenerationOutput);

      agent.setTestGenerator(mockGenerator);

      await agent.start();

      const task = createTask({
        title: 'Generate Tests',
        content: 'Generate tests for auth module',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      // Process task manually
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(mockGenerator).toHaveBeenCalledWith(task);
    });
  });

  describe('setDeepReviewer', () => {
    it('should allow setting custom deep reviewer', async () => {
      const mockReviewer = jest.fn().mockResolvedValue({
        summary: 'Custom review completed',
        findings: [],
        metrics: {
          complexity: 80,
          maintainability: 85,
          testability: 75,
          security: 90,
          overall: 82,
        },
        approved: true,
        reason: 'Code meets standards',
        actionItems: [],
      } as DeepReviewOutput);

      agent.setDeepReviewer(mockReviewer);

      await agent.start();

      const task = createTask({
        title: 'Review Code',
        content: 'Review authentication module',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'high',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(mockReviewer).toHaveBeenCalledWith(task);
    });
  });

  describe('setRefactoringAnalyzer', () => {
    it('should allow setting custom refactoring analyzer', async () => {
      const mockAnalyzer = jest.fn().mockResolvedValue({
        summary: 'Refactoring analysis completed',
        suggestions: [],
        technicalDebtScore: 20,
        codeHealth: {
          duplications: 5,
          complexity: 15,
          coupling: 10,
          cohesion: 80,
        },
        prioritizedOrder: [],
      } as RefactoringOutput);

      agent.setRefactoringAnalyzer(mockAnalyzer);

      await agent.start();

      const task = createTask({
        title: 'Analyze Refactoring',
        content: 'Analyze code for refactoring opportunities',
        from: 'development',
        to: 'qa',
        type: 'refactor',
        priority: 'medium',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(mockAnalyzer).toHaveBeenCalledWith(task);
    });
  });

  describe('handleTestGeneration', () => {
    it('should generate tests with default implementation', async () => {
      await agent.start();

      const task = createTask({
        title: 'Generate Tests',
        content: 'Generate tests for user service',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
        files: [
          { path: 'src/services/user.ts', action: 'review', description: 'User service' },
          { path: 'src/services/auth.ts', action: 'review', description: 'Auth service' },
        ],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('summary');
      expect(result.result).toHaveProperty('tests');
      expect(result.result).toHaveProperty('totalGenerated');

      const output = result.result as TestGenerationOutput;
      expect(output.tests).toHaveLength(2);
      expect(output.totalGenerated).toBe(2);
    });

    it('should handle empty file list', async () => {
      await agent.start();

      const task = createTask({
        title: 'Generate Tests',
        content: 'Generate tests',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'medium',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as TestGenerationOutput;
      expect(output.tests).toHaveLength(0);
      expect(output.totalGenerated).toBe(0);
    });
  });

  describe('handleDeepReview', () => {
    it('should perform deep review with default implementation', async () => {
      await agent.start();

      const task = createTask({
        title: 'Deep Review',
        content: 'Review code with any types and console.log statements',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'high',
        files: [{ path: 'src/index.ts', action: 'review' }],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('summary');
      expect(result.result).toHaveProperty('findings');
      expect(result.result).toHaveProperty('metrics');
      expect(result.result).toHaveProperty('approved');

      const output = result.result as DeepReviewOutput;
      expect(output.findings.length).toBeGreaterThan(0);
      expect(output.metrics.overall).toBeDefined();
    });

    it('should detect any type usage', async () => {
      await agent.start();

      const task = createTask({
        title: 'Review Any Types',
        content: 'Code contains any type',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'high',
      });

      const result = await agent.processTask(task);
      const output = result.result as DeepReviewOutput;

      const anyFinding = output.findings.find(
        (f) => f.message.toLowerCase().includes('any')
      );
      expect(anyFinding).toBeDefined();
    });

    it('should detect console.log usage', async () => {
      await agent.start();

      const task = createTask({
        title: 'Review Console',
        content: 'Code has console.log statements',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'medium',
      });

      const result = await agent.processTask(task);
      const output = result.result as DeepReviewOutput;

      const consoleFinding = output.findings.find(
        (f) => f.message.toLowerCase().includes('console')
      );
      expect(consoleFinding).toBeDefined();
    });
  });

  describe('handleRefactoring', () => {
    it('should analyze refactoring opportunities with default implementation', async () => {
      await agent.start();

      const task = createTask({
        title: 'Refactoring Analysis',
        content: `function a() {}
function b() {}
function c() {}
function d() {}
function e() {}
function f() {}`,
        from: 'development',
        to: 'qa',
        type: 'refactor',
        priority: 'medium',
        files: [{ path: 'src/utils.ts', action: 'review' }],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('summary');
      expect(result.result).toHaveProperty('suggestions');
      expect(result.result).toHaveProperty('technicalDebtScore');
      expect(result.result).toHaveProperty('codeHealth');

      const output = result.result as RefactoringOutput;
      expect(output.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect complex conditionals', async () => {
      await agent.start();

      const task = createTask({
        title: 'Refactoring Conditionals',
        content: 'if (a) {} else if (b) {} else {}',
        from: 'development',
        to: 'qa',
        type: 'refactor',
        priority: 'low',
      });

      const result = await agent.processTask(task);
      const output = result.result as RefactoringOutput;

      const conditionalSuggestion = output.suggestions.find(
        (s) => s.type === 'decompose-conditional'
      );
      expect(conditionalSuggestion).toBeDefined();
    });

    it('should calculate technical debt score', async () => {
      await agent.start();

      const task = createTask({
        title: 'Tech Debt Analysis',
        content: 'Clean code with no issues',
        from: 'development',
        to: 'qa',
        type: 'refactor',
        priority: 'medium',
      });

      const result = await agent.processTask(task);
      const output = result.result as RefactoringOutput;

      expect(output.technicalDebtScore).toBeGreaterThanOrEqual(0);
      expect(output.technicalDebtScore).toBeLessThanOrEqual(100);
    });
  });

  describe('lifecycle', () => {
    it('should start and stop correctly', async () => {
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);

      await agent.start();
      expect(agent.status).toBe(TeamAgentStatus.IDLE);

      await agent.stop();
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should handle multiple start calls', async () => {
      await agent.start();
      await agent.start(); // Should not throw
      expect(agent.status).toBe(TeamAgentStatus.IDLE);
    });

    it('should handle multiple stop calls', async () => {
      await agent.start();
      await agent.stop();
      await agent.stop(); // Should not throw
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });
  });

  describe('error handling', () => {
    it('should handle test generator errors', async () => {
      agent.setTestGenerator(jest.fn().mockRejectedValue(new Error('Generator failed')));

      await agent.start();

      const task = createTask({
        title: 'Failing Test',
        content: 'This will fail',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Generator failed');
    });

    it('should handle reviewer errors', async () => {
      agent.setDeepReviewer(jest.fn().mockRejectedValue(new Error('Review failed')));

      await agent.start();

      const task = createTask({
        title: 'Failing Review',
        content: 'This will fail',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'high',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Review failed');
    });

    it('should handle refactoring analyzer errors', async () => {
      agent.setRefactoringAnalyzer(
        jest.fn().mockRejectedValue(new Error('Analysis failed'))
      );

      await agent.start();

      const task = createTask({
        title: 'Failing Analysis',
        content: 'This will fail',
        from: 'development',
        to: 'qa',
        type: 'refactor',
        priority: 'medium',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis failed');
    });
  });
});
