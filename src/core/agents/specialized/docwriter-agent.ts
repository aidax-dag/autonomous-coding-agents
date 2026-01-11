/**
 * DocWriter Agent
 *
 * DI-based implementation responsible for documentation generation and maintenance.
 * Handles code documentation, README generation, API docs, changelogs, and user guides.
 *
 * Follows SOLID principles:
 * - S: Single responsibility - documentation tasks
 * - O: Open for extension via hooks
 * - L: Implements IAgent, substitutable
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * Feature: F1.8 - DocWriter Agent
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
 * Documentation types
 */
export enum DocumentationType {
  JSDOC = 'jsdoc',
  README = 'readme',
  API = 'api',
  CHANGELOG = 'changelog',
  USER_GUIDE = 'user-guide',
  INLINE_COMMENTS = 'inline-comments',
}

/**
 * Documentation output formats
 */
export enum DocumentationFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  PLAIN = 'plain',
}

/**
 * Documentation detail levels
 */
export enum DetailLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
}

/**
 * Change types for changelog
 */
export enum ChangeType {
  ADDED = 'added',
  CHANGED = 'changed',
  DEPRECATED = 'deprecated',
  REMOVED = 'removed',
  FIXED = 'fixed',
  SECURITY = 'security',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Code documentation generation payload schema
 */
export const CodeDocumentationPayloadSchema = z.object({
  code: z.object({
    content: z.string().min(1),
    language: z.string().min(1),
    filePath: z.string().optional(),
  }),
  style: z.enum(['jsdoc', 'tsdoc', 'docstring', 'javadoc']).default('jsdoc'),
  detailLevel: z.nativeEnum(DetailLevel).default(DetailLevel.STANDARD),
  includeExamples: z.boolean().default(true),
  includeTypes: z.boolean().default(true),
});

/**
 * README generation payload schema
 */
export const ReadmeGenerationPayloadSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    language: z.string().optional(),
    framework: z.string().optional(),
  }),
  existingReadme: z.string().optional(),
  sections: z
    .array(
      z.enum([
        'overview',
        'installation',
        'usage',
        'api',
        'configuration',
        'contributing',
        'license',
        'badges',
        'examples',
        'faq',
        'troubleshooting',
      ])
    )
    .optional(),
  codeStructure: z
    .object({
      directories: z.array(z.string()).optional(),
      mainFiles: z.array(z.string()).optional(),
      dependencies: z.record(z.string()).optional(),
    })
    .optional(),
  updateMode: z.enum(['create', 'update', 'merge']).default('create'),
});

/**
 * API documentation payload schema
 */
export const ApiDocumentationPayloadSchema = z.object({
  api: z.object({
    name: z.string().min(1),
    version: z.string().optional(),
    baseUrl: z.string().optional(),
    endpoints: z
      .array(
        z.object({
          method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
          path: z.string(),
          description: z.string().optional(),
          parameters: z.array(z.record(z.unknown())).optional(),
          requestBody: z.record(z.unknown()).optional(),
          responses: z.record(z.unknown()).optional(),
        })
      )
      .optional(),
    types: z
      .array(
        z.object({
          name: z.string(),
          properties: z.record(z.string()),
        })
      )
      .optional(),
  }),
  format: z.nativeEnum(DocumentationFormat).default(DocumentationFormat.MARKDOWN),
  includeExamples: z.boolean().default(true),
  includeSchemas: z.boolean().default(true),
});

/**
 * Changelog generation payload schema
 */
