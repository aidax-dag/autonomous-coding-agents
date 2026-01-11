/**
 * Hooks API Service
 *
 * Service layer for Hooks API operations - simplified for API usage
 */

import { createLogger, ILogger } from '../../core/services/logger.js';

export interface HookInfo {
  id: string;
  name: string;
  type: string;
  event: string;
  priority: number;
  enabled: boolean;
  description?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface HookExecutionRecord {
  id: string;
  hookName: string;
  event: string;
  context: Record<string, unknown>;
  result: { success: boolean; data?: unknown; error?: string };
  duration: number;
  executedAt: Date;
}

export interface HookStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastExecutedAt: Date | null;
}

export interface ListHooksOptions {
  type?: string;
  event?: string;
  enabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListHooksResult {
  hooks: HookInfo[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Hooks Service
 *
 * Provides API-friendly operations for hook management
 */
export class HooksService {
  private readonly logger: ILogger;
  private readonly hooks: Map<string, HookInfo>;
  private readonly executionHistory: Map<string, HookExecutionRecord[]>;
  private readonly hookStats: Map<string, HookStats>;

  constructor() {
    this.logger = createLogger('HooksService');
    this.hooks = new Map();
    this.executionHistory = new Map();
    this.hookStats = new Map();
  }

  /**
   * List hooks with filtering and pagination
   */
  async listHooks(options: ListHooksOptions = {}): Promise<ListHooksResult> {
    const { type, event, enabled, search, page = 1, limit = 20 } = options;

    let hooks = Array.from(this.hooks.values());

    // Filter by type
    if (type) {
      hooks = hooks.filter((h) => h.type === type);
    }

    // Filter by event
    if (event) {
      hooks = hooks.filter((h) => h.event === event);
    }

    // Filter by enabled status
    if (enabled !== undefined) {
      hooks = hooks.filter((h) => h.enabled === enabled);
    }

    // Search by name
    if (search) {
      const searchLower = search.toLowerCase();
      hooks = hooks.filter((h) => h.name.toLowerCase().includes(searchLower));
    }

    const total = hooks.length;
    const offset = (page - 1) * limit;
    const paginatedHooks = hooks.slice(offset, offset + limit);

    return {
      hooks: paginatedHooks,
      total,
      page,
      limit,
    };
  }

  /**
   * Get hook by ID or name
   */
  async getHook(idOrName: string): Promise<HookInfo | null> {
    // Try to find by ID first
    for (const hook of this.hooks.values()) {
      if (hook.id === idOrName) {
        return hook;
      }
    }

    // Try to find by name
    const hook = this.hooks.get(idOrName);
    return hook || null;
  }

  /**
   * Register a new hook
   */
  async registerHook(hookData: {
    name: string;
    type: string;
    event: string;
    handler?: string;
    priority?: number;
    enabled?: boolean;
    description?: string;
    config?: Record<string, unknown>;
  }): Promise<HookInfo> {
    const now = new Date();
    const id = crypto.randomUUID();

    const hook: HookInfo = {
      id,
      name: hookData.name,
      type: hookData.type,
      event: hookData.event,
      priority: hookData.priority || 100,
      enabled: hookData.enabled !== false,
      description: hookData.description,
      config: hookData.config,
      createdAt: now,
      updatedAt: now,
    };

    this.hooks.set(hookData.name, hook);

    // Initialize stats
    this.hookStats.set(hookData.name, {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      lastExecutedAt: null,
    });

    this.logger.info('Hook registered', { id, name: hookData.name, event: hookData.event });

    return hook;
  }

  /**
   * Update hook configuration
   */
  async updateHook(
    idOrName: string,
    updates: Partial<{
      name: string;
      priority: number;
      enabled: boolean;
      description: string;
      config: Record<string, unknown>;
    }>
  ): Promise<HookInfo | null> {
    const existingHook = await this.getHook(idOrName);
    if (!existingHook) {
      return null;
    }

    const hook = this.hooks.get(existingHook.name);
    if (!hook) {
      return null;
    }

    // Apply updates
    if (updates.name !== undefined && updates.name !== hook.name) {
      // Update the map key if name changes
      this.hooks.delete(hook.name);
      hook.name = updates.name;
      this.hooks.set(hook.name, hook);
    }
    if (updates.priority !== undefined) {
      hook.priority = updates.priority;
    }
    if (updates.enabled !== undefined) {
      hook.enabled = updates.enabled;
    }
    if (updates.description !== undefined) {
      hook.description = updates.description;
    }
    if (updates.config !== undefined) {
      hook.config = updates.config;
    }
    hook.updatedAt = new Date();

    this.logger.info('Hook updated', { name: hook.name, updates });

    return hook;
  }

  /**
   * Unregister a hook
   */
  async unregisterHook(idOrName: string): Promise<boolean> {
    const hook = await this.getHook(idOrName);
    if (!hook) {
      return false;
    }

    this.hooks.delete(hook.name);
    this.executionHistory.delete(hook.name);
    this.hookStats.delete(hook.name);

    this.logger.info('Hook unregistered', { name: hook.name });

    return true;
  }

  /**
   * Enable a hook
   */
  async enableHook(idOrName: string): Promise<HookInfo | null> {
    return this.updateHook(idOrName, { enabled: true });
  }

  /**
   * Disable a hook
   */
  async disableHook(idOrName: string): Promise<HookInfo | null> {
    return this.updateHook(idOrName, { enabled: false });
  }

  /**
   * Test a hook with sample data
   */
  async testHook(
    idOrName: string,
    testData?: Record<string, unknown>
  ): Promise<{ success: boolean; result?: { success: boolean; data?: unknown }; error?: string; duration: number }> {
    const hook = await this.getHook(idOrName);
    if (!hook) {
      return { success: false, error: 'Hook not found', duration: 0 };
    }

    const startTime = Date.now();

    // Simulate hook execution
    const result = { success: true, data: { executed: true, testData } };

    const duration = Date.now() - startTime;

    // Record test execution
    this.recordExecution(hook.name, hook.event, testData || {}, result, duration);

    return {
      success: true,
      result,
      duration,
    };
  }

  /**
   * Get hook execution history
   */
  async getExecutionHistory(
    idOrName: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ records: HookExecutionRecord[]; total: number }> {
    const hook = await this.getHook(idOrName);
    if (!hook) {
      return { records: [], total: 0 };
    }

    const { page = 1, limit = 20 } = options;
    const history = this.executionHistory.get(hook.name) || [];

    const total = history.length;
    const offset = (page - 1) * limit;
    const records = history.slice(offset, offset + limit);

    return { records, total };
  }

  /**
   * Get hook statistics
   */
  async getHookStats(idOrName: string): Promise<HookStats | null> {
    const hook = await this.getHook(idOrName);
    if (!hook) {
      return null;
    }

    return this.hookStats.get(hook.name) || null;
  }

  /**
   * Record hook execution
   */
  private recordExecution(
    hookName: string,
    event: string,
    context: Record<string, unknown>,
    result: { success: boolean; data?: unknown; error?: string },
    duration: number
  ): void {
    const record: HookExecutionRecord = {
      id: crypto.randomUUID(),
      hookName,
      event,
      context,
      result,
      duration,
      executedAt: new Date(),
    };

    // Add to history
    if (!this.executionHistory.has(hookName)) {
      this.executionHistory.set(hookName, []);
    }
    const history = this.executionHistory.get(hookName)!;
    history.unshift(record);

    // Keep only last 100 records
    if (history.length > 100) {
      history.pop();
    }

    // Update stats
    const stats = this.hookStats.get(hookName);
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
}

/**
 * Create hooks service instance
 */
export function createHooksService(): HooksService {
  return new HooksService();
}
