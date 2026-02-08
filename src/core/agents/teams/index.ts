/**
 * Team Agents Module
 *
 * Exports all team agent implementations.
 * Consolidated from core/orchestrator/agents to core/agents/teams
 *
 * @module core/agents/teams
 */

// Base team agent
export {
  BaseTeamAgent,
  type BaseTeamAgentEvents,
  type BaseTeamAgentOptions,
} from './base-team-agent';

// Team agent interfaces and types
export {
  type ITeamAgent,
  type TeamAgentStatus,
  type TeamAgentConfig,
  type TeamMetrics,
  type TeamCapability,
  type TaskHandler,
  type TaskHandlerResult,
  createTeamConfig,
} from './team-agent';

// Planning agent
export {
  PlanningAgent,
  createPlanningAgent,
  type PlanningOutput,
  type PlanningAgentOptions,
} from './planning-agent';

// Development agent
export {
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,
  type DevelopmentOutput,
  type DevelopmentAgentOptions,
} from './development-agent';

// QA agent
export {
  QAAgent,
  createQAAgent,
  type QAOutput,
  type QAAgentOptions,
  type TestResult,
} from './qa-agent';

// Code quality agent
export {
  CodeQualityAgent,
  createCodeQualityAgent,
  type CodeQualityAgentOptions,
  type GeneratedTestCase,
  type CodeReviewFinding,
  type RefactoringSuggestion,
  type TestGenerationOutput,
  type DeepReviewOutput,
  type RefactoringOutput,
} from './code-quality-agent';
