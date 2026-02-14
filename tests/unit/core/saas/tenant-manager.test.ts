/**
 * TenantManager Unit Tests
 *
 * Feature: D-4 - SaaS Features
 */

import { TenantManager, getPlanLimits } from '../../../../src/core/saas/tenant-manager';
import type { PlanType } from '../../../../src/core/saas/tenant-manager';

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Tests
// ============================================================================

describe('TenantManager', () => {
  let manager: TenantManager;

  beforeEach(() => {
    manager = new TenantManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==========================================================================
  // createTenant
  // ==========================================================================

  describe('createTenant', () => {
    it('should create a free tenant by default', () => {
      const tenant = manager.createTenant('t1', 'Acme Corp');

      expect(tenant.id).toBe('t1');
      expect(tenant.name).toBe('Acme Corp');
      expect(tenant.plan).toBe('free');
      expect(tenant.isActive).toBe(true);
      expect(tenant.createdAt).toBeDefined();
      expect(tenant.usage.currentAgents).toBe(0);
      expect(tenant.usage.requestsToday).toBe(0);
    });

    it('should create a pro tenant', () => {
      const tenant = manager.createTenant('t1', 'Pro Corp', 'pro');

      expect(tenant.plan).toBe('pro');
      expect(tenant.limits.maxAgents).toBe(10);
      expect(tenant.limits.maxProjects).toBe(10);
    });

    it('should create an enterprise tenant', () => {
      const tenant = manager.createTenant('t1', 'Enterprise Corp', 'enterprise');

      expect(tenant.plan).toBe('enterprise');
      expect(tenant.limits.maxAgents).toBe(50);
      expect(tenant.limits.maxTokensPerMonth).toBe(100_000_000);
    });

    it('should throw when creating duplicate tenant', () => {
      manager.createTenant('t1', 'Acme Corp');
      expect(() => manager.createTenant('t1', 'Duplicate')).toThrow(
        "Tenant 't1' already exists",
      );
    });

    it('should emit tenant:created event', () => {
      const listener = jest.fn();
      manager.on('tenant:created', listener);

      const tenant = manager.createTenant('t1', 'Acme Corp');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(tenant);
    });
  });

  // ==========================================================================
  // getTenant / listTenants / getActiveTenants
  // ==========================================================================

  describe('getTenant', () => {
    it('should return tenant by id', () => {
      manager.createTenant('t1', 'Acme Corp');
      const tenant = manager.getTenant('t1');

      expect(tenant).not.toBeNull();
      expect(tenant!.id).toBe('t1');
    });

    it('should return null for non-existent tenant', () => {
      expect(manager.getTenant('nonexistent')).toBeNull();
    });
  });

  describe('listTenants', () => {
    it('should return empty array when no tenants', () => {
      expect(manager.listTenants()).toEqual([]);
    });

    it('should return all tenants', () => {
      manager.createTenant('t1', 'Tenant 1');
      manager.createTenant('t2', 'Tenant 2');

      const tenants = manager.listTenants();
      expect(tenants).toHaveLength(2);
    });
  });

  describe('getActiveTenants', () => {
    it('should return only active tenants', () => {
      manager.createTenant('t1', 'Tenant 1');
      manager.createTenant('t2', 'Tenant 2');
      manager.deactivateTenant('t1');

      const active = manager.getActiveTenants();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('t2');
    });
  });

  // ==========================================================================
  // upgradePlan
  // ==========================================================================

  describe('upgradePlan', () => {
    it('should upgrade from free to pro', () => {
      manager.createTenant('t1', 'Acme Corp');
      const updated = manager.upgradePlan('t1', 'pro');

      expect(updated).not.toBeNull();
      expect(updated!.plan).toBe('pro');
      expect(updated!.limits.maxAgents).toBe(10);
    });

    it('should upgrade from pro to enterprise', () => {
      manager.createTenant('t1', 'Acme Corp', 'pro');
      const updated = manager.upgradePlan('t1', 'enterprise');

      expect(updated!.plan).toBe('enterprise');
      expect(updated!.limits.features).toContain('sso');
    });

    it('should return null for non-existent tenant', () => {
      expect(manager.upgradePlan('nonexistent', 'pro')).toBeNull();
    });

    it('should emit tenant:plan-changed event', () => {
      manager.createTenant('t1', 'Acme Corp');
      const listener = jest.fn();
      manager.on('tenant:plan-changed', listener);

      manager.upgradePlan('t1', 'pro');

      expect(listener).toHaveBeenCalledWith({ id: 't1', from: 'free', to: 'pro' });
    });
  });

  // ==========================================================================
  // checkLimit
  // ==========================================================================

  describe('checkLimit', () => {
    it('should return allowed for maxAgents when under limit', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.checkLimit('t1', 'maxAgents');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(3); // free plan
    });

    it('should return not allowed for maxAgents at limit', () => {
      manager.createTenant('t1', 'Acme Corp');
      const tenant = manager.getTenant('t1')!;
      tenant.usage.currentAgents = 3;

      const result = manager.checkLimit('t1', 'maxAgents');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
    });

    it('should check maxProjects limit', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.checkLimit('t1', 'maxProjects');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(2); // free plan
    });

    it('should check maxRequestsPerDay limit', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.checkLimit('t1', 'maxRequestsPerDay');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100); // free plan
    });

    it('should check maxTokensPerMonth limit', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.checkLimit('t1', 'maxTokensPerMonth');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1_000_000); // free plan
    });

    it('should return not allowed for non-existent tenant', () => {
      const result = manager.checkLimit('nonexistent', 'maxAgents');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(0);
    });

    it('should return allowed for features key (non-numeric)', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.checkLimit('t1', 'features');

      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // recordUsage
  // ==========================================================================

  describe('recordUsage', () => {
    it('should increment requestsToday and tokensThisMonth', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.recordUsage('t1', 500);

      expect(result).toBe(true);
      const tenant = manager.getTenant('t1')!;
      expect(tenant.usage.requestsToday).toBe(1);
      expect(tenant.usage.tokensThisMonth).toBe(500);
    });

    it('should return false for non-existent tenant', () => {
      expect(manager.recordUsage('nonexistent', 100)).toBe(false);
    });

    it('should return false for inactive tenant', () => {
      manager.createTenant('t1', 'Acme Corp');
      manager.deactivateTenant('t1');

      expect(manager.recordUsage('t1', 100)).toBe(false);
    });

    it('should emit tenant:limit-reached when day limit exceeded', () => {
      manager.createTenant('t1', 'Acme Corp'); // free: 100 requests/day
      const listener = jest.fn();
      manager.on('tenant:limit-reached', listener);

      const tenant = manager.getTenant('t1')!;
      tenant.usage.requestsToday = 99; // one below limit

      manager.recordUsage('t1', 10); // now at 100 (not < 100)

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].id).toBe('t1');
    });

    it('should emit tenant:limit-reached when month limit exceeded', () => {
      manager.createTenant('t1', 'Acme Corp'); // free: 1M tokens/month
      const listener = jest.fn();
      manager.on('tenant:limit-reached', listener);

      const tenant = manager.getTenant('t1')!;
      tenant.usage.tokensThisMonth = 999_999;

      manager.recordUsage('t1', 5); // 1,000,004 >= 1,000,000

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // deactivateTenant
  // ==========================================================================

  describe('deactivateTenant', () => {
    it('should deactivate a tenant', () => {
      manager.createTenant('t1', 'Acme Corp');
      const result = manager.deactivateTenant('t1');

      expect(result).toBe(true);
      expect(manager.getTenant('t1')!.isActive).toBe(false);
    });

    it('should return false for non-existent tenant', () => {
      expect(manager.deactivateTenant('nonexistent')).toBe(false);
    });

    it('should emit tenant:deactivated event', () => {
      manager.createTenant('t1', 'Acme Corp');
      const listener = jest.fn();
      manager.on('tenant:deactivated', listener);

      manager.deactivateTenant('t1');

      expect(listener).toHaveBeenCalledWith('t1');
    });
  });

  // ==========================================================================
  // hasFeature
  // ==========================================================================

  describe('hasFeature', () => {
    it('should return true for included feature', () => {
      manager.createTenant('t1', 'Acme Corp');
      expect(manager.hasFeature('t1', 'basic-orchestration')).toBe(true);
    });

    it('should return false for non-included feature', () => {
      manager.createTenant('t1', 'Acme Corp'); // free plan
      expect(manager.hasFeature('t1', 'sso')).toBe(false);
    });

    it('should return false for non-existent tenant', () => {
      expect(manager.hasFeature('nonexistent', 'basic-orchestration')).toBe(false);
    });

    it('enterprise should have sso feature', () => {
      manager.createTenant('t1', 'Enterprise Corp', 'enterprise');
      expect(manager.hasFeature('t1', 'sso')).toBe(true);
      expect(manager.hasFeature('t1', 'audit-log')).toBe(true);
      expect(manager.hasFeature('t1', 'priority-support')).toBe(true);
    });

    it('pro should have plugins but not sso', () => {
      manager.createTenant('t1', 'Pro Corp', 'pro');
      expect(manager.hasFeature('t1', 'plugins')).toBe(true);
      expect(manager.hasFeature('t1', 'sso')).toBe(false);
    });
  });

  // ==========================================================================
  // resetDailyUsage / resetMonthlyUsage
  // ==========================================================================

  describe('resetDailyUsage', () => {
    it('should reset requestsToday to 0', () => {
      manager.createTenant('t1', 'Acme Corp');
      manager.recordUsage('t1', 100);
      manager.recordUsage('t1', 200);

      manager.resetDailyUsage('t1');

      const tenant = manager.getTenant('t1')!;
      expect(tenant.usage.requestsToday).toBe(0);
      expect(tenant.usage.tokensThisMonth).toBe(300); // should not reset monthly
    });

    it('should do nothing for non-existent tenant', () => {
      expect(() => manager.resetDailyUsage('nonexistent')).not.toThrow();
    });
  });

  describe('resetMonthlyUsage', () => {
    it('should reset tokensThisMonth to 0', () => {
      manager.createTenant('t1', 'Acme Corp');
      manager.recordUsage('t1', 1000);

      manager.resetMonthlyUsage('t1');

      const tenant = manager.getTenant('t1')!;
      expect(tenant.usage.tokensThisMonth).toBe(0);
      expect(tenant.usage.requestsToday).toBe(1); // should not reset daily
    });

    it('should do nothing for non-existent tenant', () => {
      expect(() => manager.resetMonthlyUsage('nonexistent')).not.toThrow();
    });
  });

  // ==========================================================================
  // plan limits differ per plan
  // ==========================================================================

  describe('plan limits', () => {
    it.each<[PlanType, number, number]>([
      ['free', 3, 2],
      ['pro', 10, 10],
      ['enterprise', 50, 100],
    ])('%s plan has maxAgents=%i maxProjects=%i', (plan, agents, projects) => {
      const limits = getPlanLimits(plan);
      expect(limits.maxAgents).toBe(agents);
      expect(limits.maxProjects).toBe(projects);
    });
  });

  // ==========================================================================
  // getTenantCount
  // ==========================================================================

  describe('getTenantCount', () => {
    it('should return 0 when empty', () => {
      expect(manager.getTenantCount()).toBe(0);
    });

    it('should return correct count', () => {
      manager.createTenant('t1', 'Tenant 1');
      manager.createTenant('t2', 'Tenant 2');
      expect(manager.getTenantCount()).toBe(2);
    });
  });

  // ==========================================================================
  // dispose
  // ==========================================================================

  describe('dispose', () => {
    it('should clear all tenants and listeners', () => {
      manager.createTenant('t1', 'Tenant 1');
      manager.createTenant('t2', 'Tenant 2');

      manager.dispose();

      expect(manager.getTenantCount()).toBe(0);
      expect(manager.listTenants()).toEqual([]);
      expect(manager.listenerCount('tenant:created')).toBe(0);
    });
  });
});
