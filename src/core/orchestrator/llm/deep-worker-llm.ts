/**
 * Deep Worker LLM Executors
 *
 * Provides LLM-based executors for the DeepWorker pipeline:
 * - ExplorationExecutor: explores codebase context before work
 * - PlanningExecutor: generates autonomous execution plans
 *
 * These differ from agent executors in that they operate on
 * DeepWorkerContext (not TaskDocument) and return domain-specific results.
 *
 * @module core/orchestrator/llm
 */

import { z } from 'zod';
import type {
  DeepWorkerContext,
  ExplorationResult,
  SelfPlanResult,
} from '../../deep-worker/interfaces/deep-worker.interface';
import type { ExplorationExecutor } from '../../deep-worker/pre-exploration';
import type { PlanningExecutor } from '../../deep-worker/self-planning';
import { TeamAgentLLMAdapter } from './team-agent-llm';

// ============================================================================
// Schemas
// ============================================================================

const ExplorationResultSchema = z.object({
  relevantFiles: z.array(z.string()),
  patterns: z.array(z.string()),
  dependencies: z.array(z.string()),
  summary: z.string(),
  duration: z.number().optional(),
});

const PlannedStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['explore', 'implement', 'test', 'review', 'refactor']),
  dependencies: z.array(z.string()),
  effort: z.enum(['small', 'medium', 'large']),
  completed: z.boolean(),
  error: z.string().optional(),
});

const SelfPlanResultSchema = z.object({
  steps: z.array(PlannedStepSchema),
  summary: z.string(),
  totalEffort: z.enum(['small', 'medium', 'large']),
  duration: z.number().optional(),
});

// ============================================================================
// Prompts
// ============================================================================

const explorationSystemPrompt = `You are a code exploration specialist in an autonomous coding agent system.
Your job is to analyze a workspace and task description, then identify:
1. Relevant files that need to be read or modified
2. Code patterns used in the project (e.g., Factory, Repository, Middleware)
3. Key dependencies (both internal modules and external packages)
4. A concise summary of the exploration findings

Always respond with structured JSON output as specified.
Be thorough but focused — only include files and patterns relevant to the task.

Output Format:
{
  "relevantFiles": ["src/path/to/file.ts"],
  "patterns": ["Pattern Name"],
  "dependencies": ["dependency-name"],
  "summary": "Exploration summary"
}`;

const selfPlanningSystemPrompt = `You are a planning specialist in an autonomous coding agent system.
Given a task description and exploration results, generate a step-by-step execution plan.

Each step should:
1. Have a unique ID (e.g., "step-1", "explore-auth", "impl-login")
2. Clearly describe what needs to be done
3. Specify its type: explore, implement, test, review, or refactor
4. List dependencies on other step IDs (steps that must complete first)
5. Estimate effort: small, medium, or large
6. Start with completed=false

Order steps logically: explore → implement → test → review.

Output Format:
{
  "steps": [{ "id": "...", "description": "...", "type": "...", "dependencies": [], "effort": "small|medium|large", "completed": false }],
  "summary": "Plan summary",
  "totalEffort": "small|medium|large"
}`;

// ============================================================================
// Executor Options
// ============================================================================

export interface DeepWorkerLLMExecutorOptions {
  /** LLM adapter for executing prompts */
  adapter: TeamAgentLLMAdapter;
}

// ============================================================================
// Exploration Executor
// ============================================================================

/**
 * Create an LLM-backed exploration executor for PreExploration.
 *
 * Signature matches ExplorationExecutor:
 *   (context: DeepWorkerContext) => Promise<ExplorationResult>
 */
export function createExplorationLLMExecutor(
  options: DeepWorkerLLMExecutorOptions,
): ExplorationExecutor {
  const { adapter } = options;

  return async (context: DeepWorkerContext): Promise<ExplorationResult> => {
    const start = Date.now();

    const userPrompt = buildExplorationUserPrompt(context);

    const response = await adapter.execute(
      explorationSystemPrompt,
      userPrompt,
      ExplorationResultSchema,
    );

    return {
      ...response.parsed,
      duration: Date.now() - start,
    };
  };
}

// ============================================================================
// Self-Planning Executor
// ============================================================================

/**
 * Create an LLM-backed planning executor for SelfPlanning.
 *
 * Signature matches PlanningExecutor:
 *   (context: DeepWorkerContext, exploration: ExplorationResult) => Promise<SelfPlanResult>
 */
export function createSelfPlanningLLMExecutor(
  options: DeepWorkerLLMExecutorOptions,
): PlanningExecutor {
  const { adapter } = options;

  return async (
    context: DeepWorkerContext,
    exploration: ExplorationResult,
  ): Promise<SelfPlanResult> => {
    const start = Date.now();

    const userPrompt = buildPlanningUserPrompt(context, exploration);

    const response = await adapter.execute(
      selfPlanningSystemPrompt,
      userPrompt,
      SelfPlanResultSchema,
    );

    return {
      ...response.parsed,
      duration: Date.now() - start,
    };
  };
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildExplorationUserPrompt(context: DeepWorkerContext): string {
  const parts: string[] = [
    '## Task',
    context.taskDescription,
    '',
    '## Workspace',
    `Directory: ${context.workspaceDir}`,
  ];

  if (context.projectContext) {
    parts.push('', '## Project Context', context.projectContext);
  }

  parts.push(
    '',
    '## Instructions',
    'Explore the workspace and identify relevant files, patterns, and dependencies for this task.',
    'Focus on files that will need to be read or modified.',
    'Respond with the JSON structure specified in your system prompt.',
  );

  return parts.join('\n');
}

function buildPlanningUserPrompt(
  context: DeepWorkerContext,
  exploration: ExplorationResult,
): string {
  const parts: string[] = [
    '## Task',
    context.taskDescription,
    '',
    '## Exploration Results',
    `Summary: ${exploration.summary}`,
    '',
    '### Relevant Files',
    ...exploration.relevantFiles.map((f) => `- ${f}`),
    '',
    '### Patterns Identified',
    ...exploration.patterns.map((p) => `- ${p}`),
    '',
    '### Dependencies',
    ...exploration.dependencies.map((d) => `- ${d}`),
  ];

  if (context.projectContext) {
    parts.push('', '## Project Context', context.projectContext);
  }

  parts.push(
    '',
    '## Instructions',
    'Create a step-by-step execution plan for this task.',
    'Use the exploration results to inform your plan.',
    'Order steps logically with proper dependencies.',
    'Respond with the JSON structure specified in your system prompt.',
  );

  return parts.join('\n');
}

// ============================================================================
// Validation helpers
// ============================================================================

export function validateExplorationResult(output: unknown): ExplorationResult {
  const parsed = ExplorationResultSchema.parse(output);
  return { ...parsed, duration: parsed.duration ?? 0 };
}

export function validateSelfPlanResult(output: unknown): SelfPlanResult {
  const parsed = SelfPlanResultSchema.parse(output);
  return { ...parsed, duration: parsed.duration ?? 0 };
}
