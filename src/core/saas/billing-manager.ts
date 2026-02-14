/**
 * Billing Manager
 *
 * Billing management with Stripe-compatible interfaces.
 * Handles plans, subscriptions, and invoices.
 *
 * Feature: D-4 - SaaS Features
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('SaaS', 'billing-manager');

/**
 * Billing plan definition
 */
export interface BillingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceCurrency: string;
  features: string[];
}

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

/**
 * Billing subscription
 */
export interface BillingSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/**
 * Invoice status
 */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

/**
 * Billing invoice
 */
export interface BillingInvoice {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  createdAt: string;
  paidAt?: string;
  items: BillingInvoiceItem[];
}

/**
 * Invoice line item
 */
export interface BillingInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Billing Manager events
 */
export interface BillingManagerEvents {
  'subscription:created': (subscription: BillingSubscription) => void;
  'subscription:canceled': (subscription: BillingSubscription) => void;
  'invoice:created': (invoice: BillingInvoice) => void;
  'invoice:paid': (invoice: BillingInvoice) => void;
}

/**
 * Default billing plans
 */
const DEFAULT_PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceCurrency: 'USD',
    features: ['basic-orchestration'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceCurrency: 'USD',
    features: ['multi-model', 'parallel-execution', 'plugins'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 99,
    priceCurrency: 'USD',
    features: ['all-features', 'sso', 'priority-support'],
  },
];

/**
 * BillingManager
 *
 * Manages billing plans, subscriptions, and invoices with
 * Stripe-compatible data structures for future integration.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class BillingManager extends EventEmitter {
  private plans: Map<string, BillingPlan> = new Map();
  private subscriptions: Map<string, BillingSubscription> = new Map();
  private invoices: BillingInvoice[] = [];

  constructor() {
    super();
    for (const plan of DEFAULT_PLANS) {
      this.plans.set(plan.id, plan);
    }
  }

  /**
   * Get all available plans
   */
  getPlans(): BillingPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Get a plan by id
   */
  getPlan(id: string): BillingPlan | null {
    return this.plans.get(id) ?? null;
  }

  /**
   * Create a subscription for a tenant.
   * Free plans start as active, paid plans start as trialing.
   * @returns null if plan does not exist
   */
  createSubscription(tenantId: string, planId: string): BillingSubscription | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription: BillingSubscription = {
      id: `sub_${tenantId}_${Date.now()}`,
      tenantId,
      planId,
      status: plan.priceMonthly === 0 ? 'active' : 'trialing',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    };

    this.subscriptions.set(tenantId, subscription);
    this.emit('subscription:created', subscription);
    logger.info(`Subscription created: ${subscription.id} for tenant ${tenantId}`);
    return subscription;
  }

  /**
   * Get a subscription by tenant id
   */
  getSubscription(tenantId: string): BillingSubscription | null {
    return this.subscriptions.get(tenantId) ?? null;
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription(tenantId: string): BillingSubscription | null {
    const sub = this.subscriptions.get(tenantId);
    if (!sub) return null;

    sub.cancelAtPeriodEnd = true;
    sub.status = 'canceled';
    this.emit('subscription:canceled', sub);
    logger.info(`Subscription canceled: ${sub.id}`);
    return sub;
  }

  /**
   * Create an invoice with line items
   */
  createInvoice(tenantId: string, items: BillingInvoiceItem[]): BillingInvoice {
    const amount = items.reduce((sum, item) => sum + item.amount, 0);
    const invoice: BillingInvoice = {
      id: `inv_${tenantId}_${Date.now()}`,
      tenantId,
      amount,
      currency: 'USD',
      status: 'open',
      createdAt: new Date().toISOString(),
      items,
    };

    this.invoices.push(invoice);
    this.emit('invoice:created', invoice);
    return invoice;
  }

  /**
   * Pay an open invoice
   * @returns null if invoice not found or not in 'open' status
   */
  payInvoice(invoiceId: string): BillingInvoice | null {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.status !== 'open') return null;

    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    this.emit('invoice:paid', invoice);
    return invoice;
  }

  /**
   * Get all invoices for a tenant
   */
  getInvoices(tenantId: string): BillingInvoice[] {
    return this.invoices.filter((i) => i.tenantId === tenantId);
  }

  /**
   * Get total subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.plans.clear();
    this.subscriptions.clear();
    this.invoices = [];
    this.removeAllListeners();
  }
}

/**
 * Type-safe event emitter interface
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface BillingManager {
  on<E extends keyof BillingManagerEvents>(event: E, listener: BillingManagerEvents[E]): this;
  emit<E extends keyof BillingManagerEvents>(
    event: E,
    ...args: Parameters<BillingManagerEvents[E]>
  ): boolean;
}
