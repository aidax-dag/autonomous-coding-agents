/**
 * Tools API Service
 *
 * Service layer for Tools API operations - simplified for API usage
 */

import { createLogger, ILogger } from '../../core/services/logger.js';
import { ConflictException, ValidationException } from '../middleware/error.middleware.js';

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  version: string;
  enabled: boolean;
  parameters: ToolParameterInfo[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolParameterInfo {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  result: { success: boolean; data?: unknown; error?: string };
  duration: number;
  executedAt: Date;
}

export interface ToolStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastExecutedAt: Date | null;
}

export interface ListToolsOptions {
  category?: string;
  enabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListToolsResult {
  tools: ToolInfo[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Tools Service
 *
 * Provides API-friendly operations for tool management
 */
export class ToolsService {
  private readonly logger: ILogger;
  private readonly tools: Map<string, ToolInfo>;
  private readonly executionHistory: Map<string, ToolExecutionRecord[]>;
  private readonly toolStats: Map<string, ToolStats>;

  constructor() {
    this.logger = createLogger('ToolsService');
    this.tools = new Map();
    this.executionHistory = new Map();
    this.toolStats = new Map();
  }

  /**
   * List tools with filtering and pagination
   */
  async listTools(options: ListToolsOptions = {}): Promise<ListToolsResult> {
    const { category, enabled, search, page = 1, limit = 20 } = options;

    let tools = Array.from(this.tools.values());

    // Filter by category
    if (category) {
      tools = tools.filter((t) => t.category === category);
    }

    // Filter by enabled status
    if (enabled !== undefined) {
      tools = tools.filter((t) => t.enabled === enabled);
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
      );
    }

    const total = tools.length;
    const offset = (page - 1) * limit;
    const paginatedTools = tools.slice(offset, offset + limit);

    return {
      tools: paginatedTools,
      total,
      page,
      limit,
    };
  }

  /**
   * Get tool by name
   */
  async getTool(name: string): Promise<ToolInfo | null> {
    return this.tools.get(name) || null;
  }

  /**
   * Register a new tool
   */
  async registerTool(toolData: {
    name: string;
    description: string;
    category: string;
    version?: string;
    enabled?: boolean;
    parameters?: ToolParameterInfo[];
    handler?: string;
    metadata?: Record<string, unknown>;
    schema?: Record<string, unknown>;
  }): Promise<ToolInfo> {
    // Check for duplicate tool name
    if (this.tools.has(toolData.name)) {
      throw new ConflictException(`Tool with name '${toolData.name}' already exists`);
    }

    const now = new Date();

    // Extract parameters from schema if provided
    const parameters = toolData.parameters || this.extractParametersFromSchema(toolData.schema);

    const tool: ToolInfo = {
      name: toolData.name,
      description: toolData.description,
      category: toolData.category,
      version: toolData.version || '1.0.0',
      enabled: toolData.enabled !== false,
      parameters,
      metadata: toolData.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.tools.set(toolData.name, tool);

    // Initialize stats
    this.toolStats.set(toolData.name, {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      lastExecutedAt: null,
    });

    this.logger.info('Tool registered', { name: toolData.name, category: toolData.category });

    return tool;
  }

  /**
   * Update tool configuration
   */
  async updateTool(
    name: string,
    updates: Partial<{
      description: string;
      enabled: boolean;
      parameters: ToolParameterInfo[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<ToolInfo | null> {
    const tool = this.tools.get(name);
    if (!tool) {
      return null;
    }

    // Apply updates
    if (updates.description !== undefined) {
      tool.description = updates.description;
    }
    if (updates.enabled !== undefined) {
      tool.enabled = updates.enabled;
    }
    if (updates.parameters !== undefined) {
      tool.parameters = updates.parameters;
    }
    if (updates.metadata !== undefined) {
      tool.metadata = updates.metadata;
    }
    tool.updatedAt = new Date();

    this.logger.info('Tool updated', { name, updates });

    return tool;
  }

  /**
   * Unregister a tool
   */
  async unregisterTool(name: string): Promise<boolean> {
    if (!this.tools.has(name)) {
      return false;
    }

    this.tools.delete(name);
    this.executionHistory.delete(name);
    this.toolStats.delete(name);

    this.logger.info('Tool unregistered', { name });

    return true;
  }

  /**
   * Execute a tool
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>,
    options?: { dryRun?: boolean; validateParams?: boolean }
  ): Promise<{ success: boolean; data?: unknown; error?: string; duration: number }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: 'Tool not found', duration: 0 };
    }

    if (!tool.enabled) {
      return { success: false, error: 'Tool is disabled', duration: 0 };
    }

    // Validate parameters if tool has required parameters
    if (options?.validateParams !== false) {
      const validation = await this.validateParams(name, params);
      if (!validation.valid) {
        throw new ValidationException(
          validation.errors.map((e) => ({ field: e.field, message: e.message, code: 'required' }))
        );
      }
    }

    const startTime = Date.now();

    // Simulate tool execution
    const result = { success: true, data: { executed: true, params, dryRun: options?.dryRun } };

    const duration = Date.now() - startTime;

    // Record execution
    this.recordExecution(name, params, result, duration);

    return {
      success: true,
      data: result.data,
      duration,
    };
  }

  /**
   * Validate tool parameters
   */
  async validateParams(
    name: string,
    params: Record<string, unknown>
  ): Promise<{ valid: boolean; errors: Array<{ field: string; message: string }> }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, errors: [{ field: '_tool', message: 'Tool not found' }] };
    }

    const errors: Array<{ field: string; message: string }> = [];

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push({ field: param.name, message: `Required parameter '${param.name}' is missing` });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get tool execution history
   */
  async getExecutionHistory(
    name: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ records: ToolExecutionRecord[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const history = this.executionHistory.get(name) || [];

    const total = history.length;
    const offset = (page - 1) * limit;
    const records = history.slice(offset, offset + limit);

    return { records, total };
  }

  /**
   * Get tool statistics
   */
  async getToolStats(name: string): Promise<ToolStats | null> {
    return this.toolStats.get(name) || null;
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const categoryCounts = new Map<string, number>();

    for (const tool of this.tools.values()) {
      const count = categoryCounts.get(tool.category) || 0;
      categoryCounts.set(tool.category, count + 1);
    }

    return Array.from(categoryCounts.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  }

  /**
   * Batch execute tools
   */
  async batchExecute(
    executions: Array<{ tool: string; params: Record<string, unknown> }>
  ): Promise<Array<{ tool: string; result: { success: boolean; data?: unknown; error?: string } }>> {
    const results = await Promise.all(
      executions.map(async (exec) => ({
        tool: exec.tool,
        result: await this.executeTool(exec.tool, exec.params),
      }))
    );

    return results;
  }

  /**
   * Record tool execution
   */
  private recordExecution(
    toolName: string,
    params: Record<string, unknown>,
    result: { success: boolean; data?: unknown; error?: string },
    duration: number
  ): void {
    const record: ToolExecutionRecord = {
      id: crypto.randomUUID(),
      toolName,
      params,
      result,
      duration,
      executedAt: new Date(),
    };

    // Add to history
    if (!this.executionHistory.has(toolName)) {
      this.executionHistory.set(toolName, []);
    }
    const history = this.executionHistory.get(toolName)!;
    history.unshift(record);

    // Keep only last 100 records
    if (history.length > 100) {
      history.pop();
    }

    // Update stats
    const stats = this.toolStats.get(toolName);
    if (stats) {
      stats.totalExecutions++;
      if (result.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
      }
      stats.averageDuration =
        (stats.averageDuration * (stats.totalExecutions - 1) + duration) / stats.totalExecutions;
      stats.lastExecutedAt = new Date();
    }
  }

  /**
   * Extract parameters from JSON Schema
   */
  private extractParametersFromSchema(schema?: Record<string, unknown>): ToolParameterInfo[] {
    if (!schema) {
      return [];
    }

    const parameters: ToolParameterInfo[] = [];
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = (schema.required as string[]) || [];

    if (properties) {
      for (const [name, prop] of Object.entries(properties)) {
        parameters.push({
          name,
          type: (prop.type as string) || 'string',
          description: (prop.description as string) || '',
          required: required.includes(name),
          default: prop.default,
        });
      }
    }

    return parameters;
  }
}

/**
 * Create tools service instance
 */
export function createToolsService(): ToolsService {
  return new ToolsService();
}
