/**
 * QA Team
 *
 * Re-exports from the refactored qa-team module.
 * This file maintains backwards compatibility.
 *
 * Feature: Team System
 */

export {
  QATeam,
  createQATeam,
  QATeamConfig,
  TestAnalysis,
  TestScenario,
  GeneratedTestFile,
  TestExecutionResult,
  TestFailure,
  TestGenerationResult,
  QAStats,
  DEFAULT_QA_CONFIG,
  createQAAgentRoles,
} from './qa-team/index';
