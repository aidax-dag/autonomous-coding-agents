/**
 * DocWriterAgent Unit Tests
 *
 * Feature: F1.8 - DocWriter Agent
 */

import {
  DocWriterAgent,
  DocWriterAgentConfig,
  createDocWriterAgent,
  CodeDocumentationPayloadSchema,
  ReadmeGenerationPayloadSchema,
  ApiDocumentationPayloadSchema,
  ChangelogPayloadSchema,
  UserGuidePayloadSchema,
  CodeDocumentationResponseSchema,
  ReadmeResponseSchema,
  ApiDocumentationResponseSchema,
  ChangelogResponseSchema,
  UserGuideResponseSchema,
  DocumentationType,
  DocumentationFormat,
  DetailLevel,
  ChangeType,
} from '../../../../src/core/agents/specialized/docwriter-agent';
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  type ITask,
} from '../../../../src/core/interfaces';
import type {
  AgentDependencies,
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  LLMResponse,
} from '../../../../src/core/agents/interfaces';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLLMClient = (): ILLMClient => ({
  complete: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      documentedCode: '/** @param x */ function test(x) {}',
      documentsAdded: 1,
      coverage: {
        functions: 100,
        classes: 100,
        interfaces: 100,
        total: 100,
      },
    }),
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    stopReason: 'end',
  } as LLMResponse),
  stream: jest.fn(),
  getProvider: jest.fn().mockReturnValue('claude'),
  getModel: jest.fn().mockReturnValue('claude-3'),
});

const createMockMessageBroker = (): IMessageBroker => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockResolvedValue({}),
  isConnected: jest.fn().mockReturnValue(true),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

const createMockLogger = (): IAgentLogger => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

const createDependencies = (): AgentDependencies => ({
  llmClient: createMockLLMClient(),
  messageBroker: createMockMessageBroker(),
  logger: createMockLogger(),
});

