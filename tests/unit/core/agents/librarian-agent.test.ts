/**
 * Librarian Agent Tests
 *
 * Comprehensive test suite for the LibrarianAgent following the same
 * patterns established in explorer-agent.test.ts and docwriter-agent.test.ts.
 *
 * @module tests/unit/core/agents/librarian-agent
 */

import {
  LibrarianAgent,
  createLibrarianAgent,
  DocumentationSource,
  ReferenceType,
  SearchScope,
  ContentFormat,
  KnowledgeDomain,
  ApiDocLookupPayloadSchema,
  CodeExampleSearchPayloadSchema,
  BestPracticesLookupPayloadSchema,
  ReferenceSearchPayloadSchema,
  KnowledgeSynthesisPayloadSchema,
  ApiDocLookupResponseSchema,
  CodeExampleSearchResponseSchema,
  BestPracticesLookupResponseSchema,
  ReferenceSearchResponseSchema,
  KnowledgeSynthesisResponseSchema,
  type LibrarianAgentConfig,
} from '../../../../src/core/agents/specialized/librarian-agent';
import type {
  AgentDependencies,
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  LLMMessage,
} from '../../../../src/core/agents/interfaces';
import { AgentType, TaskPriority, type ITask } from '../../../../src/core/interfaces';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockLLMClient(): jest.Mocked<ILLMClient> {
  return {
    complete: jest.fn(),
    stream: jest.fn(),
    getProvider: jest.fn().mockReturnValue('mock'),
    getModel: jest.fn().mockReturnValue('mock-model'),
  };
}

function createMockMessageBroker(): jest.Mocked<IMessageBroker> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    request: jest.fn().mockResolvedValue({}),
    isConnected: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockLogger(): jest.Mocked<IAgentLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
}

function createMockDependencies(): AgentDependencies {
  return {
    llmClient: createMockLLMClient(),
    messageBroker: createMockMessageBroker(),
    logger: createMockLogger(),
  };
}

function createDefaultConfig(): LibrarianAgentConfig {
  return {
    id: 'librarian-test-001',
    name: 'Test Librarian Agent',
    version: '1.0.0',
    llm: { provider: 'claude', model: 'claude-3' },
    defaultSource: DocumentationSource.ALL,
    defaultScope: SearchScope.ALL,
    defaultFormat: ContentFormat.MARKDOWN,
    enableCaching: true,
    cacheTTL: 300000,
    maxConcurrentSearches: 5,
    retry: {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
    },
  };
}

