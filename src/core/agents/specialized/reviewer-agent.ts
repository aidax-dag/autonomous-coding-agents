/**
 * Reviewer Agent - DI-based Implementation
 *
 * Specialized agent for code review operations.
 * Uses dependency injection for testability and flexibility.
 *
 * Feature: F1.6 - Reviewer Agent Enhance
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentDependencies } from '../interfaces';
import {
  IAgentConfig,
  AgentCapability,
  ITask,
  TaskResult,
} from '../../interfaces';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for review task payload
 */
export const ReviewPayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1, 'Repository owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
  }),
  pullRequest: z.object({
    number: z.number().positive('Pull request number must be positive'),
    title: z.string().min(1, 'Pull request title is required'),
    description: z.string().optional(),
  }),
  reviewCriteria: z
    .object({
      checkSecurity: z.boolean().optional().default(true),
      checkPerformance: z.boolean().optional().default(true),
      checkTestCoverage: z.boolean().optional().default(true),
      checkDocumentation: z.boolean().optional().default(true),
      customRules: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({}),
});

export type ReviewPayload = z.infer<typeof ReviewPayloadSchema>;

/**
 * Schema for code review response from LLM
 */
export const CodeReviewResponseSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  summary: z.string().min(1, 'Review summary is required'),
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

export type CodeReviewResponse = z.infer<typeof CodeReviewResponseSchema>;

// ============================================================================
// Types
// ============================================================================

/**
 * Review decision types
 */
export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
  COMMENT = 'COMMENT',
}

/**
 * Review comment severity
 */
export enum CommentSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  state: string;
  user: {
    login: string;
  };
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * GitHub client interface for dependency injection
 */
export interface IGitHubClient {
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestInfo>;
  getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string>;
  createReview(
    owner: string,
    repo: string,
    prNumber: number,
    review: {
      body: string;
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      comments?: Array<{
        path: string;
        line?: number;
        position?: number;
        body: string;
      }>;
    }
  ): Promise<void>;
}

/**
 * CI checker interface for dependency injection
 */
export interface ICIChecker {
  checkCIStatus(owner: string, repo: string, sha: string): Promise<{
    status: 'success' | 'failure' | 'pending' | 'unknown';
    checks: Array<{
      name: string;
      status: string;
      conclusion?: string;
    }>;
  }>;
}

/**
 * Configuration for ReviewerAgent
 */
export interface ReviewerAgentConfig extends IAgentConfig {
  /** GitHub client for API operations */
  githubClient?: IGitHubClient;
  /** CI status checker */
  ciChecker?: ICIChecker;
  /** Maximum files to review in single pass */
  maxFilesPerReview?: number;
  /** Wait for CI before reviewing */
  waitForCI?: boolean;
  /** CI wait timeout in ms */
  ciWaitTimeout?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ============================================================================
// ReviewerAgent Implementation
// ============================================================================

/**
 * ReviewerAgent - Specialized agent for code review
 *
 * Capabilities:
 * - code-review: Analyze pull request changes
 * - ci-check: Verify CI status before review
 * - security-scan: Check for security issues
 * - performance-review: Analyze performance implications
 */
export class ReviewerAgent extends BaseAgent {
  private githubClient?: IGitHubClient;
  private ciChecker?: ICIChecker;
  private maxFilesPerReview: number;
  private waitForCI: boolean;
  private ciWaitTimeout: number;
  private retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: ReviewerAgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies);

