/**
 * Architect Agent
 *
 * DI-based implementation responsible for design and architecture analysis.
 * Handles document analysis, architecture design, tech stack recommendations, and API design.
 *
 * Follows SOLID principles:
 * - S: Single responsibility - architecture and design tasks
 * - O: Open for extension via hooks
 * - L: Implements IAgent, substitutable
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * Feature: F1.4 - Architect Agent
 * @module core/agents/specialized
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentDependencies, LLMMessage } from '../interfaces';
import { IAgentConfig, AgentType, AgentCapability, ITask, TaskResult } from '../../interfaces';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Document analysis payload schema
 */
export const DocumentAnalysisPayloadSchema = z.object({
  document: z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    type: z.enum(['prd', 'requirements', 'spec', 'design', 'general']).default('general'),
  }),
  analysisDepth: z.enum(['shallow', 'standard', 'deep']).default('standard'),
  focusAreas: z.array(z.string()).optional(),
});

/**
 * Architecture design payload schema
 */
export const ArchitectureDesignPayloadSchema = z.object({
  requirements: z.object({
    functional: z.array(z.string()).min(1),
    nonFunctional: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
  }),
  context: z
    .object({
      existingSystem: z.string().optional(),
      teamSize: z.number().positive().optional(),
      timeline: z.string().optional(),
      budget: z.string().optional(),
    })
    .optional(),
  preferences: z
    .object({
      architectureStyle: z.enum(['monolith', 'microservices', 'serverless', 'hybrid']).optional(),
      scalability: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

/**
 * Tech stack recommendation payload schema
 */
export const TechStackPayloadSchema = z.object({
  projectContext: z.object({
    type: z.enum(['web', 'mobile', 'desktop', 'api', 'fullstack', 'data', 'ml']),
    scale: z.enum(['small', 'medium', 'large', 'enterprise']).default('medium'),
    requirements: z.array(z.string()),
  }),
  constraints: z
    .object({
      languages: z.array(z.string()).optional(),
      frameworks: z.array(z.string()).optional(),
      cloud: z.array(z.string()).optional(),
      budget: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
  existingStack: z.array(z.string()).optional(),
});

/**
 * API design payload schema
 */
export const APIDesignPayloadSchema = z.object({
  module: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    entities: z.array(
      z.object({
        name: z.string(),
        properties: z.array(z.string()),
      })
    ),
  }),
  apiStyle: z.enum(['rest', 'graphql', 'grpc', 'mixed']).default('rest'),
  includeAuth: z.boolean().default(true),
  versioning: z.boolean().default(true),
});

/**
 * Module breakdown response schema
 */
export const ModuleBreakdownResponseSchema = z.object({
  modules: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      responsibilities: z.array(z.string()),
      dependencies: z.array(z.string()),
      complexity: z.enum(['low', 'medium', 'high']),
    })
  ),
  relationships: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      type: z.enum(['uses', 'depends', 'communicates', 'extends']),
    })
  ),
  summary: z.string(),
  recommendations: z.array(z.string()),
});

/**
 * Architecture design response schema
 */
export const ArchitectureResponseSchema = z.object({
  overview: z.string(),
  style: z.enum(['monolith', 'microservices', 'serverless', 'hybrid', 'layered', 'event-driven']),
  components: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['service', 'database', 'cache', 'queue', 'gateway', 'frontend', 'worker']),
      description: z.string(),
      technology: z.string().optional(),
    })
  ),
  patterns: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      rationale: z.string(),
    })
  ),
  tradeoffs: z.array(
    z.object({
      aspect: z.string(),
      advantage: z.string(),
      disadvantage: z.string(),
    })
  ),
  diagram: z.string().optional(),
});

/**
 * Tech stack response schema
 */
export const TechStackResponseSchema = z.object({
  recommended: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    databases: z.array(z.string()),
    infrastructure: z.array(z.string()),
    devops: z.array(z.string()),
  }),
  alternatives: z.array(
    z.object({
      category: z.string(),
      option: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    })
  ),
  rationale: z.string(),
  considerations: z.array(z.string()),
});

/**
 * API spec response schema
 */
