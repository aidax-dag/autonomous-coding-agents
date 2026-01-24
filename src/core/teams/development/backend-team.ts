/**
 * Backend Team
 *
 * This file re-exports from the refactored backend-team module.
 * The implementation has been split into smaller, more maintainable files.
 *
 * @see ./backend-team/index.ts for the full module structure
 *
 * Feature: Team System
 */

// Re-export everything from the new module structure
export {
  BackendTeam,
  createBackendTeam,
  DEFAULT_BACKEND_CONFIG,
  API_DEVELOPER_ROLE,
  DATABASE_SPECIALIST_ROLE,
  SECURITY_SPECIALIST_ROLE,
  INTEGRATION_SPECIALIST_ROLE,
} from './backend-team/index';

export type {
  BackendTeamConfig,
  APIAnalysis,
  ModelAnalysis,
  BackendAPIStats,
} from './backend-team/index';