export const ChangelogPayloadSchema = z.object({
  version: z.string().min(1),
  previousVersion: z.string().optional(),
  changes: z.array(
    z.object({
      type: z.nativeEnum(ChangeType),
      description: z.string(),
      scope: z.string().optional(),
      breaking: z.boolean().default(false),
      issueRef: z.string().optional(),
    })
  ),
  commits: z
    .array(
      z.object({
        hash: z.string(),
        message: z.string(),
        author: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .optional(),
  existingChangelog: z.string().optional(),
  format: z.enum(['keepachangelog', 'conventional', 'simple']).default('keepachangelog'),
});

/**
 * User guide generation payload schema
 */
export const UserGuidePayloadSchema = z.object({
  product: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    features: z.array(z.string()),
  }),
  targetAudience: z.enum(['beginner', 'intermediate', 'advanced', 'all']).default('all'),
  sections: z
    .array(
      z.object({
        title: z.string(),
        topics: z.array(z.string()),
      })
    )
    .optional(),
  includeScreenshots: z.boolean().default(false),
  includeTroubleshooting: z.boolean().default(true),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Code documentation response schema
 */
export const CodeDocumentationResponseSchema = z.object({
  documentedCode: z.string(),
  documentsAdded: z.number(),
  coverage: z.object({
    functions: z.number(),
    classes: z.number(),
    interfaces: z.number(),
    total: z.number(),
  }),
  warnings: z.array(z.string()).optional(),
});

/**
 * README response schema
 */
export const ReadmeResponseSchema = z.object({
  content: z.string(),
  sections: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    })
  ),
  metadata: z.object({
    wordCount: z.number(),
    hasInstallation: z.boolean(),
    hasUsage: z.boolean(),
    hasExamples: z.boolean(),
  }),
});

/**
 * API documentation response schema
 */
export const ApiDocumentationResponseSchema = z.object({
  documentation: z.string(),
  endpoints: z.array(
    z.object({
      method: z.string(),
      path: z.string(),
      documentation: z.string(),
    })
  ),
  schemas: z.array(
    z.object({
      name: z.string(),
      documentation: z.string(),
    })
  ),
  format: z.string(),
});

/**
 * Changelog response schema
 */
export const ChangelogResponseSchema = z.object({
  content: z.string(),
  version: z.string(),
  date: z.string(),
  changeCount: z.object({
    added: z.number(),
    changed: z.number(),
    deprecated: z.number(),
    removed: z.number(),
    fixed: z.number(),
    security: z.number(),
  }),
  hasBreakingChanges: z.boolean(),
});

/**
 * User guide response schema
 */
export const UserGuideResponseSchema = z.object({
  content: z.string(),
  tableOfContents: z.array(
    z.object({
      level: z.number(),
      title: z.string(),
      anchor: z.string(),
    })
  ),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    })
  ),
  metadata: z.object({
    wordCount: z.number(),
    estimatedReadTime: z.number(),
  }),
});

// Type exports
export type CodeDocumentationPayload = z.infer<typeof CodeDocumentationPayloadSchema>;
export type ReadmeGenerationPayload = z.infer<typeof ReadmeGenerationPayloadSchema>;
export type ApiDocumentationPayload = z.infer<typeof ApiDocumentationPayloadSchema>;
export type ChangelogPayload = z.infer<typeof ChangelogPayloadSchema>;
export type UserGuidePayload = z.infer<typeof UserGuidePayloadSchema>;
export type CodeDocumentationResponse = z.infer<typeof CodeDocumentationResponseSchema>;
export type ReadmeResponse = z.infer<typeof ReadmeResponseSchema>;
export type ApiDocumentationResponse = z.infer<typeof ApiDocumentationResponseSchema>;
export type ChangelogResponse = z.infer<typeof ChangelogResponseSchema>;
export type UserGuideResponse = z.infer<typeof UserGuideResponseSchema>;

// ============================================================================
// Configuration
// ============================================================================

/**
 * DocWriter Agent Configuration
 */