const createConfig = (overrides?: Partial<DocWriterAgentConfig>): DocWriterAgentConfig => ({
  id: 'docwriter-test-1',
  type: AgentType.DOC_WRITER,
  name: 'Test DocWriter Agent',
  llm: { provider: 'claude', model: 'claude-3' },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('DocWriterAgent', () => {
  let agent: DocWriterAgent;
  let dependencies: AgentDependencies;

  beforeEach(() => {
    dependencies = createDependencies();
  });

  afterEach(async () => {
    if (agent) {
      try {
        await agent.dispose();
      } catch {
        // Already disposed, ignore
      }
    }
  });

  describe('Construction', () => {
    it('should create agent with default config', () => {
      agent = new DocWriterAgent(createConfig(), dependencies);

      expect(agent.id).toBe('docwriter-test-1');
      expect(agent.name).toBe('Test DocWriter Agent');
      expect(agent.type).toBe(AgentType.DOC_WRITER);
      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should accept custom configuration', () => {
      agent = new DocWriterAgent(
        createConfig({
          defaultDetailLevel: DetailLevel.COMPREHENSIVE,
          defaultFormat: DocumentationFormat.HTML,
          maxCodeLength: 100000,
          enableAutoExamples: false,
          retry: {
            maxAttempts: 5,
            baseDelay: 2000,
            maxDelay: 20000,
          },
        }),
        dependencies
      );

      expect(agent).toBeInstanceOf(DocWriterAgent);
    });
  });

  describe('Lifecycle', () => {
    beforeEach(() => {
      agent = new DocWriterAgent(createConfig(), dependencies);
    });

    it('should initialize successfully', async () => {
      await agent.initialize();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        'DocWriterAgent initializing',
        expect.objectContaining({
          defaultDetailLevel: 'standard',
        })
      );
    });

    it('should start successfully', async () => {
      await agent.initialize();
      await agent.start();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });

    it('should pause and resume', async () => {
      await agent.initialize();
      await agent.start();

      await agent.pause();
      expect(agent.getState().status).toBe(AgentStatus.PAUSED);

      await agent.resume();
      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });

    it('should stop gracefully', async () => {
      await agent.initialize();
      await agent.start();
      await agent.stop();

      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should dispose and cleanup', async () => {
      await agent.initialize();
      await agent.start();
      await agent.dispose();

      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });
  });

  describe('Capabilities', () => {
    beforeEach(() => {
      agent = new DocWriterAgent(createConfig(), dependencies);
    });

    it('should return all docwriter capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'code-documentation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'readme-generation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'api-documentation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'changelog-generation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'user-guide-generation' })
      );
    });

    it('should have correct capability count', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toHaveLength(5);
    });
  });

  describe('Code Documentation Task', () => {
    const createCodeDocTask = (): ITask => ({
      id: 'task-codedoc-1',
      type: 'code-documentation',
      agentType: AgentType.DOC_WRITER,
      payload: {
        code: {
          content: 'function add(a, b) { return a + b; }',
          language: 'javascript',
          filePath: 'utils/math.js',
        },
        style: 'jsdoc',
        detailLevel: 'standard',
        includeExamples: true,
        includeTypes: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process code documentation task successfully', async () => {
      const task = createCodeDocTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { documentation: unknown };
      expect(data.documentation).toBeDefined();
    });

    it('should call LLM for code documentation', async () => {
      const task = createCodeDocTask();
      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ maxTokens: 8000 })
      );
    });

    it('should fail with invalid payload', async () => {
      const task: ITask = {
        id: 'task-invalid',
        type: 'code-documentation',
        agentType: AgentType.DOC_WRITER,
        payload: { code: { content: '' } }, // Missing language, empty content
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid payload');
    });

    it('should fail if code exceeds max length', async () => {
      agent = new DocWriterAgent(
        createConfig({ maxCodeLength: 10 }),
        dependencies
      );
      await agent.initialize();
      await agent.start();

      const task: ITask = {
        id: 'task-too-long',
        type: 'code-documentation',
        agentType: AgentType.DOC_WRITER,
        payload: {
          code: {
            content: 'a'.repeat(100),
            language: 'javascript',
          },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('exceeds maximum length');
    });
  });

  describe('README Generation Task', () => {
    const createReadmeTask = (): ITask => ({
      id: 'task-readme-1',
      type: 'readme-generation',
      agentType: AgentType.DOC_WRITER,
      payload: {
        project: {
          name: 'awesome-project',
          description: 'An awesome project for awesome things',
          language: 'TypeScript',
          framework: 'Node.js',
        },
        sections: ['overview', 'installation', 'usage', 'api'],
        updateMode: 'create',
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock README response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          content: '# awesome-project\n\nAn awesome project...',
          sections: [
            { name: 'overview', content: '## Overview\n...' },
            { name: 'installation', content: '## Installation\n...' },
          ],
          metadata: {
            wordCount: 500,
            hasInstallation: true,
            hasUsage: true,
            hasExamples: true,
          },
        }),
        usage: { inputTokens: 150, outputTokens: 400, totalTokens: 550 },
        stopReason: 'end',
      });

      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process readme generation task successfully', async () => {
      const task = createReadmeTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { readme: unknown };
      expect(data.readme).toBeDefined();
    });

    it('should include project name in result', async () => {
      const task = createReadmeTask();
      const result = await agent.processTask(task);

      const data = result.data as { projectName: string; updateMode: string };
      expect(data.projectName).toBe('awesome-project');
      expect(data.updateMode).toBe('create');
    });
  });

  describe('API Documentation Task', () => {
    const createApiDocTask = (): ITask => ({
      id: 'task-apidoc-1',
      type: 'api-documentation',
      agentType: AgentType.DOC_WRITER,
      payload: {
        api: {
          name: 'User API',
          version: 'v1',
          baseUrl: 'https://api.example.com',
          endpoints: [
            { method: 'GET', path: '/users', description: 'List all users' },
            { method: 'POST', path: '/users', description: 'Create a user' },
          ],
          types: [
            { name: 'User', properties: { id: 'string', name: 'string' } },
          ],
        },
        format: 'markdown',
        includeExamples: true,
        includeSchemas: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock API doc response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          documentation: '# User API\n\n## Endpoints\n...',
          endpoints: [
            { method: 'GET', path: '/users', documentation: '## GET /users\n...' },
          ],
          schemas: [
            { name: 'User', documentation: '### User Schema\n...' },
          ],
          format: 'markdown',
        }),
        usage: { inputTokens: 200, outputTokens: 500, totalTokens: 700 },
        stopReason: 'end',
      });

      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process api documentation task successfully', async () => {
      const task = createApiDocTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { apiDocumentation: unknown };
      expect(data.apiDocumentation).toBeDefined();
    });

    it('should include api name in result', async () => {
      const task = createApiDocTask();
      const result = await agent.processTask(task);

      const data = result.data as { apiName: string; format: string };
      expect(data.apiName).toBe('User API');
      expect(data.format).toBe('markdown');
    });
  });

  describe('Changelog Generation Task', () => {
    const createChangelogTask = (): ITask => ({
      id: 'task-changelog-1',
      type: 'changelog-generation',
      agentType: AgentType.DOC_WRITER,
      payload: {
        version: '1.2.0',
        previousVersion: '1.1.0',
        changes: [
          { type: ChangeType.ADDED, description: 'New user authentication', scope: 'auth' },
          { type: ChangeType.FIXED, description: 'Login bug fix', issueRef: '#123' },
          { type: ChangeType.CHANGED, description: 'API response format', breaking: true },
        ],
        format: 'keepachangelog',
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock changelog response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          content: '## [1.2.0] - 2025-01-05\n\n### Added\n- New user authentication...',
          version: '1.2.0',
          date: '2025-01-05',
          changeCount: {
            added: 1,
            changed: 1,
            deprecated: 0,
            removed: 0,
            fixed: 1,
            security: 0,
          },
          hasBreakingChanges: true,
        }),
        usage: { inputTokens: 120, outputTokens: 300, totalTokens: 420 },
        stopReason: 'end',
      });

      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process changelog generation task successfully', async () => {
      const task = createChangelogTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { changelog: unknown };
      expect(data.changelog).toBeDefined();
    });

    it('should include version in result', async () => {
      const task = createChangelogTask();
      const result = await agent.processTask(task);

      const data = result.data as { version: string; format: string };
      expect(data.version).toBe('1.2.0');
      expect(data.format).toBe('keepachangelog');
    });
  });

  describe('User Guide Generation Task', () => {
    const createUserGuideTask = (): ITask => ({
      id: 'task-userguide-1',
      type: 'user-guide-generation',
      agentType: AgentType.DOC_WRITER,
      payload: {
        product: {
          name: 'My Product',
          description: 'A product that does amazing things',
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
        },
        targetAudience: 'beginner',
        includeTroubleshooting: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock user guide response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          content: '# My Product User Guide\n\n## Getting Started\n...',
          tableOfContents: [
            { level: 1, title: 'Getting Started', anchor: '#getting-started' },
            { level: 2, title: 'Installation', anchor: '#installation' },
          ],
          sections: [
            { title: 'Getting Started', content: '## Getting Started\n...' },
          ],
          metadata: {
            wordCount: 2000,
            estimatedReadTime: 10,
          },
        }),
        usage: { inputTokens: 180, outputTokens: 600, totalTokens: 780 },
        stopReason: 'end',
      });

      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process user guide generation task successfully', async () => {
      const task = createUserGuideTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { userGuide: unknown };
      expect(data.userGuide).toBeDefined();
    });

    it('should include product info in result', async () => {
      const task = createUserGuideTask();
      const result = await agent.processTask(task);

      const data = result.data as { productName: string; targetAudience: string };
      expect(data.productName).toBe('My Product');
      expect(data.targetAudience).toBe('beginner');
    });
  });

  describe('Unsupported Task', () => {
    beforeEach(async () => {
      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should fail for unsupported task type', async () => {
      const task: ITask = {
        id: 'task-unknown',
        type: 'unknown-task-type',
        agentType: AgentType.DOC_WRITER,
        payload: {},
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unsupported task type');
    });
  });

  describe('Malformed LLM Response Handling', () => {
    beforeEach(async () => {
      agent = new DocWriterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should handle malformed JSON gracefully', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: 'This is not valid JSON',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        stopReason: 'end',
      });

      const task: ITask = {
        id: 'task-malformed',
        type: 'code-documentation',
        agentType: AgentType.DOC_WRITER,
        payload: {
          code: {
            content: 'function test() {}',
            language: 'javascript',
          },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      // Should still complete with default/empty response
      expect(result.success).toBe(true);
      const data = result.data as { documentation: { documentedCode: string } };
      expect(data.documentation.documentedCode).toBe('');
    });
  });

  describe('Retry Behavior', () => {
    it('should retry on transient failures', async () => {
      const failingLLMClient = createMockLLMClient();
      (failingLLMClient.complete as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            documentedCode: '/** @param x */ function test(x) {}',
            documentsAdded: 1,
            coverage: { functions: 100, classes: 100, interfaces: 100, total: 100 },
          }),
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          stopReason: 'end',
        });

      const retryDependencies = {
        ...dependencies,
        llmClient: failingLLMClient,
      };

      agent = new DocWriterAgent(
        createConfig({
          retry: { maxAttempts: 3, baseDelay: 10, maxDelay: 100 },
        }),
        retryDependencies
      );
      await agent.initialize();
      await agent.start();

      const task: ITask = {
        id: 'task-retry',
        type: 'code-documentation',
        agentType: AgentType.DOC_WRITER,
        payload: {
          code: {
            content: 'function test() {}',
            language: 'javascript',
          },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(failingLLMClient.complete).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Schema Validation', () => {
  describe('CodeDocumentationPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        code: {
          content: 'function test() {}',
          language: 'javascript',
          filePath: 'test.js',
        },
        style: 'jsdoc',
        detailLevel: 'comprehensive',
      };

      const result = CodeDocumentationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        code: {
          content: 'function test() {}',
          language: 'javascript',
        },
      };

      const result = CodeDocumentationPayloadSchema.parse(payload);
      expect(result.style).toBe('jsdoc');
      expect(result.detailLevel).toBe(DetailLevel.STANDARD);
      expect(result.includeExamples).toBe(true);
      expect(result.includeTypes).toBe(true);
    });

    it('should reject empty content', () => {
      const payload = {
        code: {
          content: '',
          language: 'javascript',
        },
      };

      const result = CodeDocumentationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject empty language', () => {
      const payload = {
        code: {
          content: 'code',
          language: '',
        },
      };

      const result = CodeDocumentationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ReadmeGenerationPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        project: {
          name: 'my-project',
          description: 'A cool project',
          language: 'TypeScript',
        },
        sections: ['overview', 'installation'],
        updateMode: 'create',
      };

      const result = ReadmeGenerationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        project: {
          name: 'my-project',
          description: 'A cool project',
        },
      };

      const result = ReadmeGenerationPayloadSchema.parse(payload);
      expect(result.updateMode).toBe('create');
    });

    it('should reject empty name', () => {
      const payload = {
        project: {
          name: '',
          description: 'A cool project',
        },
      };

      const result = ReadmeGenerationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiDocumentationPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        api: {
          name: 'Test API',
          version: 'v1',
          endpoints: [
            { method: 'GET', path: '/test' },
          ],
        },
        format: 'markdown',
      };

      const result = ApiDocumentationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        api: {
          name: 'Test API',
        },
      };

      const result = ApiDocumentationPayloadSchema.parse(payload);
      expect(result.format).toBe(DocumentationFormat.MARKDOWN);
      expect(result.includeExamples).toBe(true);
      expect(result.includeSchemas).toBe(true);
    });
  });

  describe('ChangelogPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        version: '1.0.0',
        changes: [
          { type: ChangeType.ADDED, description: 'New feature' },
          { type: ChangeType.FIXED, description: 'Bug fix', issueRef: '#123' },
        ],
        format: 'keepachangelog',
      };

      const result = ChangelogPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults for change items', () => {
      const payload = {
        version: '1.0.0',
        changes: [
          { type: ChangeType.ADDED, description: 'New feature' },
        ],
      };

      const result = ChangelogPayloadSchema.parse(payload);
      expect(result.changes[0].breaking).toBe(false);
      expect(result.format).toBe('keepachangelog');
    });

    it('should reject empty version', () => {
      const payload = {
        version: '',
        changes: [],
      };

      const result = ChangelogPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('UserGuidePayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        product: {
          name: 'My Product',
          description: 'A great product',
          features: ['Feature 1', 'Feature 2'],
        },
        targetAudience: 'beginner',
      };

      const result = UserGuidePayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        product: {
          name: 'My Product',
          description: 'A great product',
          features: ['Feature 1'],
        },
      };

      const result = UserGuidePayloadSchema.parse(payload);
      expect(result.targetAudience).toBe('all');
      expect(result.includeScreenshots).toBe(false);
      expect(result.includeTroubleshooting).toBe(true);
    });
  });

  describe('Response Schemas', () => {
    describe('CodeDocumentationResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          documentedCode: '/** Documented */ function test() {}',
          documentsAdded: 5,
          coverage: {
            functions: 100,
            classes: 80,
            interfaces: 90,
            total: 90,
          },
        };

        const result = CodeDocumentationResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('ReadmeResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          content: '# Project\n\nDescription...',
          sections: [{ name: 'overview', content: '## Overview' }],
          metadata: {
            wordCount: 500,
            hasInstallation: true,
            hasUsage: true,
            hasExamples: false,
          },
        };

        const result = ReadmeResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('ApiDocumentationResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          documentation: '# API Docs',
          endpoints: [
            { method: 'GET', path: '/users', documentation: 'Get all users' },
          ],
          schemas: [
            { name: 'User', documentation: 'User schema' },
          ],
          format: 'markdown',
        };

        const result = ApiDocumentationResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('ChangelogResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          content: '## [1.0.0] - 2025-01-05\n\n### Added\n- Feature',
          version: '1.0.0',
          date: '2025-01-05',
          changeCount: {
            added: 1,
            changed: 0,
            deprecated: 0,
            removed: 0,
            fixed: 0,
            security: 0,
          },
          hasBreakingChanges: false,
        };

        const result = ChangelogResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('UserGuideResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          content: '# User Guide\n\n## Getting Started',
          tableOfContents: [
            { level: 1, title: 'Getting Started', anchor: '#getting-started' },
          ],
          sections: [
            { title: 'Getting Started', content: '## Getting Started\n...' },
          ],
          metadata: {
            wordCount: 1000,
            estimatedReadTime: 5,
          },
        };

        const result = UserGuideResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Enums', () => {
  describe('DocumentationType', () => {
    it('should have all expected values', () => {
      expect(DocumentationType.JSDOC).toBe('jsdoc');
      expect(DocumentationType.README).toBe('readme');
      expect(DocumentationType.API).toBe('api');
      expect(DocumentationType.CHANGELOG).toBe('changelog');
      expect(DocumentationType.USER_GUIDE).toBe('user-guide');
      expect(DocumentationType.INLINE_COMMENTS).toBe('inline-comments');
    });
  });

  describe('DocumentationFormat', () => {
    it('should have all expected values', () => {
      expect(DocumentationFormat.MARKDOWN).toBe('markdown');
      expect(DocumentationFormat.HTML).toBe('html');
      expect(DocumentationFormat.JSON).toBe('json');
      expect(DocumentationFormat.PLAIN).toBe('plain');
    });
  });

  describe('DetailLevel', () => {
    it('should have all expected values', () => {
      expect(DetailLevel.MINIMAL).toBe('minimal');
      expect(DetailLevel.STANDARD).toBe('standard');
      expect(DetailLevel.COMPREHENSIVE).toBe('comprehensive');
    });
  });

  describe('ChangeType', () => {
    it('should have all expected values', () => {
      expect(ChangeType.ADDED).toBe('added');
      expect(ChangeType.CHANGED).toBe('changed');
      expect(ChangeType.DEPRECATED).toBe('deprecated');
      expect(ChangeType.REMOVED).toBe('removed');
      expect(ChangeType.FIXED).toBe('fixed');
      expect(ChangeType.SECURITY).toBe('security');
    });
  });
});

describe('createDocWriterAgent helper', () => {
  it('should create DocWriterAgent instance', () => {
    const dependencies = createDependencies();
    const config = createConfig();

    const agent = createDocWriterAgent(config, dependencies);

    expect(agent).toBeInstanceOf(DocWriterAgent);
    expect(agent.id).toBe(config.id);
  });
});
