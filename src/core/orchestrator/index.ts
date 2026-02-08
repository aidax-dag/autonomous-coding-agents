/**
 * Orchestrator Module
 *
 * Provides agent coordination, task distribution, and workflow orchestration.
 *
 * @module core/orchestrator
 *
 * @example
 * ```typescript
 * import {
 *   OrchestratorService,
 *   createOrchestrator,
 *   RoutingStrategy,
 *   OrchestratorEvents,
 * } from '@core/orchestrator';
 *
 * // Create orchestrator with least-loaded routing
 * const orchestrator = createOrchestrator(agentRegistry, eventBus, {
 *   routingStrategy: RoutingStrategy.LEAST_LOADED,
 *   maxConcurrentTasks: 10,
 *   taskTimeout: 60000,
 * });
 *
 * // Start the orchestrator
 * await orchestrator.start();
 *
 * // Subscribe to events
 * orchestrator.on(OrchestratorEvents.TASK_COMPLETED, (payload) => {
 *   console.log(`Task ${payload.taskId} completed`);
 * });
 *
 * // Submit a task
 * const taskId = await orchestrator.submitTask(task);
 *
 * // Get statistics
 * const stats = orchestrator.getStats();
 * console.log(`Processed: ${stats.totalProcessed}, Failed: ${stats.failedTasks}`);
 * ```
 */

export {
  // Service
  OrchestratorService,
  createOrchestrator,

  // Enums
  RoutingStrategy,
  OrchestratorStatus,
  QueuedTaskStatus,

  // Events
  OrchestratorEvents,

  // Schemas
  OrchestratorConfigSchema,

  // Types
  type QueuedTask,
  type TaskAssignment,
  type OrchestratorConfig,
  type OrchestratorStats,
  type OrchestratorEventType,
  type OrchestratorEventPayload,
  type IOrchestrator,
} from './orchestrator-service';

export {
  // Task Decomposer
  TaskDecomposer,
  createTaskDecomposer,

  // Enums
  PRDSectionType,
  ComplexityLevel,
  DependencyType,
  DependencyStrength,

  // Schemas
  TaskDecomposerConfigSchema,

  // Defaults
  DEFAULT_TASK_DECOMPOSER_CONFIG,

  // Types
  type PRDFeature,
  type PRDAnalysis,
  type DecomposedTask,
  type TaskTree,
  type DependencyEdge,
  type DependencyGraph,
  type ExecutionPlan,
  type ExecutionPhase,
  type TaskDecomposerConfig,
  type ITaskDecomposer,
} from './task-decomposer';

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
