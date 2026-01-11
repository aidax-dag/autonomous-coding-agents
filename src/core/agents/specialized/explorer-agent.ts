/**
 * Explorer Agent Implementation
 *
 * Codebase exploration agent for file structure analysis, code search,
 * dependency tracking, and symbol lookup.
 *
 * Follows SOLID principles:
 * - S: Single responsibility - codebase exploration tasks
 * - O: Open for extension via hooks
 * - L: Implements IAgent, substitutable
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * Feature: F1.9 - Explorer Agent
 * @module core/agents/specialized
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentDependencies, LLMMessage } from '../interfaces';
import { IAgentConfig, AgentType, AgentCapability, ITask, TaskResult } from '../../interfaces';

// ============================================================================
// Enums
// ============================================================================

/**
 * Search types for code exploration
 */
export enum SearchType {
  REGEX = 'regex',
  LITERAL = 'literal',
  AST = 'ast',
  SEMANTIC = 'semantic',
}

/**
 * File types for filtering
 */
export enum FileType {
  SOURCE = 'source',
  TEST = 'test',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  ALL = 'all',
}

/**
 * Analysis depth levels
 */
export enum ExplorationDepth {
  SHALLOW = 'shallow',
  STANDARD = 'standard',
  DEEP = 'deep',
  EXHAUSTIVE = 'exhaustive',
}

/**
 * Symbol types for lookup
 */
export enum SymbolType {
  FUNCTION = 'function',
  CLASS = 'class',
  INTERFACE = 'interface',
  TYPE = 'type',
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  ENUM = 'enum',
  MODULE = 'module',
  ALL = 'all',
}

/**
 * Dependency relationship types
 */
export enum DependencyType {
  IMPORT = 'import',
  EXPORT = 'export',
  INHERITANCE = 'inheritance',
  IMPLEMENTATION = 'implementation',
  COMPOSITION = 'composition',
  ALL = 'all',
}

// ============================================================================
// Payload Schemas
// ============================================================================

/**
 * File structure analysis payload schema
 */
export const FileStructureAnalysisPayloadSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
  depth: z.nativeEnum(ExplorationDepth).default(ExplorationDepth.STANDARD),
  includePatterns: z.array(z.string()).default(['**/*']),
  excludePatterns: z.array(z.string()).default(['node_modules/**', '.git/**', 'dist/**']),
  fileTypes: z.array(z.nativeEnum(FileType)).default([FileType.ALL]),
  includeMetadata: z.boolean().default(true),
  maxFiles: z.number().min(1).max(10000).default(1000),
});

export type FileStructureAnalysisPayload = z.infer<typeof FileStructureAnalysisPayloadSchema>;

/**
 * Code search payload schema
 */
export const CodeSearchPayloadSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
  query: z.string().min(1, 'Search query is required'),
  searchType: z.nativeEnum(SearchType).default(SearchType.LITERAL),
  fileTypes: z.array(z.nativeEnum(FileType)).default([FileType.SOURCE]),
  includePatterns: z.array(z.string()).default(['**/*']),
  excludePatterns: z.array(z.string()).default(['node_modules/**', '.git/**']),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(false),
  maxResults: z.number().min(1).max(1000).default(100),
  contextLines: z.number().min(0).max(10).default(3),
});

export type CodeSearchPayload = z.infer<typeof CodeSearchPayloadSchema>;

/**
 * Dependency analysis payload schema
 */
export const DependencyAnalysisPayloadSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
  entryPoints: z.array(z.string()).min(1, 'At least one entry point is required'),
  dependencyTypes: z.array(z.nativeEnum(DependencyType)).default([DependencyType.ALL]),
  depth: z.nativeEnum(ExplorationDepth).default(ExplorationDepth.STANDARD),
  includeExternal: z.boolean().default(false),
  includeDevDependencies: z.boolean().default(false),
  detectCircular: z.boolean().default(true),
  groupByModule: z.boolean().default(true),
});

export type DependencyAnalysisPayload = z.infer<typeof DependencyAnalysisPayloadSchema>;

