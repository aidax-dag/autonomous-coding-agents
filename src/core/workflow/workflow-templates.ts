/**
 * Workflow Templates
 *
 * Pre-defined workflow templates for common patterns.
 * Supports parameterization, inheritance, and customization.
 *
 * @module core/workflow/workflow-templates
 *
 * @example
 * ```typescript
 * import {
 *   WorkflowTemplateBuilder,
 *   WorkflowTemplateRegistry,
 *   createTemplateRegistry,
 *   builtInTemplates,
 * } from '@core/workflow/workflow-templates';
 *
 * // Create a template
 * const template = new WorkflowTemplateBuilder('code-review')
 *   .withName('Code Review Template')
 *   .withDescription('Standard code review workflow')
 *   .withParameter('repositoryUrl', 'string', true, 'Repository URL')
 *   .withParameter('reviewers', 'array', false, 'List of reviewers')
 *   .withStep('checkout', 'agent', { agentType: 'git', taskType: 'checkout' })
 *   .withStep('analyze', 'agent', { agentType: 'reviewer', taskType: 'analyze' })
 *   .build();
 *
 * // Register template
 * const registry = createTemplateRegistry();
 * registry.register(template);
 *
 * // Instantiate workflow from template
 * const workflow = registry.instantiate('code-review', {
 *   repositoryUrl: 'https://github.com/example/repo',
 *   reviewers: ['alice', 'bob'],
 * });
 * ```
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowBuilder,
  StepDefinition,
  WorkflowVariable,
  StepType,
  validateWorkflowDefinition,
} from './workflow-definition';
import { AgentType } from '../interfaces/agent.interface';

// ============================================================================
// Enums
// ============================================================================

/**
 * Template parameter types
 */
export enum TemplateParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
}

/**
 * Template category
 */
