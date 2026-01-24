/**
 * Fullstack Team
 *
 * Combined development team for full-stack application development.
 * Handles both frontend and backend tasks with integrated workflows.
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
import { FrontendTeamConfig } from '../frontend-team';
import { BackendTeamConfig } from '../backend-team';

// Local imports
import { FullstackTeamConfig, FullstackAnalysis, FullstackStats } from './fullstack-team.types';
import { DEFAULT_FULLSTACK_CONFIG } from './fullstack-team.config';
import {
  FULLSTACK_DEVELOPER_ROLE,
  INTEGRATION_ARCHITECT_ROLE,
  DEVOPS_LIAISON_ROLE,
} from './fullstack-team.roles';
import { toPascalCase, toCamelCase, toKebabCase, toResourceName, toComponentName } from './utils';

// ============================================================================
// Fullstack Team
// ============================================================================

/**
 * Fullstack development team
 *
 * @example
 * ```typescript
 * const fullstackTeam = createFullstackTeam({
 *   frontend: { uiFrameworks: ['react'] },
 *   backend: { serverFramework: 'express' },
 *   enableIntegration: true,
 * });
 *
 * await fullstackTeam.initialize();
 * await fullstackTeam.start();
 *
 * await fullstackTeam.submitTask(createTask(
 *   'User Dashboard',
 *   'Create a user dashboard with profile management'
 * ));
 * ```
 */
export class FullstackTeam extends DevelopmentTeam {
  /** Fullstack-specific configuration */
  protected readonly fullstackConfig: FullstackTeamConfig;

  /** Fullstack statistics */
  protected fullstackStats: FullstackStats = {
    featuresImplemented: 0,
    frontendFiles: 0,
    backendFiles: 0,
    sharedFiles: 0,
    apiEndpoints: 0,
    components: 0,
    models: 0,
  };

