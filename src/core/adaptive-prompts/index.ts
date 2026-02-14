/**
 * Adaptive Prompts Module
 *
 * Feedback-driven prompt optimization with variant tracking,
 * A/B testing, and performance-based selection.
 *
 * @module core/adaptive-prompts
 */

export type {
  PromptFeedback,
  PromptVariant,
  PromptModification,
  PromptPerformance,
  AdaptivePromptConfig,
  ABTest,
} from './types';

export { DEFAULT_ADAPTIVE_CONFIG } from './types';

export { FeedbackTracker } from './feedback-tracker';

export { PromptOptimizer } from './prompt-optimizer';