export enum TemplateCategory {
  GENERAL = 'general',
  CI_CD = 'ci-cd',
  CODE_REVIEW = 'code-review',
  DEPLOYMENT = 'deployment',
  TESTING = 'testing',
  DATA_PROCESSING = 'data-processing',
  CUSTOM = 'custom',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Template parameter schema
 */
export const TemplateParameterSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(TemplateParameterType),
  required: z.boolean().default(true),
  description: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      enum: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;

/**
 * Workflow template schema
 */
export const WorkflowTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.string().default('1.0.0'),
  category: z.nativeEnum(TemplateCategory).default(TemplateCategory.GENERAL),
  tags: z.array(z.string()).default([]),
  parameters: z.array(TemplateParameterSchema).default([]),
  steps: z.array(z.any()).default([]), // StepDefinition[]
  variables: z.array(z.any()).default([]), // WorkflowVariable[]
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowTemplateData = z.infer<typeof WorkflowTemplateSchema>;

/**
 * Template search criteria
 */
export interface TemplateSearchCriteria {
  name?: string;
  category?: TemplateCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Template search result
 */
export interface TemplateSearchResult {
  templates: WorkflowTemplate[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Template registry events
 */
export const TemplateRegistryEvents = {
  TEMPLATE_REGISTERED: 'template:registered',
  TEMPLATE_UPDATED: 'template:updated',
  TEMPLATE_UNREGISTERED: 'template:unregistered',
  WORKFLOW_INSTANTIATED: 'workflow:instantiated',
} as const;

export type TemplateRegistryEventType =
  (typeof TemplateRegistryEvents)[keyof typeof TemplateRegistryEvents];

// ============================================================================
// WorkflowTemplate Class
// ============================================================================

/**
 * Workflow Template
 *
 * A parameterized workflow definition that can be instantiated
 * with specific values to create concrete workflows.
 */
export class WorkflowTemplate {
  private data: WorkflowTemplateData;

  constructor(data: WorkflowTemplateData) {
    this.data = WorkflowTemplateSchema.parse(data);
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get description(): string {
    return this.data.description;
  }

  get version(): string {
    return this.data.version;
  }

  get category(): TemplateCategory {
    return this.data.category;
  }

  get tags(): string[] {
    return [...this.data.tags];
  }

  get parameters(): TemplateParameter[] {
    return [...this.data.parameters];
  }

  /**
   * Validate parameter values against the template
   */
  validateParameters(values: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const param of this.data.parameters) {
      const value = values[param.name];

      // Check required
      if (param.required && value === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (value === undefined) {
        continue;
      }

      // Check type
      if (!this.validateType(value, param.type)) {
        errors.push(
          `Invalid type for parameter ${param.name}: expected ${param.type}`
        );
        continue;
      }

      // Check validation rules
      if (param.validation) {
        const validationErrors = this.validateValue(
          value,
          param.validation,
          param.name
        );
        errors.push(...validationErrors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Instantiate a workflow from this template
   */
  instantiate(
    values: Record<string, unknown>,
    workflowId?: string
  ): WorkflowDefinition {
    // Validate parameters
    const validation = this.validateParameters(values);
    if (!validation.valid) {
      throw new Error(
        `Invalid template parameters: ${validation.errors.join(', ')}`
      );
    }

    // Merge with defaults
    const mergedValues = this.mergeWithDefaults(values);

    // Create workflow builder
    const builder = WorkflowBuilder.create(
      workflowId || `${this.data.id}-${Date.now()}`,
      `${this.data.name} Instance`
    ).description(this.data.description);

    // Add variables with resolved values
    for (const variable of this.data.variables) {
      const resolvedDefault = this.resolveValue(
        variable.defaultValue,
        mergedValues
      );
      builder.input({
        name: variable.name,
        type: variable.type as 'string' | 'number' | 'boolean' | 'object' | 'array',
        defaultValue: resolvedDefault,
        description: variable.description,
        required: variable.required ?? false,
      });
    }

    // Add steps with resolved values
    for (const step of this.data.steps) {
      const resolvedStep = this.resolveStep(step, mergedValues);
      builder.step(resolvedStep);
    }

    // Add metadata using annotations for template info
    const templateAnnotations: Record<string, string> = {
      templateId: this.data.id,
      templateVersion: this.data.version,
      instantiatedAt: new Date().toISOString(),
    };

    if (this.data.metadata) {
      const existingAnnotations = (this.data.metadata as Record<string, unknown>).annotations as Record<string, string> | undefined;
      builder.metadata({
        annotations: { ...existingAnnotations, ...templateAnnotations },
      });
    } else {
      builder.metadata({
        annotations: templateAnnotations,
      });
    }

    return builder.build();
  }

  /**
   * Get template data for serialization
   */
  toJSON(): WorkflowTemplateData {
    return { ...this.data };
  }

  // === Private Methods ===

  private validateType(value: unknown, type: TemplateParameterType): boolean {
    switch (type) {
      case TemplateParameterType.STRING:
        return typeof value === 'string';
      case TemplateParameterType.NUMBER:
        return typeof value === 'number';
      case TemplateParameterType.BOOLEAN:
        return typeof value === 'boolean';
      case TemplateParameterType.ARRAY:
        return Array.isArray(value);
      case TemplateParameterType.OBJECT:
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  private validateValue(
    value: unknown,
    validation: TemplateParameter['validation'],
    paramName: string
  ): string[] {
    const errors: string[] = [];

    if (!validation) return errors;

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push(`Parameter ${paramName} does not match pattern ${validation.pattern}`);
      }
    }

    if (validation.min !== undefined && typeof value === 'number') {
      if (value < validation.min) {
        errors.push(`Parameter ${paramName} must be >= ${validation.min}`);
      }
    }

    if (validation.max !== undefined && typeof value === 'number') {
      if (value > validation.max) {
        errors.push(`Parameter ${paramName} must be <= ${validation.max}`);
      }
    }

    if (validation.enum !== undefined) {
      if (!validation.enum.includes(value)) {
        errors.push(
          `Parameter ${paramName} must be one of: ${validation.enum.join(', ')}`
        );
      }
    }

    return errors;
  }

  private mergeWithDefaults(values: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const param of this.data.parameters) {
      if (values[param.name] !== undefined) {
        result[param.name] = values[param.name];
      } else if (param.defaultValue !== undefined) {
        result[param.name] = param.defaultValue;
      }
    }

    return result;
  }

  private resolveValue(value: unknown, params: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      // Replace {{paramName}} placeholders
      return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return String(params[key] ?? '');
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, params));
    }

    if (typeof value === 'object' && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.resolveValue(val, params);
      }
      return result;
    }

    return value;
  }

  private resolveStep(
    step: StepDefinition,
    params: Record<string, unknown>
  ): StepDefinition {
    return this.resolveValue(step, params) as StepDefinition;
  }
}

// ============================================================================
// WorkflowTemplateBuilder Class
// ============================================================================

/**
 * Fluent builder for creating WorkflowTemplates
 */
export class WorkflowTemplateBuilder {
  private data: Partial<WorkflowTemplateData>;
  private parameters: TemplateParameter[] = [];
  private steps: StepDefinition[] = [];
  private variables: WorkflowVariable[] = [];

  constructor(id: string) {
    this.data = {
      id,
      name: id,
      description: '',
      version: '1.0.0',
      category: TemplateCategory.GENERAL,
      tags: [],
      metadata: {},
    };
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  withVersion(version: string): this {
    this.data.version = version;
    return this;
  }

  withCategory(category: TemplateCategory): this {
    this.data.category = category;
    return this;
  }

  withTags(tags: string[]): this {
    this.data.tags = tags;
    return this;
  }

  withTag(tag: string): this {
    this.data.tags = [...(this.data.tags || []), tag];
    return this;
  }

  withParameter(
    name: string,
    type: TemplateParameterType,
    required: boolean = true,
    description?: string,
    defaultValue?: unknown,
    validation?: TemplateParameter['validation']
  ): this {
    this.parameters.push({
      name,
      type,
      required,
      description,
      defaultValue,
      validation,
    });
    return this;
  }

  withVariable(
    name: string,
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
    defaultValue?: unknown,
    description?: string
  ): this {
    this.variables.push({
      name,
      type,
      defaultValue,
      description,
      required: false,
    });
    return this;
  }

  withStep(
    id: string,
    type: StepType,
    config: Record<string, unknown>,
    options?: {
      name?: string;
      description?: string;
      dependsOn?: string[];
      timeout?: number;
    }
  ): this {
    this.steps.push({
      id,
      name: options?.name || id,
      type,
      config,
      description: options?.description,
      dependsOn: options?.dependsOn,
      timeout: options?.timeout,
    } as StepDefinition);
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  /**
   * Build the template
   */
  build(): WorkflowTemplate {
    return new WorkflowTemplate({
      ...this.data,
      parameters: this.parameters,
      steps: this.steps,
      variables: this.variables,
    } as WorkflowTemplateData);
  }

  /**
   * Create builder from existing template
   */
  static from(template: WorkflowTemplate): WorkflowTemplateBuilder {
    const data = template.toJSON();
    const builder = new WorkflowTemplateBuilder(data.id);
    builder.data = { ...data };
    builder.parameters = [...data.parameters];
    builder.steps = [...data.steps];
    builder.variables = [...data.variables];
    return builder;
  }
}

// ============================================================================
// WorkflowTemplateRegistry Class
// ============================================================================

/**
 * Registry for managing workflow templates
 */
export interface IWorkflowTemplateRegistry {
  // Registration
  register(template: WorkflowTemplate): void;
  update(template: WorkflowTemplate): void;
  unregister(id: string): boolean;

  // Retrieval
  get(id: string): WorkflowTemplate | null;
  getAll(): WorkflowTemplate[];
  has(id: string): boolean;
  count(): number;

  // Search
  search(criteria: TemplateSearchCriteria): TemplateSearchResult;
  findByCategory(category: TemplateCategory): WorkflowTemplate[];
  findByTag(tag: string): WorkflowTemplate[];

  // Instantiation
  instantiate(
    templateId: string,
    parameters: Record<string, unknown>,
    workflowId?: string
  ): WorkflowDefinition;

  // Events
  on(event: TemplateRegistryEventType, listener: (...args: unknown[]) => void): void;
  off(event: TemplateRegistryEventType, listener: (...args: unknown[]) => void): void;

  // Utilities
  clear(): void;
  export(): WorkflowTemplateData[];
  import(templates: WorkflowTemplateData[]): number;
}

/**
 * Workflow Template Registry implementation
 */
export class WorkflowTemplateRegistry
  extends EventEmitter
  implements IWorkflowTemplateRegistry
{
  private templates: Map<string, WorkflowTemplate> = new Map();
  private categoryIndex: Map<TemplateCategory, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  // === Registration ===

  register(template: WorkflowTemplate): void {
    const existing = this.templates.get(template.id);

    this.templates.set(template.id, template);
    this.updateIndices(template);

    if (existing) {
      this.emit(TemplateRegistryEvents.TEMPLATE_UPDATED, {
        template,
        timestamp: new Date(),
      });
    } else {
      this.emit(TemplateRegistryEvents.TEMPLATE_REGISTERED, {
        template,
        timestamp: new Date(),
      });
    }
  }

  update(template: WorkflowTemplate): void {
    if (!this.templates.has(template.id)) {
      throw new Error(`Template not found: ${template.id}`);
    }
    this.register(template);
  }

  unregister(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    this.removeFromIndices(id);
    this.templates.delete(id);

    this.emit(TemplateRegistryEvents.TEMPLATE_UNREGISTERED, {
      templateId: id,
      timestamp: new Date(),
    });

    return true;
  }

  // === Retrieval ===

  get(id: string): WorkflowTemplate | null {
    return this.templates.get(id) || null;
  }

  getAll(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  count(): number {
    return this.templates.size;
  }

  // === Search ===

  search(criteria: TemplateSearchCriteria): TemplateSearchResult {
    let results = Array.from(this.templates.values());

    // Filter by name
    if (criteria.name) {
      const lowerName = criteria.name.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerName) ||
          t.id.toLowerCase().includes(lowerName)
      );
    }

    // Filter by category
    if (criteria.category) {
      results = results.filter((t) => t.category === criteria.category);
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter((t) =>
        criteria.tags!.some((tag) => t.tags.includes(tag))
      );
    }

    // Apply pagination
    const total = results.length;
    const offset = criteria.offset || 0;
    const limit = criteria.limit || results.length;

    results = results.slice(offset, offset + limit);

    return {
      templates: results,
      total,
      hasMore: offset + results.length < total,
    };
  }

  findByCategory(category: TemplateCategory): WorkflowTemplate[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.templates.get(id))
      .filter((t): t is WorkflowTemplate => t !== undefined);
  }

  findByTag(tag: string): WorkflowTemplate[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.templates.get(id))
      .filter((t): t is WorkflowTemplate => t !== undefined);
  }

  // === Instantiation ===

  instantiate(
    templateId: string,
    parameters: Record<string, unknown>,
    workflowId?: string
  ): WorkflowDefinition {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const workflow = template.instantiate(parameters, workflowId);

    // Validate the generated workflow
    const validation = validateWorkflowDefinition(workflow);
    if (!validation.valid) {
      const errorMessages = validation.errors.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new Error(
        `Generated workflow is invalid: ${errorMessages.join(', ')}`
      );
    }

    this.emit(TemplateRegistryEvents.WORKFLOW_INSTANTIATED, {
      templateId,
      workflowId: workflow.id,
      parameters,
      timestamp: new Date(),
    });

    return workflow;
  }

  // === Utilities ===

  clear(): void {
    this.templates.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
  }

  export(): WorkflowTemplateData[] {
    return Array.from(this.templates.values()).map((t) => t.toJSON());
  }

  import(templates: WorkflowTemplateData[]): number {
    let imported = 0;
    for (const data of templates) {
      try {
        const template = new WorkflowTemplate(data);
        this.register(template);
        imported++;
      } catch {
        // Skip invalid templates
      }
    }
    return imported;
  }

  // === Private Methods ===

  private updateIndices(template: WorkflowTemplate): void {
    this.removeFromIndices(template.id);

    // Category index
    if (!this.categoryIndex.has(template.category)) {
      this.categoryIndex.set(template.category, new Set());
    }
    this.categoryIndex.get(template.category)!.add(template.id);

    // Tag index
    for (const tag of template.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(template.id);
    }
  }

  private removeFromIndices(id: string): void {
    for (const [, ids] of this.categoryIndex) {
      ids.delete(id);
    }
    for (const [, ids] of this.tagIndex) {
      ids.delete(id);
    }
  }
}

// ============================================================================
// Built-in Templates
// ============================================================================

/**
 * Sequential processing template
 */
export const sequentialTemplate = new WorkflowTemplateBuilder('sequential-pipeline')
  .withName('Sequential Pipeline')
  .withDescription('Execute steps in sequence, one after another')
  .withCategory(TemplateCategory.GENERAL)
  .withTags(['sequential', 'pipeline', 'basic'])
  .withParameter('stepCount', TemplateParameterType.NUMBER, false, 'Number of steps', 3, { min: 1, max: 10 })
  .withStep('step-1', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
  .withStep('step-2', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} }, { dependsOn: ['step-1'] })
  .withStep('step-3', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} }, { dependsOn: ['step-2'] })
  .build();

