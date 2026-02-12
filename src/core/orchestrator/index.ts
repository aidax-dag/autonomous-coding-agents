/**
 * Orchestrator Module
 *
 * Provides team-based orchestration, task distribution, and workflow execution.
 *
 * @module core/orchestrator
 */

// ============================================================================
// Team-based Orchestration (Agent OS)
// ============================================================================

export {
  // Team Agent
  TeamAgentStatus,
  TeamAgentConfigSchema,
  DEFAULT_TEAM_CONFIGS,
  createTeamConfig,

  // Types
  type ITeamAgent,
  type TeamCapability,
  type TeamMetrics,
  type TeamAgentConfig,
  type TaskHandler,
  type TaskHandlerResult,
} from './team-agent';

export {
  // Team Registry
  TeamRegistry,
  createDefaultRegistry,

  // Types
  type ITeamRegistry,
  type TeamLookupResult,
  type RegistryStats,
  type RegistryEvents,
} from './team-registry';

export {
  // Task Router
  TaskRouter,
  RoutingStrategy as TeamRoutingStrategy,

  // Types
  type TaskRouterConfig,
  type RoutingDecision,
  type RouterEvents,
} from './task-router';

export {
  // CEO Orchestrator
  CEOOrchestrator,
  CEOStatus,
  createOrchestrator as createCEOOrchestrator,

  // Types
  type CEOOrchestratorConfig,
  type CEOStats,
  type CEOEvents,
} from './ceo-orchestrator';

export {
  // Base Team Agent
  BaseTeamAgent,

  // Types
  type BaseTeamAgentEvents,
  type BaseTeamAgentOptions,
} from './base-team-agent';

// ============================================================================
// Concrete Team Agent Implementations
// ============================================================================

export {
  // Planning Agent
  PlanningAgent,
  createPlanningAgent,

  // Development Agent
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,

  // QA Agent
  QAAgent,
  createQAAgent,

  // Code Quality Agent
  CodeQualityAgent,
  createCodeQualityAgent,

  // Types
  type PlanningOutput,
  type PlanningAgentOptions,
  type DevelopmentOutput,
  type DevelopmentAgentOptions,
  type QAOutput,
  type QAAgentOptions,
  type TestResult,
  type CodeQualityAgentOptions,
  type GeneratedTestCase,
  type CodeReviewFinding,
  type RefactoringSuggestion,
  type TestGenerationOutput,
  type DeepReviewOutput,
  type RefactoringOutput,
} from './agents';

// ============================================================================
// LLM Integration
// ============================================================================

export {
  // Core Adapter
  TeamAgentLLMAdapter,
  createTeamAgentLLMAdapter,
  formatTaskForPrompt,

  // Prompt Templates
  PlanningPrompts,
  DevelopmentPrompts,
  QAPrompts,
  getPromptForTask,

  // Agent-specific LLM Executors
  createPlanningLLMExecutor,
  createDevelopmentLLMExecutor,
  createQALLMExecutor,
  validatePlanningOutput,
  validateDevelopmentOutput,
  validateQAOutput,
  createTestResult,

  // Code Quality LLM Executors
  CodeQualityPrompts,
  createTestGenerationLLMExecutor,
  createDeepReviewLLMExecutor,
  createRefactoringLLMExecutor,
  validateTestGenerationOutput,
  validateDeepReviewOutput,
  validateRefactoringOutput,

  // Types
  type TeamAgentLLMConfig,
  type LLMParsedResponse,
  type PromptContext,
  type PlanningLLMExecutorOptions,
  type DevelopmentLLMExecutorOptions,
  type QALLMExecutorOptions,
  type TestGenerationLLMExecutorOptions,
  type DeepReviewLLMExecutorOptions,
  type RefactoringLLMExecutorOptions,
} from './llm';

// ============================================================================
// End-to-End Workflow Runner
// ============================================================================

