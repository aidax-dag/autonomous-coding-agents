/**
 * Runner Module
 *
 * Provides autonomous project execution by integrating all core components:
 * - TaskDecomposer: PRD analysis and task decomposition
 * - ProjectStore: Persistent state management
 * - Daemon: 24/7 continuous execution
 * - CompletionDetector: Quality gates and completion checking
 *
 * @module core/runner
 */

export {
  // Enums
  RunnerEvent,
  RunnerStatus,

  // Types
  type LLMProvider,
  type RealLLMConfig,
  type RunnerConfig,
  type CreateProjectParams,
  type ProjectRunResult,
  type IAutonomousRunner,

  // Schemas and Defaults
  RunnerConfigSchema,
  DEFAULT_RUNNER_CONFIG,

  // Classes
  AutonomousRunner,
  LLMAgentDispatcher,
  MockLLMClient,
  SharedLLMClientAdapter,

  // Factory Functions
  createAutonomousRunner,
  createMockAutonomousRunner,
  createRealAutonomousRunner,
  createAutonomousRunnerByProvider,
  createRealLLMClient,
} from './autonomous-runner';