/**
 * Parallel processing template
 */
export const parallelTemplate = new WorkflowTemplateBuilder('parallel-pipeline')
  .withName('Parallel Pipeline')
  .withDescription('Execute multiple steps concurrently')
  .withCategory(TemplateCategory.GENERAL)
  .withTags(['parallel', 'concurrent', 'basic'])
  .withParameter('parallelism', TemplateParameterType.NUMBER, false, 'Maximum parallel tasks', 3, { min: 2, max: 10 })
  .withStep('parallel-group', StepType.PARALLEL, {
    steps: [
      { id: 'task-a', type: StepType.AGENT, name: 'Task A', config: { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} } },
      { id: 'task-b', type: StepType.AGENT, name: 'Task B', config: { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} } },
      { id: 'task-c', type: StepType.AGENT, name: 'Task C', config: { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} } },
    ],
    maxConcurrency: 3,
  })
  .build();

/**
 * Code review template
 */
export const codeReviewTemplate = new WorkflowTemplateBuilder('code-review')
  .withName('Code Review Workflow')
  .withDescription('Automated code review with analysis and feedback')
  .withCategory(TemplateCategory.CODE_REVIEW)
  .withTags(['code-review', 'analysis', 'quality'])
  .withParameter('repositoryUrl', TemplateParameterType.STRING, true, 'Repository URL')
  .withParameter('branch', TemplateParameterType.STRING, false, 'Branch to review', 'main')
  .withParameter('reviewScope', TemplateParameterType.STRING, false, 'Review scope', 'full', { enum: ['full', 'changed-only', 'critical'] })
  .withStep('checkout', StepType.AGENT, {
    agentType: AgentType.CUSTOM,
    taskType: 'checkout',
    payload: { url: '{{repositoryUrl}}', branch: '{{branch}}' },
  })
  .withStep('static-analysis', StepType.AGENT, {
    agentType: AgentType.REVIEWER,
    taskType: 'static-analysis',
    payload: { scope: '{{reviewScope}}' },
  }, { dependsOn: ['checkout'] })
  .withStep('security-scan', StepType.AGENT, {
    agentType: AgentType.SECURITY_AUDITOR,
    taskType: 'scan',
    payload: {},
  }, { dependsOn: ['checkout'] })
  .withStep('generate-report', StepType.AGENT, {
    agentType: AgentType.DOC_WRITER,
    taskType: 'generate',
    payload: {},
  }, { dependsOn: ['static-analysis', 'security-scan'] })
  .build();