export const APISpecResponseSchema = z.object({
  endpoints: z.array(
    z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      path: z.string(),
      description: z.string(),
      requestBody: z.record(z.unknown()).optional(),
      responseBody: z.record(z.unknown()).optional(),
      queryParams: z.array(z.string()).optional(),
      pathParams: z.array(z.string()).optional(),
    })
  ),
  schemas: z.array(
    z.object({
      name: z.string(),
      properties: z.record(z.string()),
    })
  ),
  authentication: z
    .object({
      type: z.string(),
      details: z.string(),
    })
    .optional(),
  versioning: z
    .object({
      strategy: z.string(),
      currentVersion: z.string(),
    })
    .optional(),
  summary: z.string(),
});

// Type exports
export type DocumentAnalysisPayload = z.infer<typeof DocumentAnalysisPayloadSchema>;
export type ArchitectureDesignPayload = z.infer<typeof ArchitectureDesignPayloadSchema>;
export type TechStackPayload = z.infer<typeof TechStackPayloadSchema>;
export type APIDesignPayload = z.infer<typeof APIDesignPayloadSchema>;
export type ModuleBreakdownResponse = z.infer<typeof ModuleBreakdownResponseSchema>;
export type ArchitectureResponse = z.infer<typeof ArchitectureResponseSchema>;
export type TechStackResponse = z.infer<typeof TechStackResponseSchema>;
export type APISpecResponse = z.infer<typeof APISpecResponseSchema>;

// ============================================================================
// Enums
// ============================================================================

/**
 * Analysis depth levels
 */
export enum AnalysisDepth {
  SHALLOW = 'shallow',
  STANDARD = 'standard',
  DEEP = 'deep',
}

/**
 * Architecture styles
 */
