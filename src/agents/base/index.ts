/**
 * Base Agent Exports
 *
 * @deprecated This module is deprecated. Use `@/core/agents` instead.
 * This module will be removed in version 2.0.
 *
 * Migration guide: See src/core/agents/_legacy/README.md
 *
 * @see {@link @/core/agents/base-agent} for the new implementation
 */

// Development mode deprecation warning
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] src/agents/base is deprecated. ' +
      'Use import from @/core/agents instead. ' +
      'This will be removed in version 2.0. ' +
      'See src/core/agents/_legacy/README.md for migration guide.'
  );
}

export * from '@/agents/base/agent';
export * from '@/agents/base/types';