/**
 * Symbol lookup payload schema
 */
export const SymbolLookupPayloadSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
  symbolName: z.string().min(1, 'Symbol name is required'),
  symbolTypes: z.array(z.nativeEnum(SymbolType)).default([SymbolType.ALL]),
  includeReferences: z.boolean().default(true),
  includeDefinition: z.boolean().default(true),
  maxReferences: z.number().min(1).max(500).default(50),
  searchScope: z.enum(['file', 'directory', 'project']).default('project'),
  filePath: z.string().optional(),
});

export type SymbolLookupPayload = z.infer<typeof SymbolLookupPayloadSchema>;

/**
 * Codebase summary payload schema
 */
export const CodebaseSummaryPayloadSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
  depth: z.nativeEnum(ExplorationDepth).default(ExplorationDepth.STANDARD),
  includeStatistics: z.boolean().default(true),
  includeArchitecture: z.boolean().default(true),
  includeTechnologies: z.boolean().default(true),
  includePatterns: z.boolean().default(true),
  excludePatterns: z.array(z.string()).default(['node_modules/**', '.git/**', 'dist/**']),
  maxFilesToAnalyze: z.number().min(1).max(5000).default(500),
});

export type CodebaseSummaryPayload = z.infer<typeof CodebaseSummaryPayloadSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * File info schema
 */
const FileInfoSchema = z.object({
  path: z.string(),
  name: z.string(),
  extension: z.string(),
  size: z.number(),
  type: z.nativeEnum(FileType),
  lastModified: z.string().optional(),
  lineCount: z.number().optional(),
});

/**
 * Directory info schema
 */
const DirectoryInfoSchema = z.object({
  path: z.string(),
  name: z.string(),
  fileCount: z.number(),
  subdirectoryCount: z.number(),
  totalSize: z.number(),
});

/**
 * File structure analysis response schema
 */
export const FileStructureResponseSchema = z.object({
  rootPath: z.string(),
  totalFiles: z.number(),
  totalDirectories: z.number(),
  totalSize: z.number(),
  files: z.array(FileInfoSchema),
  directories: z.array(DirectoryInfoSchema),
  filesByType: z.record(z.string(), z.number()),
  filesByExtension: z.record(z.string(), z.number()),
  largestFiles: z.array(FileInfoSchema),
  recentlyModified: z.array(FileInfoSchema).optional(),
  structureTree: z.string().optional(),
});

export type FileStructureResponse = z.infer<typeof FileStructureResponseSchema>;

/**
 * Search match schema
 */
const SearchMatchSchema = z.object({
  filePath: z.string(),
  lineNumber: z.number(),
  columnStart: z.number(),
  columnEnd: z.number(),
  matchedText: z.string(),
  context: z.object({
    before: z.array(z.string()),
    line: z.string(),
    after: z.array(z.string()),
  }),
});

/**
 * Code search response schema
 */
export const CodeSearchResponseSchema = z.object({
  query: z.string(),
  searchType: z.nativeEnum(SearchType),
  totalMatches: z.number(),
  filesWithMatches: z.number(),
  matches: z.array(SearchMatchSchema),
  searchDuration: z.number(),
  truncated: z.boolean(),
});

export type CodeSearchResponse = z.infer<typeof CodeSearchResponseSchema>;

/**
 * Dependency node schema
 */
const DependencyNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum(['internal', 'external', 'builtin']),
  version: z.string().optional(),
});

/**
 * Dependency edge schema
 */
const DependencyEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.nativeEnum(DependencyType),
  importedSymbols: z.array(z.string()).optional(),
});

/**
 * Circular dependency schema
 */
const CircularDependencySchema = z.object({
  cycle: z.array(z.string()),
  severity: z.enum(['warning', 'error']),
});

/**
 * Dependency analysis response schema
 */
