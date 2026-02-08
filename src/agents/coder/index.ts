/**
 * Coder Agent Exports
 *
 * @deprecated This module is deprecated. Use `@/core/agents/specialized` instead.
 * This module will be removed in version 2.0.
 *
 * Migration:
 * ```typescript
 * // OLD
 * import { CoderAgent } from '@/agents/coder';
 * // NEW
 * import { CoderAgent } from '@/core/agents/specialized';
 * ```
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] src/agents/coder is deprecated. ' +
      'Use @/core/agents/specialized/coder-agent instead.'
  );
}

export * from '@/agents/coder/coder-agent';
