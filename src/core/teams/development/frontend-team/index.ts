/**
 * Frontend Team Module
 *
 * Exports for the frontend development team.
 *
 * Feature: Team System
 */

// Main class and factory
export { FrontendTeam, createFrontendTeam } from './frontend-team';

// Types
export type {
  FrontendTeamConfig,
  ComponentAnalysis,
  ComponentStats,
} from './frontend-team.types';

// Configuration
export { DEFAULT_FRONTEND_CONFIG } from './frontend-team.config';

// Roles
export {
  UI_DEVELOPER_ROLE,
  ACCESSIBILITY_SPECIALIST_ROLE,
  STYLING_SPECIALIST_ROLE,
} from './frontend-team.roles';

// Utilities
export * from './utils';

// Templates (re-export for extensibility)
export * from './templates';
export * from './test-templates';
