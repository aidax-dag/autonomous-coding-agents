/**
 * Librarian Agent
 *
 * Specialized agent for documentation lookup, reference search, and knowledge retrieval.
 * Provides capabilities for finding API documentation, code examples, best practices,
 * and integrating external documentation sources.
 *
 * @module core/agents/specialized/librarian-agent
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentDependencies, LLMMessage } from '../interfaces';
import { IAgentConfig, AgentType, AgentCapability, ITask, TaskResult } from '../../interfaces';

// ============================================================================
// Enums
// ============================================================================

/**
 * Documentation source types
 */
export enum DocumentationSource {
  OFFICIAL = 'official',
  COMMUNITY = 'community',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  ALL = 'all',
}

/**
 * Reference types for lookup
 */
export enum ReferenceType {
  API = 'api',
  TUTORIAL = 'tutorial',
  GUIDE = 'guide',
  EXAMPLE = 'example',
  SPECIFICATION = 'specification',
  ALL = 'all',
}

/**
 * Search scope for documentation
 */
export enum SearchScope {
  LOCAL = 'local',
  REMOTE = 'remote',
  CACHED = 'cached',
  ALL = 'all',
}

/**
 * Content format for results
 */
export enum ContentFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  PLAIN_TEXT = 'plain_text',
  JSON = 'json',
}

/**
 * Knowledge domain categories
 */
export enum KnowledgeDomain {
  LANGUAGE = 'language',
  FRAMEWORK = 'framework',
  LIBRARY = 'library',
  TOOL = 'tool',
  PATTERN = 'pattern',
  BEST_PRACTICE = 'best_practice',
  ALL = 'all',
}

// ============================================================================
// Payload Schemas
// ============================================================================

/**
 * API documentation lookup payload
 */
export const ApiDocLookupPayloadSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  library: z.string().optional(),
  version: z.string().optional(),
  language: z.string().optional(),
  source: z.nativeEnum(DocumentationSource).default(DocumentationSource.ALL),
  includeExamples: z.boolean().default(true),
  maxResults: z.number().min(1).max(50).default(10),
});

export type ApiDocLookupPayload = z.infer<typeof ApiDocLookupPayloadSchema>;

/**
 * Code example search payload
 */
export const CodeExampleSearchPayloadSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  language: z.string().min(1, 'Programming language is required'),
  framework: z.string().optional(),
  complexity: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  includeExplanation: z.boolean().default(true),
  maxExamples: z.number().min(1).max(20).default(5),
});

export type CodeExampleSearchPayload = z.infer<typeof CodeExampleSearchPayloadSchema>;

/**
 * Best practices lookup payload
 */
export const BestPracticesLookupPayloadSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  domain: z.nativeEnum(KnowledgeDomain).default(KnowledgeDomain.ALL),
  context: z.string().optional(),
  includeAntiPatterns: z.boolean().default(true),
  includeReferences: z.boolean().default(true),
});

export type BestPracticesLookupPayload = z.infer<typeof BestPracticesLookupPayloadSchema>;

/**
 * Reference search payload
 */
export const ReferenceSearchPayloadSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  referenceType: z.nativeEnum(ReferenceType).default(ReferenceType.ALL),
  scope: z.nativeEnum(SearchScope).default(SearchScope.ALL),
  filters: z
    .object({
      language: z.string().optional(),
      framework: z.string().optional(),
      minRelevance: z.number().min(0).max(1).optional(),
      dateRange: z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  maxResults: z.number().min(1).max(100).default(20),
});

export type ReferenceSearchPayload = z.infer<typeof ReferenceSearchPayloadSchema>;

/**
 * Knowledge synthesis payload
 */
export const KnowledgeSynthesisPayloadSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  sources: z.array(z.string()).min(1, 'At least one source is required'),
  outputFormat: z.nativeEnum(ContentFormat).default(ContentFormat.MARKDOWN),
  depth: z.enum(['summary', 'detailed', 'comprehensive']).default('detailed'),
  includeSourceLinks: z.boolean().default(true),
});