export interface DocWriterAgentConfig extends IAgentConfig {
  defaultDetailLevel?: DetailLevel;
  defaultFormat?: DocumentationFormat;
  maxCodeLength?: number;
  enableAutoExamples?: boolean;
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * DocWriter Agent
 *
 * Handles documentation generation including code docs, README, API docs,
 * changelogs, and user guides.
 */
export class DocWriterAgent extends BaseAgent {
  private readonly defaultDetailLevel: DetailLevel;
  private readonly defaultFormat: DocumentationFormat;
  private readonly maxCodeLength: number;
  private readonly enableAutoExamples: boolean;
  private readonly retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: DocWriterAgentConfig, dependencies: AgentDependencies) {
    super(
      {
        ...config,
        type: AgentType.DOC_WRITER,
      },
      dependencies
    );

    this.defaultDetailLevel = config.defaultDetailLevel ?? DetailLevel.STANDARD;
    this.defaultFormat = config.defaultFormat ?? DocumentationFormat.MARKDOWN;
    this.maxCodeLength = config.maxCodeLength ?? 50000;
    this.enableAutoExamples = config.enableAutoExamples ?? true;

    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================

  protected async onInitialize(): Promise<void> {
    this.logger.info('DocWriterAgent initializing', {
      defaultDetailLevel: this.defaultDetailLevel,
      defaultFormat: this.defaultFormat,
      maxCodeLength: this.maxCodeLength,
      enableAutoExamples: this.enableAutoExamples,
    });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('DocWriterAgent disposing');
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'code-documentation',
        description: 'Generate documentation comments for code (JSDoc, TSDoc, docstrings)',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                language: { type: 'string' },
                filePath: { type: 'string' },
              },
              required: ['content', 'language'],
            },
            style: { type: 'string', enum: ['jsdoc', 'tsdoc', 'docstring', 'javadoc'] },
            detailLevel: { type: 'string', enum: ['minimal', 'standard', 'comprehensive'] },
          },
          required: ['code'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            documentedCode: { type: 'string' },
            documentsAdded: { type: 'number' },
            coverage: { type: 'object' },
          },
        },
      },
      {
        name: 'readme-generation',
        description: 'Generate or update README.md files for projects',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                language: { type: 'string' },
              },
              required: ['name', 'description'],
            },
            sections: { type: 'array', items: { type: 'string' } },
            updateMode: { type: 'string', enum: ['create', 'update', 'merge'] },
          },
          required: ['project'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            sections: { type: 'array' },
            metadata: { type: 'object' },
          },
        },
      },
      {
        name: 'api-documentation',
        description: 'Generate API documentation from endpoint definitions',
        inputSchema: {
          type: 'object',
          properties: {
            api: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                version: { type: 'string' },
                endpoints: { type: 'array' },
              },
              required: ['name'],
            },
            format: { type: 'string', enum: ['markdown', 'html', 'json'] },
          },
          required: ['api'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            documentation: { type: 'string' },
            endpoints: { type: 'array' },
            schemas: { type: 'array' },
          },
        },
      },
      {
        name: 'changelog-generation',
        description: 'Generate changelog entries from commits and changes',
        inputSchema: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            changes: { type: 'array' },
            commits: { type: 'array' },
            format: { type: 'string', enum: ['keepachangelog', 'conventional', 'simple'] },
          },
          required: ['version', 'changes'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            version: { type: 'string' },
            changeCount: { type: 'object' },
          },
        },
      },
      {
        name: 'user-guide-generation',
        description: 'Generate user guides and tutorials for products',
        inputSchema: {
          type: 'object',
          properties: {
            product: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                features: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'description', 'features'],
            },
            targetAudience: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'all'] },
          },
          required: ['product'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            tableOfContents: { type: 'array' },
            sections: { type: 'array' },
          },
        },
      },
    ];
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();

    try {
      switch (task.type) {
        case 'code-documentation':
          return await this.handleCodeDocumentation(task, startTime);

        case 'readme-generation':
          return await this.handleReadmeGeneration(task, startTime);

        case 'api-documentation':
          return await this.handleApiDocumentation(task, startTime);

        case 'changelog-generation':
          return await this.handleChangelogGeneration(task, startTime);

        case 'user-guide-generation':
          return await this.handleUserGuideGeneration(task, startTime);

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

  /**
   * Handle code documentation task
   */
  private async handleCodeDocumentation(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = CodeDocumentationPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    if (payload.code.content.length > this.maxCodeLength) {
      return this.createFailureResult(
        task,
        new Error(`Code exceeds maximum length of ${this.maxCodeLength} characters`),
        startTime
      );
    }

    this.logger.info('Generating code documentation', {
      taskId: task.id,
      language: payload.code.language,
      style: payload.style,
      detailLevel: payload.detailLevel,
    });

    const systemPrompt = this.buildCodeDocSystemPrompt(payload);
    const userPrompt = this.buildCodeDocUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'code-documentation-llm'
    );

    const documentation = this.parseCodeDocResponse(response);

    return this.createSuccessResult(
      task,
      {
        documentation,
        language: payload.code.language,
        style: payload.style,
      },
      startTime
    );
  }

  /**
   * Handle README generation task
   */
  private async handleReadmeGeneration(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ReadmeGenerationPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Generating README', {
      taskId: task.id,
      projectName: payload.project.name,
      updateMode: payload.updateMode,
      sectionCount: payload.sections?.length,
    });

    const systemPrompt = this.buildReadmeSystemPrompt(payload);
    const userPrompt = this.buildReadmeUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'readme-generation-llm'
    );

    const readme = this.parseReadmeResponse(response);

    return this.createSuccessResult(
      task,
      {
        readme,
        projectName: payload.project.name,
        updateMode: payload.updateMode,
      },
      startTime
    );
  }

  /**
   * Handle API documentation task
   */
  private async handleApiDocumentation(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ApiDocumentationPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Generating API documentation', {
      taskId: task.id,
      apiName: payload.api.name,
      endpointCount: payload.api.endpoints?.length,
      format: payload.format,
    });

    const systemPrompt = this.buildApiDocSystemPrompt(payload);
    const userPrompt = this.buildApiDocUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'api-documentation-llm'
    );

    const apiDoc = this.parseApiDocResponse(response);

    return this.createSuccessResult(
      task,
      {
        apiDocumentation: apiDoc,
        apiName: payload.api.name,
        format: payload.format,
      },
      startTime
    );
  }

  /**
   * Handle changelog generation task
   */
  private async handleChangelogGeneration(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ChangelogPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Generating changelog', {
      taskId: task.id,
      version: payload.version,
      changeCount: payload.changes.length,
      format: payload.format,
    });

    const systemPrompt = this.buildChangelogSystemPrompt(payload);
    const userPrompt = this.buildChangelogUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'changelog-generation-llm'
    );

    const changelog = this.parseChangelogResponse(response);

    return this.createSuccessResult(
      task,
      {
        changelog,
        version: payload.version,
        format: payload.format,
      },
      startTime
    );
  }

  /**
   * Handle user guide generation task
   */
  private async handleUserGuideGeneration(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = UserGuidePayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Generating user guide', {
      taskId: task.id,
      productName: payload.product.name,
      targetAudience: payload.targetAudience,
      featureCount: payload.product.features.length,
    });

    const systemPrompt = this.buildUserGuideSystemPrompt(payload);
    const userPrompt = this.buildUserGuideUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'user-guide-generation-llm'
    );

    const userGuide = this.parseUserGuideResponse(response);

    return this.createSuccessResult(
      task,
      {
        userGuide,
        productName: payload.product.name,
        targetAudience: payload.targetAudience,
      },
      startTime
    );
  }

  // ============================================================================
  // LLM Interaction
  // ============================================================================

  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llmClient.complete(messages, {
      maxTokens: 8000,
      temperature: 0.2,
    });

    return response.content;
  }

  // ============================================================================
  // Prompt Builders
  // ============================================================================

  private buildCodeDocSystemPrompt(payload: CodeDocumentationPayload): string {
    return `You are an expert technical writer specializing in code documentation.

Your task is to add comprehensive documentation comments to the provided code.

Documentation Style: ${payload.style.toUpperCase()}
Detail Level: ${payload.detailLevel}
Language: ${payload.code.language}

Guidelines for ${payload.style}:
${this.getStyleGuidelines(payload.style)}

Detail Level Guidelines:
${payload.detailLevel === 'minimal' ? '- Include only essential descriptions for public APIs' : ''}
${payload.detailLevel === 'standard' ? '- Include descriptions, parameters, return values, and basic examples' : ''}
${payload.detailLevel === 'comprehensive' ? '- Include detailed descriptions, all parameters, return values, examples, edge cases, and related methods' : ''}

${payload.includeExamples ? '- Include usage examples for complex functions' : '- Do not include usage examples'}
${payload.includeTypes ? '- Include type information where applicable' : ''}

Respond with a JSON object:
{
  "documentedCode": "string - the complete code with documentation added",
  "documentsAdded": number,
  "coverage": {
    "functions": number (percentage 0-100),
    "classes": number (percentage 0-100),
    "interfaces": number (percentage 0-100),
    "total": number (percentage 0-100)
  },
  "warnings": ["string"] (optional - any issues encountered)
}`;
  }

  private getStyleGuidelines(style: string): string {
    switch (style) {
      case 'jsdoc':
        return `- Use /** */ comment blocks
- Use @param for parameters with {type} annotation
- Use @returns for return values
- Use @example for code examples
- Use @throws for exceptions
- Use @deprecated for deprecated items`;
      case 'tsdoc':
        return `- Use /** */ comment blocks
- Use @param without type (TypeScript infers)
- Use @returns for return values
- Use @example for code examples
- Use @throws for exceptions
- Use @remarks for additional details`;
      case 'docstring':
        return `- Use triple quotes """ for docstrings
- Use Google or NumPy style
- Include Args section for parameters
- Include Returns section
- Include Raises section for exceptions
- Include Examples section`;
      case 'javadoc':
        return `- Use /** */ comment blocks
- Use @param for parameters
- Use @return for return values
- Use @throws for exceptions
- Use @see for references
- Use @deprecated for deprecated items`;
      default:
        return '- Follow standard documentation practices';
    }
  }

  private buildCodeDocUserPrompt(payload: CodeDocumentationPayload): string {
    return `Add documentation to the following ${payload.code.language} code:
${payload.code.filePath ? `\nFile: ${payload.code.filePath}` : ''}

\`\`\`${payload.code.language}
${payload.code.content}
\`\`\`

Generate comprehensive ${payload.style} documentation for all:
1. Classes and their methods
2. Functions
3. Interfaces/Types
4. Important constants
5. Complex logic (inline comments where helpful)`;
  }

  private buildReadmeSystemPrompt(payload: ReadmeGenerationPayload): string {
    const sectionList =
      payload.sections?.join(', ') ||
      'overview, installation, usage, api, configuration, contributing, license';

    return `You are an expert technical writer specializing in README documentation.

Your task is to ${payload.updateMode === 'create' ? 'create a new' : 'update the existing'} README.md file.

Project: ${payload.project.name}
Mode: ${payload.updateMode.toUpperCase()}
Requested Sections: ${sectionList}

Guidelines:
- Write clear, concise documentation
- Use proper Markdown formatting
- Include code examples where appropriate
- Make installation steps easy to follow
- Organize content logically
${payload.updateMode === 'update' ? '- Preserve existing content structure where possible' : ''}
${payload.updateMode === 'merge' ? '- Merge new content with existing, avoiding duplicates' : ''}

Respond with a JSON object:
{
  "content": "string - complete README content in Markdown",
  "sections": [{"name": "string", "content": "string"}],
  "metadata": {
    "wordCount": number,
    "hasInstallation": boolean,
    "hasUsage": boolean,
    "hasExamples": boolean
  }
}`;
  }

  private buildReadmeUserPrompt(payload: ReadmeGenerationPayload): string {
    let prompt = `${payload.updateMode === 'create' ? 'Create' : 'Update'} a README.md for:

Project: ${payload.project.name}
Description: ${payload.project.description}
${payload.project.language ? `Language: ${payload.project.language}` : ''}
${payload.project.framework ? `Framework: ${payload.project.framework}` : ''}
`;

    if (payload.codeStructure) {
      prompt += `
Code Structure:
${payload.codeStructure.directories ? `- Directories: ${payload.codeStructure.directories.join(', ')}` : ''}
${payload.codeStructure.mainFiles ? `- Main Files: ${payload.codeStructure.mainFiles.join(', ')}` : ''}
${payload.codeStructure.dependencies ? `- Dependencies: ${JSON.stringify(payload.codeStructure.dependencies)}` : ''}
`;
    }

    if (payload.existingReadme) {
      prompt += `
Existing README:
\`\`\`markdown
${payload.existingReadme}
\`\`\`
`;
    }

    return prompt;
  }

  private buildApiDocSystemPrompt(payload: ApiDocumentationPayload): string {
    return `You are an expert API documentation writer.

Your task is to generate comprehensive API documentation.

API: ${payload.api.name}
${payload.api.version ? `Version: ${payload.api.version}` : ''}
Format: ${payload.format.toUpperCase()}

Guidelines:
- Document all endpoints clearly
- Include request/response examples
- Document all parameters and their types
- Include authentication requirements
- Document error responses
${payload.includeExamples ? '- Include curl/code examples for each endpoint' : ''}
${payload.includeSchemas ? '- Include complete schema definitions' : ''}

Respond with a JSON object:
{
  "documentation": "string - complete API documentation",
  "endpoints": [{"method": "string", "path": "string", "documentation": "string"}],
  "schemas": [{"name": "string", "documentation": "string"}],
  "format": "string"
}`;
  }

  private buildApiDocUserPrompt(payload: ApiDocumentationPayload): string {
    let prompt = `Generate API documentation for: ${payload.api.name}
${payload.api.baseUrl ? `Base URL: ${payload.api.baseUrl}` : ''}
`;

    if (payload.api.endpoints?.length) {
      prompt += `
Endpoints:
${payload.api.endpoints
  .map(
    (e) => `- ${e.method} ${e.path}${e.description ? `: ${e.description}` : ''}`
  )
  .join('\n')}
`;
    }

    if (payload.api.types?.length) {
      prompt += `
Types/Schemas:
${payload.api.types
  .map(
    (t) => `- ${t.name}: ${JSON.stringify(t.properties)}`
  )
  .join('\n')}
`;
    }

    return prompt;
  }

  private buildChangelogSystemPrompt(payload: ChangelogPayload): string {
    return `You are an expert at writing changelogs following best practices.

Your task is to generate a changelog entry.

Version: ${payload.version}
${payload.previousVersion ? `Previous Version: ${payload.previousVersion}` : ''}
Format: ${payload.format.toUpperCase()}

Format Guidelines:
${this.getChangelogFormatGuidelines(payload.format)}

Respond with a JSON object:
{
  "content": "string - the changelog entry content",
  "version": "string",
  "date": "string (YYYY-MM-DD)",
  "changeCount": {
    "added": number,
    "changed": number,
    "deprecated": number,
    "removed": number,
    "fixed": number,
    "security": number
  },
  "hasBreakingChanges": boolean
}`;
  }

  private getChangelogFormatGuidelines(format: string): string {
    switch (format) {
      case 'keepachangelog':
        return `- Follow Keep a Changelog format (https://keepachangelog.com)
- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
- Use clear, human-readable descriptions
- Link to issues/PRs where applicable`;
      case 'conventional':
        return `- Follow Conventional Commits format
- Use feat:, fix:, docs:, style:, refactor:, perf:, test:, chore: prefixes
- Include scope in parentheses when applicable
- Mark breaking changes with BREAKING CHANGE`;
      case 'simple':
        return `- Use simple bullet point format
- Group by category if many changes
- Keep descriptions brief
- Include version and date`;
      default:
        return '- Follow standard changelog practices';
    }
  }

  private buildChangelogUserPrompt(payload: ChangelogPayload): string {
    let prompt = `Generate a changelog entry for version ${payload.version}:

Changes:
${payload.changes
  .map(
    (c) =>
      `- [${c.type.toUpperCase()}]${c.scope ? ` (${c.scope})` : ''}: ${c.description}${c.breaking ? ' [BREAKING]' : ''}${c.issueRef ? ` (${c.issueRef})` : ''}`
  )
  .join('\n')}
`;

    if (payload.commits?.length) {
      prompt += `
Recent Commits:
${payload.commits
  .map(
    (c) => `- ${c.hash.substring(0, 7)}: ${c.message}${c.author ? ` (${c.author})` : ''}`
  )
  .join('\n')}
`;
    }

    if (payload.existingChangelog) {
      prompt += `
Existing Changelog (prepend new entry):
\`\`\`markdown
${payload.existingChangelog}
\`\`\`
`;
    }

    return prompt;
  }

  private buildUserGuideSystemPrompt(payload: UserGuidePayload): string {
    return `You are an expert technical writer specializing in user documentation.

Your task is to create a comprehensive user guide.

Product: ${payload.product.name}
Target Audience: ${payload.targetAudience.toUpperCase()}

Guidelines:
- Write for ${payload.targetAudience} users
- Use clear, accessible language
- Include step-by-step instructions
- Organize content logically with clear headings
${payload.includeScreenshots ? '- Include placeholder markers for screenshots: [SCREENSHOT: description]' : ''}
${payload.includeTroubleshooting ? '- Include a troubleshooting section' : ''}

Target Audience Guidelines:
${this.getAudienceGuidelines(payload.targetAudience)}

Respond with a JSON object:
{
  "content": "string - complete user guide in Markdown",
  "tableOfContents": [{"level": number, "title": "string", "anchor": "string"}],
  "sections": [{"title": "string", "content": "string"}],
  "metadata": {
    "wordCount": number,
    "estimatedReadTime": number (in minutes)
  }
}`;
  }

  private getAudienceGuidelines(audience: string): string {
    switch (audience) {
      case 'beginner':
        return `- Explain all concepts from basics
- Avoid jargon or define all terms
- Include many examples
- Use simple, short sentences`;
      case 'intermediate':
        return `- Assume basic knowledge
- Focus on practical usage
- Include tips and best practices
- Balance detail with efficiency`;
      case 'advanced':
        return `- Assume expert knowledge
- Focus on advanced features
- Include technical details
- Cover edge cases and optimization`;
      case 'all':
        return `- Structure content for all levels
- Start with basics, progress to advanced
- Clearly label difficulty levels
- Include quick-start and deep-dive sections`;
      default:
        return '- Write for a general audience';
    }
  }

  private buildUserGuideUserPrompt(payload: UserGuidePayload): string {
    let prompt = `Create a user guide for:

Product: ${payload.product.name}
Description: ${payload.product.description}

Features to document:
${payload.product.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}
`;

    if (payload.sections?.length) {
      prompt += `
Requested sections:
${payload.sections.map((s) => `- ${s.title}: ${s.topics.join(', ')}`).join('\n')}
`;
    }

    return prompt;
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseCodeDocResponse(response: string): CodeDocumentationResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = CodeDocumentationResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('Code documentation response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse code documentation response', { error });
    }

    return {
      documentedCode: '',
      documentsAdded: 0,
      coverage: {
        functions: 0,
        classes: 0,
        interfaces: 0,
        total: 0,
      },
      warnings: ['Documentation generation incomplete - parsing failed'],
    };
  }

  private parseReadmeResponse(response: string): ReadmeResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ReadmeResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('README response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse README response', { error });
    }

    return {
      content: '',
      sections: [],
      metadata: {
        wordCount: 0,
        hasInstallation: false,
        hasUsage: false,
        hasExamples: false,
      },
    };
  }

  private parseApiDocResponse(response: string): ApiDocumentationResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ApiDocumentationResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('API documentation response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse API documentation response', { error });
    }

    return {
      documentation: '',
      endpoints: [],
      schemas: [],
      format: 'markdown',
    };
  }

  private parseChangelogResponse(response: string): ChangelogResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ChangelogResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('Changelog response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse changelog response', { error });
    }

    return {
      content: '',
      version: '',
      date: new Date().toISOString().split('T')[0],
      changeCount: {
        added: 0,
        changed: 0,
        deprecated: 0,
        removed: 0,
        fixed: 0,
        security: 0,
      },
      hasBreakingChanges: false,
    };
  }

  private parseUserGuideResponse(response: string): UserGuideResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = UserGuideResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('User guide response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse user guide response', { error });
    }

    return {
      content: '',
      tableOfContents: [],
      sections: [],
      metadata: {
        wordCount: 0,
        estimatedReadTime: 0,
      },
    };
  }

  // ============================================================================
  // Retry Logic
  // ============================================================================

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );

          this.logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
            attempt,
            maxAttempts: this.retryConfig.maxAttempts,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a DocWriterAgent instance
 */
export function createDocWriterAgent(
  config: DocWriterAgentConfig,
  dependencies: AgentDependencies
): DocWriterAgent {
  return new DocWriterAgent(config, dependencies);
}
