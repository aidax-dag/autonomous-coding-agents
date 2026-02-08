import { BaseAgent } from '@/agents/base/agent';
import {
  AgentConfig,
  AgentType,
  Task,
  TaskResult,
  TaskStatus,
  ReviewRequest,
  ReviewResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitHubClient, PullRequest, DiffFile, PullRequestDiff } from '@/shared/github/client';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import { CIChecker, CIStatus, CheckRun } from '@/shared/ci/index.js';
import { z } from 'zod';

/**
 * Reviewer Agent
 *
 * Responsible for reviewing code changes and providing feedback.
 * Uses LLM for code analysis and GitHub for PR interactions.
 *
 * Follows strict quality standards:
 * - Zod validation for all external data
 * - Explicit error handling with retries
 * - Resource cleanup in finally blocks
 * - No any types
 *
 * Feature: F2.4 - Reviewer Agent
 */

/**
 * Review request payload schema
 */
const ReviewPayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
  }),
  pullRequest: z.object({
    number: z.number().positive(),
    title: z.string().min(1),
    description: z.string().optional(),
  }),
  reviewCriteria: z
    .object({
      checkSecurity: z.boolean().optional(),
      checkPerformance: z.boolean().optional(),
      checkTestCoverage: z.boolean().optional(),
      checkDocumentation: z.boolean().optional(),
      customRules: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * LLM response schema for code review
 */
const CodeReviewResponseSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  summary: z.string(),
  comments: z.array(
    z.object({
      path: z.string(),
      line: z.number().optional(),
      position: z.number().optional(),
      body: z.string(),
      severity: z.enum(['info', 'warning', 'error']),
    })
  ),
  stats: z.object({
    filesReviewed: z.number(),
    issuesFound: z.number(),
    criticalIssues: z.number(),
    warnings: z.number(),
    suggestions: z.number(),
  }),
});

type CodeReviewResponse = z.infer<typeof CodeReviewResponseSchema>;

/**
 * Reviewer Agent Implementation
 */
export class ReviewerAgent extends BaseAgent {
  private customLLMClient?: ILLMClient;
  private githubClient: GitHubClient;
  private ciChecker: CIChecker;

  constructor(
    config: AgentConfig,
    natsClient: NatsClient,
    llmClient?: ILLMClient,
    githubClient?: GitHubClient,
    ciChecker?: CIChecker
  ) {
    super(config, natsClient);
    this.customLLMClient = llmClient;
    this.githubClient = githubClient || new GitHubClient(process.env.GITHUB_TOKEN || '');
    this.ciChecker = ciChecker || new CIChecker(process.env.GITHUB_TOKEN || '', {
      minCoverage: parseInt(process.env.MIN_COVERAGE || '80', 10),
    });
  }

  getAgentType(): AgentType {
    return AgentType.REVIEWER;
  }

  /**
   * Process review task
   */
  async processTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Validate task payload
      const validationResult = ReviewPayloadSchema.safeParse((task as ReviewRequest).payload);

