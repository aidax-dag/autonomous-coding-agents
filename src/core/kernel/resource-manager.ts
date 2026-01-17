/**
 * Resource Manager
 *
 * Manages resource allocation, quotas, and cost tracking for the Agent OS kernel.
 *
 * Features:
 * - LLM token quota management
 * - Tool access control and rate limiting
 * - Cost tracking and budgeting
 * - Resource pooling and sharing
 *
 * Feature: Agent OS Kernel
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Resource types managed by the kernel
 */
export enum ResourceType {
  LLM_TOKENS = 'llm_tokens',
  TOOL_CALLS = 'tool_calls',
  MEMORY = 'memory',
  CPU_TIME = 'cpu_time',
  NETWORK = 'network',
  STORAGE = 'storage',
}

/**
 * Resource allocation status
 */
export enum AllocationStatus {
  PENDING = 'pending',
  ALLOCATED = 'allocated',
  DENIED = 'denied',
  RELEASED = 'released',
  EXPIRED = 'expired',
}

/**
 * Resource quota configuration
 */
export interface ResourceQuota {
  type: ResourceType;
  limit: number;
  used: number;
  reserved: number;
  resetPeriodMs?: number;
  lastResetAt?: Date;
  costPerUnit?: number;
}

/**
 * Resource allocation request
 */
export interface AllocationRequest {
  requestId: string;
  taskId: string;
  resourceType: ResourceType;
  amount: number;
  priority: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Resource allocation result
 */
export interface AllocationResult {
  requestId: string;
  status: AllocationStatus;
  allocatedAmount: number;
  remainingQuota: number;
  estimatedCost: number;
  expiresAt?: Date;
  error?: string;
}

/**
 * Resource usage record
 */
export interface ResourceUsage {
  taskId: string;
  resourceType: ResourceType;
  allocated: number;
  used: number;
  cost: number;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Resource pool configuration
 */
export interface ResourcePool {
  id: string;
  name: string;
  quotas: Map<ResourceType, ResourceQuota>;
  members: Set<string>;
  sharedAccess: boolean;
  priorityBoost: number;
}

/**
 * Resource manager configuration
 */
export interface ResourceManagerConfig {
  defaultQuotas: Partial<Record<ResourceType, number>>;
  costRates: Partial<Record<ResourceType, number>>;
  maxPendingRequests: number;
  allocationTimeoutMs: number;
  quotaResetPeriodMs: number;
  enableCostTracking: boolean;
  enablePooling: boolean;
  overcommitRatio: number;
}

/**
 * Resource manager events
 */
export interface ResourceManagerEvents {
  'resource:allocated': AllocationResult;
  'resource:released': { taskId: string; resourceType: ResourceType; amount: number };
  'resource:denied': AllocationResult;
  'resource:quota_exceeded': { resourceType: ResourceType; requested: number; available: number };
  'resource:cost_warning': { totalCost: number; budgetRemaining: number };
  'pool:created': ResourcePool;
  'pool:updated': ResourcePool;
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const ResourceManagerConfigSchema = z.object({
  defaultQuotas: z.record(z.number()).optional().default({}),
  costRates: z.record(z.number()).optional().default({}),
  maxPendingRequests: z.number().min(1).default(100),
  allocationTimeoutMs: z.number().min(100).default(30000),
  quotaResetPeriodMs: z.number().min(1000).default(3600000), // 1 hour
  enableCostTracking: z.boolean().default(true),
  enablePooling: z.boolean().default(true),
  overcommitRatio: z.number().min(1).max(2).default(1.2),
});

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_RESOURCE_MANAGER_CONFIG: ResourceManagerConfig = {
  defaultQuotas: {
    [ResourceType.LLM_TOKENS]: 1000000, // 1M tokens
    [ResourceType.TOOL_CALLS]: 10000, // 10K calls
    [ResourceType.MEMORY]: 1073741824, // 1GB
    [ResourceType.CPU_TIME]: 3600000, // 1 hour in ms
    [ResourceType.NETWORK]: 104857600, // 100MB
    [ResourceType.STORAGE]: 10737418240, // 10GB
  },
  costRates: {
    [ResourceType.LLM_TOKENS]: 0.00001, // $0.01 per 1K tokens
    [ResourceType.TOOL_CALLS]: 0.001, // $0.001 per call
    [ResourceType.MEMORY]: 0.0000001, // $0.0001 per MB
    [ResourceType.CPU_TIME]: 0.00001, // $0.01 per minute
    [ResourceType.NETWORK]: 0.00001, // $0.01 per MB
    [ResourceType.STORAGE]: 0.000001, // $0.001 per MB
  },
  maxPendingRequests: 100,
  allocationTimeoutMs: 30000,
  quotaResetPeriodMs: 3600000,
  enableCostTracking: true,
  enablePooling: true,
  overcommitRatio: 1.2,
};

// ============================================================================
// Resource Manager Implementation
// ============================================================================

/**
 * Resource Manager
 *
 * Manages resource allocation, quotas, and cost tracking for the Agent OS.
 */
export class ResourceManager extends EventEmitter {
  private config: ResourceManagerConfig;
  private quotas: Map<ResourceType, ResourceQuota>;
  private allocations: Map<string, AllocationResult>;
  private usage: Map<string, ResourceUsage[]>;
  private pools: Map<string, ResourcePool>;
  private pendingRequests: AllocationRequest[];
  private totalCost: number;
  private budget: number;

