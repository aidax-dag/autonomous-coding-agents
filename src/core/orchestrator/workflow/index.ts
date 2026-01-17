/**
 * Workflow Module
 *
 * YAML-based workflow definition and execution engine.
 *
 * Feature: Workflow Engine for Agent OS
 */

// Schema
export {
  // Schemas
  WorkflowDefinitionSchema,
  WorkflowStepSchema,
  ParallelStepGroupSchema,
  ConditionSchema,
  ConditionGroupSchema,
  RetryConfigSchema,
  WorkflowTriggerSchema,
  WorkflowVariableSchema,
  WorkflowOutputSchema,

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

  // Utilities
  validateWorkflowDefinition,
  isParallelGroup,
  getAllStepIds,
  validateDependencies,
  detectCircularDependencies,
} from './workflow-schema';

// Parser
export {
  // Functions
  parseWorkflowYaml,
  parseWorkflowFile,
  parseAndValidateWorkflow,
  serializeWorkflowToYaml,
  saveWorkflowToFile,
  loadWorkflowsFromDirectory,
  createWorkflowDefinition,

  // Errors
  WorkflowParseError,
  WorkflowValidationError,
} from './workflow-parser';

// Engine
export {
  // Classes
  WorkflowEngine,
  createWorkflowEngine,

  // Enums
  StepStatus,

  // Types
  type StepResult,
  type WorkflowContext,
  type WorkflowExecutionResult,
  type StepExecutor,
  type WorkflowEngineConfig,
  type WorkflowEngineEvents,
} from './workflow-engine';
