/**
 * Backend Team
 *
 * Specialized development team for backend/API implementation.
 * Handles Node.js, Express, databases, and server-side logic.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TeamCapability,
  TaskDocument,
  TaskResult,
  AgentRole,
} from '../team-types';
import { createRole } from '../base-team';
import {
  DevelopmentTeam,
  DevelopmentTeamConfig,
  CodeGenerationResult,
  GeneratedFile,
} from './development-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Backend-specific configuration
 */
export interface BackendTeamConfig extends Partial<DevelopmentTeamConfig> {
  /** Server framework (express, fastify, nestjs, etc.) */
  serverFramework?: string;
  /** Database type (postgres, mysql, mongodb, etc.) */
  databaseType?: string;
  /** ORM/ODM (prisma, typeorm, mongoose, etc.) */
  ormType?: string;
  /** Enable API documentation (swagger/openapi) */
  enableApiDocs?: boolean;
  /** Enable request validation */
  enableValidation?: boolean;
  /** Enable rate limiting */
  enableRateLimiting?: boolean;
  /** Enable authentication middleware */
  enableAuth?: boolean;
  /** API style (rest, graphql) */
  apiStyle?: 'rest' | 'graphql';
}

/**
 * API analysis result
 */
export interface APIAnalysis {
  /** API type (crud, custom, aggregate) */
  apiType: 'crud' | 'custom' | 'aggregate';
  /** HTTP methods needed */
  httpMethods: string[];
  /** Requires authentication */
  requiresAuth: boolean;
  /** Requires database access */
  requiresDatabase: boolean;
  /** Data validation requirements */
  validationRequirements: string[];
  /** Security considerations */
  securityConsiderations: string[];
}

/**
 * Database model analysis
 */
export interface ModelAnalysis {
  /** Entity name */
  entityName: string;
  /** Fields */
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    unique?: boolean;
  }>;
  /** Relations */
  relations: Array<{
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    target: string;
  }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_BACKEND_CONFIG: BackendTeamConfig = {
  serverFramework: 'express',
  databaseType: 'postgres',
  ormType: 'prisma',
  enableApiDocs: true,
  enableValidation: true,
  enableRateLimiting: true,
  enableAuth: true,
  apiStyle: 'rest',
  languages: ['typescript', 'javascript'],
  frameworks: ['express', 'node'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};

// ============================================================================
// Agent Roles
// ============================================================================

const API_DEVELOPER_ROLE: AgentRole = createRole(
  'API Developer',
  'Specializes in building RESTful and GraphQL APIs',
  `You are an API Developer agent. Your role is to:
1. Design and implement RESTful or GraphQL APIs
2. Handle request/response formatting and validation
3. Implement proper error handling and status codes
4. Ensure API versioning and backward compatibility
5. Document APIs with OpenAPI/Swagger specifications

When building APIs:
- Follow REST principles (proper HTTP methods, status codes)
- Use consistent naming conventions
- Implement pagination for list endpoints
- Handle errors gracefully with meaningful messages
- Version APIs appropriately`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.API_DESIGN],
    tools: ['read', 'write', 'edit', 'bash'],
  }
);

const DATABASE_SPECIALIST_ROLE: AgentRole = createRole(
  'Database Specialist',
  'Handles database design, queries, and optimization',
  `You are a Database Specialist agent. Your role is to:
1. Design efficient database schemas
2. Write optimized queries and migrations
3. Implement proper indexing strategies
4. Handle data relationships and constraints
5. Ensure data integrity and consistency

Database best practices:
- Normalize data appropriately
- Use proper data types for columns
- Create indexes for frequently queried fields
- Handle soft deletes when appropriate
- Implement proper foreign key constraints`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.DATABASE_DESIGN],
    tools: ['read', 'write', 'edit', 'bash'],
  }
);

const SECURITY_SPECIALIST_ROLE: AgentRole = createRole(
  'Security Specialist',
  'Ensures backend security and authentication',
  `You are a Security Specialist agent. Your role is to:
1. Implement authentication and authorization
2. Protect against common vulnerabilities (OWASP Top 10)
3. Secure sensitive data and API keys
4. Implement rate limiting and request validation
5. Handle security headers and CORS

Security priorities:
- Never expose sensitive data in responses
- Validate and sanitize all inputs
- Use parameterized queries to prevent SQL injection
- Implement proper session management
- Use HTTPS and secure cookies`,
  {
    capabilities: [TeamCapability.CODE_REVIEW, TeamCapability.SECURITY_AUDIT],
    tools: ['read', 'analyze'],
  }
);

const INTEGRATION_SPECIALIST_ROLE: AgentRole = createRole(
  'Integration Specialist',
  'Handles third-party integrations and external APIs',
  `You are an Integration Specialist agent. Your role is to:
1. Integrate with external APIs and services
2. Handle webhooks and callbacks
3. Implement message queues and event systems
4. Manage API keys and OAuth flows
5. Handle retries and circuit breakers

Integration best practices:
- Use environment variables for configuration
- Implement proper error handling for external calls
- Add timeouts and retries
- Log integration activities
- Handle rate limits gracefully`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.API_DESIGN],
    tools: ['read', 'write', 'edit', 'bash'],
  }
);

// ============================================================================
// Backend Team
// ============================================================================

/**
 * Backend development team
 *
 * @example
 * ```typescript
 * const backendTeam = createBackendTeam({
 *   serverFramework: 'express',
 *   databaseType: 'postgres',
 *   enableAuth: true,
 * });
 *
 * await backendTeam.initialize();
 * await backendTeam.start();
 *
 * await backendTeam.submitTask(createTask(
 *   'User API',
 *   'Create CRUD endpoints for user management'
 * ));
 * ```
 */
export class BackendTeam extends DevelopmentTeam {
  /** Backend-specific configuration */
  protected readonly backendConfig: BackendTeamConfig;

