/**
 * Model Router
 *
 * Implements ILLMClient for drop-in replacement. Routes requests to optimal
 * model based on configurable strategy, tracks costs, and manages model profiles.
 *
 * @module shared/llm/model-router
 */

import type {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from './base-client';
import type {
  IModelRouter,
  IRoutingStrategy,
  RoutingContext,
  RoutingDecision,
  ModelProfile,
} from './interfaces/routing.interface';
import { CostTracker } from './cost-tracker';
import { ModelProfileRegistry } from './model-profiles';

/**
 * Model Router Configuration
 */
export interface ModelRouterConfig {
  /** Map of provider name → ILLMClient instances */
  clients: Map<string, ILLMClient>;
  /** Routing strategy */
  strategy: IRoutingStrategy;
  /** Model profile registry */
  profileRegistry?: ModelProfileRegistry;
  /** Budget limit in USD */
  budgetLimit?: number;
  /** Default provider to fall back to */
  defaultProvider?: string;
}

/**
 * Model Router
 *
 * Routes LLM requests to optimal provider/model based on strategy.
 * Implements ILLMClient for transparent integration.
 */
export class ModelRouter implements IModelRouter {
  private clients: Map<string, ILLMClient>;
  private strategy: IRoutingStrategy;
  private profileRegistry: ModelProfileRegistry;
  private costTracker: CostTracker;
  private defaultProvider: string;

  constructor(config: ModelRouterConfig) {
    if (config.clients.size === 0) {
      throw new Error('ModelRouter requires at least one client');
    }

    this.clients = config.clients;
    this.strategy = config.strategy;
    this.profileRegistry = config.profileRegistry ?? new ModelProfileRegistry();
    this.costTracker = new CostTracker();
    this.defaultProvider = config.defaultProvider ?? config.clients.keys().next().value!;

    if (config.budgetLimit !== undefined) {
      this.costTracker.setBudget(config.budgetLimit);
    }
  }

  // === ILLMClient implementation ===

  getProvider(): string {
    return 'model-router';
  }

  getDefaultModel(): string {
    const defaultClient = this.clients.get(this.defaultProvider);
    return defaultClient?.getDefaultModel() ?? 'auto';
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const context: RoutingContext = { messages };
    return this.chatWithContext(messages, context, options);
  }

  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const context: RoutingContext = { messages };
    const decision = this.getRoutingDecision(context);
    const client = this.resolveClient(decision.profile);

    const result = await client.chatStream(messages, callback, {
      ...options,
      model: decision.profile.model,
    });

    this.recordCost(decision.profile, result);
    return result;
  }

  getMaxContextLength(model?: string): number {
    if (model) {
      const profiles = this.profileRegistry.getAll();
      const match = profiles.find((p) => p.model === model);
      if (match) return match.maxContextLength;
    }

    const defaultClient = this.clients.get(this.defaultProvider);
    return defaultClient?.getMaxContextLength(model) ?? 200000;
  }

  // === IModelRouter implementation ===

  async chatWithContext(
    messages: LLMMessage[],
    routingContext: RoutingContext,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const decision = this.getRoutingDecision(routingContext);
    const client = this.resolveClient(decision.profile);

    const result = await client.chat(messages, {
      ...options,
      model: decision.profile.model,
    });

    this.recordCost(decision.profile, result);
    return result;
  }

  getRoutingDecision(context: RoutingContext): RoutingDecision {
    const profiles = this.profileRegistry.getAll();
    if (profiles.length === 0) {
      throw new Error('No model profiles available for routing');
    }

    // Filter to only profiles with available clients
    const availableProfiles = profiles.filter((p) => this.clients.has(p.provider));
    if (availableProfiles.length === 0) {
      throw new Error('No model profiles match available clients');
    }

    // Inject budget info
    const enrichedContext: RoutingContext = {
      ...context,
      budgetRemaining: context.budgetRemaining ?? this.costTracker.getRemainingBudget(),
    };

    return this.strategy.selectModel(enrichedContext, availableProfiles);
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  switchStrategy(strategy: IRoutingStrategy): void {
    this.strategy = strategy;
  }

  getCurrentStrategy(): IRoutingStrategy {
    return this.strategy;
  }

  // === Internal helpers ===

  private resolveClient(profile: ModelProfile): ILLMClient {
    const client = this.clients.get(profile.provider);
    if (!client) {
      // Fallback to default
      const fallback = this.clients.get(this.defaultProvider);
      if (!fallback) {
        throw new Error(`No client available for provider: ${profile.provider}`);
      }
      return fallback;
    }
    return client;
  }

  private recordCost(profile: ModelProfile, result: LLMCompletionResult): void {
    const inputCost = (result.usage.promptTokens / 1000) * profile.inputCostPer1K;
    const outputCost = (result.usage.completionTokens / 1000) * profile.outputCostPer1K;

    this.costTracker.record({
      timestamp: Date.now(),
      model: profile.model,
      provider: profile.provider,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      totalCost: inputCost + outputCost,
    });
  }
}

/**
 * Create a model router
 */
export function createModelRouter(config: ModelRouterConfig): ModelRouter {
  return new ModelRouter(config);
}