export type KnowledgeSynthesisPayload = z.infer<typeof KnowledgeSynthesisPayloadSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * API documentation entry
 */
const ApiDocEntrySchema = z.object({
  name: z.string(),
  signature: z.string().optional(),
  description: z.string(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        required: z.boolean().default(true),
        defaultValue: z.string().optional(),
      })
    )
    .optional(),
  returnType: z.string().optional(),
  returnDescription: z.string().optional(),
  examples: z.array(z.string()).optional(),
  deprecated: z.boolean().default(false),
  deprecationMessage: z.string().optional(),
  seeAlso: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
});

/**
 * API documentation lookup response
 */
export const ApiDocLookupResponseSchema = z.object({
  query: z.string(),
  results: z.array(ApiDocEntrySchema),
  totalFound: z.number(),
  source: z.nativeEnum(DocumentationSource),
  library: z.string().optional(),
  version: z.string().optional(),
  searchDuration: z.number(),
});

export type ApiDocLookupResponse = z.infer<typeof ApiDocLookupResponseSchema>;

/**
 * Code example entry
 */
const CodeExampleEntrySchema = z.object({
  title: z.string(),
  description: z.string(),
  code: z.string(),
  language: z.string(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  complexity: z.enum(['beginner', 'intermediate', 'advanced']),
  sourceUrl: z.string().optional(),
  relatedExamples: z.array(z.string()).optional(),
});

/**
 * Code example search response
 */
export const CodeExampleSearchResponseSchema = z.object({
  query: z.string(),
  language: z.string(),
  examples: z.array(CodeExampleEntrySchema),
  totalFound: z.number(),
  framework: z.string().optional(),
});

export type CodeExampleSearchResponse = z.infer<typeof CodeExampleSearchResponseSchema>;

/**
 * Best practice entry
 */
const BestPracticeEntrySchema = z.object({
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  examples: z.array(z.string()).optional(),
  antiPatterns: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        whyBad: z.string(),
      })
    )
    .optional(),
  references: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        type: z.string(),
      })
    )
    .optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Best practices lookup response
 */
export const BestPracticesLookupResponseSchema = z.object({
  topic: z.string(),
  domain: z.nativeEnum(KnowledgeDomain),
  practices: z.array(BestPracticeEntrySchema),
  totalFound: z.number(),
  context: z.string().optional(),
});

export type BestPracticesLookupResponse = z.infer<typeof BestPracticesLookupResponseSchema>;

/**
 * Reference entry
 */
const ReferenceEntrySchema = z.object({
  title: z.string(),
  type: z.nativeEnum(ReferenceType),
  summary: z.string(),
  url: z.string().optional(),
  content: z.string().optional(),
  relevanceScore: z.number().min(0).max(1),
  lastUpdated: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Reference search response
 */
export const ReferenceSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(ReferenceEntrySchema),
  totalFound: z.number(),
  scope: z.nativeEnum(SearchScope),
  filters: z.record(z.unknown()).optional(),
});

export type ReferenceSearchResponse = z.infer<typeof ReferenceSearchResponseSchema>;

/**
 * Knowledge synthesis response
 */
export const KnowledgeSynthesisResponseSchema = z.object({
  topic: z.string(),
  synthesis: z.string(),
  format: z.nativeEnum(ContentFormat),
  sourcesSynthesized: z.number(),
  keyPoints: z.array(z.string()),
  sourceLinks: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        contribution: z.string(),
      })
    )
    .optional(),
  confidence: z.number().min(0).max(1),
  generatedAt: z.string(),
});

export type KnowledgeSynthesisResponse = z.infer<typeof KnowledgeSynthesisResponseSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Librarian agent configuration
 */