export enum ArchitectureStyle {
  MONOLITH = 'monolith',
  MICROSERVICES = 'microservices',
  SERVERLESS = 'serverless',
  HYBRID = 'hybrid',
  LAYERED = 'layered',
  EVENT_DRIVEN = 'event-driven',
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Architect Agent Configuration
 */
export interface ArchitectAgentConfig extends IAgentConfig {
  defaultAnalysisDepth?: AnalysisDepth;
  maxModules?: number;
  enableDiagramGeneration?: boolean;
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
 * Architect Agent
 *
 * Handles document analysis, architecture design, tech stack recommendations, and API design.
 */
export class ArchitectAgent extends BaseAgent {
  private readonly defaultAnalysisDepth: AnalysisDepth;
  private readonly maxModules: number;
  private readonly enableDiagramGeneration: boolean;
  private readonly retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: ArchitectAgentConfig, dependencies: AgentDependencies) {
    super(
      {
        ...config,
        type: AgentType.ARCHITECT,
      },
      dependencies
    );

    this.defaultAnalysisDepth = config.defaultAnalysisDepth ?? AnalysisDepth.STANDARD;
    this.maxModules = config.maxModules ?? 20;
    this.enableDiagramGeneration = config.enableDiagramGeneration ?? true;

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
    this.logger.info('ArchitectAgent initializing', {
      defaultAnalysisDepth: this.defaultAnalysisDepth,
      maxModules: this.maxModules,
      enableDiagramGeneration: this.enableDiagramGeneration,
    });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('ArchitectAgent disposing');
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'document-analysis',
        description: 'Analyze documents to extract module breakdown and requirements',
        inputSchema: {
          type: 'object',
          properties: {
            document: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                type: { type: 'string', enum: ['prd', 'requirements', 'spec', 'design', 'general'] },
              },
              required: ['title', 'content'],
            },
            analysisDepth: { type: 'string', enum: ['shallow', 'standard', 'deep'] },
          },
          required: ['document'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            modules: { type: 'array' },
            relationships: { type: 'array' },
            summary: { type: 'string' },
          },
        },
      },
      {
        name: 'architecture-design',
        description: 'Design system architecture based on requirements',
        inputSchema: {
          type: 'object',
          properties: {
            requirements: {
              type: 'object',
              properties: {
                functional: { type: 'array', items: { type: 'string' } },
                nonFunctional: { type: 'array', items: { type: 'string' } },
              },
              required: ['functional'],
            },
          },
          required: ['requirements'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            overview: { type: 'string' },
            style: { type: 'string' },
            components: { type: 'array' },
            patterns: { type: 'array' },
          },
        },
      },
      {
        name: 'tech-stack-recommendation',
        description: 'Recommend technology stack based on project context',
        inputSchema: {
          type: 'object',
          properties: {
            projectContext: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                scale: { type: 'string' },
                requirements: { type: 'array', items: { type: 'string' } },
              },
              required: ['type', 'requirements'],
            },
          },
          required: ['projectContext'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            recommended: { type: 'object' },
            alternatives: { type: 'array' },
            rationale: { type: 'string' },
          },
        },
      },
      {
        name: 'api-design',
        description: 'Design API specification for a module',
        inputSchema: {
          type: 'object',
          properties: {
            module: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                entities: { type: 'array' },
              },
              required: ['name', 'description', 'entities'],
            },
            apiStyle: { type: 'string', enum: ['rest', 'graphql', 'grpc', 'mixed'] },
          },
          required: ['module'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            endpoints: { type: 'array' },
            schemas: { type: 'array' },
            summary: { type: 'string' },
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
        case 'document-analysis':
          return await this.handleDocumentAnalysis(task, startTime);

        case 'architecture-design':
          return await this.handleArchitectureDesign(task, startTime);

        case 'tech-stack-recommendation':
          return await this.handleTechStackRecommendation(task, startTime);

        case 'api-design':
          return await this.handleAPIDesign(task, startTime);

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
   * Handle document analysis task
   */
  private async handleDocumentAnalysis(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = DocumentAnalysisPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Analyzing document', {
      taskId: task.id,
      documentTitle: payload.document.title,
      documentType: payload.document.type,
      depth: payload.analysisDepth,
    });

    const systemPrompt = this.buildDocumentAnalysisSystemPrompt(payload);
    const userPrompt = this.buildDocumentAnalysisUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'document-analysis-llm'
    );

    const moduleBreakdown = this.parseModuleBreakdownResponse(response);

    return this.createSuccessResult(
      task,
      {
        moduleBreakdown,
        documentTitle: payload.document.title,
        analysisDepth: payload.analysisDepth,
      },
      startTime
    );
  }

  /**
   * Handle architecture design task
   */
  private async handleArchitectureDesign(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = ArchitectureDesignPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Designing architecture', {
      taskId: task.id,
      functionalRequirements: payload.requirements.functional.length,
      preferredStyle: payload.preferences?.architectureStyle,
    });

    const systemPrompt = this.buildArchitectureDesignSystemPrompt(payload);
    const userPrompt = this.buildArchitectureDesignUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'architecture-design-llm'
    );

    const architecture = this.parseArchitectureResponse(response);

    return this.createSuccessResult(
      task,
      {
        architecture,
        requirements: payload.requirements,
      },
      startTime
    );
  }

  /**
   * Handle tech stack recommendation task
   */
  private async handleTechStackRecommendation(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = TechStackPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Recommending tech stack', {
      taskId: task.id,
      projectType: payload.projectContext.type,
      projectScale: payload.projectContext.scale,
    });

    const systemPrompt = this.buildTechStackSystemPrompt(payload);
    const userPrompt = this.buildTechStackUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'tech-stack-llm'
    );

    const techStack = this.parseTechStackResponse(response);

    return this.createSuccessResult(
      task,
      {
        techStack,
        projectContext: payload.projectContext,
      },
      startTime
    );
  }

  /**
   * Handle API design task
   */
  private async handleAPIDesign(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = APIDesignPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Designing API', {
      taskId: task.id,
      moduleName: payload.module.name,
      apiStyle: payload.apiStyle,
    });

    const systemPrompt = this.buildAPIDesignSystemPrompt(payload);
    const userPrompt = this.buildAPIDesignUserPrompt(payload);

    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'api-design-llm'
    );

    const apiSpec = this.parseAPISpecResponse(response);

    return this.createSuccessResult(
      task,
      {
        apiSpec,
        moduleName: payload.module.name,
        apiStyle: payload.apiStyle,
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
      maxTokens: 4000,
      temperature: 0.3,
    });

    return response.content;
  }

  // ============================================================================
  // Prompt Builders
  // ============================================================================

  private buildDocumentAnalysisSystemPrompt(payload: DocumentAnalysisPayload): string {
    return `You are an expert software architect specializing in system analysis and modular design.

Your task is to analyze the provided document and extract a module breakdown.

Analysis Depth: ${payload.analysisDepth}
${payload.analysisDepth === 'shallow' ? '- Focus on high-level modules only' : ''}
${payload.analysisDepth === 'standard' ? '- Include main modules and key relationships' : ''}
${payload.analysisDepth === 'deep' ? '- Provide detailed module breakdown with all dependencies and complexities' : ''}

${payload.focusAreas ? `Focus Areas: ${payload.focusAreas.join(', ')}` : ''}

Guidelines:
- Identify distinct functional modules
- Map dependencies between modules
- Assess complexity of each module
- Suggest optimal module boundaries

Respond with a JSON object matching this structure:
{
  "modules": [{"name": "string", "description": "string", "responsibilities": ["string"], "dependencies": ["string"], "complexity": "low|medium|high"}],
  "relationships": [{"from": "string", "to": "string", "type": "uses|depends|communicates|extends"}],
  "summary": "string",
  "recommendations": ["string"]
}`;
  }

  private buildDocumentAnalysisUserPrompt(payload: DocumentAnalysisPayload): string {
    return `Analyze the following ${payload.document.type} document:

Title: ${payload.document.title}

Content:
${payload.document.content}

Extract a comprehensive module breakdown identifying:
1. All distinct modules with their responsibilities
2. Dependencies and relationships between modules
3. Complexity assessment for each module
4. Recommendations for implementation order`;
  }

  private buildArchitectureDesignSystemPrompt(payload: ArchitectureDesignPayload): string {
    return `You are an expert software architect with deep experience in designing scalable systems.

Your task is to design a system architecture based on the provided requirements.

${payload.preferences?.architectureStyle ? `Preferred Style: ${payload.preferences.architectureStyle}` : ''}
${payload.preferences?.scalability ? `Scalability Target: ${payload.preferences.scalability}` : ''}

Guidelines:
- Choose appropriate architecture style
- Define clear component boundaries
- Apply relevant design patterns
- Consider trade-offs explicitly
${this.enableDiagramGeneration ? '- Include a text-based architecture diagram' : ''}

Respond with a JSON object matching this structure:
{
  "overview": "string - high level description",
  "style": "monolith|microservices|serverless|hybrid|layered|event-driven",
  "components": [{"name": "string", "type": "service|database|cache|queue|gateway|frontend|worker", "description": "string", "technology": "string (optional)"}],
  "patterns": [{"name": "string", "description": "string", "rationale": "string"}],
  "tradeoffs": [{"aspect": "string", "advantage": "string", "disadvantage": "string"}],
  "diagram": "string - ASCII diagram (optional)"
}`;
  }

  private buildArchitectureDesignUserPrompt(payload: ArchitectureDesignPayload): string {
    let prompt = `Design a system architecture for the following requirements:

Functional Requirements:
${payload.requirements.functional.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    if (payload.requirements.nonFunctional?.length) {
      prompt += `
Non-Functional Requirements:
${payload.requirements.nonFunctional.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    }

    if (payload.requirements.constraints?.length) {
      prompt += `
Constraints:
${payload.requirements.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;
    }

    if (payload.context) {
      prompt += `
Context:
${payload.context.existingSystem ? `- Existing System: ${payload.context.existingSystem}` : ''}
${payload.context.teamSize ? `- Team Size: ${payload.context.teamSize}` : ''}
${payload.context.timeline ? `- Timeline: ${payload.context.timeline}` : ''}
${payload.context.budget ? `- Budget: ${payload.context.budget}` : ''}
`;
    }

    return prompt;
  }

  private buildTechStackSystemPrompt(payload: TechStackPayload): string {
    return `You are an expert technology consultant with broad knowledge of programming languages, frameworks, and infrastructure.

Your task is to recommend a technology stack for the project.

Project Type: ${payload.projectContext.type}
Project Scale: ${payload.projectContext.scale}

${payload.existingStack?.length ? `Existing Stack to consider: ${payload.existingStack.join(', ')}` : ''}

Guidelines:
- Consider project requirements and scale
- Balance between cutting-edge and mature technologies
- Consider team learning curve
- Include alternatives with pros/cons

Respond with a JSON object matching this structure:
{
  "recommended": {
    "languages": ["string"],
    "frameworks": ["string"],
    "databases": ["string"],
    "infrastructure": ["string"],
    "devops": ["string"]
  },
  "alternatives": [{"category": "string", "option": "string", "pros": ["string"], "cons": ["string"]}],
  "rationale": "string",
  "considerations": ["string"]
}`;
  }

  private buildTechStackUserPrompt(payload: TechStackPayload): string {
    let prompt = `Recommend a technology stack for this project:

Project Type: ${payload.projectContext.type}
Scale: ${payload.projectContext.scale}

Requirements:
${payload.projectContext.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    if (payload.constraints) {
      prompt += `
Constraints:
${payload.constraints.languages?.length ? `- Languages: ${payload.constraints.languages.join(', ')}` : ''}
${payload.constraints.frameworks?.length ? `- Frameworks: ${payload.constraints.frameworks.join(', ')}` : ''}
${payload.constraints.cloud?.length ? `- Cloud: ${payload.constraints.cloud.join(', ')}` : ''}
${payload.constraints.budget ? `- Budget: ${payload.constraints.budget}` : ''}
`;
    }

    return prompt;
  }

  private buildAPIDesignSystemPrompt(payload: APIDesignPayload): string {
    return `You are an expert API designer with experience in RESTful, GraphQL, and gRPC APIs.

Your task is to design an API specification for the provided module.

API Style: ${payload.apiStyle}
Include Authentication: ${payload.includeAuth}
Include Versioning: ${payload.versioning}

Guidelines:
- Follow ${payload.apiStyle.toUpperCase()} best practices
- Design intuitive endpoint paths
- Include proper HTTP methods and status codes
- Define clear request/response schemas
${payload.includeAuth ? '- Include authentication requirements' : ''}
${payload.versioning ? '- Include versioning strategy' : ''}

Respond with a JSON object matching this structure:
{
  "endpoints": [{"method": "GET|POST|PUT|PATCH|DELETE", "path": "string", "description": "string", "requestBody": {}, "responseBody": {}, "queryParams": ["string"], "pathParams": ["string"]}],
  "schemas": [{"name": "string", "properties": {"field": "type"}}],
  "authentication": {"type": "string", "details": "string"},
  "versioning": {"strategy": "string", "currentVersion": "string"},
  "summary": "string"
}`;
  }

  private buildAPIDesignUserPrompt(payload: APIDesignPayload): string {
    return `Design an API for the following module:

Module: ${payload.module.name}
Description: ${payload.module.description}

Entities:
${payload.module.entities.map((e) => `- ${e.name}: ${e.properties.join(', ')}`).join('\n')}

Create a complete ${payload.apiStyle.toUpperCase()} API specification with:
1. CRUD endpoints for each entity
2. Request and response schemas
3. Proper error handling patterns
${payload.includeAuth ? '4. Authentication requirements' : ''}`;
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseModuleBreakdownResponse(response: string): ModuleBreakdownResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ModuleBreakdownResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('Module breakdown response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse module breakdown response', { error });
    }

    return {
      modules: [],
      relationships: [],
      summary: 'Analysis incomplete - parsing failed',
      recommendations: ['Manual review recommended'],
    };
  }

  private parseArchitectureResponse(response: string): ArchitectureResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ArchitectureResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('Architecture response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse architecture response', { error });
    }

    return {
      overview: 'Architecture design incomplete - parsing failed',
      style: 'monolith',
      components: [],
      patterns: [],
      tradeoffs: [],
    };
  }

  private parseTechStackResponse(response: string): TechStackResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = TechStackResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('Tech stack response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse tech stack response', { error });
    }

    return {
      recommended: {
        languages: [],
        frameworks: [],
        databases: [],
        infrastructure: [],
        devops: [],
      },
      alternatives: [],
      rationale: 'Recommendation incomplete - parsing failed',
      considerations: ['Manual review recommended'],
    };
  }

  private parseAPISpecResponse(response: string): APISpecResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = APISpecResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      this.logger.warn('API spec response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse API spec response', { error });
    }

    return {
      endpoints: [],
      schemas: [],
      summary: 'API design incomplete - parsing failed',
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
 * Create an ArchitectAgent instance
 */
export function createArchitectAgent(
  config: ArchitectAgentConfig,
  dependencies: AgentDependencies
): ArchitectAgent {
  return new ArchitectAgent(config, dependencies);
}
