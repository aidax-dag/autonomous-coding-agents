/**
 * Repo Manager Agent Exports
 *
 * @deprecated This module is deprecated. Use `@/core/agents/teams` instead.
 * This module will be removed in version 2.0.
 *
 * Migration:
 * ```typescript
 * // OLD
 * import { RepoManagerAgent } from '@/agents/repo-manager';
 * // NEW
 * import { PlanningAgent, DevelopmentAgent } from '@/core/agents/teams';
 * ```
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] src/agents/repo-manager is deprecated. ' + 'Use @/core/agents/teams instead.'
  );
}

export * from '@/agents/repo-manager/repo-manager-agent';