export interface LibrarianAgentConfig extends Omit<IAgentConfig, 'type'> {
  /** Default documentation source */
  defaultSource?: DocumentationSource;
  /** Default search scope */
  defaultScope?: SearchScope;
  /** Default content format */
  defaultFormat?: ContentFormat;
  /** Enable caching for lookups */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Maximum concurrent searches */
  maxConcurrentSearches?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ============================================================================
// Librarian Agent Implementation
// ============================================================================

/**
 * Librarian Agent
 *
 * Provides documentation lookup, reference search, and knowledge synthesis capabilities.
 * Integrates with external documentation sources and maintains a knowledge cache.
 */
export class LibrarianAgent extends BaseAgent {
  private readonly defaultSource: DocumentationSource;
  private readonly defaultScope: SearchScope;
  private readonly defaultFormat: ContentFormat;
  private readonly enableCaching: boolean;
  private readonly cacheTTL: number;
  private readonly maxConcurrentSearches: number;
  private readonly retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: LibrarianAgentConfig, dependencies: AgentDependencies) {
    super(
      {
        ...config,
        type: AgentType.LIBRARIAN,
      },
      dependencies
    );

    this.defaultSource = config.defaultSource ?? DocumentationSource.ALL;
    this.defaultScope = config.defaultScope ?? SearchScope.ALL;
    this.defaultFormat = config.defaultFormat ?? ContentFormat.MARKDOWN;
    this.enableCaching = config.enableCaching ?? true;
    this.cacheTTL = config.cacheTTL ?? 600000; // 10 minutes
    this.maxConcurrentSearches = config.maxConcurrentSearches ?? 5;

    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };

