/**
 * LLM Integration for Team Agents
 *
 * Exports all LLM-related modules for the orchestrator.
 *
 * Feature: LLM Integration for Agent OS
 */

// Core adapter
export {
  TeamAgentLLMAdapter,
  TeamAgentLLMConfig,
  LLMParsedResponse,
  PromptContext,
  formatTaskForPrompt,
  createTeamAgentLLMAdapter,
} from './team-agent-llm';

// Prompt templates
export {
  PlanningPrompts,
  DevelopmentPrompts,
  QAPrompts,
  getPromptForTask,
} from './prompt-templates';

// Agent-specific executors
export {
  createPlanningLLMExecutor,
  validatePlanningOutput,
  PlanningLLMExecutorOptions,
  PlanningOutputSchema,
} from './planning-llm';

export {
  createDevelopmentLLMExecutor,
  validateDevelopmentOutput,
  DevelopmentLLMExecutorOptions,
} from './development-llm';

export {
  createQALLMExecutor,
  validateQAOutput,
  createTestResult,
  QALLMExecutorOptions,
} from './qa-llm';

// Code Quality LLM executors
export {
  CodeQualityPrompts,
  createTestGenerationLLMExecutor,
  createDeepReviewLLMExecutor,
  createRefactoringLLMExecutor,
  validateTestGenerationOutput,
  validateDeepReviewOutput,
  validateRefactoringOutput,
  TestGenerationOutputSchema,
  DeepReviewOutputSchema,
  RefactoringOutputSchema,
  type TestGenerationLLMExecutorOptions,
  type DeepReviewLLMExecutorOptions,
  type RefactoringLLMExecutorOptions,
} from './code-quality-llm';

// Expanded agent LLM executors
export {
  createArchitectureLLMExecutor,
  createSecurityLLMExecutor,
  createDebuggingLLMExecutor,
  createDocumentationLLMExecutor,
  createExplorationAgentLLMExecutor,
  createIntegrationLLMExecutor,
  validateArchitectureOutput,
  validateSecurityOutput,
  validateDebuggingOutput,
  validateDocumentationOutput,
  validateExplorationOutput,
  validateIntegrationOutput,
  ArchitecturePrompts,
  SecurityPrompts,
  DebuggingPrompts,
  DocumentationPrompts,
  ExplorationPrompts,
  IntegrationPrompts,
  type ExpandedAgentLLMExecutorOptions,
} from './expanded-agents-llm';

// Deep Worker LLM executors
export {
  createExplorationLLMExecutor,
  createSelfPlanningLLMExecutor,
  validateExplorationResult,
  validateSelfPlanResult,
  type DeepWorkerLLMExecutorOptions,
} from './deep-worker-llm';

// Skill LLM executors
export {
  createPlanningSkillLLMExecutor,
  createCodeReviewSkillLLMExecutor,
  createTestGenerationSkillLLMExecutor,
  createRefactoringSkillLLMExecutor,
  createSecurityScanSkillLLMExecutor,
  createDebuggingSkillLLMExecutor,
  createDocumentationSkillLLMExecutor,
  createPerformanceSkillLLMExecutor,
  SecurityScanOutputSchema,
  DebuggingOutputSchema,
  DocumentationOutputSchema,
  PerformanceOutputSchema,
  type SkillLLMExecutorOptions,
} from './skill-llm';