/**
 * CI/CD pipeline template
 */
export const cicdPipelineTemplate = new WorkflowTemplateBuilder('cicd-pipeline')
  .withName('CI/CD Pipeline')
  .withDescription('Continuous integration and deployment pipeline')
  .withCategory(TemplateCategory.CI_CD)
  .withTags(['ci', 'cd', 'pipeline', 'deployment'])
  .withParameter('projectPath', TemplateParameterType.STRING, true, 'Project path')
  .withParameter('environment', TemplateParameterType.STRING, true, 'Target environment', undefined, { enum: ['development', 'staging', 'production'] })
  .withParameter('runTests', TemplateParameterType.BOOLEAN, false, 'Run tests', true)
  .withStep('build', StepType.AGENT, {
    agentType: AgentType.CODER,
    taskType: 'build',
    payload: { path: '{{projectPath}}' },
  })
  .withStep('test', StepType.CONDITION, {
    condition: { type: 'expression', expression: '{{runTests}} === true' },
    thenSteps: [{ id: 'run-tests', type: StepType.AGENT, name: 'Run Tests', config: { agentType: AgentType.TESTER, taskType: 'test', payload: {} } }],
    elseSteps: [{ id: 'skip-tests', type: StepType.WAIT, name: 'Skip Tests', config: { waitType: 'duration', duration: 0 } }],
  }, { dependsOn: ['build'] })
  .withStep('deploy', StepType.AGENT, {
    agentType: AgentType.CUSTOM,
    taskType: 'deploy',
    payload: { environment: '{{environment}}' },
  }, { dependsOn: ['test'] })
  .build();

