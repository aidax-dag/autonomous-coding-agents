/**
 * Tenant Manager
 *
 * Multi-tenant management system with plan-based limits,
 * usage tracking, and feature gating.
 *
 * Feature: D-4 - SaaS Features
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('SaaS', 'tenant-manager');

/**
 * Plan types
 */
export type PlanType = 'free' | 'pro' | 'enterprise';

/**
 * Tenant configuration
 */
export interface TenantConfig {
  id: string;
  name: string;
  plan: PlanType;
  createdAt: string;
  isActive: boolean;
  limits: TenantLimits;
  usage: TenantUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Plan-based resource limits
 */
export interface TenantLimits {
  maxAgents: number;
  maxProjects: number;
  maxRequestsPerDay: number;
  maxTokensPerMonth: number;
  features: string[];
}

/**
 * Current usage tracking
 */
export interface TenantUsage {
  currentAgents: number;
  currentProjects: number;
  requestsToday: number;
  tokensThisMonth: number;
  lastResetAt: string;
}

/**
 * Default plan limits
 */
const PLAN_LIMITS: Record<PlanType, TenantLimits> = {
  free: {
    maxAgents: 3,
    maxProjects: 2,
    maxRequestsPerDay: 100,
    maxTokensPerMonth: 1_000_000,
    features: ['basic-orchestration', 'single-model'],
  },
  pro: {
    maxAgents: 10,
    maxProjects: 10,
    maxRequestsPerDay: 1000,
    maxTokensPerMonth: 10_000_000,
    features: [
      'basic-orchestration',
      'multi-model',
      'parallel-execution',
      'plugins',
      'analytics',
    ],
  },
  enterprise: {
    maxAgents: 50,
    maxProjects: 100,
    maxRequestsPerDay: 10000,
    maxTokensPerMonth: 100_000_000,
    features: [
      'basic-orchestration',
      'multi-model',
      'parallel-execution',
      'plugins',
      'analytics',
      'sso',
      'audit-log',
      'custom-models',
      'priority-support',
    ],
  },
};

/**
 * Tenant Manager events
 */
export interface TenantManagerEvents {
  'tenant:created': (tenant: TenantConfig) => void;
  'tenant:plan-changed': (info: { id: string; from: PlanType; to: PlanType }) => void;
  'tenant:limit-reached': (info: {
    id: string;
    dayLimit: { allowed: boolean; current: number; limit: number };
    monthLimit: { allowed: boolean; current: number; limit: number };
  }) => void;
  'tenant:deactivated': (id: string) => void;
}

/**
 * TenantManager
 *
 * Manages multi-tenant lifecycle including creation, plan management,
 * usage tracking, and feature gating.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TenantManager extends EventEmitter {
  private tenants: Map<string, TenantConfig> = new Map();

  /**
   * Create a new tenant with a plan
   * @throws Error if tenant already exists
   */
  createTenant(id: string, name: string, plan: PlanType = 'free'): TenantConfig {
    if (this.tenants.has(id)) {
      throw new Error(`Tenant '${id}' already exists`);
    }

    const tenant: TenantConfig = {
      id,
      name,
      plan,
      createdAt: new Date().toISOString(),
      isActive: true,
      limits: { ...PLAN_LIMITS[plan] },
      usage: {
        currentAgents: 0,
        currentProjects: 0,
        requestsToday: 0,
        tokensThisMonth: 0,
        lastResetAt: new Date().toISOString(),
      },
    };

    this.tenants.set(id, tenant);
    this.emit('tenant:created', tenant);
    logger.info(`Tenant created: ${id} (${plan})`);
    return tenant;
  }

  /**
   * Get a tenant by id
   */
  getTenant(id: string): TenantConfig | null {
    return this.tenants.get(id) ?? null;
  }

  /**
   * List all tenants
   */
  listTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  /**
   * Get only active tenants
   */
  getActiveTenants(): TenantConfig[] {
    return Array.from(this.tenants.values()).filter((t) => t.isActive);
  }