      if (!validationResult.success) {
        throw new AgentError(
          'Invalid review request payload',
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: validationResult.error.errors }
        );
      }

      const payload = validationResult.data;
      const { repository, pullRequest, reviewCriteria } = payload;

      this.logger.info('Processing review request', {
        taskId: task.id,
        pr: pullRequest.number,
      });

      // Fetch PR details
      const pr = await this.fetchPullRequest(repository, pullRequest.number);

      // Fetch PR diff
      const prDiff = await this.fetchPullRequestDiff(repository, pullRequest.number);

      // Check CI status before review
      this.logger.info('Checking CI status', { pr: pullRequest.number, sha: pr.head.sha });
      const ciStatus = await this.ciChecker.waitForCompletion(
        repository.owner,
        repository.repo,
        pr.head.sha
      );

      // If CI failed, request changes
      if (this.ciChecker.isFailed(ciStatus)) {
        const failedChecks = this.ciChecker.getFailedChecks(ciStatus);
        const failureMessage = this.formatCIFailure(ciStatus, failedChecks);

        this.logger.warn('CI checks failed', {
          pr: pullRequest.number,
          failedCount: failedChecks.length,
        });

        // Post review about failed CI
        await this.githubClient.createReview(
          repository,
          pullRequest.number,
          {
            event: 'REQUEST_CHANGES',
            body: failureMessage,
          }
        );

        // Build early result - don't proceed with code review if CI failed
        const result: ReviewResult = {
          taskId: task.id,
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            repository: {
              owner: repository.owner,
              repo: repository.repo,
            },
            pullRequest: {
              number: pullRequest.number,
            },
            review: {
              id: 0,
              decision: 'REQUEST_CHANGES',
              summary: 'CI checks failed. Please fix the failing tests.',
              comments: [],
              stats: {
                filesReviewed: 0,
                issuesFound: failedChecks.length,
                criticalIssues: failedChecks.length,
                warnings: 0,
                suggestions: 0,
              },
            },
          },
        };

        return result;
      }

      this.logger.info('CI checks passed', { pr: pullRequest.number });

      // Analyze changes using LLM
      const analysisResult = await this.analyzeChanges(
        prDiff.files,
        {
          title: pr.title,
          description: pr.body || '',
        },
        reviewCriteria
      );

      // Post review to GitHub
      const postedReview = await this.postReview(repository, pullRequest.number, analysisResult);

      // Build result
      const result: ReviewResult = {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        success: true,
        data: {
          repository: {
            owner: repository.owner,
            repo: repository.repo,
          },
          pullRequest: {
            number: pullRequest.number,
          },
          review: {
            id: postedReview.id,
            decision: analysisResult.decision,
            summary: analysisResult.summary,
            comments: analysisResult.comments,
            stats: analysisResult.stats,
          },
        },
      };

      this.logger.info('Review completed successfully', {
        taskId: task.id,
        decision: analysisResult.decision,
        issuesFound: analysisResult.stats.issuesFound,
      });

      return result;
    } catch (error) {
      this.logger.error('Review failed', {
        taskId: task.id,
        error,
      });

      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        success: false,
        error: {
          code: error instanceof AgentError ? error.code : ErrorCode.REVIEW_FAILED,
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof AgentError ? error.context : undefined,
        },
        metadata: {
          completedAt: Date.now(),
          duration: Date.now() - startTime,
          agentId: this.config.id,
        },
      };
    }
  }

  /**
   * Fetch pull request details
   */
  private async fetchPullRequest(
    repository: { owner: string; repo: string },
    prNumber: number
  ): Promise<PullRequest> {
    try {
      const pr = await this.githubClient.getPullRequest(repository, prNumber);
      this.logger.info('PR details fetched', { pr: prNumber, title: pr.title });
      return pr;
    } catch (error) {
      throw new AgentError(
        'Failed to fetch pull request',
        ErrorCode.GITHUB_API_ERROR,
        true,
        { prNumber, error: String(error) }
      );
    }
  }

  /**
   * Fetch pull request diff
   */
  private async fetchPullRequestDiff(
    repository: { owner: string; repo: string },
    prNumber: number
  ): Promise<PullRequestDiff> {
    try {
      const diff = await this.githubClient.getPullRequestDiff(repository, prNumber);
      this.logger.info('PR diff fetched', { pr: prNumber, filesCount: diff.files.length });
      return diff;
    } catch (error) {
      throw new AgentError(
        'Failed to fetch pull request diff',
        ErrorCode.GITHUB_API_ERROR,
        true,
        { prNumber, error: String(error) }
      );
    }
  }

  /**
   * Analyze code changes using LLM with retry logic
   */
  private async analyzeChanges(
    files: DiffFile[],
    prInfo: { title: string; description: string },
    criteria?: {
      checkSecurity?: boolean;
      checkPerformance?: boolean;
      checkTestCoverage?: boolean;
      checkDocumentation?: boolean;
      customRules?: string[];
    }
  ): Promise<CodeReviewResponse> {
    return this.retryWithBackoff(async () => {
      const llm = this.customLLMClient || this.llmClient;

      const prompt = this.buildReviewPrompt(files, prInfo, criteria);

      try {
        const response = await llm.chat(
          [
            {
              role: 'system',
              content:
                'You are an expert code reviewer. Analyze code changes for quality, bugs, security, and performance issues. Provide constructive feedback.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          {
            temperature: 0.3,
            maxTokens: 4000,
          }
        );

        // Parse and validate response
        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(response.content);
        } catch {
          throw new AgentError(
            'LLM response is not valid JSON',
            ErrorCode.LLM_INVALID_RESPONSE,
            true,
            { content: response.content.substring(0, 200) }
          );
        }

        const validationResult = CodeReviewResponseSchema.safeParse(parsedContent);
        if (!validationResult.success) {
          throw new AgentError(
            'LLM response does not match expected schema',
            ErrorCode.LLM_INVALID_RESPONSE,
            true,
            { errors: validationResult.error.errors }
          );
        }

        return validationResult.data;
      } catch (error) {
        if (error instanceof AgentError) {
          throw error;
        }

        throw new AgentError(
          'Code analysis failed',
          ErrorCode.LLM_API_ERROR,
          true,
          { error: String(error) }
        );
      }
    }, 3);
  }

  /**
   * Build prompt for code review
   */
  private buildReviewPrompt(
    files: DiffFile[],
    prInfo: { title: string; description: string },
    criteria?: {
      checkSecurity?: boolean;
      checkPerformance?: boolean;
      checkTestCoverage?: boolean;
      checkDocumentation?: boolean;
      customRules?: string[];
    }
  ): string {
    const criteriaList: string[] = [];

    if (criteria?.checkSecurity) criteriaList.push('security vulnerabilities');
    if (criteria?.checkPerformance) criteriaList.push('performance issues');
    if (criteria?.checkTestCoverage) criteriaList.push('test coverage');
    if (criteria?.checkDocumentation) criteriaList.push('documentation completeness');
    if (criteria?.customRules && criteria.customRules.length > 0) {
      criteriaList.push(...criteria.customRules);
    }

    const criteriaSection =
      criteriaList.length > 0
        ? `\nFocus on these specific criteria:\n${criteriaList.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
        : '';

    const filesSection = files
      .map(
        (file) => `
File: ${file.filename} (${file.status})
Changes: +${file.additions} -${file.deletions}
${file.patch ? `\nDiff:\n${file.patch}` : ''}
`
      )
      .join('\n---\n');

    return `Review the following pull request:

Title: ${prInfo.title}
Description: ${prInfo.description || 'No description provided'}
${criteriaSection}
Files Changed (${files.length}):
${filesSection}

Provide a code review with the following structure:
1. Overall decision: APPROVE, REQUEST_CHANGES, or COMMENT
2. Summary of the review
3. Specific comments on issues (if any) with file path, line number, and severity
4. Statistics about the review

Return response in JSON format:
{
  "decision": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "summary": "Overall review summary",
  "comments": [
    {"path": "file/path.ts", "line": 10, "body": "Comment text", "severity": "error" | "warning" | "info"}
  ],
  "stats": {
    "filesReviewed": number,
    "issuesFound": number,
    "criticalIssues": number,
    "warnings": number,
    "suggestions": number
  }
}`;
  }

  /**
   * Post review to GitHub
   */
  private async postReview(
    repository: { owner: string; repo: string },
    prNumber: number,
    review: CodeReviewResponse
  ): Promise<{ id: number; body: string; state: string; submittedAt?: string }> {
    try {
      const result = await this.githubClient.createReview(repository, prNumber, {
        event: review.decision,
        body: review.summary,
        comments: review.comments,
      });

      this.logger.info('Review posted to GitHub', {
        pr: prNumber,
        reviewId: result.id,
        decision: review.decision,
      });

      return result;
    } catch (error) {
      throw new AgentError(
        'Failed to post review to GitHub',
        ErrorCode.GITHUB_API_ERROR,
        true,
        { prNumber, error: String(error) }
      );
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof AgentError
            ? error.retryable
            : error instanceof Error && error.message.toLowerCase().includes('rate limit');

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        // Wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: String(error),
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Format CI failure message for GitHub comment
   */
  private formatCIFailure(_ciStatus: CIStatus, failedChecks: CheckRun[]): string {
    const lines: string[] = [];

    lines.push('## ❌ CI Checks Failed\n');
    lines.push('The following CI checks have failed. Please fix these issues before the code can be reviewed:\n');

    for (const check of failedChecks) {
      lines.push(`### ${check.name}`);
      lines.push(`- **Status**: ${check.conclusion}`);

      if (check.detailsUrl) {
        lines.push(`- **Details**: ${check.detailsUrl}`);
      }

      if (check.output?.summary) {
        lines.push(`\n${check.output.summary}\n`);
      }

      lines.push('');
    }

    lines.push('---');
    lines.push('Once all CI checks pass, the code review will proceed automatically.');

    return lines.join('\n');
  }
}
