/**
 * Agent Manager Exports
 *
 * @deprecated This module is deprecated. Use `@/core/agents` instead.
 * This module will be removed in version 2.0.
 *
 * Migration:
 * ```typescript
 * // OLD
 * import { AgentManager } from '@/agents/manager';
 * // NEW
 * import { AgentRegistry, AgentFactory } from '@/core/agents';
 * ```
 */

if (process.env.NODE_ENV === 'development') {
  console.warn('[DEPRECATED] src/agents/manager is deprecated. ' + 'Use @/core/agents instead.');
}

export * from '@/agents/manager/agent-manager';
