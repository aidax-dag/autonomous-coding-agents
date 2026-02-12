/**
 * Token Budget Manager
 *
 * Simplified token budget management for the unified context module.
 * Tracks token usage and provides budget-aware operations.
 *
 * @module core/context/token-budget-manager
 */

import type {
  ITokenBudgetManager,
  TokenBudgetConfig,
} from './interfaces/context.interface';
import { DEFAULT_CONTEXT_CONFIG } from './constants/context.constants';

// ============================================================================
// Implementation
// ============================================================================

/**
 * TokenBudgetManager
 *
 * Manages token budget tracking with simple add/release operations.
 */
export class TokenBudgetManager implements ITokenBudgetManager {
  private config: TokenBudgetConfig;
  private usedTokens: number = 0;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = {
      ...DEFAULT_CONTEXT_CONFIG.tokenBudget,
      ...config,
    };
  }

  // ==========================================================================
  // Token Operations
  // ==========================================================================

  /**
   * Get current used tokens
   */
  getUsedTokens(): number {
    return this.usedTokens;
  }

  /**
   * Get maximum allowed tokens
   */
  getMaxTokens(): number {
    return this.config.maxTokens;
  }

  /**
   * Set maximum allowed tokens
   */
  setMaxTokens(max: number): void {
    if (max <= 0) {
      throw new Error('Max tokens must be positive');
    }
    this.config.maxTokens = max;
  }

  /**
   * Add tokens to usage
   */
  addTokens(count: number): void {
    if (count < 0) {
      throw new Error('Token count cannot be negative');
    }
    this.usedTokens += count;
  }

  /**
   * Release tokens from usage
   */
  releaseTokens(count: number): void {
    if (count < 0) {
      throw new Error('Token count cannot be negative');
    }
    this.usedTokens = Math.max(0, this.usedTokens - count);
  }

  /**
   * Check if can afford specified tokens
   */
  canAfford(tokens: number): boolean {
    const remaining = this.config.maxTokens - this.usedTokens;
    const available = remaining - this.config.reserveTokens;
    return available >= tokens;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Configure the manager
   */
  configure(config: Partial<TokenBudgetConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * Reset usage to zero
   */
  reset(): void {
    this.usedTokens = 0;
  }

  // ==========================================================================
  // Threshold Checks
  // ==========================================================================

  /**
   * Get usage percentage (0-100)
   */
  getUsagePercent(): number {
    return (this.usedTokens / this.config.maxTokens) * 100;
  }

  /**
   * Check if at warning threshold
   */
  isAtWarning(): boolean {
    return this.getUsagePercent() >= this.config.warningThreshold;
  }

  /**
   * Check if at critical threshold
   */
  isAtCritical(): boolean {
    return this.getUsagePercent() >= this.config.criticalThreshold;
  }

  /**
   * Get remaining tokens
   */
  getRemainingTokens(): number {
    return this.config.maxTokens - this.usedTokens;
  }

  /**
   * Get available tokens (remaining minus reserved)
   */
  getAvailableTokens(): number {
    return Math.max(0, this.getRemainingTokens() - this.config.reserveTokens);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a TokenBudgetManager instance
 */
export function createTokenBudgetManager(config?: Partial<TokenBudgetConfig>): TokenBudgetManager {
  return new TokenBudgetManager(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default TokenBudgetManager;