  constructor(config: Partial<ResourceManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RESOURCE_MANAGER_CONFIG, ...config };
    this.quotas = new Map();
    this.allocations = new Map();
    this.usage = new Map();
    this.pools = new Map();
    this.pendingRequests = [];
    this.totalCost = 0;
    this.budget = Infinity;

    this.initializeQuotas();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize default quotas
   */
  private initializeQuotas(): void {
    for (const [type, limit] of Object.entries(this.config.defaultQuotas)) {
      const resourceType = type as ResourceType;
      this.quotas.set(resourceType, {
        type: resourceType,
        limit: limit as number,
        used: 0,
        reserved: 0,
        resetPeriodMs: this.config.quotaResetPeriodMs,
        lastResetAt: new Date(),
        costPerUnit: this.config.costRates[resourceType] ?? 0,
      });
    }
  }

  // ==========================================================================
  // Resource Allocation
  // ==========================================================================

  /**
   * Request resource allocation
   */
  allocate(request: AllocationRequest): AllocationResult {
    const quota = this.quotas.get(request.resourceType);

    if (!quota) {
      return this.createDeniedResult(request, 'Unknown resource type');
    }

    // Check quota reset
    this.checkQuotaReset(quota);

    // Calculate available resources (with overcommit)
    const maxAvailable = quota.limit * this.config.overcommitRatio;
    const available = maxAvailable - quota.used - quota.reserved;

    // Check if request can be fulfilled
    if (request.amount > available) {
      const result = this.createDeniedResult(
        request,
        `Insufficient quota: requested ${request.amount}, available ${available}`
      );

      this.emit('resource:quota_exceeded', {
        resourceType: request.resourceType,
        requested: request.amount,
        available,
      });

      // Add to pending if within limits
      if (this.pendingRequests.length < this.config.maxPendingRequests) {
        this.pendingRequests.push(request);
      }

      return result;
    }

    // Calculate cost
    const estimatedCost = this.config.enableCostTracking
      ? request.amount * (quota.costPerUnit ?? 0)
      : 0;

    // Check budget
    if (this.totalCost + estimatedCost > this.budget) {
      return this.createDeniedResult(request, 'Budget exceeded');
    }

    // Allocate resources
    quota.reserved += request.amount;

    const result: AllocationResult = {
      requestId: request.requestId,
      status: AllocationStatus.ALLOCATED,
      allocatedAmount: request.amount,
      remainingQuota: available - request.amount,
      estimatedCost,
      expiresAt: request.timeout
        ? new Date(Date.now() + request.timeout)
        : undefined,
    };

    this.allocations.set(request.requestId, result);

    // Track usage
    this.trackUsage(request, result);

    this.emit('resource:allocated', result);

    return result;
  }

