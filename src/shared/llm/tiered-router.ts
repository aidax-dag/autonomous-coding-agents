/**
 * Tiered Model Router
 *
 * Selects the most cost-effective model based on task complexity.
 * Wraps ILLMClient to transparently route requests to appropriate tiers.
 *
 * Tiers:
 * - FAST: Simple tasks (complexity 1-3) → haiku, gpt-4o-mini, gemini-flash
 * - BALANCED: Medium tasks (complexity 4-7) → sonnet, gpt-4o, gemini-pro
 * - POWERFUL: Complex tasks (complexity 8-10) → opus, o3, gemini-ultra
 *
 * @module shared/llm
 */

import type {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from './base-client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Model tier based on capability/cost
 */
export enum ModelTier {
  FAST = 'fast',
  BALANCED = 'balanced',
  POWERFUL = 'powerful',
}

/**
 * Task context for routing decisions
 */
export interface TaskContext {
  /** Task description or prompt */
  description: string;
  /** Estimated complexity (1-10, optional — will be auto-computed if missing) */
  complexity?: number;
  /** Task category hint */
  category?: string;
  /** Whether streaming is needed */
  streaming?: boolean;
  /** Maximum acceptable latency in ms */
  maxLatency?: number;
  /** Budget constraint (cost units) */
  budgetRemaining?: number;
}

/**
 * Model selection result
 */
export interface ModelSelection {
  /** Selected tier */
  tier: ModelTier;
  /** Selected model identifier */
  model: string;
  /** Estimated cost per 1K tokens */
  estimatedCost: number;
  /** Rationale for selection */
  rationale: string;
}

/**
 * Routing strategy interface
 */
export interface IRoutingStrategy {
  /** Evaluate task complexity (1-10) */
  evaluateComplexity(context: TaskContext): number;
  /** Select tier based on complexity and constraints */
  selectTier(complexity: number, budgetRemaining?: number): ModelTier;
  /** Select specific model within a tier */
  selectModel(tier: ModelTier, provider: string): string;
}

/**
 * Cost per 1K tokens by tier
 */
export interface TierCostConfig {
  [ModelTier.FAST]: number;
  [ModelTier.BALANCED]: number;
  [ModelTier.POWERFUL]: number;
}

/**
 * Model mapping per provider and tier
 */
export interface ModelMapping {
  [provider: string]: {
    [ModelTier.FAST]: string;
    [ModelTier.BALANCED]: string;
    [ModelTier.POWERFUL]: string;
  };
}

/**
 * TieredRouter configuration
 */
export interface TieredRouterConfig {
  /** Underlying LLM client */
  client: ILLMClient;
  /** Custom routing strategy */
  strategy?: IRoutingStrategy;
  /** Model mapping overrides */
  modelMapping?: ModelMapping;
  /** Cost per 1K tokens per tier */
  tierCosts?: TierCostConfig;
  /** Default tier when complexity is ambiguous */
  defaultTier?: ModelTier;
  /** Enable verbose logging */
  verbose?: boolean;
}

// ============================================================================
// Default Model Mappings
// ============================================================================

export const DEFAULT_MODEL_MAPPING: ModelMapping = {
  claude: {
    [ModelTier.FAST]: 'claude-haiku-4-5-20251001',
    [ModelTier.BALANCED]: 'claude-sonnet-4-5-20250929',
    [ModelTier.POWERFUL]: 'claude-opus-4-6',
  },
  openai: {
    [ModelTier.FAST]: 'gpt-4o-mini',
    [ModelTier.BALANCED]: 'gpt-4o',
    [ModelTier.POWERFUL]: 'o3',
  },
  gemini: {
    [ModelTier.FAST]: 'gemini-2.0-flash',
    [ModelTier.BALANCED]: 'gemini-2.5-pro',
    [ModelTier.POWERFUL]: 'gemini-2.5-pro',
  },
};

export const DEFAULT_TIER_COSTS: TierCostConfig = {
  [ModelTier.FAST]: 0.25,
  [ModelTier.BALANCED]: 3.0,
  [ModelTier.POWERFUL]: 15.0,
};

// ============================================================================
// Default Routing Strategy
// ============================================================================

/**
 * Default complexity-based routing strategy
 */
export class DefaultRoutingStrategy implements IRoutingStrategy {
  /** Complexity keywords for quick heuristic classification */
  private static readonly COMPLEX_KEYWORDS = [
    'architect', 'design', 'refactor', 'security', 'audit',
    'optimize', 'migration', 'system', 'distributed', 'concurrent',
  ];

  private static readonly SIMPLE_KEYWORDS = [
    'fix typo', 'rename', 'format', 'lint', 'simple',
    'add comment', 'update version', 'log', 'print',
  ];

  evaluateComplexity(context: TaskContext): number {
    if (context.complexity !== undefined) {
      return Math.max(1, Math.min(10, context.complexity));
    }

    const desc = context.description.toLowerCase();
    let score = 5; // Default medium

    // Simple task indicators
    for (const kw of DefaultRoutingStrategy.SIMPLE_KEYWORDS) {
      if (desc.includes(kw)) score -= 2;
    }

    // Complex task indicators
    for (const kw of DefaultRoutingStrategy.COMPLEX_KEYWORDS) {
      if (desc.includes(kw)) score += 2;
    }

    // Length heuristic: longer descriptions tend to be more complex
    if (desc.length > 500) score += 1;
    if (desc.length < 50) score -= 1;

    return Math.max(1, Math.min(10, score));
  }

  selectTier(complexity: number, budgetRemaining?: number): ModelTier {
    // Budget constraint: if very low budget, force FAST
    if (budgetRemaining !== undefined && budgetRemaining < 1) {
      return ModelTier.FAST;
    }

    if (complexity <= 3) return ModelTier.FAST;
    if (complexity <= 7) return ModelTier.BALANCED;
    return ModelTier.POWERFUL;
  }

  selectModel(tier: ModelTier, provider: string): string {
    const mapping = DEFAULT_MODEL_MAPPING[provider];
    if (mapping) return mapping[tier];
    // Fallback to claude mapping
    return DEFAULT_MODEL_MAPPING.claude[tier];
  }
}

// ============================================================================
// TieredRouter
// ============================================================================

/**
 * Tiered Model Router — wraps ILLMClient with intelligent model selection
 */
export class TieredRouter implements ILLMClient {
  private readonly client: ILLMClient;
  private readonly strategy: IRoutingStrategy;
  readonly modelMapping: ModelMapping;
  private readonly tierCosts: TierCostConfig;
  private readonly defaultTier: ModelTier;
  private readonly verbose: boolean;

  /** Current task context for routing */
  private currentContext?: TaskContext;
  /** Last selection made */
  private lastSelection?: ModelSelection;

  constructor(config: TieredRouterConfig) {
    this.client = config.client;
    this.strategy = config.strategy ?? new DefaultRoutingStrategy();
    this.modelMapping = config.modelMapping ?? DEFAULT_MODEL_MAPPING;
    this.tierCosts = config.tierCosts ?? DEFAULT_TIER_COSTS;
    this.defaultTier = config.defaultTier ?? ModelTier.BALANCED;
    this.verbose = config.verbose ?? false;
  }

  /**
   * Set task context for the next routing decision
   */
  setTaskContext(context: TaskContext): void {
    this.currentContext = context;
  }

  /**
   * Get the last model selection
   */
  getLastSelection(): ModelSelection | undefined {
    return this.lastSelection;
  }

  /**
   * Route a task context to a model selection
   */
  route(context: TaskContext): ModelSelection {
    const provider = this.client.getProvider();
    const complexity = this.strategy.evaluateComplexity(context);
    const tier = this.strategy.selectTier(complexity, context.budgetRemaining);
    const model = this.strategy.selectModel(tier, provider);
    const estimatedCost = this.tierCosts[tier];

    const selection: ModelSelection = {
      tier,
      model,
      estimatedCost,
      rationale: `complexity=${complexity}, tier=${tier}, provider=${provider}`,
    };

    if (this.verbose) {
      console.log(`[TieredRouter] ${selection.rationale} → ${model}`);
    }

    this.lastSelection = selection;
    return selection;
  }

  // =========================================================================
  // ILLMClient implementation
  // =========================================================================

  getProvider(): string {
    return this.client.getProvider();
  }

  getDefaultModel(): string {
    if (this.currentContext) {
      const selection = this.route(this.currentContext);
      return selection.model;
    }

    // Default to balanced tier model
    const provider = this.client.getProvider();
    return this.strategy.selectModel(this.defaultTier, provider);
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult> {
    const model = this.resolveModel(options);
    return this.client.chat(messages, { ...options, model });
  }

  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult> {
    const model = this.resolveModel(options);
    return this.client.chatStream(messages, callback, { ...options, model });
  }

  countTokens?(messages: LLMMessage[]): Promise<number> {
    return this.client.countTokens?.(messages) ?? Promise.resolve(0);
  }

  getMaxContextLength(model?: string): number {
    return this.client.getMaxContextLength(model);
  }

  // =========================================================================
  // Private
  // =========================================================================

  private resolveModel(options?: LLMCompletionOptions): string {
    // If model explicitly specified, use it
    if (options?.model) return options.model;

    // If task context available, route
    if (this.currentContext) {
      const selection = this.route(this.currentContext);
      return selection.model;
    }

    // Fallback to default tier
    const provider = this.client.getProvider();
    return this.strategy.selectModel(this.defaultTier, provider);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a TieredRouter wrapping an existing LLM client
 */
export function createTieredRouter(config: TieredRouterConfig): TieredRouter {
  return new TieredRouter(config);
}
