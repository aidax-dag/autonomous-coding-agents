/**
 * ArchitectAgent Unit Tests
 *
 * Feature: F1.4 - Architect Agent
 */

import {
  ArchitectAgent,
  ArchitectAgentConfig,
  createArchitectAgent,
  DocumentAnalysisPayloadSchema,
  ArchitectureDesignPayloadSchema,
  TechStackPayloadSchema,
  APIDesignPayloadSchema,
  ModuleBreakdownResponseSchema,
  ArchitectureResponseSchema,
  TechStackResponseSchema,
  APISpecResponseSchema,
  AnalysisDepth,
} from '../../../../src/core/agents/specialized/architect-agent';
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
      modules: [
        {
          name: 'auth-module',
          description: 'Authentication and authorization',
          responsibilities: ['User login', 'Token management'],
          dependencies: [],
          complexity: 'medium',
        },
      ],
      relationships: [
        { from: 'auth-module', to: 'user-module', type: 'uses' },
      ],
      summary: 'Analysis complete',
      recommendations: ['Start with auth-module'],
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

const createConfig = (overrides?: Partial<ArchitectAgentConfig>): ArchitectAgentConfig => ({
  id: 'architect-test-1',
  type: AgentType.ARCHITECT,
  name: 'Test Architect Agent',
  llm: { provider: 'claude', model: 'claude-3' },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent;
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
      agent = new ArchitectAgent(createConfig(), dependencies);

      expect(agent.id).toBe('architect-test-1');
      expect(agent.name).toBe('Test Architect Agent');
      expect(agent.type).toBe(AgentType.ARCHITECT);
      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should accept custom configuration', () => {
      agent = new ArchitectAgent(
        createConfig({
          defaultAnalysisDepth: AnalysisDepth.DEEP,
          maxModules: 30,
          enableDiagramGeneration: false,
          retry: {
            maxAttempts: 5,
            baseDelay: 2000,
            maxDelay: 20000,
          },
        }),
        dependencies
      );

      expect(agent).toBeInstanceOf(ArchitectAgent);
    });
  });

  describe('Lifecycle', () => {
    beforeEach(() => {
      agent = new ArchitectAgent(createConfig(), dependencies);
    });

    it('should initialize successfully', async () => {
      await agent.initialize();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        'ArchitectAgent initializing',
        expect.objectContaining({
          defaultAnalysisDepth: 'standard',
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
      agent = new ArchitectAgent(createConfig(), dependencies);
    });

    it('should return all architect capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'document-analysis' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'architecture-design' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'tech-stack-recommendation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'api-design' })
      );
    });

    it('should have correct capability count', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toHaveLength(4);
    });
  });

  describe('Document Analysis Task', () => {
    const createDocumentAnalysisTask = (): ITask => ({
      id: 'task-doc-1',
      type: 'document-analysis',
      agentType: AgentType.ARCHITECT,
      payload: {
        document: {
          title: 'E-commerce Platform PRD',
          content: 'Build an e-commerce platform with user authentication, product catalog, and checkout...',
          type: 'prd',
        },
        analysisDepth: 'standard',
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new ArchitectAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process document analysis task successfully', async () => {
      const task = createDocumentAnalysisTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { moduleBreakdown: unknown };
      expect(data.moduleBreakdown).toBeDefined();
    });

    it('should call LLM for document analysis', async () => {
      const task = createDocumentAnalysisTask();
      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ maxTokens: 4000 })
      );
    });

    it('should fail with invalid payload', async () => {
      const task: ITask = {
        id: 'task-invalid',
        type: 'document-analysis',
        agentType: AgentType.ARCHITECT,
        payload: { document: { title: 'Test' } }, // Missing content
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid payload');
    });
  });

  describe('Architecture Design Task', () => {
    const createArchitectureDesignTask = (): ITask => ({
      id: 'task-arch-1',
      type: 'architecture-design',
      agentType: AgentType.ARCHITECT,
      payload: {
        requirements: {
          functional: [
            'User registration and login',
            'Product catalog management',
            'Shopping cart functionality',
          ],
          nonFunctional: [
            'Handle 10000 concurrent users',
            'Response time < 200ms',
          ],
        },
        preferences: {
          architectureStyle: 'microservices',
          scalability: 'high',
        },
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock architecture design response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          overview: 'Microservices architecture for e-commerce platform',
          style: 'microservices',
          components: [
            {
              name: 'auth-service',
              type: 'service',
              description: 'Handles authentication',
              technology: 'Node.js',
            },
          ],
          patterns: [
            {
              name: 'API Gateway',
              description: 'Single entry point',
              rationale: 'Centralized routing and security',
            },
          ],
          tradeoffs: [
            {
              aspect: 'Complexity',
              advantage: 'Independent scaling',
              disadvantage: 'Operational overhead',
            },
          ],
        }),
        usage: { inputTokens: 150, outputTokens: 300, totalTokens: 450 },
        stopReason: 'end',
      });

      agent = new ArchitectAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process architecture design task successfully', async () => {
      const task = createArchitectureDesignTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { architecture: unknown };
      expect(data.architecture).toBeDefined();
    });

    it('should include requirements in result', async () => {
      const task = createArchitectureDesignTask();
      const result = await agent.processTask(task);

      const data = result.data as { requirements: { functional: string[] } };
      expect(data.requirements.functional).toHaveLength(3);
    });
  });

  describe('Tech Stack Recommendation Task', () => {
    const createTechStackTask = (): ITask => ({
      id: 'task-tech-1',
      type: 'tech-stack-recommendation',
      agentType: AgentType.ARCHITECT,
      payload: {
        projectContext: {
          type: 'fullstack',
          scale: 'medium',
          requirements: [
            'Real-time notifications',
            'File uploads',
            'Payment processing',
          ],
        },
        constraints: {
          languages: ['TypeScript', 'Python'],
        },
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock tech stack response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          recommended: {
            languages: ['TypeScript', 'Python'],
            frameworks: ['Next.js', 'FastAPI'],
            databases: ['PostgreSQL', 'Redis'],
            infrastructure: ['AWS', 'Docker'],
            devops: ['GitHub Actions', 'Terraform'],
          },
          alternatives: [
            {
              category: 'Database',
              option: 'MongoDB',
              pros: ['Flexible schema', 'Easy scaling'],
              cons: ['Less suited for relational data'],
            },
          ],
          rationale: 'Modern stack for rapid development with TypeScript support',
          considerations: ['Team expertise', 'Long-term maintenance'],
        }),
        usage: { inputTokens: 100, outputTokens: 250, totalTokens: 350 },
        stopReason: 'end',
      });

      agent = new ArchitectAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process tech stack recommendation task successfully', async () => {
      const task = createTechStackTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { techStack: unknown };
      expect(data.techStack).toBeDefined();
    });
  });

  describe('API Design Task', () => {
    const createAPIDesignTask = (): ITask => ({
      id: 'task-api-1',
      type: 'api-design',
      agentType: AgentType.ARCHITECT,
      payload: {
        module: {
          name: 'user-management',
          description: 'Manages user accounts and profiles',
          entities: [
            { name: 'User', properties: ['id', 'email', 'name', 'createdAt'] },
            { name: 'Profile', properties: ['userId', 'avatar', 'bio'] },
          ],
        },
        apiStyle: 'rest',
        includeAuth: true,
        versioning: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      // Mock API design response
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          endpoints: [
            {
              method: 'GET',
              path: '/api/v1/users',
              description: 'List all users',
              responseBody: { users: [] },
            },
            {
              method: 'POST',
              path: '/api/v1/users',
              description: 'Create a user',
              requestBody: { email: 'string', name: 'string' },
            },
          ],
          schemas: [
            {
              name: 'User',
              properties: { id: 'string', email: 'string', name: 'string' },
            },
          ],
          authentication: {
            type: 'Bearer Token',
            details: 'JWT-based authentication',
          },
          versioning: {
            strategy: 'URL path versioning',
            currentVersion: 'v1',
          },
          summary: 'RESTful API for user management',
        }),
        usage: { inputTokens: 120, outputTokens: 280, totalTokens: 400 },
        stopReason: 'end',
      });

      agent = new ArchitectAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process API design task successfully', async () => {
      const task = createAPIDesignTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { apiSpec: unknown };
      expect(data.apiSpec).toBeDefined();
    });

    it('should include module info in result', async () => {
      const task = createAPIDesignTask();
      const result = await agent.processTask(task);

      const data = result.data as { moduleName: string; apiStyle: string };
      expect(data.moduleName).toBe('user-management');
      expect(data.apiStyle).toBe('rest');
    });
  });

  describe('Unsupported Task', () => {
    beforeEach(async () => {
      agent = new ArchitectAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should fail for unsupported task type', async () => {
      const task: ITask = {
        id: 'task-unknown',
        type: 'unknown-task-type',
        agentType: AgentType.ARCHITECT,
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
      agent = new ArchitectAgent(createConfig(), dependencies);
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
        type: 'document-analysis',
        agentType: AgentType.ARCHITECT,
        payload: {
          document: {
            title: 'Test',
            content: 'Test content',
            type: 'general',
          },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      // Should still complete with default/empty response
      expect(result.success).toBe(true);
      const data = result.data as { moduleBreakdown: { modules: unknown[] } };
      expect(data.moduleBreakdown.modules).toEqual([]);
    });
  });

  describe('Retry Behavior', () => {
    it('should retry on transient failures', async () => {
      const failingLLMClient = createMockLLMClient();
      (failingLLMClient.complete as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            modules: [],
            relationships: [],
            summary: 'Retry succeeded',
            recommendations: [],
          }),
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          stopReason: 'end',
        });

      const retryDependencies = {
        ...dependencies,
        llmClient: failingLLMClient,
      };

      agent = new ArchitectAgent(
        createConfig({
          retry: { maxAttempts: 3, baseDelay: 10, maxDelay: 100 },
        }),
        retryDependencies
      );
      await agent.initialize();
      await agent.start();

      const task: ITask = {
        id: 'task-retry',
        type: 'document-analysis',
        agentType: AgentType.ARCHITECT,
        payload: {
          document: {
            title: 'Retry Test',
            content: 'Test content for retry',
            type: 'general',
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
  describe('DocumentAnalysisPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        document: {
          title: 'Test Document',
          content: 'This is test content',
          type: 'prd',
        },
        analysisDepth: 'deep',
      };

      const result = DocumentAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        document: {
          title: 'Test',
          content: 'Content',
        },
      };

      const result = DocumentAnalysisPayloadSchema.parse(payload);
      expect(result.document.type).toBe('general');
      expect(result.analysisDepth).toBe('standard');
    });

    it('should reject empty content', () => {
      const payload = {
        document: {
          title: 'Test',
          content: '',
        },
      };

      const result = DocumentAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ArchitectureDesignPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        requirements: {
          functional: ['Feature 1', 'Feature 2'],
          nonFunctional: ['Performance requirement'],
        },
      };

      const result = ArchitectureDesignPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject empty functional requirements', () => {
      const payload = {
        requirements: {
          functional: [],
        },
      };

      const result = ArchitectureDesignPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('TechStackPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        projectContext: {
          type: 'web',
          scale: 'large',
          requirements: ['Real-time', 'Scalable'],
        },
      };

      const result = TechStackPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply scale default', () => {
      const payload = {
        projectContext: {
          type: 'api',
          requirements: ['REST API'],
        },
      };

      const result = TechStackPayloadSchema.parse(payload);
      expect(result.projectContext.scale).toBe('medium');
    });
  });

  describe('APIDesignPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        module: {
          name: 'test-module',
          description: 'Test module description',
          entities: [
            { name: 'Entity1', properties: ['id', 'name'] },
          ],
        },
        apiStyle: 'graphql',
      };

      const result = APIDesignPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        module: {
          name: 'test',
          description: 'desc',
          entities: [],
        },
      };

      const result = APIDesignPayloadSchema.parse(payload);
      expect(result.apiStyle).toBe('rest');
      expect(result.includeAuth).toBe(true);
      expect(result.versioning).toBe(true);
    });
  });

  describe('ModuleBreakdownResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        modules: [
          {
            name: 'auth',
            description: 'Authentication module',
            responsibilities: ['Login', 'Logout'],
            dependencies: [],
            complexity: 'medium',
          },
        ],
        relationships: [],
        summary: 'Analysis complete',
        recommendations: ['Start with auth'],
      };

      const result = ModuleBreakdownResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('ArchitectureResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        overview: 'System overview',
        style: 'microservices',
        components: [
          { name: 'service1', type: 'service', description: 'desc' },
        ],
        patterns: [
          { name: 'CQRS', description: 'Command Query Separation', rationale: 'Scalability' },
        ],
        tradeoffs: [],
      };

      const result = ArchitectureResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('TechStackResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        recommended: {
          languages: ['TypeScript'],
          frameworks: ['Next.js'],
          databases: ['PostgreSQL'],
          infrastructure: ['AWS'],
          devops: ['GitHub Actions'],
        },
        alternatives: [],
        rationale: 'Modern stack',
        considerations: ['Team size'],
      };

      const result = TechStackResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('APISpecResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        endpoints: [
          { method: 'GET', path: '/users', description: 'List users' },
        ],
        schemas: [
          { name: 'User', properties: { id: 'string' } },
        ],
        summary: 'API spec complete',
      };

      const result = APISpecResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('createArchitectAgent helper', () => {
  it('should create ArchitectAgent instance', () => {
    const dependencies = createDependencies();
    const config = createConfig();

    const agent = createArchitectAgent(config, dependencies);

    expect(agent).toBeInstanceOf(ArchitectAgent);
    expect(agent.id).toBe(config.id);
  });
});
