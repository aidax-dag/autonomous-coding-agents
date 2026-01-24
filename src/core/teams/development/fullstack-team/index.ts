/**
 * Fullstack Team Module
 *
 * Exports for the fullstack development team.
 *
 * Feature: Team System
 */

// Main class and factory
export { FullstackTeam, createFullstackTeam } from './fullstack-team';

// Types
export type {
  FullstackTeamConfig,
  FullstackAnalysis,
  FullstackStats,
} from './fullstack-team.types';

// Configuration
export { DEFAULT_FULLSTACK_CONFIG } from './fullstack-team.config';

// Roles
export {
  FULLSTACK_DEVELOPER_ROLE,
  INTEGRATION_ARCHITECT_ROLE,
  DEVOPS_LIAISON_ROLE,
} from './fullstack-team.roles';

// Utilities
export * from './utils';
