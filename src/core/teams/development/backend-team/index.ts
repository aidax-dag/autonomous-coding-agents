/**
 * Backend Team Module
 *
 * Re-exports all backend team components.
 *
 * Feature: Team System
 */

// Main class and factory
export { BackendTeam, createBackendTeam } from './backend-team';

// Types
export type { BackendTeamConfig, APIAnalysis, ModelAnalysis, BackendAPIStats } from './backend-team.types';

// Configuration
export { DEFAULT_BACKEND_CONFIG } from './backend-team.config';

// Roles
export {
  API_DEVELOPER_ROLE,
  DATABASE_SPECIALIST_ROLE,
  SECURITY_SPECIALIST_ROLE,
  INTEGRATION_SPECIALIST_ROLE,
} from './backend-team.roles';

// Utilities
export * from './utils/naming.utils';
export * from './utils/type-mapping';

// Templates (for extensibility)
export * from './templates';
export * from './test-templates';
