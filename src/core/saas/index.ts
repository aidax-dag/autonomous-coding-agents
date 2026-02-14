/**
 * SaaS Module
 *
 * Multi-tenant management with billing and plan enforcement.
 *
 * Components:
 * - TenantManager: Multi-tenant lifecycle, limits, and usage tracking
 * - BillingManager: Plans, subscriptions, and invoices
 *
 * Feature: D-4 - SaaS Features
 */

export {
  PlanType,
  TenantConfig,
  TenantLimits,
  TenantUsage,
  TenantManager,
  TenantManagerEvents,
  getPlanLimits,
} from './tenant-manager';

export {
  BillingPlan,
  SubscriptionStatus,
  BillingSubscription,
  InvoiceStatus,
  BillingInvoice,
  BillingInvoiceItem,
  BillingManager,
  BillingManagerEvents,
} from './billing-manager';