export const DependencyAnalysisResponseSchema = z.object({
  entryPoints: z.array(z.string()),
  totalModules: z.number(),
  internalModules: z.number(),
  externalModules: z.number(),
  nodes: z.array(DependencyNodeSchema),
  edges: z.array(DependencyEdgeSchema),
  circularDependencies: z.array(CircularDependencySchema),
  moduleGroups: z.record(z.string(), z.array(z.string())).optional(),
  unusedExports: z.array(z.string()).optional(),
  missingDependencies: z.array(z.string()).optional(),
});

export type DependencyAnalysisResponse = z.infer<typeof DependencyAnalysisResponseSchema>;

/**
 * Symbol definition schema
 */
const SymbolDefinitionSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(SymbolType),
  filePath: z.string(),
  lineNumber: z.number(),
  columnNumber: z.number(),
  signature: z.string().optional(),
  documentation: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
});

/**
 * Symbol reference schema
 */
const SymbolReferenceSchema = z.object({
  filePath: z.string(),
  lineNumber: z.number(),
  columnNumber: z.number(),
  context: z.string(),
  referenceType: z.enum(['read', 'write', 'call', 'type', 'unknown']),
});

/**
 * Symbol lookup response schema
 */
export const SymbolLookupResponseSchema = z.object({
  symbolName: z.string(),
  found: z.boolean(),
  definition: SymbolDefinitionSchema.optional(),
  references: z.array(SymbolReferenceSchema),
  totalReferences: z.number(),
  relatedSymbols: z.array(z.string()).optional(),
});

export type SymbolLookupResponse = z.infer<typeof SymbolLookupResponseSchema>;

/**
 * Technology info schema
 */
const TechnologyInfoSchema = z.object({
  name: z.string(),
  category: z.enum(['language', 'framework', 'library', 'tool', 'database', 'other']),
  version: z.string().optional(),
  files: z.array(z.string()).optional(),
});

/**
 * Architecture pattern schema
 */
const ArchitecturePatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  locations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

/**
 * Codebase statistics schema
 */
const CodebaseStatisticsSchema = z.object({
  totalFiles: z.number(),
  totalLines: z.number(),
  totalBytes: z.number(),
  filesByLanguage: z.record(z.string(), z.number()),
  linesByLanguage: z.record(z.string(), z.number()),
  averageFileSize: z.number(),
  largestFiles: z.array(FileInfoSchema),
});

/**
 * Codebase summary response schema
 */
export const CodebaseSummaryResponseSchema = z.object({
  rootPath: z.string(),
  projectName: z.string(),
  description: z.string(),
  statistics: CodebaseStatisticsSchema.optional(),
  technologies: z.array(TechnologyInfoSchema).optional(),
  architecturePatterns: z.array(ArchitecturePatternSchema).optional(),
  mainEntryPoints: z.array(z.string()),
  keyDirectories: z.array(z.object({
    path: z.string(),
    purpose: z.string(),
  })),
  recommendations: z.array(z.string()).optional(),
});

export type CodebaseSummaryResponse = z.infer<typeof CodebaseSummaryResponseSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Explorer agent configuration
 */
export interface ExplorerAgentConfig extends Omit<IAgentConfig, 'type'> {
  /** Default exploration depth */
  defaultDepth?: ExplorationDepth;
  /** Default search type */
  defaultSearchType?: SearchType;
  /** Maximum files to process in a single operation */
  maxFilesPerOperation?: number;
  /** Enable caching for repeated operations */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ============================================================================
// Explorer Agent Implementation
// ============================================================================

/**
 * Explorer Agent
 *
 * Provides codebase exploration capabilities including:
 * - File structure analysis
 * - Code search (regex, literal, AST, semantic)
 * - Dependency analysis
 * - Symbol lookup
 * - Codebase summary
 */
export class ExplorerAgent extends BaseAgent {
  private readonly defaultDepth: ExplorationDepth;
  private readonly defaultSearchType: SearchType;
  private readonly maxFilesPerOperation: number;
  private readonly enableCaching: boolean;
  private readonly cacheTTL: number;
  private readonly retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: ExplorerAgentConfig, dependencies: AgentDependencies) {
    super(
      {
        ...config,
        type: AgentType.EXPLORER,
      },
      dependencies
    );

    this.defaultDepth = config.defaultDepth ?? ExplorationDepth.STANDARD;
    this.defaultSearchType = config.defaultSearchType ?? SearchType.LITERAL;
    this.maxFilesPerOperation = config.maxFilesPerOperation ?? 1000;
    this.enableCaching = config.enableCaching ?? true;
    this.cacheTTL = config.cacheTTL ?? 300000; // 5 minutes

    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };

