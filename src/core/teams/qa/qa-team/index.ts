/**
 * QA Team Module
 *
 * Exports for the QA team.
 *
 * Feature: Team System
 */

// Main class and factory
export { QATeam, createQATeam } from './qa-team';

// Types
export type {
  QATeamConfig,
  TestAnalysis,
  TestScenario,
  GeneratedTestFile,
  TestExecutionResult,
  TestFailure,
  TestGenerationResult,
  QAStats,
} from './qa-team.types';

// Configuration
export { DEFAULT_QA_CONFIG } from './qa-team.config';

// Roles
export { createQAAgentRoles } from './qa-team.roles';

// Utilities
export * from './utils';