export {
  // Orchestrator Runner
  OrchestratorRunner,
  createOrchestratorRunner,
  createMockRunner,
  RunnerStatus,

  // Types
  type OrchestratorRunnerConfig,
  type RunnerEvents,
  type WorkflowResult,
  type GoalResult,
} from './orchestrator-runner';

export {
  // Agent Factory
  createAndRegisterAgents,

  // Types
  type AgentFactoryConfig,
  type CreatedAgents,
} from './agent-factory';

export {
  // Integration Setup
  initializeIntegrations,

  // Types
  type IntegrationFlags,
} from './integration-setup';

export {
  // Runner Config Factory
  createRunnerFromEnv,
  createRunnerFromConfig,
  buildRunnerConfig,
  loadRunnerConfig,

  // Schemas
  RunnerConfigSchema,

  // Types
  type RunnerConfig,
} from './runner-config';

export {
  // Runner State Manager
  RunnerStateManager,
} from './runner-state-manager';

export {
  // Error Escalator
  ErrorEscalator,
  createErrorEscalator,

  // Enums
  ErrorSeverity,
  EscalationAction,

  // Types
  type ErrorClassification,
  type ErrorEvent,
  type ErrorEscalatorConfig,
  type ErrorClassifier,
} from './error-escalator';

export {
  // Agent Workflow
  AgentWorkflow,
  createAgentWorkflow,
  createMockWorkflow,

  // Types
  type WorkflowType,
  type WorkflowStepResult,
  type FullWorkflowResult,
  type WorkflowOptions,
  type AgentWorkflowConfig,
  type AgentWorkflowEvents,
} from './agent-workflow';

// ============================================================================
// Parallel Execution (P0-2)
// ============================================================================

export {
  ParallelExecutor,
  createParallelExecutor,
} from './parallel-executor';

export {
  AgentPool,
  createAgentPool,
  type AgentPoolConfig,
} from './agent-pool';

export {
  BackgroundManager,
  createBackgroundManager,
} from './background-manager';

export type {
  IParallelExecutor,
  IAgentPool,
  TaskNode,
  TaskGroup,
  ParallelExecutorConfig,
  TaskExecutorFn,
  PoolStats,
  BackgroundTaskHandle,
} from './interfaces/parallel.interface';

// ============================================================================
// Quality Measurement Integration
// ============================================================================

export {
  // Quality Executor
  QualityExecutor,
  createQualityExecutor,
  createQAExecutor,

  // Types
  type QualityExecutorConfig,
} from './quality';

// ============================================================================
// YAML Workflow Engine
// ============================================================================

export {
  // Schema
  WorkflowDefinitionSchema,
  WorkflowStepSchema,
  ParallelStepGroupSchema,
  ConditionSchema,
  ConditionGroupSchema,
  RetryConfigSchema,
  WorkflowTriggerSchema,
  WorkflowVariableSchema,
  WorkflowOutputSchema,
  validateWorkflowDefinition,
  isParallelGroup,
  getAllStepIds,
  validateDependencies,
  detectCircularDependencies,

  // Parser
  parseWorkflowYaml,
  parseWorkflowFile,
  parseAndValidateWorkflow,
  serializeWorkflowToYaml,
  saveWorkflowToFile,
  loadWorkflowsFromDirectory,
  createWorkflowDefinition,
  WorkflowParseError,
  WorkflowValidationError,

  // Engine
  WorkflowEngine,
  createWorkflowEngine,
  StepStatus,

  // Types
  type WorkflowDefinition,
  type WorkflowStep,
  type ParallelStepGroup,
  type StepEntry,
  type Condition,
  type ConditionGroup,
  type ConditionExpression,
  type ComparisonOperator,
  type RetryConfig,
  type StepInput,
  type WorkflowTrigger,
  type WorkflowVariable,
  type WorkflowOutput,
  type StepResult,
  type WorkflowContext,
  type WorkflowExecutionResult,
  type StepExecutor,
  type WorkflowEngineConfig,
  type WorkflowEngineEvents,
} from './workflow';
