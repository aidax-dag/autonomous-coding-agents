/**
 * Routing Interfaces
 *
 * Defines contracts for multi-model intelligent routing.
 * ModelRouter implements ILLMClient for drop-in replacement.
 *
 * @module shared/llm/interfaces/routing
 */

import type { ILLMClient, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../base-client';
import type { TaskType, TeamType } from '@/core/workspace/task-document';

/**
 * Model quality tier
 */
export type ModelTier = 'quality' | 'balanced' | 'budget';

/**
 * Model profile describing capabilities and costs
 */
export interface ModelProfile {
  /** Unique profile identifier */
  id: string;
  /** Display name */
  name: string;
  /** Quality tier */
  tier: ModelTier;
  /** LLM provider name */
  provider: string;
  /** Model identifier for the provider */
  model: string;
  /** Cost per 1K input tokens (USD) */
  inputCostPer1K: number;
  /** Cost per 1K output tokens (USD) */
  outputCostPer1K: number;
  /** Maximum context window size */
  maxContextLength: number;
  /** Capability tags */
  capabilities: string[];
}

/**
 * Context for routing decisions
 */
export interface RoutingContext {
  /** Messages to send */
  messages: LLMMessage[];
  /** Task type classification */
  taskType?: TaskType;
  /** Agent role making the request */
  agentRole?: TeamType;
  /** Estimated task complexity */
  estimatedComplexity?: 'simple' | 'moderate' | 'complex';
  /** Remaining budget in USD */
  budgetRemaining?: number;
  /** Additional metadata for strategy use */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a routing decision
 */
export interface RoutingDecision {
  /** Selected model profile */
  profile: ModelProfile;
  /** Confidence in this selection (0-1) */
  confidence: number;
  /** Reason for selection */
  reason: string;
  /** Strategy that made the decision */
  strategy: string;
}

/**
 * Cost record for tracking
 */
export interface CostRecord {
  /** Timestamp */
  timestamp: number;
  /** Model used */
  model: string;
  /** Provider */
  provider: string;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total cost in USD */
  totalCost: number;
}

/**
 * Routing strategy interface
 */
export interface IRoutingStrategy {
  /** Strategy name */
  readonly name: string;
  /** Select optimal model for given context */
  selectModel(context: RoutingContext, profiles: ModelProfile[]): RoutingDecision;
}

/**
 * Model router interface extending ILLMClient
 */
export interface IModelRouter extends ILLMClient {
  /** Chat with explicit routing context */
  chatWithContext(
    messages: LLMMessage[],
    routingContext: RoutingContext,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /** Get routing decision without executing */
  getRoutingDecision(context: RoutingContext): RoutingDecision;

  /** Get the cost tracker */
  getCostTracker(): ICostTracker;

  /** Switch the active routing strategy */
  switchStrategy(strategy: IRoutingStrategy): void;

  /** Get the current strategy */
  getCurrentStrategy(): IRoutingStrategy;
}

/**
 * Cost tracker interface
 */
export interface ICostTracker {
  /** Record a cost entry */
  record(record: CostRecord): void;
  /** Get total cost */
  getTotalCost(): number;
  /** Set budget limit */
  setBudget(limit: number): void;
  /** Check if budget is exceeded */
  isBudgetExceeded(): boolean;
  /** Get remaining budget */
  getRemainingBudget(): number;
  /** Get all records */
  getRecords(): CostRecord[];
  /** Reset tracker */
  reset(): void;
}