  constructor(config: FullstackTeamConfig = DEFAULT_FULLSTACK_CONFIG) {
    const mergedConfig = {
      ...DEFAULT_FULLSTACK_CONFIG,
      ...config,
      frontend: { ...DEFAULT_FULLSTACK_CONFIG.frontend, ...config.frontend },
      backend: { ...DEFAULT_FULLSTACK_CONFIG.backend, ...config.backend },
    };

    super({
      id: config.id || `fullstack-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Fullstack Team',
      type: TeamType.FULLSTACK,
      languages: mergedConfig.languages || DEFAULT_FULLSTACK_CONFIG.languages!,
      frameworks: mergedConfig.frameworks || DEFAULT_FULLSTACK_CONFIG.frameworks!,
      generateTests: mergedConfig.generateTests ?? true,
      coverageTarget: mergedConfig.coverageTarget ?? 80,
      generateDocs: mergedConfig.generateDocs ?? true,
      enableLinting: mergedConfig.enableLinting ?? true,
      ...config,
    });

    this.fullstackConfig = mergedConfig;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  protected override async initializeMembers(): Promise<void> {
    // Add core developer roles
    await super.initializeMembers();

    // Add fullstack-specific roles
    this.addMember(FULLSTACK_DEVELOPER_ROLE);
    this.addMember(INTEGRATION_ARCHITECT_ROLE);
    this.addMember(DEVOPS_LIAISON_ROLE);
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
        case 'fullstack':
        case 'feature':
          result = await this.processFullstackFeature(task);
          break;
        case 'crud':
          result = await this.processCRUDFeature(task);
          break;
        case 'integration':
          result = await this.processIntegration(task);
          break;
        case 'api-client':
          result = await this.processAPIClient(task);
          break;
        default:
          // Analyze and route to appropriate processing
          const analysis = this.analyzeFullstackTask(task);
          if (analysis.hasFrontend && analysis.hasBackend) {
            result = await this.processFullstackFeature(task);
          } else if (analysis.hasFrontend) {
            result = await this.processFrontendTask(task);
          } else if (analysis.hasBackend) {
            result = await this.processBackendTask(task);
          } else {
            result = await this.processImplementation(task);
          }
      }

      // Update statistics
      this.updateCodeStats(result);
      this.updateFullstackStats(result);

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
          fullstackStats: this.fullstackStats,
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
  // Fullstack-Specific Processing
  // ============================================================================

  /**
   * Process fullstack feature
   */
  protected async processFullstackFeature(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeFullstackTask(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate shared types
    const sharedTypes = this.generateSharedTypes(task, analysis);
    files.push(sharedTypes);

    // Generate backend
    if (analysis.hasBackend) {
      const backendFiles = await this.generateBackendLayer(task, analysis);
      files.push(...backendFiles.files);
      testFiles.push(...backendFiles.tests);
    }

    // Generate frontend
    if (analysis.hasFrontend) {
      const frontendFiles = await this.generateFrontendLayer(task, analysis);
      files.push(...frontendFiles.files);
      testFiles.push(...frontendFiles.tests);
    }

    // Generate API client
    if (this.fullstackConfig.generateApiClient && analysis.hasBackend) {
      const apiClient = this.generateAPIClientFile(task, analysis);
      files.push(apiClient);
    }

    // Generate state management
    if (this.fullstackConfig.enableStateManagement && analysis.hasFrontend) {
      const store = this.generateStateStore(task, analysis);
      files.push(store);
    }

    // Generate integration tests
    if (this.devConfig.generateTests) {
      const e2eTests = this.generateE2ETests(task, analysis);
      testFiles.push(e2eTests);
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateFullstackDocumentation(task, analysis)
        : undefined,
      dependencies: this.detectFullstackDependencies(task, analysis),
      notes: [
        `Feature: ${task.title}`,
        `Layers: ${analysis.layers.join(', ')}`,
        `Complexity: ${analysis.complexity}`,
      ],
    };
  }

  /**
   * Process CRUD feature
   */
  protected async processCRUDFeature(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeFullstackTask(task);
    analysis.layers = ['ui', 'api', 'service', 'database'];
    analysis.hasBackend = true;
    analysis.hasFrontend = true;
    analysis.hasDatabase = true;

    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    // Generate shared types
    files.push(this.generateCRUDTypes(task, resourceName, typeName));

    // Generate database model
    files.push(this.generateCRUDModel(task, resourceName, typeName));

    // Generate repository
    files.push(this.generateCRUDRepository(task, resourceName, typeName));

    // Generate service
    files.push(this.generateCRUDService(task, resourceName, typeName));

    // Generate controller
    files.push(this.generateCRUDController(task, resourceName, typeName));

    // Generate routes
    files.push(this.generateCRUDRoutes(task, resourceName, typeName));

    // Generate validation
    files.push(this.generateCRUDValidation(task, resourceName, typeName));

    // Generate API client
    files.push(this.generateCRUDApiClient(task, resourceName, typeName));

    // Generate state store
    files.push(this.generateCRUDStore(task, resourceName, typeName));

    // Generate components
    files.push(...this.generateCRUDComponents(task, resourceName, typeName));

    // Generate page
    files.push(this.generateCRUDPage(task, resourceName, typeName));

    // Generate tests
    if (this.devConfig.generateTests) {
      testFiles.push(...this.generateCRUDTests(task, resourceName, typeName));
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateCRUDDocumentation(task, resourceName, typeName)
        : undefined,
      dependencies: this.detectFullstackDependencies(task, analysis),
      notes: [
        `CRUD: ${typeName}`,
        `Layers: All layers implemented`,
        `Endpoints: GET, POST, PUT, DELETE`,
      ],
    };
  }

  /**
   * Process integration task
   */
  protected async processIntegration(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate API client
    const apiClient = this.generateIntegrationClient(task);
    files.push(apiClient);

    // Generate types
    const types = this.generateIntegrationTypes(task);
    files.push(types);

    // Generate hooks (if React)
    if (this.fullstackConfig.frontend?.uiFrameworks?.includes('react')) {
      const hooks = this.generateIntegrationHooks(task);
      files.push(hooks);
    }

    // Generate tests
    if (this.devConfig.generateTests) {
      const integrationTests = this.generateIntegrationTests(task);
      testFiles.push(integrationTests);
    }

    return {
      files,
      testFiles,
      dependencies: [
        { name: 'axios', version: '^1.6.0', isDev: false },
        { name: '@tanstack/react-query', version: '^5.0.0', isDev: false },
      ],
      notes: [`Integration: ${task.title}`],
    };
  }

  /**
   * Process API client task
   */
  protected async processAPIClient(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate base client
    const baseClient = this.generateBaseAPIClient(task);
    files.push(baseClient);

    // Generate resource-specific client
    const resourceClient = this.generateResourceAPIClient(task);
    files.push(resourceClient);

    // Generate types
    const types = this.generateAPIClientTypes(task);
    files.push(types);

    // Generate tests
    if (this.devConfig.generateTests) {
      const clientTests = this.generateAPIClientTests(task);
      testFiles.push(clientTests);
    }

    return {
      files,
      testFiles,
      dependencies: [{ name: 'axios', version: '^1.6.0', isDev: false }],
      notes: [`API Client: ${task.title}`],
    };
  }

  /**
   * Process frontend-only task
   */
  protected async processFrontendTask(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeFullstackTask(task);
    const frontendFiles = await this.generateFrontendLayer(task, analysis);

    return {
      files: frontendFiles.files,
      testFiles: frontendFiles.tests,
      documentation: this.devConfig.generateDocs
        ? this.generateFrontendDocumentation(task)
        : undefined,
      dependencies: this.detectFrontendDependencies(task),
      notes: [`Frontend: ${task.title}`],
    };
  }

  /**
   * Process backend-only task
   */
  protected async processBackendTask(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeFullstackTask(task);
    const backendFiles = await this.generateBackendLayer(task, analysis);

    return {
      files: backendFiles.files,
      testFiles: backendFiles.tests,
      documentation: this.devConfig.generateDocs
        ? this.generateBackendDocumentation(task)
        : undefined,
      dependencies: this.detectBackendDependencies(task),
      notes: [`Backend: ${task.title}`],
    };
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Analyze fullstack task
   */
  protected analyzeFullstackTask(task: TaskDocument): FullstackAnalysis {
    const description = `${task.title} ${task.description}`.toLowerCase();

    // Determine layers
    const hasFrontend =
      description.includes('ui') ||
      description.includes('component') ||
      description.includes('page') ||
      description.includes('form') ||
      description.includes('frontend') ||
      description.includes('display') ||
      description.includes('view');

    const hasBackend =
      description.includes('api') ||
      description.includes('endpoint') ||
      description.includes('backend') ||
      description.includes('server') ||
      description.includes('service');

    const hasDatabase =
      description.includes('database') ||
      description.includes('model') ||
      description.includes('store') ||
      description.includes('persist') ||
      description.includes('save');

    const requiresAuth =
      description.includes('auth') ||
      description.includes('login') ||
      description.includes('user') ||
      description.includes('protected');

    // Determine layers
    const layers: FullstackAnalysis['layers'] = [];
    if (hasFrontend) layers.push('ui');
    if (hasBackend) layers.push('api', 'service');
    if (hasDatabase) layers.push('database');

    // Determine complexity
    let complexity: FullstackAnalysis['complexity'] = 'simple';
    if (layers.length >= 3) {
      complexity = 'moderate';
    }
    if (layers.length === 4 && requiresAuth) {
      complexity = 'complex';
    }

    return {
      hasFrontend,
      hasBackend,
      hasDatabase,
      requiresAuth,
      layers,
      complexity,
    };
  }

  // ============================================================================
  // Layer Generation
  // ============================================================================

  /**
   * Generate backend layer files
   */
  protected async generateBackendLayer(
    task: TaskDocument,
    analysis: FullstackAnalysis
  ): Promise<{ files: GeneratedFile[]; tests: GeneratedFile[] }> {
    const files: GeneratedFile[] = [];
    const tests: GeneratedFile[] = [];
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    // Controller
    files.push(this.generateControllerFile(task, resourceName, typeName));

    // Routes
    files.push(this.generateRoutesFile(task, resourceName, typeName, analysis.requiresAuth));

    // Service
    files.push(this.generateServiceFile(task, resourceName, typeName));

    // Validation
    files.push(this.generateValidationFile(task, resourceName, typeName));

    // Model (if database)
    if (analysis.hasDatabase) {
      files.push(this.generateModelFile(task, resourceName, typeName));
      files.push(this.generateRepositoryFile(task, resourceName, typeName));
    }

    // Tests
    if (this.devConfig.generateTests) {
      tests.push(this.generateBackendTests(task, resourceName, typeName));
    }

    return { files, tests };
  }

  /**
   * Generate frontend layer files
   */
  protected async generateFrontendLayer(
    task: TaskDocument,
    analysis: FullstackAnalysis
  ): Promise<{ files: GeneratedFile[]; tests: GeneratedFile[] }> {
    const files: GeneratedFile[] = [];
    const tests: GeneratedFile[] = [];
    const componentName = this.toComponentName(task.title);

    // Main component
    files.push(this.generateComponentFile(task, componentName, analysis));

    // Styles
    files.push(this.generateStylesFile(task, componentName));

    // Types
    files.push(this.generateComponentTypesFile(task, componentName));

    // Hooks (if API integration)
    if (analysis.hasBackend && this.fullstackConfig.frontend?.uiFrameworks?.includes('react')) {
      files.push(this.generateHooksFile(task, componentName));
    }

    // Tests
    if (this.devConfig.generateTests) {
      tests.push(this.generateFrontendTests(task, componentName));
    }

    return { files, tests };
  }

  // ============================================================================
  // File Generation - Shared
  // ============================================================================

  /**
   * Generate shared types
   */
  protected generateSharedTypes(task: TaskDocument, _analysis: FullstackAnalysis): GeneratedFile {
    const typeName = this.toPascalCase(this.toResourceName(task.title));

    const content = `/**
 * Shared Types for ${task.title}
 *
 * Types shared between frontend and backend.
 *
 * @generated by Fullstack Team
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ${typeName} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${typeName}Request {
  // Fields for creating ${typeName}
}

export interface Update${typeName}Request {
  // Fields for updating ${typeName}
}

// ============================================================================
// Response Types
// ============================================================================

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

export interface ${typeName}ErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface ${typeName}Query {
  page?: number;
  limit?: number;
  sortBy?: keyof ${typeName};
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// ============================================================================
// State Types
// ============================================================================

export interface ${typeName}State {
  items: ${typeName}[];
  selectedItem: ${typeName} | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// ============================================================================
// Action Types
// ============================================================================

export type ${typeName}Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: ${typeName}ListResponse }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SELECT_ITEM'; payload: ${typeName} }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CREATE_SUCCESS'; payload: ${typeName} }
  | { type: 'UPDATE_SUCCESS'; payload: ${typeName} }
  | { type: 'DELETE_SUCCESS'; payload: string };
`;

    return {
      path: `src/shared/types/${this.toKebabCase(typeName)}.types.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate API client file
   */
  protected generateAPIClientFile(task: TaskDocument, _analysis: FullstackAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);

    const content = `/**
 * API Client for ${task.title}
 *
 * @generated by Fullstack Team
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  ${typeName},
  Create${typeName}Request,
  Update${typeName}Request,
  ${typeName}Response,
  ${typeName}ListResponse,
  ${typeName}Query,
} from '../shared/types/${this.toKebabCase(typeName)}.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ${typeName}API {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers.Authorization = \`Bearer \${token}\`;
      }
      return config;
    });
  }

  /**
   * Get all ${resourceName}s with pagination
   */
  async getAll(query: ${typeName}Query = {}): Promise<${typeName}ListResponse> {
    const params = new URLSearchParams();
    if (query.page) params.set('page', query.page.toString());
    if (query.limit) params.set('limit', query.limit.toString());
    if (query.sortBy) params.set('sortBy', query.sortBy as string);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);
    if (query.search) params.set('search', query.search);

    const response = await this.client.get(\`/${resourceName}s?\${params.toString()}\`);
    return response.data;
  }

  /**
   * Get a single ${resourceName} by ID
   */
  async getById(id: string): Promise<${typeName}Response> {
    const response = await this.client.get(\`/${resourceName}s/\${id}\`);
    return response.data;
  }

  /**
   * Create a new ${resourceName}
   */
  async create(data: Create${typeName}Request): Promise<${typeName}Response> {
    const response = await this.client.post(\`/${resourceName}s\`, data);
    return response.data;
  }

  /**
   * Update an existing ${resourceName}
   */
  async update(id: string, data: Update${typeName}Request): Promise<${typeName}Response> {
    const response = await this.client.put(\`/${resourceName}s/\${id}\`, data);
    return response.data;
  }

  /**
   * Delete a ${resourceName}
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(\`/${resourceName}s/\${id}\`);
  }
}

export const ${resourceName}API = new ${typeName}API();
export default ${resourceName}API;
`;

    return {
      path: `src/client/api/${resourceName}.api.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate state store
   */
  protected generateStateStore(task: TaskDocument, _analysis: FullstackAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    const typeName = this.toPascalCase(resourceName);
    const stateLib = this.fullstackConfig.stateManagementLib;

    let content: string;

    if (stateLib === 'zustand') {
      content = this.generateZustandStore(resourceName, typeName);
    } else if (stateLib === 'redux') {
      content = this.generateReduxSlice(resourceName, typeName);
    } else {
      content = this.generateContextStore(resourceName, typeName);
    }

    return {
      path: `src/client/stores/${resourceName}.store.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate Zustand store
   */
  protected generateZustandStore(resourceName: string, typeName: string): string {
    return `/**
 * ${typeName} Store (Zustand)
 *
 * @generated by Fullstack Team
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  ${typeName},
  ${typeName}State,
  ${typeName}Query,
} from '../../shared/types/${this.toKebabCase(typeName)}.types';
import { ${resourceName}API } from '../api/${resourceName}.api';

interface ${typeName}Store extends ${typeName}State {
  // Actions
  fetchAll: (query?: ${typeName}Query) => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  create: (data: unknown) => Promise<void>;
  update: (id: string, data: unknown) => Promise<void>;
  remove: (id: string) => Promise<void>;
  selectItem: (item: ${typeName}) => void;
  clearSelection: () => void;
  clearError: () => void;
}

export const use${typeName}Store = create<${typeName}Store>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        items: [],
        selectedItem: null,
        isLoading: false,
        error: null,
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
        },

        // Actions
        fetchAll: async (query = {}) => {
          set({ isLoading: true, error: null });
          try {
            const response = await ${resourceName}API.getAll(query);
            set({
              items: response.data,
              isLoading: false,
              pagination: {
                page: response.page,
                limit: response.limit,
                total: response.total,
              },
            });
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },

        fetchById: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await ${resourceName}API.getById(id);
            set({ selectedItem: response.data, isLoading: false });
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },

        create: async (data: unknown) => {
          set({ isLoading: true, error: null });
          try {
            const response = await ${resourceName}API.create(data as any);
            set((state) => ({
              items: [response.data, ...state.items],
              isLoading: false,
            }));
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },

        update: async (id: string, data: unknown) => {
          set({ isLoading: true, error: null });
          try {
            const response = await ${resourceName}API.update(id, data as any);
            set((state) => ({
              items: state.items.map((item) =>
                item.id === id ? response.data : item
              ),
              selectedItem:
                state.selectedItem?.id === id ? response.data : state.selectedItem,
              isLoading: false,
            }));
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },

        remove: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            await ${resourceName}API.delete(id);
            set((state) => ({
              items: state.items.filter((item) => item.id !== id),
              selectedItem:
                state.selectedItem?.id === id ? null : state.selectedItem,
              isLoading: false,
            }));
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },

        selectItem: (item: ${typeName}) => set({ selectedItem: item }),
        clearSelection: () => set({ selectedItem: null }),
        clearError: () => set({ error: null }),
      }),
      {
        name: '${resourceName}-storage',
        partialize: (state) => ({ pagination: state.pagination }),
      }
    ),
    { name: '${typeName}Store' }
  )
);
`;
  }

  /**
   * Generate Redux slice
   */
  protected generateReduxSlice(resourceName: string, typeName: string): string {
    return `/**
 * ${typeName} Slice (Redux Toolkit)
 *
 * @generated by Fullstack Team
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  ${typeName},
  ${typeName}State,
  ${typeName}Query,
} from '../../shared/types/${this.toKebabCase(typeName)}.types';
import { ${resourceName}API } from '../api/${resourceName}.api';

const initialState: ${typeName}State = {
  items: [],
  selectedItem: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
};

// Async thunks
export const fetch${typeName}s = createAsyncThunk(
  '${resourceName}/fetchAll',
  async (query: ${typeName}Query = {}) => {
    return await ${resourceName}API.getAll(query);
  }
);

export const fetch${typeName}ById = createAsyncThunk(
  '${resourceName}/fetchById',
  async (id: string) => {
    return await ${resourceName}API.getById(id);
  }
);

export const create${typeName} = createAsyncThunk(
  '${resourceName}/create',
  async (data: unknown) => {
    return await ${resourceName}API.create(data as any);
  }
);

export const update${typeName} = createAsyncThunk(
  '${resourceName}/update',
  async ({ id, data }: { id: string; data: unknown }) => {
    return await ${resourceName}API.update(id, data as any);
  }
);

export const delete${typeName} = createAsyncThunk(
  '${resourceName}/delete',
  async (id: string) => {
    await ${resourceName}API.delete(id);
    return id;
  }
);

const ${resourceName}Slice = createSlice({
  name: '${resourceName}',
  initialState,
  reducers: {
    selectItem: (state, action: PayloadAction<${typeName}>) => {
      state.selectedItem = action.payload;
    },
    clearSelection: (state) => {
      state.selectedItem = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetch${typeName}s.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetch${typeName}s.fulfilled, (state, action) => {
        state.items = action.payload.data;
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
        };
        state.isLoading = false;
      })
      .addCase(fetch${typeName}s.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch';
        state.isLoading = false;
      })
      // Create
      .addCase(create${typeName}.fulfilled, (state, action) => {
        state.items.unshift(action.payload.data);
      })
      // Update
      .addCase(update${typeName}.fulfilled, (state, action) => {
        const index = state.items.findIndex((i) => i.id === action.payload.data.id);
        if (index !== -1) {
          state.items[index] = action.payload.data;
        }
      })
      // Delete
      .addCase(delete${typeName}.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.id !== action.payload);
      });
  },
});

export const { selectItem, clearSelection, clearError } = ${resourceName}Slice.actions;
export default ${resourceName}Slice.reducer;
`;
  }

  /**
   * Generate Context store
   */
  protected generateContextStore(resourceName: string, typeName: string): string {
    return `/**
 * ${typeName} Context Store
 *
 * @generated by Fullstack Team
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  ${typeName},
  ${typeName}State,
  ${typeName}Action,
} from '../../shared/types/${this.toKebabCase(typeName)}.types';

const initialState: ${typeName}State = {
  items: [],
  selectedItem: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
};

function ${resourceName}Reducer(state: ${typeName}State, action: ${typeName}Action): ${typeName}State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        items: action.payload.data,
        isLoading: false,
        pagination: {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
        },
      };
    case 'FETCH_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SELECT_ITEM':
      return { ...state, selectedItem: action.payload };
    case 'CLEAR_SELECTION':
      return { ...state, selectedItem: null };
    case 'CREATE_SUCCESS':
      return { ...state, items: [action.payload, ...state.items] };
    case 'UPDATE_SUCCESS':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? action.payload : i
        ),
      };
    case 'DELETE_SUCCESS':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
      };
    default:
      return state;
  }
}

interface ${typeName}ContextType {
  state: ${typeName}State;
  dispatch: React.Dispatch<${typeName}Action>;
}

const ${typeName}Context = createContext<${typeName}ContextType | undefined>(undefined);

export function ${typeName}Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(${resourceName}Reducer, initialState);

  return (
    <${typeName}Context.Provider value={{ state, dispatch }}>
      {children}
    </${typeName}Context.Provider>
  );
}

export function use${typeName}Context() {
  const context = useContext(${typeName}Context);
  if (!context) {
    throw new Error('use${typeName}Context must be used within a ${typeName}Provider');
  }
  return context;
}
`;
  }

  // ============================================================================
  // CRUD Generation
  // ============================================================================

  protected generateCRUDTypes(_task: TaskDocument, _resourceName: string, typeName: string): GeneratedFile {
    const content = `/**
 * ${typeName} Types
 * @generated by Fullstack Team
 */

export interface ${typeName} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${typeName}Input {
  name: string;
}

export interface Update${typeName}Input {
  name?: string;
}

export interface ${typeName}ListResponse {
  data: ${typeName}[];
  total: number;
  page: number;
  limit: number;
}
`;

    return {
      path: `src/shared/types/${this.toKebabCase(typeName)}.types.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  protected generateCRUDModel(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile {
    return {
      path: `prisma/models/${resourceName}.prisma`,
      content: `model ${typeName} {\n  id        String   @id @default(uuid())\n  name      String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n`,
      language: 'prisma',
      linesOfCode: 6,
      isTest: false,
    };
  }

  protected generateCRUDRepository(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/repositories/${resourceName}.repository.ts`,
      content: `import { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();\n\nexport const ${resourceName}Repository = {\n  findAll: async (skip = 0, take = 20) => prisma.${resourceName}.findMany({ skip, take }),\n  findById: async (id: string) => prisma.${resourceName}.findUnique({ where: { id } }),\n  create: async (data: any) => prisma.${resourceName}.create({ data }),\n  update: async (id: string, data: any) => prisma.${resourceName}.update({ where: { id }, data }),\n  delete: async (id: string) => prisma.${resourceName}.delete({ where: { id } }),\n  count: async () => prisma.${resourceName}.count(),\n};\n`,
      language: 'typescript',
      linesOfCode: 12,
      isTest: false,
    };
  }

  protected generateCRUDService(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/services/${resourceName}.service.ts`,
      content: `import { ${resourceName}Repository } from '../repositories/${resourceName}.repository';\n\nexport const ${resourceName}Service = {\n  findAll: async (page = 1, limit = 20) => {\n    const skip = (page - 1) * limit;\n    const [data, total] = await Promise.all([${resourceName}Repository.findAll(skip, limit), ${resourceName}Repository.count()]);\n    return { data, total, page, limit };\n  },\n  findById: async (id: string) => ${resourceName}Repository.findById(id),\n  create: async (data: any) => ${resourceName}Repository.create(data),\n  update: async (id: string, data: any) => ${resourceName}Repository.update(id, data),\n  delete: async (id: string) => ${resourceName}Repository.delete(id),\n};\n`,
      language: 'typescript',
      linesOfCode: 14,
      isTest: false,
    };
  }

  protected generateCRUDController(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/controllers/${resourceName}.controller.ts`,
      content: `import { Request, Response, NextFunction } from 'express';\nimport { ${resourceName}Service } from '../services/${resourceName}.service';\n\nexport const ${resourceName}Controller = {\n  getAll: async (req: Request, res: Response, next: NextFunction) => {\n    try {\n      const { page, limit } = req.query;\n      const result = await ${resourceName}Service.findAll(Number(page) || 1, Number(limit) || 20);\n      res.json(result);\n    } catch (e) { next(e); }\n  },\n  getById: async (req: Request, res: Response, next: NextFunction) => {\n    try {\n      const result = await ${resourceName}Service.findById(req.params.id);\n      result ? res.json({ data: result }) : res.status(404).json({ error: 'Not found' });\n    } catch (e) { next(e); }\n  },\n  create: async (req: Request, res: Response, next: NextFunction) => {\n    try {\n      const result = await ${resourceName}Service.create(req.body);\n      res.status(201).json({ data: result });\n    } catch (e) { next(e); }\n  },\n  update: async (req: Request, res: Response, next: NextFunction) => {\n    try {\n      const result = await ${resourceName}Service.update(req.params.id, req.body);\n      res.json({ data: result });\n    } catch (e) { next(e); }\n  },\n  delete: async (req: Request, res: Response, next: NextFunction) => {\n    try {\n      await ${resourceName}Service.delete(req.params.id);\n      res.status(204).send();\n    } catch (e) { next(e); }\n  },\n};\n`,
      language: 'typescript',
      linesOfCode: 35,
      isTest: false,
    };
  }

  protected generateCRUDRoutes(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/routes/${resourceName}.routes.ts`,
      content: `import { Router } from 'express';\nimport { ${resourceName}Controller } from '../controllers/${resourceName}.controller';\n\nconst router = Router();\n\nrouter.get('/', ${resourceName}Controller.getAll);\nrouter.get('/:id', ${resourceName}Controller.getById);\nrouter.post('/', ${resourceName}Controller.create);\nrouter.put('/:id', ${resourceName}Controller.update);\nrouter.delete('/:id', ${resourceName}Controller.delete);\n\nexport default router;\n`,
      language: 'typescript',
      linesOfCode: 13,
      isTest: false,
    };
  }

  protected generateCRUDValidation(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/validation/${resourceName}.validation.ts`,
      content: `import { z } from 'zod';\n\nexport const ${resourceName}Schema = {\n  create: z.object({ name: z.string().min(1).max(255) }),\n  update: z.object({ name: z.string().min(1).max(255).optional() }),\n  query: z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().default(20) }),\n};\n`,
      language: 'typescript',
      linesOfCode: 7,
      isTest: false,
    };
  }

  protected generateCRUDApiClient(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/client/api/${resourceName}.api.ts`,
      content: `import axios from 'axios';\n\nconst API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';\n\nexport const ${resourceName}API = {\n  getAll: async (query = {}) => (await axios.get(\`\${API_URL}/${resourceName}s\`, { params: query })).data,\n  getById: async (id: string) => (await axios.get(\`\${API_URL}/${resourceName}s/\${id}\`)).data,\n  create: async (data: any) => (await axios.post(\`\${API_URL}/${resourceName}s\`, data)).data,\n  update: async (id: string, data: any) => (await axios.put(\`\${API_URL}/${resourceName}s/\${id}\`, data)).data,\n  delete: async (id: string) => axios.delete(\`\${API_URL}/${resourceName}s/\${id}\`),\n};\n`,
      language: 'typescript',
      linesOfCode: 11,
      isTest: false,
    };
  }

  protected generateCRUDStore(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile {
    return {
      path: `src/client/stores/${resourceName}.store.ts`,
      content: `import { create } from 'zustand';\nimport { ${resourceName}API } from '../api/${resourceName}.api';\n\nexport const use${typeName}Store = create((set) => ({\n  items: [],\n  isLoading: false,\n  fetchAll: async () => {\n    set({ isLoading: true });\n    const data = await ${resourceName}API.getAll();\n    set({ items: data.data, isLoading: false });\n  },\n}));\n`,
      language: 'typescript',
      linesOfCode: 12,
      isTest: false,
    };
  }

  protected generateCRUDComponents(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile[] {
    return [
      {
        path: `src/client/components/${resourceName}/${typeName}List.tsx`,
        content: `import React from 'react';\n\nexport const ${typeName}List: React.FC = () => {\n  return <div className="${resourceName}-list">{/* List items */}</div>;\n};\n`,
        language: 'typescript',
        linesOfCode: 5,
        isTest: false,
      },
      {
        path: `src/client/components/${resourceName}/${typeName}Form.tsx`,
        content: `import React from 'react';\n\nexport const ${typeName}Form: React.FC = () => {\n  return <form className="${resourceName}-form">{/* Form fields */}</form>;\n};\n`,
        language: 'typescript',
        linesOfCode: 5,
        isTest: false,
      },
    ];
  }

  protected generateCRUDPage(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile {
    return {
      path: `src/client/pages/${resourceName}/${typeName}Page.tsx`,
      content: `import React from 'react';\nimport { ${typeName}List } from '../../components/${resourceName}/${typeName}List';\nimport { ${typeName}Form } from '../../components/${resourceName}/${typeName}Form';\n\nexport const ${typeName}Page: React.FC = () => {\n  return (\n    <main className="${resourceName}-page">\n      <h1>${typeName}s</h1>\n      <${typeName}Form />\n      <${typeName}List />\n    </main>\n  );\n};\n\nexport default ${typeName}Page;\n`,
      language: 'typescript',
      linesOfCode: 15,
      isTest: false,
    };
  }

  protected generateCRUDTests(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile[] {
    return [
      {
        path: `tests/api/${resourceName}.api.test.ts`,
        content: `import request from 'supertest';\nimport { app } from '../../src/server/app';\n\ndescribe('${typeName} API', () => {\n  it('GET /${resourceName}s', async () => {\n    const res = await request(app).get('/${resourceName}s');\n    expect([200, 404]).toContain(res.status);\n  });\n});\n`,
        language: 'typescript',
        linesOfCode: 9,
        isTest: true,
      },
      {
        path: `tests/components/${typeName}.test.tsx`,
        content: `import { render, screen } from '@testing-library/react';\nimport { ${typeName}List } from '../../src/client/components/${resourceName}/${typeName}List';\n\ndescribe('${typeName}List', () => {\n  it('renders', () => {\n    render(<${typeName}List />);\n  });\n});\n`,
        language: 'typescript',
        linesOfCode: 9,
        isTest: true,
      },
    ];
  }

  protected generateCRUDDocumentation(_task: TaskDocument, resourceName: string, typeName: string): string {
    return `# ${typeName} CRUD Feature\n\n## API Endpoints\n- GET /${resourceName}s\n- GET /${resourceName}s/:id\n- POST /${resourceName}s\n- PUT /${resourceName}s/:id\n- DELETE /${resourceName}s/:id\n\n## Components\n- ${typeName}List\n- ${typeName}Form\n- ${typeName}Page\n`;
  }

  // ============================================================================
  // Additional File Generators
  // ============================================================================

  protected generateE2ETests(task: TaskDocument, _analysis: FullstackAnalysis): GeneratedFile {
    const resourceName = this.toResourceName(task.title);

    return {
      path: `tests/e2e/${resourceName}.e2e.test.ts`,
      content: `/**\n * E2E Tests for ${task.title}\n * @generated by Fullstack Team\n */\n\ndescribe('${task.title} E2E', () => {\n  it('should complete full workflow', async () => {\n    // E2E test implementation\n  });\n});\n`,
      language: 'typescript',
      linesOfCode: 10,
      isTest: true,
    };
  }

  protected generateIntegrationClient(task: TaskDocument): GeneratedFile {
    return {
      path: `src/client/integrations/${this.toKebabCase(task.title)}.client.ts`,
      content: `/**\n * Integration Client: ${task.title}\n * @generated by Fullstack Team\n */\n\nexport class ${this.toPascalCase(task.title)}Client {\n  // Integration implementation\n}\n`,
      language: 'typescript',
      linesOfCode: 8,
      isTest: false,
    };
  }

  protected generateIntegrationTypes(task: TaskDocument): GeneratedFile {
    return {
      path: `src/shared/types/${this.toKebabCase(task.title)}.types.ts`,
      content: `/**\n * Types for ${task.title} Integration\n * @generated by Fullstack Team\n */\n\nexport interface ${this.toPascalCase(task.title)}Config {}\n`,
      language: 'typescript',
      linesOfCode: 6,
      isTest: false,
    };
  }

  protected generateIntegrationHooks(task: TaskDocument): GeneratedFile {
    const hookName = `use${this.toPascalCase(task.title)}`;
    return {
      path: `src/client/hooks/${this.toKebabCase(task.title)}.hooks.ts`,
      content: `/**\n * Hooks for ${task.title}\n * @generated by Fullstack Team\n */\n\nimport { useQuery, useMutation } from '@tanstack/react-query';\n\nexport function ${hookName}() {\n  // Hook implementation\n}\n`,
      language: 'typescript',
      linesOfCode: 10,
      isTest: false,
    };
  }

  protected generateIntegrationTests(task: TaskDocument): GeneratedFile {
    return {
      path: `tests/integrations/${this.toKebabCase(task.title)}.test.ts`,
      content: `describe('${task.title} Integration', () => {\n  it('should integrate correctly', () => {\n    // Test implementation\n  });\n});\n`,
      language: 'typescript',
      linesOfCode: 5,
      isTest: true,
    };
  }

  protected generateBaseAPIClient(_task: TaskDocument): GeneratedFile {
    return {
      path: 'src/client/api/base.client.ts',
      content: `import axios from 'axios';\n\nexport const apiClient = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',\n  headers: { 'Content-Type': 'application/json' },\n});\n`,
      language: 'typescript',
      linesOfCode: 7,
      isTest: false,
    };
  }

  protected generateResourceAPIClient(task: TaskDocument): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    return {
      path: `src/client/api/${resourceName}.client.ts`,
      content: `import { apiClient } from './base.client';\n\nexport const ${resourceName}Client = {\n  getAll: () => apiClient.get('/${resourceName}s'),\n  getById: (id: string) => apiClient.get(\`/${resourceName}s/\${id}\`),\n  create: (data: any) => apiClient.post('/${resourceName}s', data),\n  update: (id: string, data: any) => apiClient.put(\`/${resourceName}s/\${id}\`, data),\n  delete: (id: string) => apiClient.delete(\`/${resourceName}s/\${id}\`),\n};\n`,
      language: 'typescript',
      linesOfCode: 10,
      isTest: false,
    };
  }

  protected generateAPIClientTypes(task: TaskDocument): GeneratedFile {
    const typeName = this.toPascalCase(this.toResourceName(task.title));
    return {
      path: `src/client/api/${this.toKebabCase(typeName)}.types.ts`,
      content: `export interface ${typeName}APIConfig {\n  baseURL?: string;\n  timeout?: number;\n}\n`,
      language: 'typescript',
      linesOfCode: 4,
      isTest: false,
    };
  }

  protected generateAPIClientTests(task: TaskDocument): GeneratedFile {
    const resourceName = this.toResourceName(task.title);
    return {
      path: `tests/client/${resourceName}.client.test.ts`,
      content: `describe('${resourceName}Client', () => {\n  it('should make API calls', () => {\n    // Test implementation\n  });\n});\n`,
      language: 'typescript',
      linesOfCode: 5,
      isTest: true,
    };
  }

  protected generateControllerFile(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/controllers/${resourceName}.controller.ts`,
      content: `import { Request, Response, NextFunction } from 'express';\n\nexport const ${resourceName}Controller = {\n  getAll: async (req: Request, res: Response, next: NextFunction) => {\n    try { res.json({ data: [] }); } catch (e) { next(e); }\n  },\n};\n`,
      language: 'typescript',
      linesOfCode: 8,
      isTest: false,
    };
  }

  protected generateRoutesFile(_task: TaskDocument, resourceName: string, _typeName: string, _requiresAuth: boolean): GeneratedFile {
    return {
      path: `src/server/routes/${resourceName}.routes.ts`,
      content: `import { Router } from 'express';\nimport { ${resourceName}Controller } from '../controllers/${resourceName}.controller';\n\nconst router = Router();\nrouter.get('/', ${resourceName}Controller.getAll);\nexport default router;\n`,
      language: 'typescript',
      linesOfCode: 6,
      isTest: false,
    };
  }

  protected generateServiceFile(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/services/${resourceName}.service.ts`,
      content: `export const ${resourceName}Service = {\n  findAll: async () => [],\n};\n`,
      language: 'typescript',
      linesOfCode: 3,
      isTest: false,
    };
  }

  protected generateValidationFile(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/validation/${resourceName}.validation.ts`,
      content: `import { z } from 'zod';\nexport const ${resourceName}Schema = { create: z.object({}) };\n`,
      language: 'typescript',
      linesOfCode: 2,
      isTest: false,
    };
  }

  protected generateModelFile(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile {
    return {
      path: `prisma/models/${resourceName}.prisma`,
      content: `model ${typeName} {\n  id String @id @default(uuid())\n}\n`,
      language: 'prisma',
      linesOfCode: 3,
      isTest: false,
    };
  }

  protected generateRepositoryFile(_task: TaskDocument, resourceName: string, _typeName: string): GeneratedFile {
    return {
      path: `src/server/repositories/${resourceName}.repository.ts`,
      content: `import { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();\nexport const ${resourceName}Repository = { findAll: async () => prisma.${resourceName}.findMany() };\n`,
      language: 'typescript',
      linesOfCode: 3,
      isTest: false,
    };
  }

  protected generateBackendTests(_task: TaskDocument, resourceName: string, typeName: string): GeneratedFile {
    return {
      path: `tests/server/${resourceName}.test.ts`,
      content: `describe('${typeName} Backend', () => {\n  it('works', () => { expect(true).toBe(true); });\n});\n`,
      language: 'typescript',
      linesOfCode: 3,
      isTest: true,
    };
  }

  protected generateComponentFile(_task: TaskDocument, componentName: string, _analysis: FullstackAnalysis): GeneratedFile {
    return {
      path: `src/client/components/${componentName}/${componentName}.tsx`,
      content: `import React from 'react';\n\nexport const ${componentName}: React.FC = () => {\n  return <div className="${this.toKebabCase(componentName)}">${componentName}</div>;\n};\n\nexport default ${componentName};\n`,
      language: 'typescript',
      linesOfCode: 7,
      isTest: false,
    };
  }

  protected generateStylesFile(_task: TaskDocument, componentName: string): GeneratedFile {
    return {
      path: `src/client/components/${componentName}/${componentName}.css`,
      content: `.${this.toKebabCase(componentName)} {\n  /* Styles */\n}\n`,
      language: 'css',
      linesOfCode: 3,
      isTest: false,
    };
  }

  protected generateComponentTypesFile(_task: TaskDocument, componentName: string): GeneratedFile {
    return {
      path: `src/client/components/${componentName}/${componentName}.types.ts`,
      content: `export interface ${componentName}Props {\n  className?: string;\n}\n`,
      language: 'typescript',
      linesOfCode: 3,
      isTest: false,
    };
  }

  protected generateHooksFile(_task: TaskDocument, componentName: string): GeneratedFile {
    return {
      path: `src/client/components/${componentName}/use${componentName}.ts`,
      content: `export function use${componentName}() {\n  // Hook logic\n  return {};\n}\n`,
      language: 'typescript',
      linesOfCode: 4,
      isTest: false,
    };
  }

  protected generateFrontendTests(_task: TaskDocument, componentName: string): GeneratedFile {
    return {
      path: `tests/components/${componentName}.test.tsx`,
      content: `import { render } from '@testing-library/react';\nimport { ${componentName} } from '../../src/client/components/${componentName}/${componentName}';\n\ndescribe('${componentName}', () => {\n  it('renders', () => { render(<${componentName} />); });\n});\n`,
      language: 'typescript',
      linesOfCode: 6,
      isTest: true,
    };
  }

  // ============================================================================
  // Documentation
  // ============================================================================

  protected generateFullstackDocumentation(task: TaskDocument, analysis: FullstackAnalysis): string {
    return `# ${task.title}\n\n${task.description}\n\n## Layers\n${analysis.layers.map((l) => `- ${l}`).join('\n')}\n\n## Complexity\n${analysis.complexity}\n`;
  }

  protected generateFrontendDocumentation(task: TaskDocument): string {
    return `# ${task.title} (Frontend)\n\n${task.description}\n`;
  }

  protected generateBackendDocumentation(task: TaskDocument): string {
    return `# ${task.title} (Backend)\n\n${task.description}\n`;
  }

  // ============================================================================
  // Dependencies
  // ============================================================================

  protected detectFullstackDependencies(
    _task: TaskDocument,
    analysis: FullstackAnalysis
  ): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    if (analysis.hasFrontend) {
      deps.push({ name: 'react', version: '^18.2.0', isDev: false });
      deps.push({ name: 'react-dom', version: '^18.2.0', isDev: false });
      deps.push({ name: '@tanstack/react-query', version: '^5.0.0', isDev: false });
    }

    if (analysis.hasBackend) {
      deps.push({ name: 'express', version: '^4.18.0', isDev: false });
      deps.push({ name: 'zod', version: '^3.22.0', isDev: false });
    }

    if (analysis.hasDatabase) {
      deps.push({ name: 'prisma', version: '^5.0.0', isDev: true });
      deps.push({ name: '@prisma/client', version: '^5.0.0', isDev: false });
    }

    deps.push({ name: 'axios', version: '^1.6.0', isDev: false });

    if (this.fullstackConfig.stateManagementLib === 'zustand') {
      deps.push({ name: 'zustand', version: '^4.4.0', isDev: false });
    } else if (this.fullstackConfig.stateManagementLib === 'redux') {
      deps.push({ name: '@reduxjs/toolkit', version: '^2.0.0', isDev: false });
      deps.push({ name: 'react-redux', version: '^9.0.0', isDev: false });
    }

    if (this.devConfig.generateTests) {
      deps.push({ name: '@testing-library/react', version: '^14.0.0', isDev: true });
      deps.push({ name: 'supertest', version: '^6.3.0', isDev: true });
    }

    return deps;
  }

  protected detectFrontendDependencies(_task: TaskDocument): { name: string; version: string; isDev: boolean }[] {
    return [
      { name: 'react', version: '^18.2.0', isDev: false },
      { name: 'react-dom', version: '^18.2.0', isDev: false },
    ];
  }

  protected detectBackendDependencies(_task: TaskDocument): { name: string; version: string; isDev: boolean }[] {
    return [
      { name: 'express', version: '^4.18.0', isDev: false },
      { name: 'zod', version: '^3.22.0', isDev: false },
    ];
  }

  // ============================================================================
  // Utilities (using imported functions)
  // ============================================================================

  protected toResourceName(title: string): string {
    return toResourceName(title);
  }

  protected toComponentName(title: string): string {
    return toComponentName(title);
  }

  protected toCamelCase(str: string): string {
    return toCamelCase(str);
  }

  protected toPascalCase(str: string): string {
    return toPascalCase(str);
  }

  protected toKebabCase(str: string): string {
    return toKebabCase(str);
  }

  protected updateFullstackStats(result: CodeGenerationResult): void {
    this.fullstackStats.featuresImplemented++;

    for (const file of result.files) {
      if (file.path.includes('/client/') || file.path.includes('/components/')) {
        this.fullstackStats.frontendFiles++;
        if (file.path.includes('components')) this.fullstackStats.components++;
      } else if (file.path.includes('/server/') || file.path.includes('/api/')) {
        this.fullstackStats.backendFiles++;
        if (file.path.includes('controller')) this.fullstackStats.apiEndpoints++;
      } else if (file.path.includes('/shared/')) {
        this.fullstackStats.sharedFiles++;
      }

      if (file.path.includes('.prisma') || file.path.includes('model')) {
        this.fullstackStats.models++;
      }
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getFullstackStats(): typeof this.fullstackStats {
    return { ...this.fullstackStats };
  }

  getFrontendConfig(): Partial<FrontendTeamConfig> {
    return { ...this.fullstackConfig.frontend };
  }

  getBackendConfig(): Partial<BackendTeamConfig> {
    return { ...this.fullstackConfig.backend };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a fullstack team
 */
export function createFullstackTeam(config: FullstackTeamConfig = DEFAULT_FULLSTACK_CONFIG): FullstackTeam {
  return new FullstackTeam(config);
}
