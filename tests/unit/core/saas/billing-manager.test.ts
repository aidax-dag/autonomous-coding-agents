/**
 * BillingManager Unit Tests
 *
 * Feature: D-4 - SaaS Features
 */

import { BillingManager } from '../../../../src/core/saas/billing-manager';
import type { BillingInvoiceItem } from '../../../../src/core/saas/billing-manager';

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

describe('BillingManager', () => {
  let manager: BillingManager;

  beforeEach(() => {
    manager = new BillingManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==========================================================================
  // getPlans / getPlan
  // ==========================================================================

  describe('getPlans', () => {
    it('should return default plans', () => {
      const plans = manager.getPlans();

      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
    });

    it('should include correct pricing', () => {
      const plans = manager.getPlans();

      const free = plans.find((p) => p.id === 'free');
      const pro = plans.find((p) => p.id === 'pro');
      const enterprise = plans.find((p) => p.id === 'enterprise');

      expect(free!.priceMonthly).toBe(0);
      expect(pro!.priceMonthly).toBe(29);
      expect(enterprise!.priceMonthly).toBe(99);
    });
  });

  describe('getPlan', () => {
    it('should return plan by id', () => {
      const plan = manager.getPlan('pro');

      expect(plan).not.toBeNull();
      expect(plan!.id).toBe('pro');
      expect(plan!.name).toBe('Pro');
    });

    it('should return null for non-existent plan', () => {
      expect(manager.getPlan('nonexistent')).toBeNull();
    });
  });

  // ==========================================================================
  // createSubscription
  // ==========================================================================

  describe('createSubscription', () => {
    it('should create a subscription with active status for free plan', () => {
      const sub = manager.createSubscription('tenant-1', 'free');

      expect(sub).not.toBeNull();
      expect(sub!.tenantId).toBe('tenant-1');
      expect(sub!.planId).toBe('free');
      expect(sub!.status).toBe('active');
      expect(sub!.cancelAtPeriodEnd).toBe(false);
      expect(sub!.id).toMatch(/^sub_tenant-1_/);
    });

    it('should create a subscription with trialing status for paid plan', () => {
      const sub = manager.createSubscription('tenant-1', 'pro');

      expect(sub).not.toBeNull();
      expect(sub!.status).toBe('trialing');
    });

    it('should set period end one month from now', () => {
      const sub = manager.createSubscription('tenant-1', 'pro');
      const start = new Date(sub!.currentPeriodStart);
      const end = new Date(sub!.currentPeriodEnd);

      // End should be approximately one month after start
      const diffMs = end.getTime() - start.getTime();
      const daysDiff = diffMs / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThanOrEqual(28);
      expect(daysDiff).toBeLessThanOrEqual(31);
    });

    it('should return null for invalid plan', () => {
      expect(manager.createSubscription('tenant-1', 'nonexistent')).toBeNull();
    });

    it('should emit subscription:created event', () => {
      const listener = jest.fn();
      manager.on('subscription:created', listener);

      const sub = manager.createSubscription('tenant-1', 'pro');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(sub);
    });
  });

  // ==========================================================================
  // getSubscription
  // ==========================================================================

  describe('getSubscription', () => {
    it('should return subscription by tenant id', () => {
      manager.createSubscription('tenant-1', 'pro');
      const sub = manager.getSubscription('tenant-1');

      expect(sub).not.toBeNull();
      expect(sub!.tenantId).toBe('tenant-1');
    });

    it('should return null for non-existent subscription', () => {
      expect(manager.getSubscription('nonexistent')).toBeNull();
    });
  });

  // ==========================================================================
  // cancelSubscription
  // ==========================================================================

  describe('cancelSubscription', () => {
    it('should cancel an existing subscription', () => {
      manager.createSubscription('tenant-1', 'pro');
      const canceled = manager.cancelSubscription('tenant-1');

      expect(canceled).not.toBeNull();
      expect(canceled!.status).toBe('canceled');
      expect(canceled!.cancelAtPeriodEnd).toBe(true);
    });

    it('should return null for non-existent subscription', () => {
      expect(manager.cancelSubscription('nonexistent')).toBeNull();
    });

    it('should emit subscription:canceled event', () => {
      manager.createSubscription('tenant-1', 'pro');
      const listener = jest.fn();
      manager.on('subscription:canceled', listener);

      manager.cancelSubscription('tenant-1');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // createInvoice / payInvoice / getInvoices
  // ==========================================================================

  describe('createInvoice', () => {
    const items: BillingInvoiceItem[] = [
      { description: 'Pro Plan', quantity: 1, unitPrice: 29, amount: 29 },
      { description: 'Extra Tokens', quantity: 10, unitPrice: 1, amount: 10 },
    ];

    it('should create an invoice with correct total', () => {
      const invoice = manager.createInvoice('tenant-1', items);

      expect(invoice.tenantId).toBe('tenant-1');
      expect(invoice.amount).toBe(39); // 29 + 10
      expect(invoice.currency).toBe('USD');
      expect(invoice.status).toBe('open');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.id).toMatch(/^inv_tenant-1_/);
    });

    it('should emit invoice:created event', () => {
      const listener = jest.fn();
      manager.on('invoice:created', listener);

      const invoice = manager.createInvoice('tenant-1', items);

      expect(listener).toHaveBeenCalledWith(invoice);
    });
  });

  describe('payInvoice', () => {
    it('should pay an open invoice', () => {
      const invoice = manager.createInvoice('tenant-1', [
        { description: 'Pro Plan', quantity: 1, unitPrice: 29, amount: 29 },
      ]);

      const paid = manager.payInvoice(invoice.id);

      expect(paid).not.toBeNull();
      expect(paid!.status).toBe('paid');
      expect(paid!.paidAt).toBeDefined();
    });

    it('should return null for non-existent invoice', () => {
      expect(manager.payInvoice('inv_nonexistent')).toBeNull();
    });

    it('should return null for already paid invoice', () => {
      const invoice = manager.createInvoice('tenant-1', [
        { description: 'Pro Plan', quantity: 1, unitPrice: 29, amount: 29 },
      ]);

      manager.payInvoice(invoice.id);
      // Second pay attempt should fail
      expect(manager.payInvoice(invoice.id)).toBeNull();
    });

    it('should emit invoice:paid event', () => {
      const invoice = manager.createInvoice('tenant-1', [
        { description: 'Pro Plan', quantity: 1, unitPrice: 29, amount: 29 },
      ]);
      const listener = jest.fn();
      manager.on('invoice:paid', listener);

      manager.payInvoice(invoice.id);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getInvoices', () => {
    it('should return invoices for a specific tenant', () => {
      manager.createInvoice('tenant-1', [
        { description: 'Item 1', quantity: 1, unitPrice: 10, amount: 10 },
      ]);
      manager.createInvoice('tenant-1', [
        { description: 'Item 2', quantity: 1, unitPrice: 20, amount: 20 },
      ]);
      manager.createInvoice('tenant-2', [
        { description: 'Item 3', quantity: 1, unitPrice: 30, amount: 30 },
      ]);

      const invoices = manager.getInvoices('tenant-1');
      expect(invoices).toHaveLength(2);
      expect(invoices.every((i) => i.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty array for tenant with no invoices', () => {
      expect(manager.getInvoices('nonexistent')).toEqual([]);
    });
  });

  // ==========================================================================
  // getSubscriptionCount
  // ==========================================================================

  describe('getSubscriptionCount', () => {
    it('should return 0 when no subscriptions', () => {
      expect(manager.getSubscriptionCount()).toBe(0);
    });

    it('should return correct count', () => {
      manager.createSubscription('t1', 'free');
      manager.createSubscription('t2', 'pro');

      expect(manager.getSubscriptionCount()).toBe(2);
    });
  });

  // ==========================================================================
  // dispose
  // ==========================================================================

  describe('dispose', () => {
    it('should clear all data and listeners', () => {
      manager.createSubscription('t1', 'free');
      manager.createInvoice('t1', [
        { description: 'Item', quantity: 1, unitPrice: 10, amount: 10 },
      ]);

      manager.dispose();

      expect(manager.getPlans()).toEqual([]);
      expect(manager.getSubscriptionCount()).toBe(0);
      expect(manager.getInvoices('t1')).toEqual([]);
      expect(manager.listenerCount('subscription:created')).toBe(0);
    });
  });
});
