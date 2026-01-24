/**
 * Team System Module
 *
 * Provides team-based agent orchestration for the Agent OS.
 * Teams are specialized groups of agents that collaborate on tasks.
 *
 * @module core/teams
 *
 * @example
 * ```typescript
 * import {
 *   TeamRegistry,
 *   PlanningTeam,
 *   createTask,
 *   TeamType,
 *   TaskPriority,
 * } from '@core/teams';
 *
 * // Create registry
 * const registry = new TeamRegistry();
 *
 * // Create and register teams
 * const planningTeam = new PlanningTeam({ name: 'Strategy' });
 * await planningTeam.initialize();
 * registry.register(planningTeam);
 *
 * // Start teams
 * await planningTeam.start();
 * registry.start();
 *
 * // Submit tasks
 * const task = createTask(
 *   'Build User Dashboard',
 *   'Create a user dashboard with analytics',
 *   { priority: TaskPriority.HIGH }
 * );
 *
 * await registry.routeAndSubmitTask(task);
 * ```
 */

// ============================================================================
// Team Types and Enums
// ============================================================================

export {
  // Enums
  TeamType,
  TeamCapability,
  TeamStatus,
  TaskPriority,
  TaskStatus,

  // Schemas
  TeamConfigSchema,
  TaskDocumentSchema,
  TeamMessageSchema,

  // Defaults
  DEFAULT_TEAM_CONFIG,
  TEAM_CAPABILITIES,

  // Types
  type TeamConfig,
  type TaskDocument,
  type TeamMessage,
  type TeamStats,
  type TaskResult,
  type TaskArtifact,
  type TeamEvents,
  type AgentRole,
  type TeamMember,
} from './team-types';

// ============================================================================
// Base Team
// ============================================================================

export {
  // Core class
  BaseTeam,

  // Helper functions
  createTask,
  createRole,
} from './base-team';

// ============================================================================
// Team Registry
// ============================================================================

export {
  // Core class
  TeamRegistry,
  createTeamRegistry,

  // Defaults
  DEFAULT_REGISTRY_CONFIG,

  // Types
  type TeamRegistryConfig,
  type TeamRegistryEvents,
  type RoutingDecision,
} from './team-registry';

// ============================================================================
// Planning Team
// ============================================================================

export {
  // Core class
  PlanningTeam,
  createPlanningTeam,

  // Defaults
  DEFAULT_PLANNING_CONFIG,

  // Types
  type PlanningTeamConfig,
  type DecompositionResult,
  type PRDDocument,
  type RequirementItem,
} from './planning/planning-team';

// ============================================================================
// Development Teams
// ============================================================================

export {
  // Base development team
  DevelopmentTeam,
  DEFAULT_DEVELOPMENT_CONFIG,
  type DevelopmentTeamConfig,
  type CodeGenerationResult,
  type GeneratedFile,
  type DependencySpec,
  type CodeAnalysisResult,

  // Frontend team
  FrontendTeam,
  createFrontendTeam,
  DEFAULT_FRONTEND_CONFIG,
  type FrontendTeamConfig,
  type ComponentAnalysis,

  // Backend team
  BackendTeam,
  createBackendTeam,
  DEFAULT_BACKEND_CONFIG,
  type BackendTeamConfig,
  type APIAnalysis,
  type ModelAnalysis,

  // Fullstack team
  FullstackTeam,
  createFullstackTeam,
  DEFAULT_FULLSTACK_CONFIG,
  type FullstackTeamConfig,
  type FullstackAnalysis,
} from './development';

// ============================================================================
// QA Team
// ============================================================================

export {
  // Core class
  QATeam,
  createQATeam,

  // Defaults
  DEFAULT_QA_CONFIG,

  // Types
  type QATeamConfig,
  type TestAnalysis,
  type TestScenario,
  type GeneratedTestFile,
  type TestExecutionResult,
  type TestFailure,
  type TestGenerationResult,
} from './qa';

// ============================================================================
// Code Quality Team
// ============================================================================

export {
  // Core class
  CodeQualityTeam,
  createCodeQualityTeam,

  // Defaults
  DEFAULT_CODE_QUALITY_CONFIG,

  // Types
  type CodeQualityTeamConfig,
  type CodeReviewResult,
  type CodeIssue,
  type CodeSuggestion,
  type TechDebtItem,
  type RefactoringResult,
  type RefactoringAction,
  type SecurityScanResult,
  type SecurityVulnerability,
} from './code-quality';

// ============================================================================
// Factory Functions
// ============================================================================

import { TeamRegistry, TeamRegistryConfig } from './team-registry';
import { PlanningTeam, PlanningTeamConfig, DEFAULT_PLANNING_CONFIG } from './planning/planning-team';

/**
 * Team system configuration
 */
export interface TeamSystemConfig {
  registry?: Partial<TeamRegistryConfig>;
  planning?: Partial<PlanningTeamConfig>;
  autoStart?: boolean;
}

/**
 * Team system instance
 */
export interface TeamSystem {
  registry: TeamRegistry;
  planningTeam: PlanningTeam;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Create a complete team system instance
 *
 * @example
 * ```typescript
 * const system = await createTeamSystem({
 *   autoStart: true,
 *   planning: { enableEstimation: true }
 * });
 *
 * // Submit a task
 * await system.planningTeam.submitTask(task);
 *
 * // Cleanup
 * await system.stop();
 * ```
 */
export async function createTeamSystem(
  config: TeamSystemConfig = {}
): Promise<TeamSystem> {
  // Create registry
  const registry = new TeamRegistry(config.registry);

  // Create planning team with defaults
  const planningTeam = new PlanningTeam({
    ...DEFAULT_PLANNING_CONFIG,
    id: 'planning-main',
    name: 'Planning Team',
    ...config.planning,
  });

  // Initialize and register
  await planningTeam.initialize();
  registry.register(planningTeam);

  // Start if configured
  if (config.autoStart) {
    await planningTeam.start();
    registry.start();
  }

  return {
    registry,
    planningTeam,
    start: async () => {
      await planningTeam.start();
      registry.start();
    },
    stop: async () => {
      await registry.stop();
    },
  };
}
