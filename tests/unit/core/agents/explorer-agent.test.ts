/**
 * Explorer Agent Tests
 *
 * Comprehensive test suite for the ExplorerAgent following the same
 * patterns established in architect-agent.test.ts and docwriter-agent.test.ts.
 *
 * @module tests/unit/core/agents/explorer-agent
 */

import {
  ExplorerAgent,
  createExplorerAgent,
  SearchType,
  FileType,
  ExplorationDepth,
  SymbolType,
  DependencyType,
  FileStructureAnalysisPayloadSchema,
  CodeSearchPayloadSchema,
  DependencyAnalysisPayloadSchema,
  SymbolLookupPayloadSchema,
  CodebaseSummaryPayloadSchema,
  FileStructureResponseSchema,
  CodeSearchResponseSchema,
  DependencyAnalysisResponseSchema,
  SymbolLookupResponseSchema,
  CodebaseSummaryResponseSchema,
  type ExplorerAgentConfig,
} from '../../../../src/core/agents/specialized/explorer-agent';
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

function createDefaultConfig(): ExplorerAgentConfig {
  return {
    id: 'explorer-test-001',
    name: 'Test Explorer Agent',
    version: '1.0.0',
    llm: { provider: 'claude', model: 'claude-3' },
    defaultDepth: ExplorationDepth.STANDARD,
    defaultSearchType: SearchType.LITERAL,
    maxFilesPerOperation: 1000,
    enableCaching: true,
    cacheTTL: 300000,
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
    agentType: AgentType.EXPLORER,
    priority: TaskPriority.NORMAL,
    payload,
    createdAt: new Date(),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('ExplorerAgent', () => {
  let agent: ExplorerAgent;
  let dependencies: AgentDependencies;
  let mockLLMClient: jest.Mocked<ILLMClient>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    mockLLMClient = dependencies.llmClient as jest.Mocked<ILLMClient>;
    agent = new ExplorerAgent(createDefaultConfig(), dependencies);
  });

  afterEach(async () => {
    if (agent) {
      await agent.dispose();
    }
  });

  describe('Construction', () => {
    it('should create agent with default config', () => {
      expect(agent).toBeInstanceOf(ExplorerAgent);
      expect(agent.id).toBe('explorer-test-001');
      expect(agent.name).toBe('Test Explorer Agent');
      expect(agent.type).toBe(AgentType.EXPLORER);
    });

    it('should accept custom configuration', () => {
      const customConfig: ExplorerAgentConfig = {
        id: 'custom-explorer',
        name: 'Custom Explorer',
        version: '2.0.0',
        llm: { provider: 'openai', model: 'gpt-4' },
        defaultDepth: ExplorationDepth.DEEP,
        defaultSearchType: SearchType.REGEX,
        maxFilesPerOperation: 500,
        enableCaching: false,
        cacheTTL: 600000,
      };

      const customAgent = new ExplorerAgent(customConfig, dependencies);
      expect(customAgent.id).toBe('custom-explorer');
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
    it('should return all explorer capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities.length).toBe(5);

      const capabilityNames = capabilities.map((c) => c.name);
      expect(capabilityNames).toContain('file-structure-analysis');
      expect(capabilityNames).toContain('code-search');
      expect(capabilityNames).toContain('dependency-analysis');
      expect(capabilityNames).toContain('symbol-lookup');
      expect(capabilityNames).toContain('codebase-summary');
    });

    it('should have correct capability count', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities.length).toBe(5);
    });
  });

  describe('File Structure Analysis Task', () => {
    const mockFileStructureResponse = {
      rootPath: '/project',
      totalFiles: 100,
      totalDirectories: 20,
      totalSize: 1024000,
      files: [
        { path: '/project/src/index.ts', name: 'index.ts', extension: '.ts', size: 1024, type: 'source' },
      ],
      directories: [
        { path: '/project/src', name: 'src', fileCount: 50, subdirectoryCount: 5, totalSize: 512000 },
      ],
      filesByType: { source: 80, test: 20 },
      filesByExtension: { '.ts': 70, '.js': 30 },
      largestFiles: [
        { path: '/project/src/main.ts', name: 'main.ts', extension: '.ts', size: 10240, type: 'source' },
      ],
      structureTree: 'project/\n  src/\n    index.ts',
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockFileStructureResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process file structure analysis task successfully', async () => {
      const task = createTask('file-structure-analysis', {
        rootPath: '/project',
        depth: ExplorationDepth.STANDARD,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
    });

    it('should call LLM for file structure analysis', async () => {
      const task = createTask('file-structure-analysis', {
        rootPath: '/project',
        depth: ExplorationDepth.DEEP,
        includePatterns: ['**/*.ts'],
      });

      await agent.processTask(task);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      const callArgs = mockLLMClient.complete.mock.calls[0][0] as LLMMessage[];
      expect(callArgs[1].content).toContain('/project');
    });

    it('should fail with invalid payload', async () => {
      const task = createTask('file-structure-analysis', {
        // Missing rootPath
        depth: ExplorationDepth.STANDARD,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('Code Search Task', () => {
    const mockCodeSearchResponse = {
      query: 'function',
      searchType: 'literal',
      totalMatches: 25,
      filesWithMatches: 10,
      matches: [
        {
          filePath: '/project/src/utils.ts',
          lineNumber: 15,
          columnStart: 1,
          columnEnd: 8,
          matchedText: 'function',
          context: {
            before: ['// Helper utilities'],
            line: 'function helper() {',
            after: ['  return true;'],
          },
        },
      ],
      searchDuration: 150,
      truncated: false,
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockCodeSearchResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process code search task successfully', async () => {
      const task = createTask('code-search', {
        rootPath: '/project',
        query: 'function',
        searchType: SearchType.LITERAL,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.totalMatches).toBe(25);
    });

    it('should include search configuration in LLM prompt', async () => {
      const task = createTask('code-search', {
        rootPath: '/project',
        query: 'export.*class',
        searchType: SearchType.REGEX,
        caseSensitive: true,
        wholeWord: false,
      });

      await agent.processTask(task);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      const callArgs = mockLLMClient.complete.mock.calls[0][0] as LLMMessage[];
      expect(callArgs[1].content).toContain('export.*class');
      expect(callArgs[1].content).toContain('regex');
    });

    it('should fail with empty query', async () => {
      const task = createTask('code-search', {
        rootPath: '/project',
        query: '',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Dependency Analysis Task', () => {
    const mockDependencyResponse = {
      entryPoints: ['/project/src/index.ts'],
      totalModules: 50,
      internalModules: 40,
      externalModules: 10,
      nodes: [
        { id: 'index', name: 'index.ts', path: '/project/src/index.ts', type: 'internal' },
        { id: 'lodash', name: 'lodash', path: 'lodash', type: 'external', version: '4.17.21' },
      ],
      edges: [
        { source: 'index', target: 'lodash', type: 'import', importedSymbols: ['map', 'filter'] },
      ],
      circularDependencies: [
        { cycle: ['a.ts', 'b.ts', 'a.ts'], severity: 'warning' },
      ],
      moduleGroups: { utils: ['utils.ts', 'helpers.ts'] },
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockDependencyResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process dependency analysis task successfully', async () => {
      const task = createTask('dependency-analysis', {
        rootPath: '/project',
        entryPoints: ['/project/src/index.ts'],
        dependencyTypes: [DependencyType.IMPORT],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.totalModules).toBe(50);
    });

    it('should detect circular dependencies', async () => {
      const task = createTask('dependency-analysis', {
        rootPath: '/project',
        entryPoints: ['/project/src/index.ts'],
        detectCircular: true,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.data?.circularDependencies as unknown[])?.length).toBeGreaterThan(0);
    });

    it('should fail with no entry points', async () => {
      const task = createTask('dependency-analysis', {
        rootPath: '/project',
        entryPoints: [],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Symbol Lookup Task', () => {
    const mockSymbolResponse = {
      symbolName: 'calculateTotal',
      found: true,
      definition: {
        name: 'calculateTotal',
        type: 'function',
        filePath: '/project/src/utils.ts',
        lineNumber: 25,
        columnNumber: 1,
        signature: 'function calculateTotal(items: Item[]): number',
        documentation: 'Calculates the total price of all items',
        modifiers: ['export'],
      },
      references: [
        {
          filePath: '/project/src/cart.ts',
          lineNumber: 50,
          columnNumber: 10,
          context: 'const total = calculateTotal(items);',
          referenceType: 'call',
        },
      ],
      totalReferences: 15,
      relatedSymbols: ['Item', 'CartItem'],
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockSymbolResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process symbol lookup task successfully', async () => {
      const task = createTask('symbol-lookup', {
        rootPath: '/project',
        symbolName: 'calculateTotal',
        symbolTypes: [SymbolType.FUNCTION],
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.found).toBe(true);
    });

    it('should include definition info in result', async () => {
      const task = createTask('symbol-lookup', {
        rootPath: '/project',
        symbolName: 'calculateTotal',
        includeDefinition: true,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.data?.definition).toBeDefined();
    });

    it('should fail with empty symbol name', async () => {
      const task = createTask('symbol-lookup', {
        rootPath: '/project',
        symbolName: '',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('Codebase Summary Task', () => {
    const mockCodebaseSummaryResponse = {
      rootPath: '/project',
      projectName: 'My Project',
      description: 'A TypeScript project with comprehensive architecture',
      statistics: {
        totalFiles: 150,
        totalLines: 25000,
        totalBytes: 1024000,
        filesByLanguage: { TypeScript: 120, JavaScript: 20, JSON: 10 },
        linesByLanguage: { TypeScript: 20000, JavaScript: 4000, JSON: 1000 },
        averageFileSize: 6826,
        largestFiles: [
          { path: '/project/src/main.ts', name: 'main.ts', extension: '.ts', size: 15000, type: 'source' },
        ],
      },
      technologies: [
        { name: 'TypeScript', category: 'language', version: '5.0.0' },
        { name: 'Jest', category: 'library', version: '29.0.0' },
      ],
      architecturePatterns: [
        { name: 'Dependency Injection', description: 'DI pattern used throughout', locations: ['/src/core/di'], confidence: 0.95 },
      ],
      mainEntryPoints: ['/project/src/index.ts'],
      keyDirectories: [
        { path: '/project/src', purpose: 'Main source code' },
        { path: '/project/tests', purpose: 'Test files' },
      ],
      recommendations: ['Consider adding more unit tests'],
    };

    beforeEach(() => {
      mockLLMClient.complete.mockResolvedValue({
        content: JSON.stringify(mockCodebaseSummaryResponse),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });
    });

    it('should process codebase summary task successfully', async () => {
      const task = createTask('codebase-summary', {
        rootPath: '/project',
        depth: ExplorationDepth.STANDARD,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data?.projectName).toBe('My Project');
    });

    it('should include statistics when requested', async () => {
      const task = createTask('codebase-summary', {
        rootPath: '/project',
        includeStatistics: true,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.data?.statistics).toBeDefined();
    });

    it('should include technologies when requested', async () => {
      const task = createTask('codebase-summary', {
        rootPath: '/project',
        includeTechnologies: true,
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.data?.technologies).toBeDefined();
    });
  });

  describe('Unsupported Task', () => {
    it('should fail for unsupported task type', async () => {
      const task = createTask('unsupported-task', {
        rootPath: '/project',
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

      const task = createTask('file-structure-analysis', {
        rootPath: '/project',
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
            rootPath: '/project',
            totalFiles: 10,
            totalDirectories: 2,
            totalSize: 1000,
            files: [],
            directories: [],
            filesByType: {},
            filesByExtension: {},
            largestFiles: [],
          }),
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          stopReason: 'end',
        });

      const task = createTask('file-structure-analysis', {
        rootPath: '/project',
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
  describe('FileStructureAnalysisPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        rootPath: '/project',
        depth: ExplorationDepth.DEEP,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
      };

      const result = FileStructureAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { rootPath: '/project' };
      const result = FileStructureAnalysisPayloadSchema.parse(payload);

      expect(result.depth).toBe(ExplorationDepth.STANDARD);
      expect(result.includeMetadata).toBe(true);
      expect(result.maxFiles).toBe(1000);
    });

    it('should reject empty root path', () => {
      const payload = { rootPath: '' };
      const result = FileStructureAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('CodeSearchPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        rootPath: '/project',
        query: 'function',
        searchType: SearchType.REGEX,
      };

      const result = CodeSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { rootPath: '/project', query: 'test' };
      const result = CodeSearchPayloadSchema.parse(payload);

      expect(result.searchType).toBe(SearchType.LITERAL);
      expect(result.caseSensitive).toBe(false);
      expect(result.contextLines).toBe(3);
    });

    it('should reject empty query', () => {
      const payload = { rootPath: '/project', query: '' };
      const result = CodeSearchPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('DependencyAnalysisPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        rootPath: '/project',
        entryPoints: ['/project/src/index.ts'],
        dependencyTypes: [DependencyType.IMPORT, DependencyType.EXPORT],
      };

      const result = DependencyAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        rootPath: '/project',
        entryPoints: ['/project/src/index.ts'],
      };
      const result = DependencyAnalysisPayloadSchema.parse(payload);

      expect(result.detectCircular).toBe(true);
      expect(result.groupByModule).toBe(true);
    });

    it('should reject empty entry points', () => {
      const payload = { rootPath: '/project', entryPoints: [] };
      const result = DependencyAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('SymbolLookupPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        rootPath: '/project',
        symbolName: 'MyClass',
        symbolTypes: [SymbolType.CLASS],
      };

      const result = SymbolLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { rootPath: '/project', symbolName: 'test' };
      const result = SymbolLookupPayloadSchema.parse(payload);

      expect(result.includeReferences).toBe(true);
      expect(result.includeDefinition).toBe(true);
      expect(result.searchScope).toBe('project');
    });

    it('should reject empty symbol name', () => {
      const payload = { rootPath: '/project', symbolName: '' };
      const result = SymbolLookupPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('CodebaseSummaryPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        rootPath: '/project',
        depth: ExplorationDepth.EXHAUSTIVE,
        includeStatistics: true,
      };

      const result = CodebaseSummaryPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = { rootPath: '/project' };
      const result = CodebaseSummaryPayloadSchema.parse(payload);

      expect(result.includeStatistics).toBe(true);
      expect(result.includeArchitecture).toBe(true);
      expect(result.includeTechnologies).toBe(true);
    });
  });

  describe('Response Schemas', () => {
    describe('FileStructureResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          rootPath: '/project',
          totalFiles: 100,
          totalDirectories: 20,
          totalSize: 1024000,
          files: [],
          directories: [],
          filesByType: {},
          filesByExtension: {},
          largestFiles: [],
        };

        const result = FileStructureResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('CodeSearchResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          query: 'test',
          searchType: SearchType.LITERAL,
          totalMatches: 10,
          filesWithMatches: 5,
          matches: [],
          searchDuration: 100,
          truncated: false,
        };

        const result = CodeSearchResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('DependencyAnalysisResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          entryPoints: ['/project/src/index.ts'],
          totalModules: 50,
          internalModules: 40,
          externalModules: 10,
          nodes: [],
          edges: [],
          circularDependencies: [],
        };

        const result = DependencyAnalysisResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('SymbolLookupResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          symbolName: 'MyClass',
          found: true,
          references: [],
          totalReferences: 0,
        };

        const result = SymbolLookupResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('CodebaseSummaryResponseSchema', () => {
      it('should validate correct response', () => {
        const response = {
          rootPath: '/project',
          projectName: 'Test Project',
          description: 'A test project',
          mainEntryPoints: ['/project/src/index.ts'],
          keyDirectories: [{ path: '/project/src', purpose: 'Source code' }],
        };

        const result = CodebaseSummaryResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });
});

// ============================================================================
// Enum Tests
// ============================================================================

describe('Enums', () => {
  describe('SearchType', () => {
    it('should have all expected values', () => {
      expect(SearchType.REGEX).toBe('regex');
      expect(SearchType.LITERAL).toBe('literal');
      expect(SearchType.AST).toBe('ast');
      expect(SearchType.SEMANTIC).toBe('semantic');
    });
  });

  describe('FileType', () => {
    it('should have all expected values', () => {
      expect(FileType.SOURCE).toBe('source');
      expect(FileType.TEST).toBe('test');
      expect(FileType.CONFIG).toBe('config');
      expect(FileType.DOCUMENTATION).toBe('documentation');
      expect(FileType.ALL).toBe('all');
    });
  });

  describe('ExplorationDepth', () => {
    it('should have all expected values', () => {
      expect(ExplorationDepth.SHALLOW).toBe('shallow');
      expect(ExplorationDepth.STANDARD).toBe('standard');
      expect(ExplorationDepth.DEEP).toBe('deep');
      expect(ExplorationDepth.EXHAUSTIVE).toBe('exhaustive');
    });
  });

  describe('SymbolType', () => {
    it('should have all expected values', () => {
      expect(SymbolType.FUNCTION).toBe('function');
      expect(SymbolType.CLASS).toBe('class');
      expect(SymbolType.INTERFACE).toBe('interface');
      expect(SymbolType.TYPE).toBe('type');
      expect(SymbolType.VARIABLE).toBe('variable');
      expect(SymbolType.CONSTANT).toBe('constant');
      expect(SymbolType.ENUM).toBe('enum');
      expect(SymbolType.MODULE).toBe('module');
      expect(SymbolType.ALL).toBe('all');
    });
  });

  describe('DependencyType', () => {
    it('should have all expected values', () => {
      expect(DependencyType.IMPORT).toBe('import');
      expect(DependencyType.EXPORT).toBe('export');
      expect(DependencyType.INHERITANCE).toBe('inheritance');
      expect(DependencyType.IMPLEMENTATION).toBe('implementation');
      expect(DependencyType.COMPOSITION).toBe('composition');
      expect(DependencyType.ALL).toBe('all');
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createExplorerAgent helper', () => {
  it('should create ExplorerAgent instance', () => {
    const dependencies = createMockDependencies();
    const agent = createExplorerAgent(
      {
        id: 'factory-test',
        name: 'Factory Test Agent',
        version: '1.0.0',
        llm: { provider: 'claude', model: 'claude-3' },
      },
      dependencies
    );

    expect(agent).toBeInstanceOf(ExplorerAgent);
    expect(agent.id).toBe('factory-test');
    expect(agent.type).toBe(AgentType.EXPLORER);
  });
});