  /**
   * Commit allocated resources (mark as used)
   */
  commit(requestId: string, actualAmount?: number): boolean {
    const allocation = this.allocations.get(requestId);
    if (!allocation || allocation.status !== AllocationStatus.ALLOCATED) {
      return false;
    }

    const usage = this.findUsage(requestId);
    if (!usage) {
      return false;
    }

    const quota = this.quotas.get(usage.resourceType);
    if (!quota) {
      return false;
    }

    const amount = actualAmount ?? allocation.allocatedAmount;

    // Move from reserved to used
    quota.reserved -= allocation.allocatedAmount;
    quota.used += amount;

    // Update usage
    usage.used = amount;
    usage.cost = amount * (quota.costPerUnit ?? 0);
    usage.completedAt = new Date();

    // Update total cost
    if (this.config.enableCostTracking) {
      this.totalCost += usage.cost;
      this.checkCostWarning();
    }

    return true;
  }

  /**
   * Release allocated resources
   */
  release(requestId: string): boolean {
    const allocation = this.allocations.get(requestId);
    if (!allocation) {
      return false;
    }

    const usage = this.findUsage(requestId);
    if (!usage) {
      return false;
    }

    const quota = this.quotas.get(usage.resourceType);
    if (!quota) {
      return false;
    }

    // Release reserved resources
    if (allocation.status === AllocationStatus.ALLOCATED) {
      quota.reserved -= allocation.allocatedAmount;
    }

    allocation.status = AllocationStatus.RELEASED;

    this.emit('resource:released', {
      taskId: usage.taskId,
      resourceType: usage.resourceType,
      amount: allocation.allocatedAmount,
    });

    // Process pending requests
    this.processPendingRequests(usage.resourceType);

    return true;
  }

  /**
   * Get allocation status
   */
  getAllocation(requestId: string): AllocationResult | undefined {
    return this.allocations.get(requestId);
  }

  // ==========================================================================
  // Quota Management
  // ==========================================================================

  /**
   * Set quota for a resource type
   */
  setQuota(type: ResourceType, limit: number): void {
    const existing = this.quotas.get(type);
    if (existing) {
      existing.limit = limit;
    } else {
      this.quotas.set(type, {
        type,
        limit,
        used: 0,
        reserved: 0,
        resetPeriodMs: this.config.quotaResetPeriodMs,
        lastResetAt: new Date(),
        costPerUnit: this.config.costRates[type] ?? 0,
      });
    }
  }

  /**
   * Get quota for a resource type
   */
  getQuota(type: ResourceType): ResourceQuota | undefined {
    const quota = this.quotas.get(type);
    if (quota) {
      this.checkQuotaReset(quota);
    }
    return quota;
  }

  /**
   * Get all quotas
   */
  getAllQuotas(): ResourceQuota[] {
    for (const quota of this.quotas.values()) {
      this.checkQuotaReset(quota);
    }
    return Array.from(this.quotas.values());
  }

  /**
   * Reset quota usage
   */
  resetQuota(type: ResourceType): void {
    const quota = this.quotas.get(type);
    if (quota) {
      quota.used = 0;
      quota.lastResetAt = new Date();
    }
  }

  /**
   * Check and perform quota reset if needed
   */
  private checkQuotaReset(quota: ResourceQuota): void {
    if (!quota.resetPeriodMs || !quota.lastResetAt) {
      return;
    }

    const elapsed = Date.now() - quota.lastResetAt.getTime();
    if (elapsed >= quota.resetPeriodMs) {
      quota.used = 0;
      quota.lastResetAt = new Date();
    }
  }

  // ==========================================================================
  // Cost Management
  // ==========================================================================

