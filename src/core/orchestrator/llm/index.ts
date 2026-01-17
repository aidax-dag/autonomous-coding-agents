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
  type TestGenerationLLMExecutorOptions,
  type DeepReviewLLMExecutorOptions,
  type RefactoringLLMExecutorOptions,
} from './code-quality-llm';