  /**
   * Upgrade or change a tenant's plan
   */
  upgradePlan(id: string, newPlan: PlanType): TenantConfig | null {
    const tenant = this.tenants.get(id);
    if (!tenant) return null;

    const oldPlan = tenant.plan;
    tenant.plan = newPlan;
    tenant.limits = { ...PLAN_LIMITS[newPlan] };

    this.emit('tenant:plan-changed', { id, from: oldPlan, to: newPlan });
    logger.info(`Tenant ${id} upgraded: ${oldPlan} -> ${newPlan}`);
    return tenant;
  }

  /**
   * Check if a resource limit allows further usage
   */
  checkLimit(
    id: string,
    resource: keyof TenantLimits,
  ): { allowed: boolean; current: number; limit: number } {
    const tenant = this.tenants.get(id);
    if (!tenant) return { allowed: false, current: 0, limit: 0 };

    const limit = tenant.limits[resource];
    let current = 0;

    switch (resource) {
      case 'maxAgents':
        current = tenant.usage.currentAgents;
        break;
      case 'maxProjects':
        current = tenant.usage.currentProjects;
        break;
      case 'maxRequestsPerDay':
        current = tenant.usage.requestsToday;
        break;
      case 'maxTokensPerMonth':
        current = tenant.usage.tokensThisMonth;
        break;
      default:
        return { allowed: true, current: 0, limit: limit as number };
    }

    return { allowed: current < (limit as number), current, limit: limit as number };
  }

  /**
   * Record usage (request + tokens) for a tenant.
   * Emits limit-reached event when limits are exceeded.
   * @returns false if tenant is inactive or not found
   */
  recordUsage(id: string, tokens: number): boolean {
    const tenant = this.tenants.get(id);
    if (!tenant || !tenant.isActive) return false;

    tenant.usage.requestsToday++;
    tenant.usage.tokensThisMonth += tokens;

    const dayLimit = this.checkLimit(id, 'maxRequestsPerDay');
    const monthLimit = this.checkLimit(id, 'maxTokensPerMonth');

    if (!dayLimit.allowed || !monthLimit.allowed) {
      this.emit('tenant:limit-reached', { id, dayLimit, monthLimit });
    }

    return true;
  }

  /**
   * Deactivate a tenant
   */
  deactivateTenant(id: string): boolean {
    const tenant = this.tenants.get(id);
    if (!tenant) return false;

    tenant.isActive = false;
    this.emit('tenant:deactivated', id);
    logger.info(`Tenant deactivated: ${id}`);
    return true;
  }

  /**
   * Check if a tenant has a specific feature
   */
  hasFeature(id: string, feature: string): boolean {
    const tenant = this.tenants.get(id);
    if (!tenant) return false;
    return tenant.limits.features.includes(feature);
  }

  /**
   * Reset daily usage counters
   */
  resetDailyUsage(id: string): void {
    const tenant = this.tenants.get(id);
    if (!tenant) return;
    tenant.usage.requestsToday = 0;
    tenant.usage.lastResetAt = new Date().toISOString();
  }

  /**
   * Reset monthly usage counters
   */
  resetMonthlyUsage(id: string): void {
    const tenant = this.tenants.get(id);
    if (!tenant) return;
    tenant.usage.tokensThisMonth = 0;
    tenant.usage.lastResetAt = new Date().toISOString();
  }

  /**
   * Get total tenant count
   */
  getTenantCount(): number {
    return this.tenants.size;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.tenants.clear();
    this.removeAllListeners();
  }
}

/**
 * Type-safe event emitter interface
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TenantManager {
  on<E extends keyof TenantManagerEvents>(event: E, listener: TenantManagerEvents[E]): this;
  emit<E extends keyof TenantManagerEvents>(
    event: E,
    ...args: Parameters<TenantManagerEvents[E]>
  ): boolean;
}

/**
 * Export plan limits for external use (e.g., UI display)
 */
export function getPlanLimits(plan: PlanType): TenantLimits {
  return { ...PLAN_LIMITS[plan] };
}
