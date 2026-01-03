/**
 * Workflow Module
 *
 * Provides workflow definition, execution, and orchestration capabilities.
 *
 * @module core/workflow
 *
 * @example
 * ```typescript
 * import {
 *   WorkflowBuilder,
 *   StepType,
 *   AgentType,
 *   validateWorkflowDefinition,
 * } from '@core/workflow';
 *
 * // Create a workflow using the builder
 * const workflow = WorkflowBuilder
 *   .create('code-review', 'Code Review Workflow')
 *   .description('Automated code review pipeline')
 *   .version('1.0.0')
 *   .agentStep('analyze', 'Analyze Code', AgentType.REVIEWER, 'code-review', {
 *     files: '${inputs.files}',
 *   })
 *   .agentStep('test', 'Run Tests', AgentType.TESTER, 'run-tests', {
 *     testFiles: '${inputs.testFiles}',
 *   }, { dependsOn: ['analyze'] })
 *   .build();
 *
 * // Validate a workflow definition
 * const result = validateWorkflowDefinition(workflowJson);
 * if (result.valid) {
 *   console.log('Valid workflow:', result.data);
 * }
 * ```
 */

// Enums
export {
  WorkflowStatus,
  StepStatus,
  StepType,
  ConditionOperator,
  LoopType,
  WaitType,
} from './workflow-definition';

// Schemas
export {
  VariableRefSchema,
  ConditionExpressionSchema,
  InputMappingSchema,
  OutputMappingSchema,
  RetryPolicySchema,
  TimeoutPolicySchema,
  ErrorHandlingPolicySchema,
  AgentStepConfigSchema,
  AgentStepSchema,
  ParallelStepSchema,
  SequentialStepSchema,
  ConditionStepSchema,
  LoopStepSchema,
  WaitStepSchema,
  TransformStepSchema,
  ApprovalStepSchema,
  SubworkflowStepSchema,
  StepDefinitionSchema,
  WorkflowTriggerSchema,
  WorkflowMetadataSchema,
  WorkflowVariableSchema,
  WorkflowDefinitionSchema,
} from './workflow-definition';

// Types
export type {
  ConditionExpression,
  InputMapping,
  OutputMapping,
  RetryPolicy,
  TimeoutPolicy,
  ErrorHandlingPolicy,
  AgentStepConfig,
  AgentStep,
  ParallelStep,
  SequentialStep,
  ConditionStep,
  LoopStep,
  WaitStep,
  TransformStep,
  ApprovalStep,
  SubworkflowStep,
  StepDefinition,
  WorkflowTrigger,
  WorkflowMetadata,
  WorkflowVariable,
  WorkflowDefinition,
} from './workflow-definition';

// Builder
export { WorkflowBuilder } from './workflow-definition';

// Utilities
export {
  validateWorkflowDefinition,
  validateStepDefinition,
  getAllStepIds,
  checkDuplicateStepIds,
  validateStepDependencies,
  createAgentStep,
  createCondition,
  and,
  or,
  not,
} from './workflow-definition';

// Workflow Engine
export {
  WorkflowEngine,
  createWorkflowEngine,
  WorkflowEngineEvents,
  WorkflowExecutionOptionsSchema,
  WorkflowEngineConfigSchema,
  type WorkflowInstance,
  type StepState,
  type LoopContext,
  type WorkflowError,
  type StepError,
  type WorkflowExecutionOptions,
  type WorkflowEngineConfig,
  type WorkflowEngineEventType,
  type WorkflowEventPayload,
  type StepEventPayload,
  type IWorkflowEngine,
  type WorkflowEngineStats,
} from './workflow-engine';

// Step Executor
export {
  StepExecutor,
  createStepExecutor,
  StepExecutorEvents,
  StepExecutorConfigSchema,
  RetryStrategy,
  type StepExecutionContext,
  type LoopExecutionContext,
  type StepExecutionResult,
  type StepExecutionError,
  type StepHookFn,
  type StepExecutorConfig,
  type StepExecutorEventType,
  type StepEventPayload as StepExecutorEventPayload,
  type IStepExecutor,
} from './step-executor';

// State Machine
export {
  StateMachine,
  StateMachineEvents,
  StateMachineConfigSchema,
  TransitionDefinitionSchema,
  StateDefinitionSchema,
  createWorkflowStateMachine,
  createStepStateMachine,
  isWorkflowStatusFinal,
  isStepStatusFinal,
  getValidWorkflowTransitions,
  getValidStepTransitions,
  type TransitionGuard,
  type TransitionAction,
  type StateAction,
  type TransitionDefinition,
  type StateDefinition,
  type StateMachineConfig,
  type TransitionHistoryEntry,
  type StateMachineEventType,
  type StateMachineEventPayload,
  type IStateMachine,
  type StateMachineSnapshot,
  type WorkflowStateMachineContext,
  type StepStateMachineContext,
} from './state-machine';