    this.logger.debug('LibrarianAgent initialized', {
      defaultSource: this.defaultSource,
      defaultScope: this.defaultScope,
      defaultFormat: this.defaultFormat,
      enableCaching: this.enableCaching,
      cacheTTL: this.cacheTTL,
      maxConcurrentSearches: this.maxConcurrentSearches,
    });
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'api-doc-lookup',
        description: 'Look up API documentation for libraries, frameworks, and languages',
        inputSchema: ApiDocLookupPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: ApiDocLookupResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'code-example-search',
        description: 'Search for code examples and usage patterns',
        inputSchema: CodeExampleSearchPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: CodeExampleSearchResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'best-practices-lookup',
        description: 'Find best practices, patterns, and anti-patterns for a topic',
        inputSchema: BestPracticesLookupPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: BestPracticesLookupResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'reference-search',
        description: 'Search for references, tutorials, guides, and specifications',
        inputSchema: ReferenceSearchPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: ReferenceSearchResponseSchema.shape as unknown as Record<string, unknown>,
      },
      {
        name: 'knowledge-synthesis',
        description: 'Synthesize knowledge from multiple sources into a coherent summary',
        inputSchema: KnowledgeSynthesisPayloadSchema.shape as unknown as Record<string, unknown>,
        outputSchema: KnowledgeSynthesisResponseSchema.shape as unknown as Record<string, unknown>,
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
        case 'api-doc-lookup':
          return await this.handleApiDocLookup(task, startTime);
        case 'code-example-search':
          return await this.handleCodeExampleSearch(task, startTime);
        case 'best-practices-lookup':
          return await this.handleBestPracticesLookup(task, startTime);
        case 'reference-search':
          return await this.handleReferenceSearch(task, startTime);
        case 'knowledge-synthesis':
          return await this.handleKnowledgeSynthesis(task, startTime);
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

  private async handleApiDocLookup(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ApiDocLookupPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting API doc lookup', { query: payload.query, library: payload.library });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildApiDocLookupPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseApiDocLookupResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleCodeExampleSearch(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = CodeExampleSearchPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting code example search', {
      query: payload.query,
      language: payload.language,
    });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildCodeExampleSearchPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseCodeExampleSearchResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleBestPracticesLookup(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = BestPracticesLookupPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting best practices lookup', { topic: payload.topic });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildBestPracticesLookupPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseBestPracticesLookupResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleReferenceSearch(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ReferenceSearchPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting reference search', {
      query: payload.query,
      type: payload.referenceType,
    });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildReferenceSearchPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseReferenceSearchResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  private async handleKnowledgeSynthesis(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = KnowledgeSynthesisPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;
    this.logger.info('Starting knowledge synthesis', {
      topic: payload.topic,
      sources: payload.sources.length,
    });

    const response = await this.executeWithRetry(async () => {
      const messages = this.buildKnowledgeSynthesisPrompt(payload);
      const llmResponse = await this.llmClient.complete(messages);
      return this.parseKnowledgeSynthesisResponse(llmResponse.content, payload);
    });

    return this.createSuccessResult(task, response, startTime);
  }

  // ============================================================================
  // Prompt Builders
  // ============================================================================

  private buildApiDocLookupPrompt(payload: ApiDocLookupPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are an expert documentation librarian. Search and retrieve API documentation based on the query.

Return your results as a JSON object with this structure:
{
  "query": "string",
  "results": [
    {
      "name": "string",
      "signature": "string (optional)",
      "description": "string",
      "parameters": [
        {
          "name": "string",
          "type": "string",
          "description": "string",
          "required": boolean,
          "defaultValue": "string (optional)"
        }
      ],
      "returnType": "string (optional)",
      "returnDescription": "string (optional)",
      "examples": ["string"],
      "deprecated": boolean,
      "seeAlso": ["string"],
      "sourceUrl": "string (optional)"
    }
  ],
  "totalFound": number,
  "source": "official" | "community" | "internal" | "external" | "all",
  "library": "string (optional)",
  "version": "string (optional)",
  "searchDuration": number
}

Provide accurate, comprehensive documentation entries.`,
      },
      {
        role: 'user',
        content: `Look up API documentation:
Query: ${payload.query}
${payload.library ? `Library: ${payload.library}` : ''}
${payload.version ? `Version: ${payload.version}` : ''}
${payload.language ? `Language: ${payload.language}` : ''}
Source: ${payload.source}
Include Examples: ${payload.includeExamples}
Max Results: ${payload.maxResults}`,
      },
    ];
  }

  private buildCodeExampleSearchPrompt(payload: CodeExampleSearchPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are an expert code librarian. Find relevant code examples for the given query.

Return your results as a JSON object with this structure:
{
  "query": "string",
  "language": "string",
  "examples": [
    {
      "title": "string",
      "description": "string",
      "code": "string",
      "language": "string",
      "explanation": "string (optional)",
      "tags": ["string"],
      "complexity": "beginner" | "intermediate" | "advanced",
      "sourceUrl": "string (optional)",
      "relatedExamples": ["string"]
    }
  ],
  "totalFound": number,
  "framework": "string (optional)"
}

Provide working, well-documented code examples.`,
      },
      {
        role: 'user',
        content: `Search for code examples:
Query: ${payload.query}
Language: ${payload.language}
${payload.framework ? `Framework: ${payload.framework}` : ''}
Complexity: ${payload.complexity}
Include Explanation: ${payload.includeExplanation}
Max Examples: ${payload.maxExamples}`,
      },
    ];
  }

  private buildBestPracticesLookupPrompt(payload: BestPracticesLookupPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are an expert in software engineering best practices. Find and explain best practices for the given topic.

Return your results as a JSON object with this structure:
{
  "topic": "string",
  "domain": "language" | "framework" | "library" | "tool" | "pattern" | "best_practice" | "all",
  "practices": [
    {
      "title": "string",
      "description": "string",
      "rationale": "string",
      "examples": ["string"],
      "antiPatterns": [
        {
          "name": "string",
          "description": "string",
          "whyBad": "string"
        }
      ],
      "references": [
        {
          "title": "string",
          "url": "string (optional)",
          "type": "string"
        }
      ],
      "tags": ["string"]
    }
  ],
  "totalFound": number,
  "context": "string (optional)"
}

Provide practical, actionable best practices with clear rationale.`,
      },
      {
        role: 'user',
        content: `Look up best practices for:
Topic: ${payload.topic}
Domain: ${payload.domain}
${payload.context ? `Context: ${payload.context}` : ''}
Include Anti-Patterns: ${payload.includeAntiPatterns}
Include References: ${payload.includeReferences}`,
      },
    ];
  }

  private buildReferenceSearchPrompt(payload: ReferenceSearchPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are an expert reference librarian. Search for relevant references, tutorials, and guides.

Return your results as a JSON object with this structure:
{
  "query": "string",
  "results": [
    {
      "title": "string",
      "type": "api" | "tutorial" | "guide" | "example" | "specification" | "all",
      "summary": "string",
      "url": "string (optional)",
      "content": "string (optional)",
      "relevanceScore": number (0-1),
      "lastUpdated": "string (optional)",
      "author": "string (optional)",
      "tags": ["string"]
    }
  ],
  "totalFound": number,
  "scope": "local" | "remote" | "cached" | "all",
  "filters": {}
}

Provide relevant, high-quality references sorted by relevance.`,
      },
      {
        role: 'user',
        content: `Search for references:
Query: ${payload.query}
Reference Type: ${payload.referenceType}
Scope: ${payload.scope}
${payload.filters ? `Filters: ${JSON.stringify(payload.filters)}` : ''}
Max Results: ${payload.maxResults}`,
      },
    ];
  }

  private buildKnowledgeSynthesisPrompt(payload: KnowledgeSynthesisPayload): LLMMessage[] {
    return [
      {
        role: 'system',
        content: `You are an expert knowledge synthesizer. Combine information from multiple sources into a coherent summary.

Return your results as a JSON object with this structure:
{
  "topic": "string",
  "synthesis": "string",
  "format": "markdown" | "html" | "plain_text" | "json",
  "sourcesSynthesized": number,
  "keyPoints": ["string"],
  "sourceLinks": [
    {
      "title": "string",
      "url": "string",
      "contribution": "string"
    }
  ],
  "confidence": number (0-1),
  "generatedAt": "string (ISO date)"
}

Create a comprehensive, well-organized synthesis that integrates all sources.`,
      },
      {
        role: 'user',
        content: `Synthesize knowledge about:
Topic: ${payload.topic}
Sources: ${payload.sources.join(', ')}
Output Format: ${payload.outputFormat}
Depth: ${payload.depth}
Include Source Links: ${payload.includeSourceLinks}`,
      },
    ];
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseApiDocLookupResponse(
    content: string,
    payload: ApiDocLookupPayload
  ): ApiDocLookupResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure required fields have defaults
    return ApiDocLookupResponseSchema.parse({
      ...parsed,
      query: parsed.query || payload.query,
      source: parsed.source || payload.source,
      searchDuration: parsed.searchDuration || 0,
    });
  }

  private parseCodeExampleSearchResponse(
    content: string,
    payload: CodeExampleSearchPayload
  ): CodeExampleSearchResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return CodeExampleSearchResponseSchema.parse({
      ...parsed,
      query: parsed.query || payload.query,
      language: parsed.language || payload.language,
    });
  }

  private parseBestPracticesLookupResponse(
    content: string,
    payload: BestPracticesLookupPayload
  ): BestPracticesLookupResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return BestPracticesLookupResponseSchema.parse({
      ...parsed,
      topic: parsed.topic || payload.topic,
      domain: parsed.domain || payload.domain,
    });
  }

  private parseReferenceSearchResponse(
    content: string,
    payload: ReferenceSearchPayload
  ): ReferenceSearchResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return ReferenceSearchResponseSchema.parse({
      ...parsed,
      query: parsed.query || payload.query,
      scope: parsed.scope || payload.scope,
    });
  }

  private parseKnowledgeSynthesisResponse(
    content: string,
    payload: KnowledgeSynthesisPayload
  ): KnowledgeSynthesisResponse {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return KnowledgeSynthesisResponseSchema.parse({
      ...parsed,
      topic: parsed.topic || payload.topic,
      format: parsed.format || payload.outputFormat,
      generatedAt: parsed.generatedAt || new Date().toISOString(),
    });
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
 * Create a librarian agent instance
 */
export function createLibrarianAgent(
  config: Omit<LibrarianAgentConfig, 'type'>,
  dependencies: AgentDependencies
): LibrarianAgent {
  return new LibrarianAgent(config, dependencies);
}