  /**
   * Set budget limit
   */
  setBudget(amount: number): void {
    this.budget = amount;
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): { totalCost: number; budget: number; remaining: number } {
    return {
      totalCost: this.totalCost,
      budget: this.budget,
      remaining: this.budget - this.totalCost,
    };
  }

  /**
   * Get cost breakdown by resource type
   */
  getCostBreakdown(): Map<ResourceType, number> {
    const breakdown = new Map<ResourceType, number>();

    for (const usages of this.usage.values()) {
      for (const usage of usages) {
        const current = breakdown.get(usage.resourceType) ?? 0;
        breakdown.set(usage.resourceType, current + usage.cost);
      }
    }

    return breakdown;
  }

  /**
   * Check and emit cost warning
   */
  private checkCostWarning(): void {
    const remaining = this.budget - this.totalCost;
    const warningThreshold = this.budget * 0.1; // 10% remaining

    if (remaining > 0 && remaining < warningThreshold) {
      this.emit('resource:cost_warning', {
        totalCost: this.totalCost,
        budgetRemaining: remaining,
      });
    }
  }

  // ==========================================================================
  // Resource Pooling
  // ==========================================================================

  /**
   * Create a resource pool
   */
  createPool(
    id: string,
    name: string,
    quotas: Partial<Record<ResourceType, number>>,
    options: { sharedAccess?: boolean; priorityBoost?: number } = {}
  ): ResourcePool {
    const poolQuotas = new Map<ResourceType, ResourceQuota>();

    for (const [type, limit] of Object.entries(quotas)) {
      const resourceType = type as ResourceType;
      poolQuotas.set(resourceType, {
        type: resourceType,
        limit: limit as number,
        used: 0,
        reserved: 0,
        costPerUnit: this.config.costRates[resourceType] ?? 0,
      });
    }

    const pool: ResourcePool = {
      id,
      name,
      quotas: poolQuotas,
      members: new Set(),
      sharedAccess: options.sharedAccess ?? true,
      priorityBoost: options.priorityBoost ?? 0,
    };

    this.pools.set(id, pool);
    this.emit('pool:created', pool);

    return pool;
  }

  /**
   * Add member to pool
   */
  addPoolMember(poolId: string, taskId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    pool.members.add(taskId);
    this.emit('pool:updated', pool);
    return true;
  }

  /**
   * Remove member from pool
   */
  removePoolMember(poolId: string, taskId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    pool.members.delete(taskId);
    this.emit('pool:updated', pool);
    return true;
  }

  /**
   * Allocate from pool
   */
  allocateFromPool(poolId: string, request: AllocationRequest): AllocationResult {
    const pool = this.pools.get(poolId);

    if (!pool) {
      return this.createDeniedResult(request, 'Pool not found');
    }

    if (!pool.sharedAccess && !pool.members.has(request.taskId)) {
      return this.createDeniedResult(request, 'Not a pool member');
    }

    const quota = pool.quotas.get(request.resourceType);
    if (!quota) {
      return this.createDeniedResult(request, 'Resource not available in pool');
    }

    const available = quota.limit - quota.used - quota.reserved;
    if (request.amount > available) {
      return this.createDeniedResult(
        request,
        `Insufficient pool quota: requested ${request.amount}, available ${available}`
      );
    }

    // Allocate from pool
    quota.reserved += request.amount;

    const result: AllocationResult = {
      requestId: request.requestId,
      status: AllocationStatus.ALLOCATED,
      allocatedAmount: request.amount,
      remainingQuota: available - request.amount,
      estimatedCost: request.amount * (quota.costPerUnit ?? 0),
    };

    this.allocations.set(request.requestId, result);
    this.trackUsage(request, result);
    this.emit('resource:allocated', result);

    return result;
  }

  /**
   * Get pool
   */
  getPool(poolId: string): ResourcePool | undefined {
    return this.pools.get(poolId);
  }