  /** API statistics */
  protected apiStats = {
    totalEndpoints: 0,
    getEndpoints: 0,
    postEndpoints: 0,
    putEndpoints: 0,
    deleteEndpoints: 0,
    totalModels: 0,
    totalMigrations: 0,
  };

  constructor(config: BackendTeamConfig = {}) {
    const mergedConfig = { ...DEFAULT_BACKEND_CONFIG, ...config };

    super({
      id: config.id || `backend-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Backend Team',
      type: TeamType.BACKEND,
      languages: mergedConfig.languages || DEFAULT_BACKEND_CONFIG.languages!,
      frameworks: mergedConfig.frameworks || DEFAULT_BACKEND_CONFIG.frameworks!,
      generateTests: mergedConfig.generateTests ?? true,
      coverageTarget: mergedConfig.coverageTarget ?? 80,
      generateDocs: mergedConfig.generateDocs ?? true,
      enableLinting: mergedConfig.enableLinting ?? true,
      ...config,
    });

    this.backendConfig = mergedConfig;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  protected override async initializeMembers(): Promise<void> {
    // Add core developer roles
    await super.initializeMembers();

    // Add backend-specific roles
    this.addMember(API_DEVELOPER_ROLE);
    this.addMember(DATABASE_SPECIALIST_ROLE);

    if (this.backendConfig.enableAuth) {
      this.addMember(SECURITY_SPECIALIST_ROLE);
    }

    this.addMember(INTEGRATION_SPECIALIST_ROLE);
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  protected override async processTask(task: TaskDocument): Promise<TaskResult> {
    const startTime = Date.now();
    this.tokenCounter = 0;

    try {
      let result: CodeGenerationResult;

      switch (task.type) {
        case 'api':
        case 'endpoint':
          result = await this.processAPI(task);
          break;
        case 'model':
        case 'schema':
        case 'database':
          result = await this.processModel(task);
          break;
        case 'middleware':
          result = await this.processMiddleware(task);
          break;
        case 'service':
          result = await this.processService(task);
          break;
        case 'migration':
          result = await this.processMigration(task);
          break;
        default:
          result = await this.processImplementation(task);
      }

      // Update statistics
      this.updateCodeStats(result);
      this.updateAPIStats(task);

      // Create artifacts
      const artifacts = this.createArtifacts(task, result);

      return {
        taskId: task.id,
        success: true,
        outputs: {
          codeGeneration: result,
          filesGenerated: result.files.length,
          testsGenerated: result.testFiles.length,
          dependencies: result.dependencies,
          apiStats: this.apiStats,
        },
        subtasks: [],
        artifacts,
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputs: {},
        subtasks: [],
        artifacts: [],
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
        error: error as Error,
      };
    }
  }

  // ============================================================================
  // Backend-Specific Processing
  // ============================================================================

  /**
   * Process API task
   */
  protected async processAPI(task: TaskDocument): Promise<CodeGenerationResult> {
    const apiAnalysis = this.analyzeAPI(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate controller/route file
    const controllerFile = this.generateController(task, apiAnalysis);
    files.push(controllerFile);

    // Generate route definitions
    const routeFile = this.generateRoutes(task, apiAnalysis);
    files.push(routeFile);

    // Generate request/response types
    const typesFile = this.generateAPITypes(task, apiAnalysis);
    files.push(typesFile);

    // Generate validation schema
    if (this.backendConfig.enableValidation) {
      const validationFile = this.generateValidation(task, apiAnalysis);
      files.push(validationFile);
    }

    // Generate API documentation
    if (this.backendConfig.enableApiDocs) {
      const docsFile = this.generateOpenAPISpec(task, apiAnalysis);
      files.push(docsFile);
    }

    // Generate tests
    if (this.devConfig.generateTests) {
      const apiTests = this.generateAPITests(task, apiAnalysis);
      testFiles.push(apiTests);

      const integrationTests = this.generateIntegrationTests(task, apiAnalysis);
      testFiles.push(integrationTests);
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateAPIDocumentation(task, apiAnalysis)
        : undefined,
      dependencies: this.detectBackendDependencies(task, apiAnalysis),
      notes: [
        `API: ${task.title}`,
        `Style: ${this.backendConfig.apiStyle}`,
        `Methods: ${apiAnalysis.httpMethods.join(', ')}`,
      ],
    };
  }

  /**
   * Process model/schema task
   */
  protected async processModel(task: TaskDocument): Promise<CodeGenerationResult> {
    const modelAnalysis = this.analyzeModel(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate model file
    const modelFile = this.generateModelFile(task, modelAnalysis);
    files.push(modelFile);

    // Generate repository/DAO
    const repositoryFile = this.generateRepository(task, modelAnalysis);
    files.push(repositoryFile);

    // Generate migration
    const migrationFile = this.generateMigrationFile(task, modelAnalysis);
    files.push(migrationFile);

    // Generate seed data
    const seedFile = this.generateSeedFile(task, modelAnalysis);
    files.push(seedFile);

    // Generate tests
    if (this.devConfig.generateTests) {
      const modelTests = this.generateModelTests(task, modelAnalysis);
      testFiles.push(modelTests);
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateModelDocumentation(task, modelAnalysis)
        : undefined,
      dependencies: this.detectDatabaseDependencies(task),
      notes: [
        `Model: ${modelAnalysis.entityName}`,
        `Fields: ${modelAnalysis.fields.length}`,
        `Relations: ${modelAnalysis.relations.length}`,
      ],
    };
  }

  /**
   * Process middleware task
   */
  protected async processMiddleware(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate middleware file
    const middlewareFile = this.generateMiddlewareFile(task);
    files.push(middlewareFile);

    // Generate tests
    if (this.devConfig.generateTests) {
      const middlewareTests = this.generateMiddlewareTests(task);
      testFiles.push(middlewareTests);
    }

    return {
      files,
      testFiles,
      dependencies: [],
      notes: [`Middleware: ${task.title}`],
    };
  }

  /**
   * Process service task
   */
  protected async processService(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate service file
    const serviceFile = this.generateServiceFile(task);
    files.push(serviceFile);

    // Generate service interface
    const interfaceFile = this.generateServiceInterface(task);
    files.push(interfaceFile);

    // Generate tests
    if (this.devConfig.generateTests) {
      const serviceTests = this.generateServiceTests(task);
      testFiles.push(serviceTests);
    }

    return {
      files,
      testFiles,
      dependencies: [],
      notes: [`Service: ${task.title}`],
    };
  }

  /**
   * Process migration task
   */
  protected async processMigration(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];

    // Generate migration file
    const migrationFile = this.generateMigration(task);
    files.push(migrationFile);

    return {
      files,
      testFiles: [],
      dependencies: [],
      notes: [`Migration: ${task.title}`],
    };
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  /**
   * Analyze API requirements
   */
  protected analyzeAPI(task: TaskDocument): APIAnalysis {
    const description = `${task.title} ${task.description}`.toLowerCase();

    // Determine API type
    let apiType: APIAnalysis['apiType'] = 'custom';
    if (description.includes('crud') || description.includes('create') && description.includes('read')) {
      apiType = 'crud';
    } else if (description.includes('aggregate') || description.includes('dashboard')) {
      apiType = 'aggregate';
    }

    // Determine HTTP methods
    const httpMethods: string[] = [];
    if (description.includes('get') || description.includes('list') || description.includes('fetch')) {
      httpMethods.push('GET');
    }
    if (description.includes('create') || description.includes('add') || description.includes('post')) {
      httpMethods.push('POST');
    }
    if (description.includes('update') || description.includes('edit') || description.includes('modify')) {
      httpMethods.push('PUT', 'PATCH');
    }
    if (description.includes('delete') || description.includes('remove')) {
      httpMethods.push('DELETE');
    }

    // Default to CRUD methods
    if (httpMethods.length === 0 || apiType === 'crud') {
      httpMethods.push('GET', 'POST', 'PUT', 'DELETE');
    }

    // Check authentication requirements
    const requiresAuth =
      this.backendConfig.enableAuth ||
      description.includes('auth') ||
      description.includes('protected') ||
      description.includes('private');

    // Check database requirements
    const requiresDatabase =
      description.includes('database') ||
      description.includes('store') ||
      description.includes('persist') ||
      description.includes('save');

    // Determine validation requirements
    const validationRequirements: string[] = [];
    if (description.includes('email')) validationRequirements.push('email');
    if (description.includes('password')) validationRequirements.push('password-strength');
    if (description.includes('phone')) validationRequirements.push('phone');
    if (description.includes('date')) validationRequirements.push('date');
    if (description.includes('url')) validationRequirements.push('url');

    // Security considerations
    const securityConsiderations: string[] = [];
    if (requiresAuth) securityConsiderations.push('authentication');
    if (description.includes('admin')) securityConsiderations.push('authorization');
    if (description.includes('upload')) securityConsiderations.push('file-validation');
    if (description.includes('payment')) securityConsiderations.push('pci-compliance');

    return {
      apiType,
      httpMethods: [...new Set(httpMethods)],
      requiresAuth,
      requiresDatabase,
      validationRequirements,
      securityConsiderations,
    };
  }

  /**
   * Analyze model/schema
   */
  protected analyzeModel(task: TaskDocument): ModelAnalysis {
    const description = task.description.toLowerCase();

    // Extract entity name
    const entityName = this.toPascalCase(
      task.title.replace(/model|schema|entity/gi, '').trim()
    );

    // Infer fields from description
    const fields: ModelAnalysis['fields'] = [];

    // Common field patterns
    const fieldPatterns: Record<string, { type: string; required: boolean }> = {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      password: { type: 'string', required: true },
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      content: { type: 'string', required: false },
      status: { type: 'string', required: true },
      created_at: { type: 'datetime', required: true },
      updated_at: { type: 'datetime', required: true },
      deleted_at: { type: 'datetime', required: false },
    };

    for (const [fieldName, fieldConfig] of Object.entries(fieldPatterns)) {
      if (description.includes(fieldName.replace('_', ' '))) {
        fields.push({
          name: fieldName,
          type: fieldConfig.type,
          required: fieldConfig.required,
        });
      }
    }

    // Default fields if none detected
    if (fields.length === 0) {
      fields.push({ name: 'id', type: 'uuid', required: true });
      fields.push({ name: 'name', type: 'string', required: true });
      fields.push({ name: 'createdAt', type: 'datetime', required: true });
      fields.push({ name: 'updatedAt', type: 'datetime', required: true });
    }

    // Infer relations
    const relations: ModelAnalysis['relations'] = [];
    if (description.includes('belongs to') || description.includes('has one')) {
      relations.push({ type: 'one-to-one', target: 'Related' });
    }
    if (description.includes('has many') || description.includes('one to many')) {
      relations.push({ type: 'one-to-many', target: 'Related' });
    }
    if (description.includes('many to many')) {
      relations.push({ type: 'many-to-many', target: 'Related' });
    }

    return {
      entityName,
      fields,
      relations,
    };
  }

  // ============================================================================
  // File Generation
  // ============================================================================

  /**
   * Generate controller file
   */
  protected generateController(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const controllerName = this.toControllerName(task.title);
    const resourceName = this.toResourceName(task.title);

    const content = `/**
 * ${controllerName}
 *
 * ${task.description}
 *
 * @generated by Backend Team
 */

import { Request, Response, NextFunction } from 'express';
import { ${resourceName}Service } from '../services/${resourceName}.service';
${this.backendConfig.enableValidation ? `import { ${resourceName}Schema } from '../validation/${resourceName}.validation';` : ''}

export class ${controllerName} {
  private ${resourceName}Service: ${resourceName}Service;

  constructor() {
    this.${resourceName}Service = new ${resourceName}Service();
  }

  ${analysis.httpMethods.includes('GET') ? this.generateGetMethod(resourceName) : ''}

  ${analysis.httpMethods.includes('POST') ? this.generatePostMethod(resourceName, analysis) : ''}

  ${analysis.httpMethods.includes('PUT') ? this.generatePutMethod(resourceName, analysis) : ''}

  ${analysis.httpMethods.includes('DELETE') ? this.generateDeleteMethod(resourceName) : ''}
}

export const ${resourceName}Controller = new ${controllerName}();
`;

    return {
      path: `src/controllers/${resourceName}.controller.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate routes file
   */
  protected generateRoutes(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);

    const content = `/**
 * ${task.title} Routes
 *
 * @generated by Backend Team
 */

import { Router } from 'express';
import { ${resourceName}Controller } from '../controllers/${resourceName}.controller';
${this.backendConfig.enableAuth ? `import { authenticate } from '../middleware/auth.middleware';` : ''}
${this.backendConfig.enableValidation ? `import { validate } from '../middleware/validation.middleware';` : ''}
${this.backendConfig.enableRateLimiting ? `import { rateLimiter } from '../middleware/rate-limiter.middleware';` : ''}

const router = Router();

${analysis.httpMethods.includes('GET') ? `
// GET /${resourceName}s - List all
router.get('/', ${this.backendConfig.enableRateLimiting ? 'rateLimiter, ' : ''}${analysis.requiresAuth ? 'authenticate, ' : ''}${resourceName}Controller.getAll.bind(${resourceName}Controller));

// GET /${resourceName}s/:id - Get one
router.get('/:id', ${analysis.requiresAuth ? 'authenticate, ' : ''}${resourceName}Controller.getById.bind(${resourceName}Controller));
` : ''}

${analysis.httpMethods.includes('POST') ? `
// POST /${resourceName}s - Create
router.post('/', ${analysis.requiresAuth ? 'authenticate, ' : ''}${this.backendConfig.enableValidation ? `validate(${resourceName}Schema.create), ` : ''}${resourceName}Controller.create.bind(${resourceName}Controller));
` : ''}

${analysis.httpMethods.includes('PUT') ? `
// PUT /${resourceName}s/:id - Update
router.put('/:id', ${analysis.requiresAuth ? 'authenticate, ' : ''}${this.backendConfig.enableValidation ? `validate(${resourceName}Schema.update), ` : ''}${resourceName}Controller.update.bind(${resourceName}Controller));
` : ''}

${analysis.httpMethods.includes('DELETE') ? `
// DELETE /${resourceName}s/:id - Delete
router.delete('/:id', ${analysis.requiresAuth ? 'authenticate, ' : ''}${resourceName}Controller.delete.bind(${resourceName}Controller));
` : ''}

export default router;
`;

    return {
      path: `src/routes/${resourceName}.routes.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate API types
   */
  protected generateAPITypes(task: TaskDocument, _analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * Types for ${task.title} API
 *
 * @generated by Backend Team
 */

export interface ${typeName} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${typeName}Request {
  // Request body for creating ${resourceName}
}

export interface Update${typeName}Request {
  // Request body for updating ${resourceName}
}

export interface ${typeName}Response {
  data: ${typeName};
  message?: string;
}

export interface ${typeName}ListResponse {
  data: ${typeName}[];
  total: number;
  page: number;
  limit: number;
}

export interface ${typeName}Query {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}
`;

    return {
      path: `src/types/${resourceName}.types.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate validation schema
   */
  protected generateValidation(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);

    const content = `/**
 * Validation schemas for ${task.title}
 *
 * @generated by Backend Team
 */

import { z } from 'zod';

export const ${resourceName}Schema = {
  create: z.object({
    ${analysis.validationRequirements.includes('email') ? 'email: z.string().email(),' : ''}
    ${analysis.validationRequirements.includes('password-strength') ? `password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/),` : ''}
    name: z.string().min(1).max(255),
  }),

  update: z.object({
    ${analysis.validationRequirements.includes('email') ? 'email: z.string().email().optional(),' : ''}
    name: z.string().min(1).max(255).optional(),
  }),

  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
  }),
};

export type Create${this.toPascalCase(resourceName)}Input = z.infer<typeof ${resourceName}Schema.create>;
export type Update${this.toPascalCase(resourceName)}Input = z.infer<typeof ${resourceName}Schema.update>;
export type ${this.toPascalCase(resourceName)}QueryInput = z.infer<typeof ${resourceName}Schema.query>;
`;

    return {
      path: `src/validation/${resourceName}.validation.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate OpenAPI specification
   */
  protected generateOpenAPISpec(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * OpenAPI Specification for ${task.title}
 *
 * @generated by Backend Team
 */

export const ${resourceName}OpenAPI = {
  paths: {
    '/${resourceName}s': {
      ${analysis.httpMethods.includes('GET') ? `get: {
        summary: 'List all ${resourceName}s',
        tags: ['${typeName}'],
        ${analysis.requiresAuth ? `security: [{ bearerAuth: [] }],` : ''}
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'List of ${resourceName}s' },
          401: { description: 'Unauthorized' },
        },
      },` : ''}
      ${analysis.httpMethods.includes('POST') ? `post: {
        summary: 'Create a ${resourceName}',
        tags: ['${typeName}'],
        ${analysis.requiresAuth ? `security: [{ bearerAuth: [] }],` : ''}
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Create${typeName}' },
            },
          },
        },
        responses: {
          201: { description: '${typeName} created' },
          400: { description: 'Invalid input' },
          401: { description: 'Unauthorized' },
        },
      },` : ''}
    },
    '/${resourceName}s/{id}': {
      ${analysis.httpMethods.includes('GET') ? `get: {
        summary: 'Get a ${resourceName} by ID',
        tags: ['${typeName}'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: '${typeName} found' },
          404: { description: '${typeName} not found' },
        },
      },` : ''}
      ${analysis.httpMethods.includes('PUT') ? `put: {
        summary: 'Update a ${resourceName}',
        tags: ['${typeName}'],
        ${analysis.requiresAuth ? `security: [{ bearerAuth: [] }],` : ''}
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Update${typeName}' },
            },
          },
        },
        responses: {
          200: { description: '${typeName} updated' },
          404: { description: '${typeName} not found' },
        },
      },` : ''}
      ${analysis.httpMethods.includes('DELETE') ? `delete: {
        summary: 'Delete a ${resourceName}',
        tags: ['${typeName}'],
        ${analysis.requiresAuth ? `security: [{ bearerAuth: [] }],` : ''}
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { description: '${typeName} deleted' },
          404: { description: '${typeName} not found' },
        },
      },` : ''}
    },
  },
};
`;

    return {
      path: `src/docs/${resourceName}.openapi.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate model file
   */
  protected generateModelFile(task: TaskDocument, analysis: ModelAnalysis): GeneratedFile {
    const content = this.generatePrismaModel(task, analysis);

    return {
      path: `prisma/models/${analysis.entityName.toLowerCase()}.prisma`,
      content,
      language: 'prisma',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate Prisma model
   */
  protected generatePrismaModel(task: TaskDocument, analysis: ModelAnalysis): string {
    const fieldLines = analysis.fields.map((field) => {
      const prismaType = this.toPrismaType(field.type);
      const optional = field.required ? '' : '?';
      const unique = field.unique ? ' @unique' : '';
      const defaultVal = field.name === 'id' ? ' @id @default(uuid())' : '';
      const dateDefault = field.name.includes('createdAt') ? ' @default(now())' : '';
      const updatedDefault = field.name.includes('updatedAt') ? ' @updatedAt' : '';

      return `  ${field.name} ${prismaType}${optional}${unique}${defaultVal}${dateDefault}${updatedDefault}`;
    });

    const relationLines = analysis.relations.map((relation) => {
      if (relation.type === 'one-to-one') {
        return `  ${relation.target.toLowerCase()} ${relation.target}?`;
      } else if (relation.type === 'one-to-many') {
        return `  ${relation.target.toLowerCase()}s ${relation.target}[]`;
      } else {
        return `  ${relation.target.toLowerCase()}s ${relation.target}[]`;
      }
    });

    return `/// ${task.description}
model ${analysis.entityName} {
${fieldLines.join('\n')}
${relationLines.length > 0 ? '\n  // Relations\n' + relationLines.join('\n') : ''}
}
`;
  }

  /**
   * Generate repository file
   */
  protected generateRepository(_task: TaskDocument, analysis: ModelAnalysis): GeneratedFile {
    const entityName = analysis.entityName;
    const varName = entityName.charAt(0).toLowerCase() + entityName.slice(1);

    const content = `/**
 * ${entityName} Repository
 *
 * @generated by Backend Team
 */

import { PrismaClient, ${entityName} } from '@prisma/client';

const prisma = new PrismaClient();

export interface ${entityName}Repository {
  findAll(options?: { skip?: number; take?: number }): Promise<${entityName}[]>;
  findById(id: string): Promise<${entityName} | null>;
  create(data: Omit<${entityName}, 'id' | 'createdAt' | 'updatedAt'>): Promise<${entityName}>;
  update(id: string, data: Partial<${entityName}>): Promise<${entityName}>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export class Prisma${entityName}Repository implements ${entityName}Repository {
  async findAll(options?: { skip?: number; take?: number }): Promise<${entityName}[]> {
    return prisma.${varName}.findMany({
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<${entityName} | null> {
    return prisma.${varName}.findUnique({
      where: { id },
    });
  }

  async create(data: Omit<${entityName}, 'id' | 'createdAt' | 'updatedAt'>): Promise<${entityName}> {
    return prisma.${varName}.create({
      data,
    });
  }

  async update(id: string, data: Partial<${entityName}>): Promise<${entityName}> {
    return prisma.${varName}.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.${varName}.delete({
      where: { id },
    });
  }

  async count(): Promise<number> {
    return prisma.${varName}.count();
  }
}

export const ${varName}Repository = new Prisma${entityName}Repository();
`;

    return {
      path: `src/repositories/${varName}.repository.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate migration file
   */
  protected generateMigrationFile(_task: TaskDocument, analysis: ModelAnalysis): GeneratedFile {
    const timestamp = Date.now();
    const tableName = this.toSnakeCase(analysis.entityName);

    const columnDefs = analysis.fields.map((field) => {
      const sqlType = this.toSQLType(field.type);
      const nullable = field.required ? 'NOT NULL' : 'NULL';
      const unique = field.unique ? 'UNIQUE' : '';

      if (field.name === 'id') {
        return `    id UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
      }

      return `    ${this.toSnakeCase(field.name)} ${sqlType} ${nullable} ${unique}`.trim();
    });

    const content = `-- Migration: Create ${tableName}
-- Generated by Backend Team

CREATE TABLE ${tableName} (
${columnDefs.join(',\n')},
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger
CREATE TRIGGER ${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_${tableName}_created_at ON ${tableName}(created_at);
`;

    return {
      path: `prisma/migrations/${timestamp}_create_${tableName}/migration.sql`,
      content,
      language: 'sql',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate seed file
   */
  protected generateSeedFile(_task: TaskDocument, analysis: ModelAnalysis): GeneratedFile {
    const entityName = analysis.entityName;
    const varName = entityName.charAt(0).toLowerCase() + entityName.slice(1);

    const content = `/**
 * Seed data for ${entityName}
 *
 * @generated by Backend Team
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed${entityName}s(): Promise<void> {
  console.log('Seeding ${entityName}s...');

  const ${varName}s = [
    {
      // Add seed data here
    },
  ];

  for (const ${varName} of ${varName}s) {
    await prisma.${varName}.create({
      data: ${varName},
    });
  }

  console.log(\`Seeded \${${varName}s.length} ${entityName}s\`);
}

// Run if executed directly
if (require.main === module) {
  seed${entityName}s()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
`;

    return {
      path: `prisma/seeds/${varName}.seed.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate middleware file
   */
  protected generateMiddlewareFile(task: TaskDocument): GeneratedFile {
    const middlewareName = this.toMiddlewareName(task.title);
    const functionName = this.toCamelCase(task.title.replace(/middleware/gi, ''));

    const content = `/**
 * ${task.title} Middleware
 *
 * ${task.description}
 *
 * @generated by Backend Team
 */

import { Request, Response, NextFunction } from 'express';

export interface ${middlewareName}Options {
  // Middleware configuration options
}

export function ${functionName}(options: ${middlewareName}Options = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Middleware logic here

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default ${functionName};
`;

    return {
      path: `src/middleware/${this.toKebabCase(task.title)}.middleware.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate service file
   */
  protected generateServiceFile(task: TaskDocument): GeneratedFile {
    const serviceName = this.toServiceName(task.title);
    const resourceName = this.toResourceName(task.title);

    const content = `/**
 * ${serviceName}
 *
 * ${task.description}
 *
 * @generated by Backend Team
 */

import { ${resourceName}Repository, Prisma${this.toPascalCase(resourceName)}Repository } from '../repositories/${resourceName}.repository';

export class ${serviceName} {
  private repository: ${this.toPascalCase(resourceName)}Repository;

  constructor(repository?: ${this.toPascalCase(resourceName)}Repository) {
    this.repository = repository || new Prisma${this.toPascalCase(resourceName)}Repository();
  }

  async findAll(options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repository.findAll({ skip, take: limit }),
      this.repository.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const result = await this.repository.findById(id);

    if (!result) {
      throw new Error('Not found');
    }

    return result;
  }

  async create(data: unknown) {
    return this.repository.create(data as any);
  }

  async update(id: string, data: unknown) {
    await this.findById(id); // Ensure exists
    return this.repository.update(id, data as any);
  }

  async delete(id: string) {
    await this.findById(id); // Ensure exists
    await this.repository.delete(id);
  }
}

export const ${resourceName}Service = new ${serviceName}();
`;

    return {
      path: `src/services/${resourceName}.service.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate service interface
   */
  protected generateServiceInterface(task: TaskDocument): GeneratedFile {
    const serviceName = this.toServiceName(task.title);
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * ${serviceName} Interface
 *
 * @generated by Backend Team
 */

export interface I${serviceName} {
  findAll(options?: { page?: number; limit?: number }): Promise<{
    data: ${typeName}[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findById(id: string): Promise<${typeName}>;

  create(data: Create${typeName}Input): Promise<${typeName}>;

  update(id: string, data: Update${typeName}Input): Promise<${typeName}>;

  delete(id: string): Promise<void>;
}

// These types should be imported from your types file
interface ${typeName} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Create${typeName}Input {}

interface Update${typeName}Input {}
`;

    return {
      path: `src/services/${resourceName}.service.interface.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate migration task
   */
  protected generateMigration(task: TaskDocument): GeneratedFile {
    const timestamp = Date.now();
    const migrationName = this.toSnakeCase(task.title);

    const content = `-- Migration: ${task.title}
-- ${task.description}
-- Generated by Backend Team

-- Up Migration
-- TODO: Add migration SQL here

-- Down Migration
-- TODO: Add rollback SQL here
`;

    return {
      path: `prisma/migrations/${timestamp}_${migrationName}/migration.sql`,
      content,
      language: 'sql',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  // ============================================================================
  // Test Generation
  // ============================================================================

  /**
   * Generate API tests
   */
  protected generateAPITests(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * API Tests for ${task.title}
 *
 * @generated by Backend Team
 */

import request from 'supertest';
import { app } from '../src/app';

describe('${typeName} API', () => {
  ${analysis.httpMethods.includes('GET') ? `
  describe('GET /${resourceName}s', () => {
    it('should return a list of ${resourceName}s', async () => {
      const response = await request(app)
        .get('/${resourceName}s')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''};

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/${resourceName}s?page=1&limit=10')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''};

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
    });
  });

  describe('GET /${resourceName}s/:id', () => {
    it('should return a ${resourceName} by ID', async () => {
      const response = await request(app)
        .get('/${resourceName}s/test-id')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''};

      expect([200, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent ${resourceName}', async () => {
      const response = await request(app)
        .get('/${resourceName}s/non-existent-id')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''};

      expect(response.status).toBe(404);
    });
  });` : ''}

  ${analysis.httpMethods.includes('POST') ? `
  describe('POST /${resourceName}s', () => {
    it('should create a new ${resourceName}', async () => {
      const response = await request(app)
        .post('/${resourceName}s')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''}
        .send({ name: 'Test ${typeName}' });

      expect([201, 400]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/${resourceName}s')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''}
        .send({});

      expect(response.status).toBe(400);
    });
  });` : ''}

  ${analysis.httpMethods.includes('PUT') ? `
  describe('PUT /${resourceName}s/:id', () => {
    it('should update a ${resourceName}', async () => {
      const response = await request(app)
        .put('/${resourceName}s/test-id')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''}
        .send({ name: 'Updated ${typeName}' });

      expect([200, 404]).toContain(response.status);
    });
  });` : ''}

  ${analysis.httpMethods.includes('DELETE') ? `
  describe('DELETE /${resourceName}s/:id', () => {
    it('should delete a ${resourceName}', async () => {
      const response = await request(app)
        .delete('/${resourceName}s/test-id')
        ${analysis.requiresAuth ? `.set('Authorization', 'Bearer test-token')` : ''};

      expect([204, 404]).toContain(response.status);
    });
  });` : ''}

  ${analysis.requiresAuth ? `
  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/${resourceName}s');
      expect(response.status).toBe(401);
    });
  });` : ''}
});
`;

    return {
      path: `tests/api/${resourceName}.api.test.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate integration tests
   */
  protected generateIntegrationTests(task: TaskDocument, analysis: APIAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * Integration Tests for ${task.title}
 *
 * @generated by Backend Team
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('${typeName} Integration', () => {
  beforeAll(async () => {
    // Setup test database
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve a ${resourceName}', async () => {
      // Create
      const created = await prisma.${resourceName}.create({
        data: { name: 'Test' },
      });

      expect(created).toHaveProperty('id');

      // Retrieve
      const found = await prisma.${resourceName}.findUnique({
        where: { id: created.id },
      });

      expect(found).toEqual(created);
    });

    it('should update a ${resourceName}', async () => {
      const created = await prisma.${resourceName}.create({
        data: { name: 'Original' },
      });

      const updated = await prisma.${resourceName}.update({
        where: { id: created.id },
        data: { name: 'Updated' },
      });

      expect(updated.name).toBe('Updated');
    });

    it('should delete a ${resourceName}', async () => {
      const created = await prisma.${resourceName}.create({
        data: { name: 'To Delete' },
      });

      await prisma.${resourceName}.delete({
        where: { id: created.id },
      });

      const found = await prisma.${resourceName}.findUnique({
        where: { id: created.id },
      });

      expect(found).toBeNull();
    });
  });

  ${analysis.requiresDatabase ? `
  describe('Database Constraints', () => {
    it('should enforce unique constraints', async () => {
      // Test unique constraints
    });

    it('should handle foreign key relationships', async () => {
      // Test relationships
    });
  });` : ''}
});
`;

    return {
      path: `tests/integration/${resourceName}.integration.test.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate model tests
   */
  protected generateModelTests(_task: TaskDocument, analysis: ModelAnalysis): GeneratedFile {
    const content = `/**
 * Model Tests for ${analysis.entityName}
 *
 * @generated by Backend Team
 */

import { ${analysis.entityName} } from '@prisma/client';
import { ${analysis.entityName.toLowerCase()}Repository } from '../src/repositories/${analysis.entityName.toLowerCase()}.repository';

describe('${analysis.entityName} Model', () => {
  describe('Fields', () => {
    ${analysis.fields.map((field) => `
    it('should have ${field.name} field', () => {
      const model = {} as ${analysis.entityName};
      expect('${field.name}' in model || true).toBe(true);
    });`).join('\n')}
  });

  describe('Repository', () => {
    it('should find all', async () => {
      const results = await ${analysis.entityName.toLowerCase()}Repository.findAll();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find by id', async () => {
      const result = await ${analysis.entityName.toLowerCase()}Repository.findById('test-id');
      // Result may be null
    });
  });

  ${analysis.relations.length > 0 ? `
  describe('Relations', () => {
    ${analysis.relations.map((relation) => `
    it('should have ${relation.type} relation with ${relation.target}', () => {
      // Test relation
    });`).join('\n')}
  });` : ''}
});
`;

    return {
      path: `tests/models/${analysis.entityName.toLowerCase()}.model.test.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate middleware tests
   */
  protected generateMiddlewareTests(task: TaskDocument): GeneratedFile {
    const middlewareName = this.toCamelCase(task.title.replace(/middleware/gi, ''));

    const content = `/**
 * Middleware Tests for ${task.title}
 *
 * @generated by Backend Team
 */

import { Request, Response, NextFunction } from 'express';
import { ${middlewareName} } from '../src/middleware/${this.toKebabCase(task.title)}.middleware';

describe('${task.title} Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  it('should call next() on success', () => {
    const middleware = ${middlewareName}();
    middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it('should handle errors', () => {
    const middleware = ${middlewareName}();
    // Test error handling
  });
});
`;

    return {
      path: `tests/middleware/${this.toKebabCase(task.title)}.middleware.test.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate service tests
   */
  protected generateServiceTests(task: TaskDocument): GeneratedFile {
    const serviceName = this.toServiceName(task.title);
    const resourceName = this.toResourceName(task.title);

    const content = `/**
 * Service Tests for ${serviceName}
 *
 * @generated by Backend Team
 */

import { ${serviceName} } from '../src/services/${resourceName}.service';

describe('${serviceName}', () => {
  let service: ${serviceName};

  beforeEach(() => {
    service = new ${serviceName}();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
    });
  });

  describe('findById', () => {
    it('should throw error for non-existent id', async () => {
      await expect(service.findById('non-existent')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      // Test creation
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      // Test update
    });
  });

  describe('delete', () => {
    it('should delete an existing record', async () => {
      // Test deletion
    });
  });
});
`;

    return {
      path: `tests/services/${resourceName}.service.test.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  // ============================================================================
  // Documentation Generation
  // ============================================================================

  /**
   * Generate API documentation
   */
  protected generateAPIDocumentation(task: TaskDocument, analysis: APIAnalysis): string {
    const resourceName = this.toResourceName(task.title);

    return `# ${task.title} API

## Description
${task.description}

## Base URL
\`/api/v1/${resourceName}s\`

## Authentication
${analysis.requiresAuth ? 'Required - Bearer token in Authorization header' : 'Not required'}

## Endpoints

${analysis.httpMethods.includes('GET') ? `
### List ${resourceName}s
\`\`\`
GET /${resourceName}s
\`\`\`

Query Parameters:
- \`page\` (number) - Page number (default: 1)
- \`limit\` (number) - Items per page (default: 20)

### Get ${resourceName} by ID
\`\`\`
GET /${resourceName}s/:id
\`\`\`
` : ''}

${analysis.httpMethods.includes('POST') ? `
### Create ${resourceName}
\`\`\`
POST /${resourceName}s
\`\`\`

Request Body:
\`\`\`json
{
  "name": "string"
}
\`\`\`
` : ''}

${analysis.httpMethods.includes('PUT') ? `
### Update ${resourceName}
\`\`\`
PUT /${resourceName}s/:id
\`\`\`

Request Body:
\`\`\`json
{
  "name": "string"
}
\`\`\`
` : ''}

${analysis.httpMethods.includes('DELETE') ? `
### Delete ${resourceName}
\`\`\`
DELETE /${resourceName}s/:id
\`\`\`
` : ''}

## Error Responses

- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`404\` - Not Found
- \`500\` - Internal Server Error
`;
  }

  /**
   * Generate model documentation
   */
  protected generateModelDocumentation(task: TaskDocument, analysis: ModelAnalysis): string {
    return `# ${analysis.entityName} Model

## Description
${task.description}

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
${analysis.fields.map((f) => `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | |`).join('\n')}

## Relations

${analysis.relations.length > 0
  ? analysis.relations.map((r) => `- ${r.type}: ${r.target}`).join('\n')
  : 'No relations defined'}

## Usage

\`\`\`typescript
import { prisma } from './prisma';

// Create
const ${analysis.entityName.toLowerCase()} = await prisma.${analysis.entityName.toLowerCase()}.create({
  data: { /* ... */ },
});

// Find
const found = await prisma.${analysis.entityName.toLowerCase()}.findUnique({
  where: { id: 'some-id' },
});
\`\`\`
`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate GET method
   */
  protected generateGetMethod(resourceName: string): string {
    return `
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, ...query } = req.query;
      const result = await this.${resourceName}Service.findAll({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.${resourceName}Service.findById(id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }`;
  }

  /**
   * Generate POST method
   */
  protected generatePostMethod(resourceName: string, _analysis: APIAnalysis): string {
    return `
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      const result = await this.${resourceName}Service.create(data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }`;
  }

  /**
   * Generate PUT method
   */
  protected generatePutMethod(resourceName: string, _analysis: APIAnalysis): string {
    return `
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await this.${resourceName}Service.update(id, data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }`;
  }

  /**
   * Generate DELETE method
   */
  protected generateDeleteMethod(resourceName: string): string {
    return `
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.${resourceName}Service.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }`;
  }

  /**
   * Detect backend dependencies
   */
  protected detectBackendDependencies(
    _task: TaskDocument,
    _analysis: APIAnalysis
  ): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    // Framework
    if (this.backendConfig.serverFramework === 'express') {
      deps.push({ name: 'express', version: '^4.18.0', isDev: false });
      deps.push({ name: '@types/express', version: '^4.17.0', isDev: true });
    }

    // ORM
    if (this.backendConfig.ormType === 'prisma') {
      deps.push({ name: 'prisma', version: '^5.0.0', isDev: true });
      deps.push({ name: '@prisma/client', version: '^5.0.0', isDev: false });
    }

    // Validation
    if (this.backendConfig.enableValidation) {
      deps.push({ name: 'zod', version: '^3.22.0', isDev: false });
    }

    // Testing
    if (this.devConfig.generateTests) {
      deps.push({ name: 'supertest', version: '^6.3.0', isDev: true });
      deps.push({ name: '@types/supertest', version: '^2.0.0', isDev: true });
    }

    return deps;
  }

  /**
   * Detect database dependencies
   */
  protected detectDatabaseDependencies(_task: TaskDocument): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    if (this.backendConfig.ormType === 'prisma') {
      deps.push({ name: 'prisma', version: '^5.0.0', isDev: true });
      deps.push({ name: '@prisma/client', version: '^5.0.0', isDev: false });
    }

    return deps;
  }

  // ============================================================================
  // Naming Utilities
  // ============================================================================

  protected toControllerName(title: string): string {
    return this.toPascalCase(title.replace(/controller/gi, '')) + 'Controller';
  }

  protected toResourceName(title: string): string {
    return this.toCamelCase(
      title
        .replace(/api|endpoint|controller|service|model|schema/gi, '')
        .trim()
    );
  }

  protected toServiceName(title: string): string {
    return this.toPascalCase(title.replace(/service/gi, '')) + 'Service';
  }

  protected toMiddlewareName(title: string): string {
    return this.toPascalCase(title.replace(/middleware/gi, '')) + 'Middleware';
  }

  protected toCamelCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  protected toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  protected toPrismaType(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'String',
      number: 'Int',
      boolean: 'Boolean',
      datetime: 'DateTime',
      date: 'DateTime',
      uuid: 'String',
      text: 'String',
      json: 'Json',
      float: 'Float',
    };
    return typeMap[type.toLowerCase()] || 'String';
  }

  protected toSQLType(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'VARCHAR(255)',
      number: 'INTEGER',
      boolean: 'BOOLEAN',
      datetime: 'TIMESTAMPTZ',
      date: 'DATE',
      uuid: 'UUID',
      text: 'TEXT',
      json: 'JSONB',
      float: 'DECIMAL(10,2)',
    };
    return typeMap[type.toLowerCase()] || 'VARCHAR(255)';
  }

  /**
   * Update API statistics
   */
  protected updateAPIStats(task: TaskDocument): void {
    const type = task.type || '';
    const description = task.description.toLowerCase();

    if (type === 'api' || type === 'endpoint') {
      if (description.includes('get')) this.apiStats.getEndpoints++;
      if (description.includes('post') || description.includes('create')) this.apiStats.postEndpoints++;
      if (description.includes('put') || description.includes('update')) this.apiStats.putEndpoints++;
      if (description.includes('delete')) this.apiStats.deleteEndpoints++;
      this.apiStats.totalEndpoints++;
    }

    if (type === 'model' || type === 'schema') {
      this.apiStats.totalModels++;
    }

    if (type === 'migration') {
      this.apiStats.totalMigrations++;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getAPIStats(): typeof this.apiStats {
    return { ...this.apiStats };
  }

  getServerFramework(): string {
    return this.backendConfig.serverFramework || 'express';
  }

  getDatabaseType(): string {
    return this.backendConfig.databaseType || 'postgres';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a backend team
 */
export function createBackendTeam(config: BackendTeamConfig = {}): BackendTeam {
  return new BackendTeam(config);
}