/**
 * Approval workflow template
 */
export const approvalTemplate = new WorkflowTemplateBuilder('approval-workflow')
  .withName('Approval Workflow')
  .withDescription('Multi-stage approval process')
  .withCategory(TemplateCategory.GENERAL)
  .withTags(['approval', 'review', 'governance'])
  .withParameter('requestTitle', TemplateParameterType.STRING, true, 'Request title')
  .withParameter('approvers', TemplateParameterType.ARRAY, true, 'List of approvers')
  .withParameter('timeout', TemplateParameterType.NUMBER, false, 'Approval timeout in hours', 24, { min: 1, max: 168 })
  .withStep('submit', StepType.AGENT, {
    agentType: AgentType.CUSTOM,
    taskType: 'notify',
    payload: { message: 'New approval request: {{requestTitle}}', recipients: '{{approvers}}' },
  })
  .withStep('await-approval', StepType.APPROVAL, {
    approvers: ['{{approvers}}'],
    requiredApprovals: 1,
    timeout: '{{timeout}}',
  }, { dependsOn: ['submit'] })
  .withStep('process', StepType.AGENT, {
    agentType: AgentType.CUSTOM,
    taskType: 'process',
    payload: { title: '{{requestTitle}}' },
  }, { dependsOn: ['await-approval'] })
  .build();

/**
 * Built-in templates collection
 */
export const builtInTemplates: WorkflowTemplate[] = [
  sequentialTemplate,
  parallelTemplate,
  codeReviewTemplate,
  cicdPipelineTemplate,
  approvalTemplate,
];

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new workflow template registry
 */
export function createTemplateRegistry(
  includeBuiltIn: boolean = false
): WorkflowTemplateRegistry {
  const registry = new WorkflowTemplateRegistry();

  if (includeBuiltIn) {
    for (const template of builtInTemplates) {
      registry.register(template);
    }
  }

  return registry;
}

/**
 * Create a new workflow template builder
 */
export function createTemplateBuilder(id: string): WorkflowTemplateBuilder {
  return new WorkflowTemplateBuilder(id);
}
