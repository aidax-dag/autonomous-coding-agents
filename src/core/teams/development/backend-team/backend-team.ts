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
  TaskDocument,
  TaskResult,
} from '../../team-types';
import {
  DevelopmentTeam,
  CodeGenerationResult,
  GeneratedFile,
} from '../development-team';

// Local imports
import { BackendTeamConfig, APIAnalysis, ModelAnalysis, BackendAPIStats } from './backend-team.types';
import { DEFAULT_BACKEND_CONFIG } from './backend-team.config';
import {
  API_DEVELOPER_ROLE,
  DATABASE_SPECIALIST_ROLE,
  SECURITY_SPECIALIST_ROLE,
  INTEGRATION_SPECIALIST_ROLE,
} from './backend-team.roles';
import { toPascalCase } from './utils/naming.utils';

// Template imports
import {
  generateController,
  generateRoutes,
  generateAPITypes,
  generateValidation,
  generateOpenAPISpec,
  generateModelFile,
  generateRepository,
  generateMigrationFile,
  generateSeedFile,
  generateMiddlewareFile,
  generateServiceFile,
  generateServiceInterface,
  generateMigration,
} from './templates';

// Test template imports
import {
  generateAPITests,
  generateIntegrationTests,
  generateModelTests,
  generateMiddlewareTests,
  generateServiceTests,
} from './test-templates';

// Documentation imports
import { generateAPIDocumentation } from './docs/api-docs.template';
import { generateModelDocumentation } from './docs/model-docs.template';

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
  protected apiStats: BackendAPIStats = {
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
    await super.initializeMembers();

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

      this.updateCodeStats(result);
      this.updateAPIStats(task);

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
  // Task Type Processing
  // ============================================================================

  protected async processAPI(task: TaskDocument): Promise<CodeGenerationResult> {
    const apiAnalysis = this.analyzeAPI(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    files.push(generateController(task, apiAnalysis, this.backendConfig));
    files.push(generateRoutes(task, apiAnalysis, this.backendConfig));
    files.push(generateAPITypes(task, apiAnalysis));

    if (this.backendConfig.enableValidation) {
      files.push(generateValidation(task, apiAnalysis));
    }

    if (this.backendConfig.enableApiDocs) {
      files.push(generateOpenAPISpec(task, apiAnalysis));
    }

    if (this.devConfig.generateTests) {
      testFiles.push(generateAPITests(task, apiAnalysis));
      testFiles.push(generateIntegrationTests(task, apiAnalysis));
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? generateAPIDocumentation(task, apiAnalysis)
        : undefined,
      dependencies: this.detectBackendDependencies(),
      notes: [
        `API: ${task.title}`,
        `Style: ${this.backendConfig.apiStyle}`,
        `Methods: ${apiAnalysis.httpMethods.join(', ')}`,
      ],
    };
  }

  protected async processModel(task: TaskDocument): Promise<CodeGenerationResult> {
    const modelAnalysis = this.analyzeModel(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    files.push(generateModelFile(task, modelAnalysis));
    files.push(generateRepository(task, modelAnalysis));
    files.push(generateMigrationFile(task, modelAnalysis));
    files.push(generateSeedFile(task, modelAnalysis));

    if (this.devConfig.generateTests) {
      testFiles.push(generateModelTests(task, modelAnalysis));
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? generateModelDocumentation(task, modelAnalysis)
        : undefined,
      dependencies: this.detectDatabaseDependencies(),
      notes: [
        `Model: ${modelAnalysis.entityName}`,
        `Fields: ${modelAnalysis.fields.length}`,
        `Relations: ${modelAnalysis.relations.length}`,
      ],
    };
  }

  protected async processMiddleware(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    files.push(generateMiddlewareFile(task));

    if (this.devConfig.generateTests) {
      testFiles.push(generateMiddlewareTests(task));
    }

    return {
      files,
      testFiles,
      dependencies: [],
      notes: [`Middleware: ${task.title}`],
    };
  }

  protected async processService(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    files.push(generateServiceFile(task));
    files.push(generateServiceInterface(task));

    if (this.devConfig.generateTests) {
      testFiles.push(generateServiceTests(task));
    }

    return {
      files,
      testFiles,
      dependencies: [],
      notes: [`Service: ${task.title}`],
    };
  }

  protected async processMigration(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];

    files.push(generateMigration(task));

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

  protected analyzeAPI(task: TaskDocument): APIAnalysis {
    const description = `${task.title} ${task.description}`.toLowerCase();

    let apiType: APIAnalysis['apiType'] = 'custom';
    if (description.includes('crud') || (description.includes('create') && description.includes('read'))) {
      apiType = 'crud';
    } else if (description.includes('aggregate') || description.includes('dashboard')) {
      apiType = 'aggregate';
    }

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

    if (httpMethods.length === 0 || apiType === 'crud') {
      httpMethods.push('GET', 'POST', 'PUT', 'DELETE');
    }

    const requiresAuth =
      this.backendConfig.enableAuth ||
      description.includes('auth') ||
      description.includes('protected') ||
      description.includes('private');

    const requiresDatabase =
      description.includes('database') ||
      description.includes('store') ||
      description.includes('persist') ||
      description.includes('save');

    const validationRequirements: string[] = [];
    if (description.includes('email')) validationRequirements.push('email');
    if (description.includes('password')) validationRequirements.push('password-strength');
    if (description.includes('phone')) validationRequirements.push('phone');
    if (description.includes('date')) validationRequirements.push('date');
    if (description.includes('url')) validationRequirements.push('url');

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

  protected analyzeModel(task: TaskDocument): ModelAnalysis {
    const description = task.description.toLowerCase();
    const entityName = toPascalCase(
      task.title.replace(/model|schema|entity/gi, '').trim()
    );

    const fields: ModelAnalysis['fields'] = [];

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

    if (fields.length === 0) {
      fields.push({ name: 'id', type: 'uuid', required: true });
      fields.push({ name: 'name', type: 'string', required: true });
      fields.push({ name: 'createdAt', type: 'datetime', required: true });
      fields.push({ name: 'updatedAt', type: 'datetime', required: true });
    }

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

    return { entityName, fields, relations };
  }

  // ============================================================================
  // Dependency Detection
  // ============================================================================

  protected detectBackendDependencies(): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    if (this.backendConfig.serverFramework === 'express') {
      deps.push({ name: 'express', version: '^4.18.0', isDev: false });
      deps.push({ name: '@types/express', version: '^4.17.0', isDev: true });
    }

    if (this.backendConfig.ormType === 'prisma') {
      deps.push({ name: 'prisma', version: '^5.0.0', isDev: true });
      deps.push({ name: '@prisma/client', version: '^5.0.0', isDev: false });
    }

    if (this.backendConfig.enableValidation) {
      deps.push({ name: 'zod', version: '^3.22.0', isDev: false });
    }

    if (this.devConfig.generateTests) {
      deps.push({ name: 'supertest', version: '^6.3.0', isDev: true });
      deps.push({ name: '@types/supertest', version: '^2.0.0', isDev: true });
    }

    return deps;
  }

  protected detectDatabaseDependencies(): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    if (this.backendConfig.ormType === 'prisma') {
      deps.push({ name: 'prisma', version: '^5.0.0', isDev: true });
      deps.push({ name: '@prisma/client', version: '^5.0.0', isDev: false });
    }

    return deps;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

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

  getAPIStats(): BackendAPIStats {
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

// Re-export types
export type { BackendTeamConfig, APIAnalysis, ModelAnalysis, BackendAPIStats };