function createTask(type: string, payload: Record<string, unknown>): ITask {
  return {
    id: `task-${Date.now()}`,
    type,
    agentType: AgentType.LIBRARIAN,
    priority: TaskPriority.NORMAL,
    payload,
    createdAt: new Date(),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('LibrarianAgent', () => {
  let agent: LibrarianAgent;
  let dependencies: AgentDependencies;
  let mockLLMClient: jest.Mocked<ILLMClient>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    mockLLMClient = dependencies.llmClient as jest.Mocked<ILLMClient>;
    agent = new LibrarianAgent(createDefaultConfig(), dependencies);
  });

  afterEach(async () => {
    if (agent) {
      await agent.dispose();
    }
  });

  describe('Construction', () => {
    it('should create agent with default config', () => {
      expect(agent).toBeInstanceOf(LibrarianAgent);
      expect(agent.id).toBe('librarian-test-001');
      expect(agent.name).toBe('Test Librarian Agent');
      expect(agent.type).toBe(AgentType.LIBRARIAN);
    });

    it('should accept custom configuration', () => {
      const customConfig: LibrarianAgentConfig = {
        id: 'custom-librarian',
        name: 'Custom Librarian',
        version: '2.0.0',
        llm: { provider: 'openai', model: 'gpt-4' },
        defaultSource: DocumentationSource.OFFICIAL,
        defaultScope: SearchScope.REMOTE,
        defaultFormat: ContentFormat.HTML,
        enableCaching: false,
        cacheTTL: 600000,
        maxConcurrentSearches: 10,
      };

      const customAgent = new LibrarianAgent(customConfig, dependencies);
      expect(customAgent.id).toBe('custom-librarian');
      expect(customAgent.version).toBe('2.0.0');
    });
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      const health = agent.getHealth();
      expect(health.healthy).toBe(true);
    });

    it('should start successfully', async () => {
      await agent.initialize();
      await agent.start();
      const state = agent.getState();
      expect(state.status).toBe('idle');
    });

    it('should pause and resume', async () => {
      await agent.initialize();
      await agent.start();
      await agent.pause();
      expect(agent.getState().status).toBe('paused');
      await agent.resume();
      expect(agent.getState().status).toBe('idle');
    });

    it('should stop gracefully', async () => {
      await agent.initialize();
      await agent.start();
      await agent.stop();
      expect(agent.getState().status).toBe('stopped');
    });

    it('should dispose and cleanup', async () => {
      await agent.initialize();
      await agent.start();
      await agent.dispose();
      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });
  });

  describe('Capabilities', () => {
    it('should return all librarian capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities.length).toBe(5);

      const capabilityNames = capabilities.map((c) => c.name);
      expect(capabilityNames).toContain('api-doc-lookup');
      expect(capabilityNames).toContain('code-example-search');
      expect(capabilityNames).toContain('best-practices-lookup');
      expect(capabilityNames).toContain('reference-search');
      expect(capabilityNames).toContain('knowledge-synthesis');
    });

    it('should have correct capability count', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities.length).toBe(5);
    });
  });

  describe('API Doc Lookup Task', () => {
    const mockApiDocResponse = {
      query: 'useState',
      results: [
        {
          name: 'useState',
          signature: 'function useState<T>(initialState: T): [T, Dispatch<SetStateAction<T>>]',
          description: 'A React hook that adds state to functional components',
          parameters: [
            {
              name: 'initialState',
              type: 'T | (() => T)',
              description: 'Initial state value or function',
              required: true,
            },
          ],
          returnType: '[T, Dispatch<SetStateAction<T>>]',
          returnDescription: 'Array containing state value and setter function',
          examples: ['const [count, setCount] = useState(0);'],
          deprecated: false,
          seeAlso: ['useReducer', 'useContext'],
          sourceUrl: 'https://react.dev/reference/react/useState',
        },
      ],
      totalFound: 1,
      source: 'official',
      library: 'react',
      version: '18.2.0',
      searchDuration: 150,
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockApiDocResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process API doc lookup task successfully', async () => {
      const task = createTask('api-doc-lookup', {
        query: 'useState',
        library: 'react',
        source: DocumentationSource.OFFICIAL,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
    });

    it('should call LLM for API doc lookup', async () => {
      const task = createTask('api-doc-lookup', {
        query: 'useState',
        library: 'react',
        version: '18.2.0',
      });

      await agent.processTask(task);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      const callArgs = mockLLMClient.complete.mock.calls[0][0] as LLMMessage[];
      expect(callArgs[1].content).toContain('useState');
    });

    it('should fail with invalid payload', async () => {
      const task = createTask('api-doc-lookup', {
        // Missing query
        library: 'react',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('Code Example Search Task', () => {
    const mockCodeExampleResponse = {
      query: 'sort array',
      language: 'typescript',
      examples: [
        {
          title: 'Sort Array of Numbers',
          description: 'How to sort an array of numbers in ascending order',
          code: 'const sorted = numbers.sort((a, b) => a - b);',
          language: 'typescript',
          explanation: 'Uses the sort method with a compare function',
          tags: ['array', 'sorting'],
          complexity: 'beginner',
          sourceUrl: 'https://example.com/sort',
          relatedExamples: ['Sort Array of Objects'],
        },
      ],
      totalFound: 1,
      framework: undefined,
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockCodeExampleResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process code example search task successfully', async () => {
      const task = createTask('code-example-search', {
        query: 'sort array',
        language: 'typescript',
        complexity: 'beginner',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.totalFound).toBe(1);
    });

    it('should include search configuration in LLM prompt', async () => {
      const task = createTask('code-example-search', {
        query: 'async await',
        language: 'javascript',
        framework: 'nodejs',
        complexity: 'intermediate',
      });

      await agent.processTask(task);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      const callArgs = mockLLMClient.complete.mock.calls[0][0] as LLMMessage[];
      expect(callArgs[1].content).toContain('async await');
      expect(callArgs[1].content).toContain('javascript');
    });

    it('should fail with empty query', async () => {
      const task = createTask('code-example-search', {
        query: '',
        language: 'typescript',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });

    it('should fail with missing language', async () => {
      const task = createTask('code-example-search', {
        query: 'sort array',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Best Practices Lookup Task', () => {
    const mockBestPracticesResponse = {
      topic: 'error handling',
      domain: 'pattern',
      practices: [
        {
          title: 'Use Custom Error Classes',
          description: 'Create custom error classes for different error types',
          rationale: 'Allows for better error categorization and handling',
          examples: ['class ValidationError extends Error {}'],
          antiPatterns: [
            {
              name: 'Catch All',
              description: 'Catching all errors without discrimination',
              whyBad: 'Hides specific error types and makes debugging harder',
            },
          ],
          references: [
            {
              title: 'Error Handling Best Practices',
              url: 'https://example.com/error-handling',
              type: 'guide',
            },
          ],
          tags: ['error', 'patterns'],
        },
      ],
      totalFound: 1,
      context: 'TypeScript development',
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockBestPracticesResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process best practices lookup task successfully', async () => {
      const task = createTask('best-practices-lookup', {
        topic: 'error handling',
        domain: KnowledgeDomain.PATTERN,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.totalFound).toBe(1);
    });

    it('should include anti-patterns when requested', async () => {
      const task = createTask('best-practices-lookup', {
        topic: 'error handling',
        includeAntiPatterns: true,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.data?.practices as unknown[])?.[0]).toHaveProperty('antiPatterns');
    });

    it('should fail with empty topic', async () => {
      const task = createTask('best-practices-lookup', {
        topic: '',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Reference Search Task', () => {
    const mockReferenceResponse = {
      query: 'react hooks',
      results: [
        {
          title: 'Introducing Hooks',
          type: 'guide',
          summary: 'Hooks are a new addition in React 16.8',
          url: 'https://react.dev/learn#using-hooks',
          content: 'Hooks let you use state and other React features...',
          relevanceScore: 0.95,
          lastUpdated: '2024-01-15',
          author: 'React Team',
          tags: ['react', 'hooks'],
        },
      ],
      totalFound: 1,
      scope: 'all',
      filters: {},
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockReferenceResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process reference search task successfully', async () => {
      const task = createTask('reference-search', {
        query: 'react hooks',
        referenceType: ReferenceType.GUIDE,
        scope: SearchScope.ALL,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.totalFound).toBe(1);
    });

    it('should apply filters when provided', async () => {
      const task = createTask('reference-search', {
        query: 'react hooks',
        filters: {
          language: 'javascript',
          minRelevance: 0.8,
        },
      });

      await agent.processTask(task);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      const callArgs = mockLLMClient.complete.mock.calls[0][0] as LLMMessage[];
      expect(callArgs[1].content).toContain('Filters');
    });

    it('should fail with empty query', async () => {
      const task = createTask('reference-search', {
        query: '',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Knowledge Synthesis Task', () => {
    const mockKnowledgeSynthesisResponse = {
      topic: 'microservices architecture',
      synthesis:
        '# Microservices Architecture\n\nMicroservices is an architectural style...',
      format: 'markdown',
      sourcesSynthesized: 3,
      keyPoints: [
        'Service independence and autonomy',
        'API-first design',
        'Decentralized data management',
      ],
      sourceLinks: [
        {
          title: 'Martin Fowler on Microservices',
          url: 'https://martinfowler.com/microservices/',
          contribution: 'Core principles and patterns',
        },
      ],
      confidence: 0.92,
      generatedAt: '2024-01-15T10:30:00Z',
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockKnowledgeSynthesisResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process knowledge synthesis task successfully', async () => {
      const task = createTask('knowledge-synthesis', {
        topic: 'microservices architecture',
        sources: ['https://martinfowler.com/microservices/', 'https://aws.amazon.com/microservices/'],
        outputFormat: ContentFormat.MARKDOWN,
        depth: 'detailed',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.sourcesSynthesized).toBe(3);
    });

    it('should include key points in synthesis', async () => {
      const task = createTask('knowledge-synthesis', {
        topic: 'microservices',
        sources: ['source1', 'source2'],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.data?.keyPoints).toBeDefined();
      expect((result.data?.keyPoints as string[]).length).toBeGreaterThan(0);
    });

    it('should fail with empty topic', async () => {
      const task = createTask('knowledge-synthesis', {
        topic: '',
        sources: ['source1'],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });

    it('should fail with empty sources', async () => {
      const task = createTask('knowledge-synthesis', {
        topic: 'microservices',
        sources: [],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Unsupported Task', () => {
    it('should fail for unsupported task type', async () => {
      const task = createTask('unsupported-task', {
        query: 'test',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('Unsupported task type');
    });
  });

  describe('Malformed LLM Response Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      mockLLMClient.complete.mockResolvedValue({
        content: 'This is not valid JSON',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createTask('api-doc-lookup', {
        query: 'useState',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Retry Behavior', () => {
    it('should retry on transient failures', async () => {
      mockLLMClient.complete
        .mockRejectedValueOnce(new Error('Transient failure'))
        .mockRejectedValueOnce(new Error('Transient failure'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            query: 'test',
            results: [],
            totalFound: 0,
            source: 'all',
            searchDuration: 100,
          }),
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          stopReason: 'end',
        });

      const task = createTask('api-doc-lookup', {
        query: 'test',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(3);
    });
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Schema Validation', () => {
  describe('ApiDocLookupPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        query: 'useState',
        library: 'react',
        version: '18.2.0',
        source: DocumentationSource.OFFICIAL,
      };

      const result = ApiDocLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { query: 'useState' };
      const result = ApiDocLookupPayloadSchema.parse(payload);

      expect(result.source).toBe(DocumentationSource.ALL);
      expect(result.includeExamples).toBe(true);
      expect(result.maxResults).toBe(10);
    });

    it('should reject empty query', () => {
      const payload = { query: '' };
      const result = ApiDocLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('CodeExampleSearchPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        query: 'sort array',
        language: 'typescript',
        complexity: 'intermediate',
      };

      const result = CodeExampleSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { query: 'test', language: 'javascript' };
      const result = CodeExampleSearchPayloadSchema.parse(payload);

      expect(result.complexity).toBe('intermediate');
      expect(result.includeExplanation).toBe(true);
      expect(result.maxExamples).toBe(5);
    });

    it('should reject empty query', () => {
      const payload = { query: '', language: 'typescript' };
      const result = CodeExampleSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing language', () => {
      const payload = { query: 'test' };
      const result = CodeExampleSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('BestPracticesLookupPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        topic: 'error handling',
        domain: KnowledgeDomain.PATTERN,
        includeAntiPatterns: true,
      };

      const result = BestPracticesLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { topic: 'testing' };
      const result = BestPracticesLookupPayloadSchema.parse(payload);

      expect(result.domain).toBe(KnowledgeDomain.ALL);
      expect(result.includeAntiPatterns).toBe(true);
      expect(result.includeReferences).toBe(true);
    });

    it('should reject empty topic', () => {
      const payload = { topic: '' };
      const result = BestPracticesLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ReferenceSearchPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        query: 'react hooks',
        referenceType: ReferenceType.TUTORIAL,
        scope: SearchScope.REMOTE,
      };

      const result = ReferenceSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { query: 'testing' };
      const result = ReferenceSearchPayloadSchema.parse(payload);

      expect(result.referenceType).toBe(ReferenceType.ALL);
      expect(result.scope).toBe(SearchScope.ALL);
      expect(result.maxResults).toBe(20);
    });

    it('should validate filters', () => {
      const payload = {
        query: 'react',
        filters: {
          language: 'javascript',
          framework: 'react',
          minRelevance: 0.8,
          dateRange: { from: '2024-01-01', to: '2024-12-31' },
        },
      };

      const result = ReferenceSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const payload = { query: '' };
      const result = ReferenceSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('KnowledgeSynthesisPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        topic: 'microservices',
        sources: ['source1', 'source2'],
        outputFormat: ContentFormat.MARKDOWN,
        depth: 'detailed',
      };

      const result = KnowledgeSynthesisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { topic: 'testing', sources: ['source1'] };
      const result = KnowledgeSynthesisPayloadSchema.parse(payload);

      expect(result.outputFormat).toBe(ContentFormat.MARKDOWN);
      expect(result.depth).toBe('detailed');
      expect(result.includeSourceLinks).toBe(true);
    });

    it('should reject empty topic', () => {
      const payload = { topic: '', sources: ['source1'] };
      const result = KnowledgeSynthesisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject empty sources', () => {
      const payload = { topic: 'testing', sources: [] };
      const result = KnowledgeSynthesisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Response Schemas', () => {
    describe('ApiDocLookupResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          query: 'useState',
          results: [],
          totalFound: 0,
          source: DocumentationSource.ALL,
          searchDuration: 100,
        };

        const result = ApiDocLookupResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('CodeExampleSearchResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          query: 'test',
          language: 'typescript',
          examples: [],
          totalFound: 0,
        };

        const result = CodeExampleSearchResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('BestPracticesLookupResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          topic: 'testing',
          domain: KnowledgeDomain.PATTERN,
          practices: [],
          totalFound: 0,
        };

        const result = BestPracticesLookupResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('ReferenceSearchResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          query: 'test',
          results: [],
          totalFound: 0,
          scope: SearchScope.ALL,
        };

        const result = ReferenceSearchResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('KnowledgeSynthesisResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          topic: 'testing',
          synthesis: 'Summary content',
          format: ContentFormat.MARKDOWN,
          sourcesSynthesized: 2,
          keyPoints: ['Point 1', 'Point 2'],
          confidence: 0.9,
          generatedAt: '2024-01-15T10:00:00Z',
        };

        const result = KnowledgeSynthesisResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });
});

// ============================================================================
// Enum Tests
// ============================================================================

describe('Enums', () => {
  describe('DocumentationSource', () => {
    it('should have all expected values', () => {
      expect(DocumentationSource.OFFICIAL).toBe('official');
      expect(DocumentationSource.COMMUNITY).toBe('community');
      expect(DocumentationSource.INTERNAL).toBe('internal');
      expect(DocumentationSource.EXTERNAL).toBe('external');
      expect(DocumentationSource.ALL).toBe('all');
    });
  });

  describe('ReferenceType', () => {
    it('should have all expected values', () => {
      expect(ReferenceType.API).toBe('api');
      expect(ReferenceType.TUTORIAL).toBe('tutorial');
      expect(ReferenceType.GUIDE).toBe('guide');
      expect(ReferenceType.EXAMPLE).toBe('example');
      expect(ReferenceType.SPECIFICATION).toBe('specification');
      expect(ReferenceType.ALL).toBe('all');
    });
  });

  describe('SearchScope', () => {
    it('should have all expected values', () => {
      expect(SearchScope.LOCAL).toBe('local');
      expect(SearchScope.REMOTE).toBe('remote');
      expect(SearchScope.CACHED).toBe('cached');
      expect(SearchScope.ALL).toBe('all');
    });
  });

  describe('ContentFormat', () => {
    it('should have all expected values', () => {
      expect(ContentFormat.MARKDOWN).toBe('markdown');
      expect(ContentFormat.HTML).toBe('html');
      expect(ContentFormat.PLAIN_TEXT).toBe('plain_text');
      expect(ContentFormat.JSON).toBe('json');
    });
  });

  describe('KnowledgeDomain', () => {
    it('should have all expected values', () => {
      expect(KnowledgeDomain.LANGUAGE).toBe('language');
      expect(KnowledgeDomain.FRAMEWORK).toBe('framework');
      expect(KnowledgeDomain.LIBRARY).toBe('library');
      expect(KnowledgeDomain.TOOL).toBe('tool');
      expect(KnowledgeDomain.PATTERN).toBe('pattern');
      expect(KnowledgeDomain.BEST_PRACTICE).toBe('best_practice');
      expect(KnowledgeDomain.ALL).toBe('all');
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createLibrarianAgent helper', () => {
  it('should create LibrarianAgent instance', () => {
    const dependencies = createMockDependencies();
    const agent = createLibrarianAgent(
      {
        id: 'factory-test',
        name: 'Factory Test Agent',
        version: '1.0.0',
        llm: { provider: 'claude', model: 'claude-3' },
      },
      dependencies
    );

    expect(agent).toBeInstanceOf(LibrarianAgent);
    expect(agent.id).toBe('factory-test');
    expect(agent.type).toBe(AgentType.LIBRARIAN);
  });
});
