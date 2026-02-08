/**
 * Reviewer Agent Exports
 *
 * @deprecated This module is deprecated. Use `@/core/agents/specialized` instead.
 * This module will be removed in version 2.0.
 *
 * Migration:
 * ```typescript
 * // OLD
 * import { ReviewerAgent } from '@/agents/reviewer';
 * // NEW
 * import { ReviewerAgent } from '@/core/agents/specialized';
 * ```
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] src/agents/reviewer is deprecated. ' +
      'Use @/core/agents/specialized/reviewer-agent instead.'
  );
}

export * from '@/agents/reviewer/reviewer-agent';