    this.githubClient = config.githubClient;
    this.ciChecker = config.ciChecker;
    this.maxFilesPerReview = config.maxFilesPerReview ?? 50;
    this.waitForCI = config.waitForCI ?? true;
    this.ciWaitTimeout = config.ciWaitTimeout ?? 300000; // 5 minutes
    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    const capabilities: AgentCapability[] = [
      {
        name: 'code-review',
        description: 'Review pull request code changes',
        inputSchema: {
          type: 'object',
          properties: {
            repository: { type: 'object' },
            pullRequest: { type: 'object' },
            reviewCriteria: { type: 'object' },
          },
          required: ['repository', 'pullRequest'],
        },
      },
      {
        name: 'security-scan',
        description: 'Scan code for security vulnerabilities',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['code'],
        },
      },
      {
        name: 'performance-review',
        description: 'Analyze code for performance issues',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['code'],
        },
      },
    ];

    if (this.ciChecker) {
      capabilities.push({
        name: 'ci-check',
        description: 'Check CI/CD status for a commit',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
            repo: { type: 'string' },
            sha: { type: 'string' },
          },
          required: ['owner', 'repo', 'sha'],
        },
      });
    }

    return capabilities;
  }

  /**
   * Initialize agent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('ReviewerAgent initializing', {
      hasGitHubClient: !!this.githubClient,
      hasCIChecker: !!this.ciChecker,
      maxFilesPerReview: this.maxFilesPerReview,
      waitForCI: this.waitForCI,
    });

    // Validate GitHub client if waitForCI is enabled
    if (this.waitForCI && !this.ciChecker) {
      this.logger.warn('waitForCI enabled but no CI checker provided');
    }
  }

  /**
   * Start agent
   */
  protected async onStart(): Promise<void> {
    this.logger.info('ReviewerAgent started');
  }

  /**
   * Pause agent
   */
  protected async onPause(): Promise<void> {
    this.logger.info('ReviewerAgent paused');
  }

  /**
   * Resume agent
   */
  protected async onResume(): Promise<void> {
    this.logger.info('ReviewerAgent resumed');
  }

  /**
   * Stop agent
   */
  protected async onStop(): Promise<void> {
    this.logger.info('ReviewerAgent stopped');
  }

  /**
   * Cleanup agent resources
   */
  protected async onDispose(): Promise<void> {
    this.logger.info('ReviewerAgent disposed');
    this.githubClient = undefined;
    this.ciChecker = undefined;
  }

  /**
   * Process a review task
   */
  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();

    try {
      this.logger.info('Processing review task', {
        taskId: task.id,
        type: task.type,
      });

      // Route to appropriate handler
      switch (task.type) {
        case 'code-review':
          return await this.handleCodeReview(task, startTime);
        case 'security-scan':
          return await this.handleSecurityScan(task, startTime);
        case 'performance-review':
          return await this.handlePerformanceReview(task, startTime);
        case 'ci-check':
          return await this.handleCICheck(task, startTime);
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Task processing failed', {
        taskId: task.id,
        error: errorMessage,
      });

      return this.createFailureResult(
        task,
        error instanceof Error ? error : new Error(errorMessage),
        startTime
      );
    }
  }

  /**
   * Handle code review task
   */
  private async handleCodeReview(task: ITask, startTime: Date): Promise<TaskResult> {
    // Validate payload
    const validationResult = ReviewPayloadSchema.safeParse(task.payload);
    if (!validationResult.success) {
      throw new Error(`Invalid payload: ${validationResult.error.message}`);
    }

    const payload = validationResult.data;
    const { repository, pullRequest, reviewCriteria } = payload;

    // Check GitHub client
    if (!this.githubClient) {
      throw new Error('GitHub client not configured');
    }

    // Check CI status if enabled
    if (this.waitForCI && this.ciChecker) {
      const prInfo = await this.fetchPullRequest(repository.owner, repository.repo, pullRequest.number);
      const ciStatus = await this.waitForCICompletion(
        repository.owner,
        repository.repo,
        prInfo.head.sha
      );

      if (ciStatus.status === 'failure') {
        return this.createSuccessResult(
          task,
          {
            decision: ReviewDecision.COMMENT,
            summary: 'CI checks are failing. Please fix CI issues before requesting review.',
            ciStatus,
            skipped: true,
          },
          startTime
        );
      }
    }

    // Fetch PR details and diff
    const prInfo = await this.fetchPullRequest(repository.owner, repository.repo, pullRequest.number);
    const diff = await this.fetchPullRequestDiff(repository.owner, repository.repo, pullRequest.number);

    // Check file count
    if (prInfo.changedFiles > this.maxFilesPerReview) {
      this.logger.warn('PR exceeds max files limit', {
        changedFiles: prInfo.changedFiles,
        maxFiles: this.maxFilesPerReview,
      });
    }

    // Analyze changes with LLM
    const reviewResult = await this.analyzeChanges(prInfo, diff, reviewCriteria);

    // Post review to GitHub
    await this.postReview(repository.owner, repository.repo, pullRequest.number, reviewResult);

    return this.createSuccessResult(
      task,
      {
        review: reviewResult,
        pullRequest: {
          number: prInfo.number,
          title: prInfo.title,
          changedFiles: prInfo.changedFiles,
        },
      },
      startTime
    );
  }

  /**
   * Handle security scan task
   */
  private async handleSecurityScan(task: ITask, startTime: Date): Promise<TaskResult> {
    const { code, language } = task.payload as { code: string; language?: string };

    if (!code) {
      throw new Error('Code is required for security scan');
    }

    const prompt = this.buildSecurityScanPrompt(code, language);
    const response = await this.llmClient.complete(
      [
        { role: 'system', content: 'You are a security expert analyzing code for vulnerabilities.' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 2000 }
    );

    return this.createSuccessResult(
      task,
      {
        analysis: response.content,
        language,
      },
      startTime
    );
  }

  /**
   * Handle performance review task
   */
  private async handlePerformanceReview(task: ITask, startTime: Date): Promise<TaskResult> {
    const { code, context } = task.payload as { code: string; context?: string };

    if (!code) {
      throw new Error('Code is required for performance review');
    }

    const prompt = this.buildPerformanceReviewPrompt(code, context);
    const response = await this.llmClient.complete(
      [
        { role: 'system', content: 'You are a performance optimization expert analyzing code.' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 2000 }
    );

    return this.createSuccessResult(
      task,
      {
        analysis: response.content,
        context,
      },
      startTime
    );
  }

  /**
   * Handle CI check task
   */
  private async handleCICheck(task: ITask, startTime: Date): Promise<TaskResult> {
    if (!this.ciChecker) {
      throw new Error('CI checker not configured');
    }

    const { owner, repo, sha } = task.payload as { owner: string; repo: string; sha: string };

    if (!owner || !repo || !sha) {
      throw new Error('owner, repo, and sha are required for CI check');
    }

    const ciStatus = await this.ciChecker.checkCIStatus(owner, repo, sha);

    return this.createSuccessResult(task, ciStatus, startTime);
  }

  /**
   * Fetch pull request information
   */
  private async fetchPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequestInfo> {
    if (!this.githubClient) {
      throw new Error('GitHub client not configured');
    }

    return this.retryWithBackoff(async () => {
      return this.githubClient!.getPullRequest(owner, repo, prNumber);
    }, 'fetchPullRequest');
  }

  /**
   * Fetch pull request diff
   */
  private async fetchPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    if (!this.githubClient) {
      throw new Error('GitHub client not configured');
    }

    return this.retryWithBackoff(async () => {
      return this.githubClient!.getPullRequestDiff(owner, repo, prNumber);
    }, 'fetchPullRequestDiff');
  }

  /**
   * Wait for CI completion
   */
  private async waitForCICompletion(
    owner: string,
    repo: string,
    sha: string
  ): Promise<{ status: string; checks: Array<{ name: string; status: string; conclusion?: string }> }> {
    if (!this.ciChecker) {
      return { status: 'unknown', checks: [] };
    }

    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < this.ciWaitTimeout) {
      const ciStatus = await this.ciChecker.checkCIStatus(owner, repo, sha);

      if (ciStatus.status !== 'pending') {
        return ciStatus;
      }

      this.logger.debug('CI still pending, waiting...', {
        elapsed: Date.now() - startTime,
        timeout: this.ciWaitTimeout,
      });

      await this.sleep(pollInterval);
    }

    this.logger.warn('CI wait timeout exceeded', {
      owner,
      repo,
      sha,
      timeout: this.ciWaitTimeout,
    });

    return { status: 'unknown', checks: [] };
  }

  /**
   * Analyze code changes with LLM
   */
  private async analyzeChanges(
    prInfo: PullRequestInfo,
    diff: string,
    criteria?: ReviewPayload['reviewCriteria']
  ): Promise<CodeReviewResponse> {
    const prompt = this.buildReviewPrompt(prInfo, diff, criteria);

    const response = await this.llmClient.complete(
      [
        { role: 'system', content: this.buildReviewSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 4000 }
    );

    // Parse and validate response
    const parsed = this.parseReviewResponse(response.content);
    const validated = CodeReviewResponseSchema.safeParse(parsed);

    if (!validated.success) {
      this.logger.warn('LLM response validation failed, using defaults', {
        error: validated.error.message,
      });

      return {
        decision: ReviewDecision.COMMENT,
        summary: response.content.substring(0, 500),
        comments: [],
        stats: {
          filesReviewed: prInfo.changedFiles,
          issuesFound: 0,
          criticalIssues: 0,
          warnings: 0,
          suggestions: 0,
        },
      };
    }

    return validated.data;
  }

  /**
   * Post review to GitHub
   */
  private async postReview(
    owner: string,
    repo: string,
    prNumber: number,
    review: CodeReviewResponse
  ): Promise<void> {
    if (!this.githubClient) {
      throw new Error('GitHub client not configured');
    }

    await this.retryWithBackoff(async () => {
      await this.githubClient!.createReview(owner, repo, prNumber, {
        body: this.formatReviewBody(review),
        event: review.decision,
        comments: review.comments.map((c) => ({
          path: c.path,
          line: c.line,
          position: c.position,
          body: `**[${c.severity.toUpperCase()}]** ${c.body}`,
        })),
      });
    }, 'postReview');

    this.logger.info('Review posted successfully', {
      owner,
      repo,
      prNumber,
      decision: review.decision,
      commentsCount: review.comments.length,
    });
  }

  /**
   * Build review prompt for LLM
   */
  private buildReviewPrompt(
    prInfo: PullRequestInfo,
    diff: string,
    criteria?: ReviewPayload['reviewCriteria']
  ): string {
    const criteriaText = criteria
      ? `
Review Criteria:
- Security: ${criteria.checkSecurity ? 'Yes' : 'No'}
- Performance: ${criteria.checkPerformance ? 'Yes' : 'No'}
- Test Coverage: ${criteria.checkTestCoverage ? 'Yes' : 'No'}
- Documentation: ${criteria.checkDocumentation ? 'Yes' : 'No'}
${criteria.customRules?.length ? `- Custom Rules: ${criteria.customRules.join(', ')}` : ''}
`
      : '';

    return `
Please review the following pull request:

## Pull Request Information
- Title: ${prInfo.title}
- Description: ${prInfo.body || 'No description provided'}
- Author: ${prInfo.user.login}
- Base Branch: ${prInfo.base.ref}
- Head Branch: ${prInfo.head.ref}
- Changes: +${prInfo.additions} -${prInfo.deletions} in ${prInfo.changedFiles} files

${criteriaText}

## Code Diff
\`\`\`diff
${diff}
\`\`\`

Please provide your review in JSON format with the following structure:
{
  "decision": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "summary": "Brief summary of your review",
  "comments": [
    {
      "path": "file path",
      "line": line number (optional),
      "position": diff position (optional),
      "body": "comment text",
      "severity": "info" | "warning" | "error"
    }
  ],
  "stats": {
    "filesReviewed": number,
    "issuesFound": number,
    "criticalIssues": number,
    "warnings": number,
    "suggestions": number
  }
}
`;
  }

  /**
   * Build system prompt for code review
   */
  private buildReviewSystemPrompt(): string {
    return `You are an expert code reviewer with deep knowledge of software engineering best practices.

Your responsibilities:
1. Review code for correctness, security, performance, and maintainability
2. Identify bugs, vulnerabilities, and potential issues
3. Suggest improvements and best practices
4. Provide constructive feedback

Guidelines:
- Be thorough but concise
- Focus on significant issues first
- Provide actionable feedback
- Use appropriate severity levels
- Consider the context and scope of changes

Response Format:
Always respond with valid JSON matching the requested schema.`;
  }

  /**
   * Build security scan prompt
   */
  private buildSecurityScanPrompt(code: string, language?: string): string {
    return `
Analyze the following ${language || 'code'} for security vulnerabilities:

\`\`\`${language || ''}
${code}
\`\`\`

Check for:
1. Injection vulnerabilities (SQL, XSS, Command injection)
2. Authentication/Authorization issues
3. Data exposure risks
4. Cryptographic weaknesses
5. Input validation issues
6. OWASP Top 10 vulnerabilities

Provide a detailed security analysis with severity ratings.
`;
  }

  /**
   * Build performance review prompt
   */
  private buildPerformanceReviewPrompt(code: string, context?: string): string {
    return `
Analyze the following code for performance issues:

${context ? `Context: ${context}\n` : ''}

\`\`\`
${code}
\`\`\`

Check for:
1. Time complexity issues (O(n²) or worse)
2. Memory leaks and inefficient memory usage
3. Unnecessary iterations or computations
4. Database query optimization opportunities
5. Caching opportunities
6. Async/await optimization

Provide recommendations with expected impact.
`;
  }

  /**
   * Parse LLM review response
   */
  private parseReviewResponse(content: string): unknown {
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        this.logger.warn('Failed to parse JSON from response');
      }
    }

    // Return raw content wrapped in expected structure
    return {
      decision: 'COMMENT',
      summary: content,
      comments: [],
      stats: {
        filesReviewed: 0,
        issuesFound: 0,
        criticalIssues: 0,
        warnings: 0,
        suggestions: 0,
      },
    };
  }

  /**
   * Format review body for GitHub
   */
  private formatReviewBody(review: CodeReviewResponse): string {
    const emoji = {
      [ReviewDecision.APPROVE]: '✅',
      [ReviewDecision.REQUEST_CHANGES]: '🔴',
      [ReviewDecision.COMMENT]: '💬',
    };

    return `
${emoji[review.decision as ReviewDecision] || '💬'} **Code Review**

## Summary
${review.summary}

## Statistics
- Files Reviewed: ${review.stats.filesReviewed}
- Issues Found: ${review.stats.issuesFound}
- Critical: ${review.stats.criticalIssues}
- Warnings: ${review.stats.warnings}
- Suggestions: ${review.stats.suggestions}

---
*This review was generated by ReviewerAgent*
`.trim();
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );

          this.logger.warn(`${operationName} failed, retrying`, {
            attempt,
            maxAttempts: this.retryConfig.maxAttempts,
            delay,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.retryConfig.maxAttempts} attempts`);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ReviewerAgent instance
 */
export function createReviewerAgent(
  config: ReviewerAgentConfig,
  dependencies: AgentDependencies
): ReviewerAgent {
  return new ReviewerAgent(config, dependencies);
}
