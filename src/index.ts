/**
 * Autonomous Coding Agents - Public API
 *
 * Main entry point for npm package consumers. Exports the core orchestration,
 * agent, LLM, hook, skill, configuration, and error APIs required to embed
 * or extend the multi-agent system programmatically.
 *
 * Internal implementation details, platform-specific integrations (VS Code,
 * JetBrains, desktop), CLI, and UI modules are intentionally excluded.
 *
 * @module autonomous-coding-agents
 */

// ============================================================================
// Core: Orchestrator & Runner
// ============================================================================

export {
  // CEO Orchestrator
  CEOOrchestrator,
  createCEOOrchestrator,
  CEOStatus,
  type CEOOrchestratorConfig,
  type CEOStats,
  type CEOEvents,

  // Orchestrator Runner
  OrchestratorRunner,
  createOrchestratorRunner,
  RunnerStatus,
  type OrchestratorRunnerConfig,
  type RunnerEvents,
  type WorkflowResult,
  type GoalResult,

  // Runner Configuration
  createRunnerFromEnv,
  createRunnerFromConfig,
  buildRunnerConfig,
  loadRunnerConfig,
  RunnerConfigSchema,
  type RunnerConfig,

  // Runner Lifecycle
  RunnerLifecycle,
  type RunnerLifecycleDeps,
} from './core/orchestrator';

// ============================================================================
// Core: Team Agents & Registry
// ============================================================================

export {
  // Team Registry
  TeamRegistry,
  createDefaultRegistry,
  type ITeamRegistry,
  type TeamLookupResult,
  type RegistryStats,

  // Team Agent
  TeamAgentStatus,
  type ITeamAgent,
  type TeamCapability,
  type TeamMetrics,
  type TeamAgentConfig,

  // Base Team Agent
  BaseTeamAgent,
  type BaseTeamAgentOptions,

  // Task Router
  TaskRouter,
  TeamRoutingStrategy,
  type TaskRouterConfig,
  type RoutingDecision,
} from './core/orchestrator';

// ============================================================================
// Core: Services
// ============================================================================

export {
  // Service Registry
  ServiceRegistry,
  type ServiceRegistryConfig,

  // Logger
  ILogger,
  LogLevel,
  ConsoleLogger,
  createLogger,
  type LoggerConfig,
} from './core/services';

// ============================================================================
// Core: Hooks
// ============================================================================

export {
  // Hook infrastructure
  HookRegistry,
  HookExecutor,
  BaseHook,

  // Hook interfaces
  type IHook,
  type IHookRegistry,
  type IHookExecutor,
  type HookEvent,
  type HookAction,
  type HookContext,
  type HookResult,
  type HookConfig,
  type HookCondition,
  type HookExecutionOptions,
  type BuiltinHookType,
} from './core/hooks';

// ============================================================================
// Core: Skills
// ============================================================================

export {
  // Skill infrastructure
  SkillRegistry,
  createSkillRegistry,
  SkillPipeline,
  createSkillPipeline,

  // Skill interfaces
  type ISkill,
  type ISkillRegistry,
  type ISkillPipeline,
  type SkillContext,
  type SkillResult,
  type SkillInfo,
  type PipelineStepOptions,
  type PipelineResult,
  type SkillRegistryOptions,
  type SkillPipelineOptions,
} from './core/skills';

// ============================================================================
// Shared: LLM Clients & Routing
// ============================================================================

export {
  // LLM client interfaces (from base-client, re-exported via shared/llm)
  type ILLMClient,
  type LLMMessage,
  type LLMCompletionOptions,
  type LLMCompletionResult,
  type LLMStreamChunk,
  type LLMStreamCallback,
  BaseLLMClient,

  // Model Router
  ModelRouter,
  createModelRouter,
  type ModelRouterConfig,

  // Cost Tracker
  CostTracker,
  createCostTracker,

  // Routing interfaces
  type ModelTier,
  type ModelProfile,
  type RoutingContext,
  type IRoutingStrategy,
  type IModelRouter,
  type ICostTracker,

  // Model Profiles
  ModelProfileRegistry,
  createModelProfileRegistry,
  DEFAULT_MODEL_PROFILES,

  // Client factory functions
  createLLMClient,
  createCLILLMClient,
  createLLMClientFromConfig,
  createModelRouterFromConfig,
} from './shared/llm';

// ============================================================================
// Shared: Configuration
// ============================================================================

export {
  type Config,
  type LLMProvider,
  loadConfig,
  validateConfig,
  getConfig,
  resetConfig,
  getConfigValue,
  getLLMApiKey,
  isCLIProvider,
  isProduction,
  isDevelopment,
  isTest,
} from './shared/config';

// ============================================================================
// Shared: Errors
// ============================================================================

export {
  // Error classes
  AgentError,
  ConfigError,
  LLMError,
  LLMRateLimitError,
  LLMTimeoutError,
  GitHubError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubAuthenticationError,
  GitError,
  GitMergeConflictError,
  GitAuthenticationError,
  DatabaseError,
  AgentTimeoutError,
  ImplementationError,
  MaxTurnsExceededError,
  ValidationError,

  // Error codes enum
  ErrorCode,

  // Error utilities
  isAgentError,
  isRetryableError,
  getErrorCode,
  wrapError,
  retryWithBackoff,
} from './shared/errors/custom-errors';
