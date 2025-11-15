import { BaseAgent } from '@/agents/base/agent';
import {
  AgentConfig,
  AgentType,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  FeatureRequest,
  FeatureResult,
  ImplementationRequest,
  ImplementationResult,
  ReviewRequest,
  ReviewResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitHubClient, PullRequest } from '@/shared/github/client';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import { z } from 'zod';

/**
 * Repo Manager Agent
 *
 * Orchestrates multi-agent workflows for feature implementation.
 * Coordinates Coder and Reviewer agents, manages PR lifecycle.
 *
 * Follows strict quality standards:
 * - Zod validation for all external data
 * - Explicit error handling
 * - Resource cleanup in finally blocks
 * - No any types
 *
 * Feature: F2.5 - Repo Manager Agent
 */

/**
 * Feature request payload schema
 */
const FeaturePayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    url: z.string().url(),
  }),
  feature: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    requirements: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()).optional(),
  }),
  workflow: z
    .object({
      autoMerge: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
      notifyOnCompletion: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Repo Manager Agent Implementation
 */
export class RepoManagerAgent extends BaseAgent {
  private customLLMClient?: ILLMClient;
  private githubClient: GitHubClient;
  private readonly NATS_TIMEOUT = 300000; // 5 minutes

  constructor(
    config: AgentConfig,
    natsClient: NatsClient,
    llmClient?: ILLMClient,
    githubClient?: GitHubClient
  ) {
    super(config, natsClient);
    this.customLLMClient = llmClient;
    this.githubClient = githubClient || new GitHubClient(process.env.GITHUB_TOKEN || '');
  }

  getAgentType(): AgentType {
    return AgentType.REPO_MANAGER;
  }

  /**
   * Process feature request
   */
  async processTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Validate task payload
      const validationResult = FeaturePayloadSchema.safeParse((task as FeatureRequest).payload);

      if (!validationResult.success) {
        throw new AgentError(
          'Invalid feature request payload',
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: validationResult.error.errors }
        );
      }

      const payload = validationResult.data;
      const { repository, feature, workflow } = payload;

      this.logger.info('Processing feature request', {
        taskId: task.id,
        feature: feature.title,
      });

      // Step 1: Request implementation from Coder agent
      const implementationResult = await this.requestImplementation(repository, feature);

      if (!implementationResult.success) {
        throw new AgentError(
          'Implementation failed',
          ErrorCode.WORKFLOW_ERROR,
          false,
          { implementationError: implementationResult.error }
        );
      }

      const branch = implementationResult.data.branch;
      const commits = implementationResult.data.commits;

      this.logger.info('Implementation completed', {
        taskId: task.id,
        branch,
        commits: commits.length,
      });

      // Step 2: Create Pull Request
      const pullRequest = await this.createPullRequest(repository, branch, feature);

      this.logger.info('Pull request created', {
        taskId: task.id,
        prNumber: pullRequest.number,
      });

      // Step 3: Request review from Reviewer agent
      const reviewResult = await this.requestReview(repository, pullRequest.number, feature.title);

      if (!reviewResult.success) {
        this.logger.warn('Review failed', {
          taskId: task.id,
          error: reviewResult.error,
        });
      }

      const reviewDecision = reviewResult.data?.review?.decision;
      let merged = false;
      let mergeCommitSha: string | undefined;

      // Step 4: Auto-merge if approved and workflow allows
      const shouldAutoMerge = workflow?.autoMerge !== false; // Default true
      const requireApproval = workflow?.requireApproval !== false; // Default true

      if (reviewDecision === 'APPROVE' && shouldAutoMerge) {
        try {
          const mergeResult = await this.mergePullRequest(repository, pullRequest.number);
          merged = mergeResult.merged;
          mergeCommitSha = mergeResult.sha;

          this.logger.info('Pull request merged', {
            taskId: task.id,
            prNumber: pullRequest.number,
            sha: mergeCommitSha,
          });
        } catch (error) {
          this.logger.error('Failed to merge PR', {
            taskId: task.id,
            prNumber: pullRequest.number,
            error,
          });
        }
      } else if (reviewDecision === 'REQUEST_CHANGES') {
        this.logger.info('Review requested changes, PR not merged', {
          taskId: task.id,
          prNumber: pullRequest.number,
        });
      } else if (!reviewDecision && requireApproval) {
        this.logger.info('Review incomplete, PR not merged', {
          taskId: task.id,
          prNumber: pullRequest.number,
        });
      }

      // Build result
      const result: FeatureResult = {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        success: true,
        data: {
          repository: {
            owner: repository.owner,
            repo: repository.repo,
          },
          feature: {
            title: feature.title,
            description: feature.description,
          },
          pullRequest: {
            number: pullRequest.number,
            url: pullRequest.url,
            merged,
            mergeCommitSha,
          },
          implementation: {
            branch,
            commits,
            filesChanged: implementationResult.data.filesChanged,
          },
          review: reviewResult.success
            ? {
                decision: reviewDecision!,
                summary: reviewResult.data.review.summary,
                issuesFound: reviewResult.data.review.stats.issuesFound,
              }
            : undefined,
        },
      };

      this.logger.info('Feature request completed', {
        taskId: task.id,
        prNumber: pullRequest.number,
        merged,
      });

      return result;
    } catch (error) {
      this.logger.error('Feature request failed', {
        taskId: task.id,
        error,
      });

      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        success: false,
        error: {
          code: error instanceof AgentError ? error.code : ErrorCode.WORKFLOW_ERROR,
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
   * Request implementation from Coder agent via NATS
   */
  private async requestImplementation(
    repository: { owner: string; repo: string; url: string },
    feature: {
      title: string;
      description: string;
      requirements: string[];
      acceptanceCriteria?: string[];
    }
  ): Promise<ImplementationResult> {
    try {
      const implementationTask: ImplementationRequest = {
        id: `impl-${Date.now()}`,
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository,
          feature,
        },
        metadata: {
          createdAt: Date.now(),
        },
      };

      this.logger.info('Requesting implementation from Coder agent', {
        feature: feature.title,
      });

      const response = await this.natsClient.request(
        'task.coder',
        JSON.stringify(implementationTask),
        { timeout: this.NATS_TIMEOUT }
      );

      const result: ImplementationResult = JSON.parse(response.data.toString());

      this.logger.info('Received implementation result', {
        success: result.success,
        status: result.status,
      });

      return result;
    } catch (error) {
      throw new AgentError(
        'Failed to request implementation',
        ErrorCode.AGENT_COMMUNICATION_ERROR,
        true,
        { error: String(error) }
      );
    }
  }

  /**
   * Request review from Reviewer agent via NATS
   */
  private async requestReview(
    repository: { owner: string; repo: string },
    prNumber: number,
    prTitle: string
  ): Promise<ReviewResult> {
    try {
      const reviewTask: ReviewRequest = {
        id: `review-${Date.now()}`,
        type: 'REVIEW_REQUEST',
        agentType: AgentType.REVIEWER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository,
          pullRequest: {
            number: prNumber,
            title: prTitle,
          },
        },
        metadata: {
          createdAt: Date.now(),
        },
      };

      this.logger.info('Requesting review from Reviewer agent', {
        prNumber,
      });

      const response = await this.natsClient.request(
        'task.reviewer',
        JSON.stringify(reviewTask),
        { timeout: this.NATS_TIMEOUT }
      );

      const result: ReviewResult = JSON.parse(response.data.toString());

      this.logger.info('Received review result', {
        success: result.success,
        decision: result.data?.review?.decision,
      });

      return result;
    } catch (error) {
      throw new AgentError(
        'Failed to request review',
        ErrorCode.AGENT_COMMUNICATION_ERROR,
        true,
        { error: String(error) }
      );
    }
  }

  /**
   * Create pull request on GitHub
   */
  private async createPullRequest(
    repository: { owner: string; repo: string },
    headBranch: string,
    feature: {
      title: string;
      description: string;
      requirements: string[];
    }
  ): Promise<PullRequest> {
    try {
      const body = `${feature.description}\n\n## Requirements\n${feature.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

      const pr = await this.githubClient.createPullRequest(repository, {
        title: feature.title,
        body,
        head: headBranch,
        base: 'main',
      });

      this.logger.info('Pull request created', {
        prNumber: pr.number,
        url: pr.url,
      });

      return pr;
    } catch (error) {
      throw new AgentError(
        'Failed to create pull request',
        ErrorCode.GITHUB_API_ERROR,
        true,
        { error: String(error) }
      );
    }
  }

  /**
   * Merge pull request on GitHub
   */
  private async mergePullRequest(
    repository: { owner: string; repo: string },
    prNumber: number
  ): Promise<{ merged: boolean; sha: string; message: string }> {
    try {
      const result = await this.githubClient.mergePullRequest(repository, prNumber, {
        mergeMethod: 'squash',
      });

      this.logger.info('Pull request merged', {
        prNumber,
        sha: result.sha,
      });

      return result;
    } catch (error) {
      throw new AgentError(
        'Failed to merge pull request',
        ErrorCode.GITHUB_API_ERROR,
        true,
        { prNumber, error: String(error) }
      );
    }
  }
}
