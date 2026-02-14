/**
 * Adaptive Prompts Types
 *
 * Type definitions for the adaptive prompt optimization system
 * that learns from task outcomes and adjusts prompts dynamically.
 *
 * @module core/adaptive-prompts/types
 */

/**
 * Feedback collected after a prompt is used in a task
 */
export interface PromptFeedback {
  /** Template that was used */
  templateId: string;
  /** Task that used this prompt */
  taskId: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Tokens consumed during execution */
  tokensUsed: number;
  /** Quality score from 0 to 1 */
  qualityScore: number;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Agent type that executed the task */
  agentType: string;
  /** When the feedback was recorded */
  timestamp: string;
  /** Additional context about the execution */
  context: Record<string, unknown>;
}

/**
 * A variant of a base prompt template with modifications
 */
export interface PromptVariant {
  /** Unique variant identifier */
  id: string;
  /** The base template this variant derives from */
  baseTemplateId: string;
  /** Version number of this variant */
  version: number;
  /** Modifications applied to the base template */
  modifications: PromptModification[];
  /** Tracked performance metrics */
  performance: PromptPerformance;
  /** When this variant was created */
  createdAt: string;
}

/**
 * A single modification applied to a prompt template
 */
export interface PromptModification {
  /** Type of modification */
  type: 'add-context' | 'simplify' | 'expand' | 'restructure' | 'add-examples';
  /** Human-readable description of the change */
  description: string;
  /** The modification content to apply */
  content: string;
}

/**
 * Aggregated performance metrics for a prompt or variant
 */
export interface PromptPerformance {
  /** Total number of times used */
  totalUses: number;
  /** Ratio of successful uses (0-1) */
  successRate: number;
  /** Average tokens consumed per use */
  avgTokens: number;
  /** Average quality score (0-1) */
  avgQuality: number;
  /** Average execution time in milliseconds */
  avgExecutionTime: number;
}

/**
 * Configuration for the adaptive prompt system
 */
export interface AdaptivePromptConfig {
  /** Whether learning and adaptation is enabled */
  learningEnabled: boolean;
  /** Minimum feedback samples before adaptation triggers */
  minSamplesForAdaptation: number;
  /** Number of recent feedbacks to consider for performance */
  performanceWindow: number;
  /** Quality score below which optimization is suggested */
  qualityThreshold: number;
  /** Minimum relative improvement needed to adopt a variant (0-1) */
  improvementThreshold: number;
}

/** Default configuration values */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptivePromptConfig = {
  learningEnabled: true,
  minSamplesForAdaptation: 5,
  performanceWindow: 50,
  qualityThreshold: 0.6,
  improvementThreshold: 0.1,
};

/**
 * An A/B test comparing two prompt variants
 */
export interface ABTest {
  /** Unique test identifier */
  id: string;
  /** First variant template ID */
  variantA: string;
  /** Second variant template ID */
  variantB: string;
  /** Feedback samples collected for variant A */
  samplesA: PromptFeedback[];
  /** Feedback samples collected for variant B */
  samplesB: PromptFeedback[];
  /** Current test status */
  status: 'running' | 'completed' | 'cancelled';
  /** Winning variant ID (set when completed) */
  winner?: string;
  /** When the test started */
  startedAt: string;
  /** When the test completed */
  completedAt?: string;
}