  /**
   * Get all pools
   */
  getAllPools(): ResourcePool[] {
    return Array.from(this.pools.values());
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  /**
   * Track resource usage
   */
  private trackUsage(request: AllocationRequest, result: AllocationResult): void {
    const usages = this.usage.get(request.taskId) ?? [];

    usages.push({
      taskId: request.taskId,
      resourceType: request.resourceType,
      allocated: result.allocatedAmount,
      used: 0,
      cost: 0,
      startedAt: new Date(),
    });

    this.usage.set(request.taskId, usages);
  }

  /**
   * Find usage by request ID
   */
  private findUsage(requestId: string): ResourceUsage | undefined {
    const allocation = this.allocations.get(requestId);
    if (!allocation) {
      return undefined;
    }

    for (const usages of this.usage.values()) {
      for (const usage of usages) {
        if (usage.allocated === allocation.allocatedAmount && !usage.completedAt) {
          return usage;
        }
      }
    }

    return undefined;
  }

  /**
   * Get usage for a task
   */
  getTaskUsage(taskId: string): ResourceUsage[] {
    return this.usage.get(taskId) ?? [];
  }

  /**
   * Get total usage summary
   */
  getUsageSummary(): {
    byType: Map<ResourceType, { allocated: number; used: number; cost: number }>;
    totalAllocated: number;
    totalUsed: number;
    totalCost: number;
  } {
    const byType = new Map<ResourceType, { allocated: number; used: number; cost: number }>();
    let totalAllocated = 0;
    let totalUsed = 0;
    let totalCost = 0;

    for (const usages of this.usage.values()) {
      for (const usage of usages) {
        const existing = byType.get(usage.resourceType) ?? {
          allocated: 0,
          used: 0,
          cost: 0,
        };

        existing.allocated += usage.allocated;
        existing.used += usage.used;
        existing.cost += usage.cost;

        byType.set(usage.resourceType, existing);

        totalAllocated += usage.allocated;
        totalUsed += usage.used;
        totalCost += usage.cost;
      }
    }

    return { byType, totalAllocated, totalUsed, totalCost };
  }

  // ==========================================================================
  // Pending Request Processing
  // ==========================================================================

  /**
   * Process pending requests for a resource type
   */
  private processPendingRequests(type: ResourceType): void {
    // Sort by priority (higher first)
    this.pendingRequests.sort((a, b) => b.priority - a.priority);

    const processed: number[] = [];

    for (let i = 0; i < this.pendingRequests.length; i++) {
      const request = this.pendingRequests[i];
      if (request.resourceType !== type) {
        continue;
      }

      // Try to allocate
      const result = this.allocate(request);
      if (result.status === AllocationStatus.ALLOCATED) {
        processed.push(i);
      }
    }

    // Remove processed requests (in reverse order to maintain indices)
    for (let i = processed.length - 1; i >= 0; i--) {
      this.pendingRequests.splice(processed[i], 1);
    }
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): AllocationRequest[] {
    return [...this.pendingRequests];
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Create denied allocation result
   */
  private createDeniedResult(request: AllocationRequest, error: string): AllocationResult {
    const result: AllocationResult = {
      requestId: request.requestId,
      status: AllocationStatus.DENIED,
      allocatedAmount: 0,
      remainingQuota: 0,
      estimatedCost: 0,
      error,
    };

    this.emit('resource:denied', result);
    return result;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    quotas: number;
    allocations: number;
    pendingRequests: number;
    pools: number;
    totalCost: number;
    budget: number;
  } {
    return {
      quotas: this.quotas.size,
      allocations: this.allocations.size,
      pendingRequests: this.pendingRequests.length,
      pools: this.pools.size,
      totalCost: this.totalCost,
      budget: this.budget,
    };
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.allocations.clear();
    this.usage.clear();
    this.pools.clear();
    this.pendingRequests = [];
    this.totalCost = 0;
    this.initializeQuotas();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a resource manager instance
 */
export function createResourceManager(
  config: Partial<ResourceManagerConfig> = {}
): ResourceManager {
  return new ResourceManager(config);
}
