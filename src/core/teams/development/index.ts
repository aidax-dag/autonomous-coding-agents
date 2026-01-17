/**
 * Development Team Module
 *
 * Exports all development team implementations.
 *
 * Feature: Team System
 */

// Base development team
export {
  DevelopmentTeam,
  DevelopmentTeamConfig,
  CodeGenerationResult,
  GeneratedFile,
  DependencySpec,
  CodeAnalysisResult,
  DEFAULT_DEVELOPMENT_CONFIG,
} from './development-team';

// Frontend team
export {
  FrontendTeam,
  FrontendTeamConfig,
  ComponentAnalysis,
  DEFAULT_FRONTEND_CONFIG,
  createFrontendTeam,
} from './frontend-team';

// Backend team
export {
  BackendTeam,
  BackendTeamConfig,
  APIAnalysis,
  ModelAnalysis,
  DEFAULT_BACKEND_CONFIG,
  createBackendTeam,
} from './backend-team';

// Fullstack team
export {
  FullstackTeam,
  FullstackTeamConfig,
  FullstackAnalysis,
  DEFAULT_FULLSTACK_CONFIG,
  createFullstackTeam,
} from './fullstack-team';
