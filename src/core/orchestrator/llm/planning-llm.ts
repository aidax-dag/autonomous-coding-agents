/**
 * Planning Agent LLM Executor
 *
 * Provides LLM-based plan generation for the Planning Agent.
 *
 * Feature: LLM Integration for Agent OS
 */

import { z } from 'zod';
import { TaskDocument } from '../../workspace/task-document';
import { PlanningOutput } from '../agents/planning-agent';
import { TeamAgentLLMAdapter } from './team-agent-llm';
import { PlanningPrompts } from './prompt-templates';

/**
 * Schema for planning output validation
 */
const PlanningOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tasks: z.array(
    z.object({
      title: z.string(),
      type: z.enum([
        'feature',
        'bugfix',
        'refactor',
        'test',
        'review',
        'documentation',
        'infrastructure',
        'analysis',
        'planning',
        'design',
      ]),
      targetTeam: z.enum([
        'orchestrator',
        'planning',
        'design',
        'development',
        'frontend',
        'backend',
        'qa',
        'code-quality',
        'infrastructure',
        'pm',
        'issue-response',
      ]),
      description: z.string(),
      dependencies: z.array(z.string()).optional(),
      estimatedEffort: z.enum(['small', 'medium', 'large']).optional(),
    })
  ),
  phases: z
    .array(
      z.object({
        name: z.string(),
        taskIndices: z.array(z.number()),
        description: z.string(),
      })
    )
    .optional(),
  risks: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
});

/**
 * Schema for analysis output validation
 */
const AnalysisOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
});

/**
 * Planning LLM Executor Options
 */
export interface PlanningLLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Project context for additional information */
  projectContext?: string;
}

/**
 * Create a plan generator function using LLM
 */
export function createPlanningLLMExecutor(
  options: PlanningLLMExecutorOptions
): (task: TaskDocument) => Promise<PlanningOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<PlanningOutput> => {
    const isAnalysis = task.metadata.type === 'analysis';

    if (isAnalysis) {
      // Handle analysis tasks
      const response = await adapter.execute(
        PlanningPrompts.analysisSystem,
        PlanningPrompts.user(task, projectContext),
        AnalysisOutputSchema
      );

      // Convert analysis to planning output format
      return {
        title: response.parsed.title,
        summary: response.parsed.summary,
        tasks: (response.parsed.nextSteps || []).map((step, index) => ({
          title: `Step ${index + 1}: ${step}`,
          type: 'analysis' as const,
          targetTeam: 'planning' as const,
          description: step,
        })),
        risks: response.parsed.risks,
        assumptions: response.parsed.findings,
      };
    }

    // Handle planning tasks
    const response = await adapter.execute(
      PlanningPrompts.system,
      PlanningPrompts.user(task, projectContext),
      PlanningOutputSchema
    );

    return response.parsed;
  };
}

/**
 * Validate planning output
 */
export function validatePlanningOutput(output: unknown): PlanningOutput {
  return PlanningOutputSchema.parse(output);
}
