/**
 * Context Module Constants
 *
 * Default configurations, compression levels, and model token limits.
 *
 * @module core/context/constants
 */

import type {
  ContextManagerConfig,
  CompressionLevel,
} from '../interfaces/context.interface.js';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  tokenBudget: {
    maxTokens: 128000, // Claude 3 default
    warningThreshold: 70,
    criticalThreshold: 85,
    reserveTokens: 4000, // Reserved for response
  },
  outputOptimizer: {
    enabled: true,
    maxOutputLength: 10000,
    compressionLevel: 'light',
    preserveCodeBlocks: true,
    preserveImportantInfo: true,
  },
  qualityCurve: {
    enabled: true,
    autoAdjust: true,
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
    checkInterval: 30000, // 30 seconds
  },
};

// ============================================================================
// Compression Levels
// ============================================================================

/**
 * Compression level configuration
 */
export interface CompressionLevelConfig {
  /** Token reduction ratio (0-1) */
  tokenReduction: number;
  /** Techniques to apply */
  techniques: string[];
}

/**
 * Compression level configurations
 */
export const COMPRESSION_LEVELS: Record<CompressionLevel, CompressionLevelConfig> = {
  none: {
    tokenReduction: 0,
    techniques: [],
  },
  light: {
    tokenReduction: 0.1,
    techniques: [
      'remove_redundant_whitespace',
      'shorten_verbose_text',
    ],
  },
  moderate: {
    tokenReduction: 0.25,
    techniques: [
      'remove_redundant_whitespace',
      'shorten_verbose_text',
      'summarize_explanations',
      'abbreviate_common_terms',
    ],
  },
  aggressive: {
    tokenReduction: 0.4,
    techniques: [
      'remove_redundant_whitespace',
      'shorten_verbose_text',
      'summarize_explanations',
      'abbreviate_common_terms',
      'remove_examples',
      'minimal_formatting',
    ],
  },
} as const;

// ============================================================================
// Model Token Limits
// ============================================================================

/**
 * Token limits by model
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // Claude 3.x models
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3.5-haiku': 200000,

  // Claude 2.x models
  'claude-2.1': 200000,
  'claude-2.0': 100000,
  'claude-instant': 100000,

  // OpenAI models
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,

  // Default
  default: 128000,
} as const;

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Characters per token estimate (approximate)
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Token estimation strategies
 */
export const TOKEN_ESTIMATION = {
  /** Characters per token for English */
  charsPerTokenEnglish: 4,
  /** Characters per token for code */
  charsPerTokenCode: 3.5,
  /** Characters per token for CJK */
  charsPerTokenCJK: 1.5,
} as const;

// ============================================================================
// Compaction Configuration
// ============================================================================

/**
 * Compaction strategy configuration
 */
export const COMPACTION_CONFIG = {
  /** Default strategy */
  defaultStrategy: 'hybrid' as const,
  /** Minimum content length for compaction */
  minContentLength: 1000,
  /** Target reduction ratio */
  targetReductionRatio: 0.3,
  /** Maximum iterations for hybrid strategy */
  maxIterations: 3,
} as const;

// ============================================================================
// Event Debounce Configuration
// ============================================================================

/**
 * Event debounce timings (milliseconds)
 */
export const EVENT_DEBOUNCE = {
  /** Debounce for usage events */
  usageEvent: 1000,
  /** Debounce for quality events */
  qualityEvent: 2000,
  /** Debounce for compression events */
  compressionEvent: 500,
} as const;

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Context thresholds
 */
export const CONTEXT_THRESHOLDS = {
  /** Warning threshold (percentage) */
  warning: 70,
  /** Critical threshold (percentage) */
  critical: 85,
  /** Overflow threshold (percentage) */
  overflow: 95,
} as const;