    this.logger.debug('ExplorerAgent initialized', {
      defaultDepth: this.defaultDepth,
      defaultSearchType: this.defaultSearchType,
      maxFilesPerOperation: this.maxFilesPerOperation,
      enableCaching: this.enableCaching,
      cacheTTL: this.cacheTTL,
    });
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'file-structure-analysis',
        description: 'Analyze directory and file structure of a codebase',
        inputSchema: FileStructureAnalysisPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: FileStructureResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'code-search',
        description: 'Search code by pattern, keyword, or semantic meaning',
        inputSchema: CodeSearchPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: CodeSearchResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'dependency-analysis',
        description: 'Analyze import/export dependencies and module relationships',
        inputSchema: DependencyAnalysisPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: DependencyAnalysisResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'symbol-lookup',
        description: 'Find definitions and references for functions, classes, and variables',
        inputSchema: SymbolLookupPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: SymbolLookupResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'codebase-summary',
        description: 'Generate comprehensive summary of codebase structure and technologies',
        inputSchema: CodebaseSummaryPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: CodebaseSummaryResponseSchema.shape as unknown as Record<string, unknown>,
      },
    ];
  }

  /**
   * Process a task
   */
  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();

    try {
      switch (task.type) {
        case 'file-structure-analysis':
          return await this.handleFileStructureAnalysis(task, startTime);
        case 'code-search':
          return await this.handleCodeSearch(task, startTime);
        case 'dependency-analysis':
          return await this.handleDependencyAnalysis(task, startTime);
        case 'symbol-lookup':
          return await this.handleSymbolLookup(task, startTime);
        case 'codebase-summary':
          return await this.handleCodebaseSummary(task, startTime);
        default:
          return this.createFailureResult(
            task,
            new Error(`Unsupported task type: ${task.type}`),
            startTime
          );
      }
    } catch (error) {
      this.logger.error('Task processing failed', { taskId: task.id, error });
      return this.createFailureResult(
        task,
        error instanceof Error ? error : new Error(String(error)),
        startTime
      );
    }
  }

  // ============================================================================
  // Task Handlers
  // ============================================================================

  private async handleFileStructureAnalysis(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = FileStructureAnalysisPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting file structure analysis', { rootPath: payload.rootPath });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildFileStructurePrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseFileStructureResponse(llmResponse.content);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleCodeSearch(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = CodeSearchPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting code search', { query: payload.query, type: payload.searchType });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildCodeSearchPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseCodeSearchResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleDependencyAnalysis(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = DependencyAnalysisPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting dependency analysis', { entryPoints: payload.entryPoints });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildDependencyAnalysisPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseDependencyAnalysisResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleSymbolLookup(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = SymbolLookupPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting symbol lookup', { symbolName: payload.symbolName });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildSymbolLookupPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseSymbolLookupResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleCodebaseSummary(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = CodebaseSummaryPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting codebase summary', { rootPath: payload.rootPath });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildCodebaseSummaryPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseCodebaseSummaryResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  // ============================================================================
  // Prompt Builders
  // ============================================================================

  private buildFileStructurePrompt(payload: FileStructureAnalysisPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are a codebase exploration expert. Analyze the file structure of the given codebase and provide detailed information about files, directories, and organization patterns.

Return your analysis as a JSON object with this structure:
{
  "rootPath": "string",
  "totalFiles": number,
  "totalDirectories": number,
  "totalSize": number,
  "files": [{ "path": "string", "name": "string", "extension": "string", "size": number, "type": "source|test|config|documentation|all" }],
  "directories": [{ "path": "string", "name": "string", "fileCount": number, "subdirectoryCount": number, "totalSize": number }],
  "filesByType": { "type": count },
  "filesByExtension": { ".ext": count },
  "largestFiles": [file objects],
  "structureTree": "optional ASCII tree representation"
}`,
      },
      {
        role: 'user',
        content: `Analyze the file structure at: ${payload.rootPath}

Configuration:
- Depth: ${payload.depth}
- Include patterns: ${payload.includePatterns.join(', ')}
- Exclude patterns: ${payload.excludePatterns.join(', ')}
- File types: ${payload.fileTypes.join(', ')}
- Include metadata: ${payload.includeMetadata}
- Max files: ${payload.maxFiles}

Provide a comprehensive file structure analysis.`,
      },
    ];
  }

  private buildCodeSearchPrompt(payload: CodeSearchPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are a code search expert. Search for code patterns and return matching results with context.

Return your results as a JSON object with this structure:
{
  "query": "string",
  "searchType": "regex|literal|ast|semantic",
  "totalMatches": number,
  "filesWithMatches": number,
  "matches": [{
    "filePath": "string",
    "lineNumber": number,
    "columnStart": number,
    "columnEnd": number,
    "matchedText": "string",
    "context": {
      "before": ["lines before"],
      "line": "matched line",
      "after": ["lines after"]
    }
  }],
  "searchDuration": number,
  "truncated": boolean
}`,
      },
      {
        role: 'user',
        content: `Search for: "${payload.query}"

Configuration:
- Root path: ${payload.rootPath}
- Search type: ${payload.searchType}
- File types: ${payload.fileTypes.join(', ')}
- Case sensitive: ${payload.caseSensitive}
- Whole word: ${payload.wholeWord}
- Max results: ${payload.maxResults}
- Context lines: ${payload.contextLines}

Find all matches and provide context.`,
      },
    ];
  }

  private buildDependencyAnalysisPrompt(payload: DependencyAnalysisPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are a dependency analysis expert. Analyze module dependencies and relationships in the codebase.

Return your analysis as a JSON object with this structure:
{
  "entryPoints": ["string"],
  "totalModules": number,
  "internalModules": number,
  "externalModules": number,
  "nodes": [{
    "id": "string",
    "name": "string",
    "path": "string",
    "type": "internal|external|builtin",
    "version": "optional string"
  }],
  "edges": [{
    "source": "string",
    "target": "string",
    "type": "import|export|inheritance|implementation|composition|all",
    "importedSymbols": ["optional symbols"]
  }],
  "circularDependencies": [{
    "cycle": ["module paths"],
    "severity": "warning|error"
  }],
  "moduleGroups": { "group": ["modules"] },
  "unusedExports": ["optional"],
  "missingDependencies": ["optional"]
}`,
      },
      {
        role: 'user',
        content: `Analyze dependencies starting from: ${payload.entryPoints.join(', ')}

Configuration:
- Root path: ${payload.rootPath}
- Dependency types: ${payload.dependencyTypes.join(', ')}
- Depth: ${payload.depth}
- Include external: ${payload.includeExternal}
- Include dev dependencies: ${payload.includeDevDependencies}
- Detect circular: ${payload.detectCircular}
- Group by module: ${payload.groupByModule}

Provide comprehensive dependency analysis.`,
      },
    ];
  }

  private buildSymbolLookupPrompt(payload: SymbolLookupPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are a symbol lookup expert. Find symbol definitions and references in the codebase.

Return your results as a JSON object with this structure:
{
  "symbolName": "string",
  "found": boolean,
  "definition": {
    "name": "string",
    "type": "function|class|interface|type|variable|constant|enum|module|all",
    "filePath": "string",
    "lineNumber": number,
    "columnNumber": number,
    "signature": "optional string",
    "documentation": "optional string",
    "modifiers": ["optional modifiers"]
  },
  "references": [{
    "filePath": "string",
    "lineNumber": number,
    "columnNumber": number,
    "context": "string",
    "referenceType": "read|write|call|type|unknown"
  }],
  "totalReferences": number,
  "relatedSymbols": ["optional related symbols"]
}`,
      },
      {
        role: 'user',
        content: `Look up symbol: "${payload.symbolName}"

Configuration:
- Root path: ${payload.rootPath}
- Symbol types: ${payload.symbolTypes.join(', ')}
- Include references: ${payload.includeReferences}
- Include definition: ${payload.includeDefinition}
- Max references: ${payload.maxReferences}
- Search scope: ${payload.searchScope}
${payload.filePath ? `- File path: ${payload.filePath}` : ''}

Find the symbol definition and all references.`,
      },
    ];
  }

  private buildCodebaseSummaryPrompt(payload: CodebaseSummaryPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are a codebase analysis expert. Generate a comprehensive summary of the codebase.

Return your summary as a JSON object with this structure:
{
  "rootPath": "string",
  "projectName": "string",
  "description": "string",
  "statistics": {
    "totalFiles": number,
    "totalLines": number,
    "totalBytes": number,
    "filesByLanguage": { "language": count },
    "linesByLanguage": { "language": count },
    "averageFileSize": number,
    "largestFiles": [file objects]
  },
  "technologies": [{
    "name": "string",
    "category": "language|framework|library|tool|database|other",
    "version": "optional string",
    "files": ["optional files"]
  }],
  "architecturePatterns": [{
    "name": "string",
    "description": "string",
    "locations": ["file paths"],
    "confidence": 0.0-1.0
  }],
  "mainEntryPoints": ["entry point paths"],
  "keyDirectories": [{
    "path": "string",
    "purpose": "string"
  }],
  "recommendations": ["optional recommendations"]
}`,
      },
      {
        role: 'user',
        content: `Generate a summary for: ${payload.rootPath}

Configuration:
- Depth: ${payload.depth}
- Include statistics: ${payload.includeStatistics}
- Include architecture: ${payload.includeArchitecture}
- Include technologies: ${payload.includeTechnologies}
- Include patterns: ${payload.includePatterns}
- Max files to analyze: ${payload.maxFilesToAnalyze}

Provide a comprehensive codebase summary.`,
      },
    ];
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseFileStructureResponse(content: string): FileStructureResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return FileStructureResponseSchema.parse(parsed);
  }

  private parseCodeSearchResponse(content: string, payload: CodeSearchPayload): CodeSearchResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        query: payload.query,
        searchType: payload.searchType,
        totalMatches: 0,
        filesWithMatches: 0,
        matches: [],
        searchDuration: 0,
        truncated: false,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return CodeSearchResponseSchema.parse(parsed);
  }

  private parseDependencyAnalysisResponse(
    content: string,
    payload: DependencyAnalysisPayload
  ): DependencyAnalysisResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        entryPoints: payload.entryPoints,
        totalModules: 0,
        internalModules: 0,
        externalModules: 0,
        nodes: [],
        edges: [],
        circularDependencies: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return DependencyAnalysisResponseSchema.parse(parsed);
  }

  private parseSymbolLookupResponse(
    content: string,
    payload: SymbolLookupPayload
  ): SymbolLookupResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        symbolName: payload.symbolName,
        found: false,
        references: [],
        totalReferences: 0,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return SymbolLookupResponseSchema.parse(parsed);
  }

  private parseCodebaseSummaryResponse(
    content: string,
    _payload: CodebaseSummaryPayload
  ): CodebaseSummaryResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return CodebaseSummaryResponseSchema.parse(parsed);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Attempt ${attempt} failed`, { error: lastError.message });

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an explorer agent instance
 */
export function createExplorerAgent(
  config: Omit<ExplorerAgentConfig, 'type'>,
  dependencies: AgentDependencies
): ExplorerAgent {
  return new ExplorerAgent(config, dependencies);
}
