/**
 * QA Agent LLM Executor
 *
 * Provides LLM-based QA execution for the QA Agent.
 *
 * Feature: LLM Integration for Agent OS
 */

import { z } from 'zod';
import { TaskDocument } from '../../workspace/task-document';
import { QAOutput, TestResult } from '../agents/qa-agent';
import { TeamAgentLLMAdapter } from './team-agent-llm';
import { QAPrompts } from './prompt-templates';

/**
 * Schema for test result validation
 */
const TestResultSchema = z.object({
  name: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  duration: z.number().optional(),
  error: z.string().optional(),
  stackTrace: z.string().optional(),
});

/**
 * Schema for test output validation
 */
const TestOutputSchema = z.object({
  summary: z.string(),
  testResults: z
    .object({
      total: z.number(),
      passed: z.number(),
      failed: z.number(),
      skipped: z.number(),
      tests: z.array(TestResultSchema),
    })
    .optional(),
  coverage: z
    .object({
      lines: z.number(),
      branches: z.number(),
      functions: z.number(),
      statements: z.number(),
    })
    .optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  recommendations: z.array(z.string()).optional(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

/**
 * Schema for review finding validation
 */
const ReviewFindingSchema = z.object({
  severity: z.enum(['critical', 'major', 'minor', 'info']),
  category: z.string(),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
});

/**
 * Schema for review output validation
 */
const ReviewOutputSchema = z.object({
  summary: z.string(),
  reviewFindings: z.array(ReviewFindingSchema).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  recommendations: z.array(z.string()).optional(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

/**
 * QA LLM Executor Options
 */
export interface QALLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Project context for additional information */
  projectContext?: string;
  /** Code to review (for review tasks) */
  codeToReview?: string;
  /** Minimum quality score for approval */
  minQualityScore?: number;
}

/**
 * Create a QA executor function using LLM
 */
export function createQALLMExecutor(
  options: QALLMExecutorOptions
): (task: TaskDocument) => Promise<QAOutput> {
  const { adapter, projectContext, codeToReview, minQualityScore = 70 } = options;

  return async (task: TaskDocument): Promise<QAOutput> => {
    const isReview = task.metadata.type === 'review';

    if (isReview) {
      // Handle review tasks
      const response = await adapter.execute(
        QAPrompts.reviewSystem,
        QAPrompts.reviewUser(task, codeToReview),
        ReviewOutputSchema
      );

      return {
        summary: response.parsed.summary,
        reviewFindings: response.parsed.reviewFindings,
        qualityScore: response.parsed.qualityScore,
        recommendations: response.parsed.recommendations,
        approved: response.parsed.approved,
        reason: response.parsed.reason,
      };
    }

    // Handle test tasks
    const response = await adapter.execute(
      QAPrompts.testSystem,
      QAPrompts.testUser(task, projectContext),
      TestOutputSchema
    );

    // Calculate approval based on quality score and test results
    const qualityScore = response.parsed.qualityScore || 0;
    const testsPassed = response.parsed.testResults?.failed === 0;
    const approved = response.parsed.approved ?? (testsPassed && qualityScore >= minQualityScore);

    return {
      summary: response.parsed.summary,
      testResults: response.parsed.testResults,
      coverage: response.parsed.coverage,
      qualityScore,
      recommendations: response.parsed.recommendations,
      approved,
      reason: response.parsed.reason || (approved ? 'All checks passed' : 'Quality requirements not met'),
    };
  };
}

/**
 * Validate QA output
 */
export function validateQAOutput(output: unknown): QAOutput {
  // Try test output first
  try {
    return TestOutputSchema.parse(output);
  } catch {
    // Fall back to review output
    return ReviewOutputSchema.parse(output);
  }
}

/**
 * Create a simple test result
 */
export function createTestResult(
  name: string,
  status: 'passed' | 'failed' | 'skipped',
  options?: { duration?: number; error?: string }
): TestResult {
  return {
    name,
    status,
    duration: options?.duration,
    error: options?.error,
  };
}
