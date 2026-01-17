/**
 * Development Agent LLM Executor
 *
 * Provides LLM-based code execution for the Development Agent.
 *
 * Feature: LLM Integration for Agent OS
 */

import { z } from 'zod';
import { TaskDocument } from '../../workspace/task-document';
import { DevelopmentOutput } from '../agents/development-agent';
import { TeamAgentLLMAdapter } from './team-agent-llm';
import { DevelopmentPrompts } from './prompt-templates';

/**
 * Schema for development output validation
 */
const DevelopmentOutputSchema = z.object({
  summary: z.string(),
  filesModified: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['created', 'modified', 'deleted']),
      description: z.string(),
    })
  ),
  codeChanges: z
    .array(
      z.object({
        file: z.string(),
        language: z.string(),
        diff: z.string().optional(),
        newCode: z.string().optional(),
        explanation: z.string().optional(),
      })
    )
    .optional(),
  tests: z.array(z.string()).optional(),
  documentation: z.array(z.string()).optional(),
  reviewNotes: z.array(z.string()).optional(),
});

/**
 * Schema for bugfix output validation
 */
const BugfixOutputSchema = z.object({
  summary: z.string(),
  rootCause: z.string().optional(),
  filesModified: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['created', 'modified', 'deleted']),
      description: z.string(),
    })
  ),
  codeChanges: z
    .array(
      z.object({
        file: z.string(),
        language: z.string(),
        newCode: z.string().optional(),
        explanation: z.string().optional(),
      })
    )
    .optional(),
  tests: z.array(z.string()).optional(),
  reviewNotes: z.array(z.string()).optional(),
});

/**
 * Schema for refactor output validation
 */
const RefactorOutputSchema = z.object({
  summary: z.string(),
  rationale: z.string().optional(),
  filesModified: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['created', 'modified', 'deleted']),
      description: z.string(),
    })
  ),
  codeChanges: z
    .array(
      z.object({
        file: z.string(),
        language: z.string(),
        newCode: z.string().optional(),
        explanation: z.string().optional(),
      })
    )
    .optional(),
  improvements: z.array(z.string()).optional(),
  reviewNotes: z.array(z.string()).optional(),
});

/**
 * Development LLM Executor Options
 */
export interface DevelopmentLLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Project context for additional information */
  projectContext?: string;
}

/**
 * Create a code executor function using LLM
 */
export function createDevelopmentLLMExecutor(
  options: DevelopmentLLMExecutorOptions
): (task: TaskDocument) => Promise<DevelopmentOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<DevelopmentOutput> => {
    const taskType = task.metadata.type;

    // Select appropriate prompt and schema based on task type
    let systemPrompt: string;
    let schema: z.ZodSchema<{
      summary: string;
      filesModified: Array<{ path: string; action: 'created' | 'modified' | 'deleted'; description: string }>;
      codeChanges?: Array<{ file: string; language: string; newCode?: string; explanation?: string }>;
      tests?: string[];
      reviewNotes?: string[];
    }>;

    if (taskType === 'bugfix') {
      systemPrompt = DevelopmentPrompts.bugfixSystem;
      schema = BugfixOutputSchema;
    } else if (taskType === 'refactor') {
      systemPrompt = DevelopmentPrompts.refactorSystem;
      schema = RefactorOutputSchema;
    } else {
      systemPrompt = DevelopmentPrompts.featureSystem;
      schema = DevelopmentOutputSchema;
    }

    const response = await adapter.execute(
      systemPrompt,
      DevelopmentPrompts.featureUser(task, projectContext),
      schema
    );

    // Convert to DevelopmentOutput format
    return {
      summary: response.parsed.summary,
      filesModified: response.parsed.filesModified,
      codeChanges: response.parsed.codeChanges?.map((change) => ({
        file: change.file,
        language: change.language,
        newCode: change.newCode,
      })),
      tests: response.parsed.tests,
      reviewNotes: response.parsed.reviewNotes,
    };
  };
}

/**
 * Validate development output
 */
export function validateDevelopmentOutput(output: unknown): DevelopmentOutput {
  return DevelopmentOutputSchema.parse(output) as DevelopmentOutput;
}
