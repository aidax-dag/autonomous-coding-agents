/**
 * Webhook Event Handlers
 *
 * Handlers for processing GitHub webhook events and triggering agent tasks.
 *
 * Feature: F4.2 - GitHub Webhook Support
 */

import {
  WebhookEvent,
  PullRequestWebhookPayload,
  PullRequestReviewWebhookPayload,
  PingWebhookPayload,
} from './types.js';
import { NatsClient } from '@/shared/messaging/nats-client.js';
import { AgentType, ReviewRequest, TaskPriority, TaskStatus } from '@/agents/base/types.js';
import { createAgentLogger } from '@/shared/logging/logger.js';
import crypto from 'crypto';

const logger = createAgentLogger('Webhook', 'handlers');

/**
 * Webhook event handlers
 */
export class WebhookHandlers {
  private natsClient: NatsClient;

  constructor(natsClient: NatsClient) {
    this.natsClient = natsClient;
  }

  /**
   * Handle pull request events
   */
  async handlePullRequest(event: WebhookEvent): Promise<void> {
    const payload = event.payload as PullRequestWebhookPayload;
    const { action, pull_request, repository } = payload;

    logger.info('Processing pull request event', {
      action,
      pr: pull_request.number,
      repo: repository.full_name,
    });

    switch (action) {
      case 'opened':
        await this.handlePullRequestOpened(payload);
        break;

      case 'synchronize':
        await this.handlePullRequestSynchronized(payload);
        break;

      case 'reopened':
        await this.handlePullRequestReopened(payload);
        break;

      case 'closed':
        if (pull_request.merged) {
          await this.handlePullRequestMerged(payload);
        } else {
          await this.handlePullRequestClosed(payload);
        }
        break;

      default:
        logger.debug('Ignoring pull request action', { action });
    }
  }

  /**
   * Handle pull request review events
   */
  async handlePullRequestReview(event: WebhookEvent): Promise<void> {
    const payload = event.payload as PullRequestReviewWebhookPayload;
    const { action, review, pull_request, repository } = payload;

    logger.info('Processing pull request review event', {
      action,
      pr: pull_request.number,
      repo: repository.full_name,
      state: review.state,
    });

    switch (action) {
      case 'submitted':
        await this.handleReviewSubmitted(payload);
        break;

      case 'dismissed':
        await this.handleReviewDismissed(payload);
        break;

      default:
        logger.debug('Ignoring review action', { action });
    }
  }

  /**
   * Handle ping events
   */
  async handlePing(event: WebhookEvent): Promise<void> {
    const payload = event.payload as PingWebhookPayload;

    logger.info('Received ping event', {
      zen: payload.zen,
      hookId: payload.hook_id,
    });

    // Ping events don't require any action
  }

  /**
   * Handle PR opened - trigger code review
   */
  private async handlePullRequestOpened(payload: PullRequestWebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    logger.info('New PR opened, triggering review', {
      pr: pull_request.number,
      repo: repository.full_name,
    });

    await this.triggerCodeReview(payload, TaskPriority.HIGH);
  }

  /**
   * Handle PR synchronized (new commits pushed) - trigger code review
   */
  private async handlePullRequestSynchronized(payload: PullRequestWebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    logger.info('PR updated with new commits, triggering review', {
      pr: pull_request.number,
      repo: repository.full_name,
    });

    await this.triggerCodeReview(payload, TaskPriority.NORMAL);
  }

  /**
   * Handle PR reopened - trigger code review
   */
  private async handlePullRequestReopened(payload: PullRequestWebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    logger.info('PR reopened, triggering review', {
      pr: pull_request.number,
      repo: repository.full_name,
    });

    await this.triggerCodeReview(payload, TaskPriority.NORMAL);
  }

  /**
   * Handle PR merged
   */
  private async handlePullRequestMerged(payload: PullRequestWebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    logger.info('PR merged', {
      pr: pull_request.number,
      repo: repository.full_name,
      mergeCommit: pull_request.merge_commit_sha,
    });

    // Could trigger cleanup tasks, notifications, etc.
    // For now, just log
  }

  /**
   * Handle PR closed without merging
   */
  private async handlePullRequestClosed(payload: PullRequestWebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    logger.info('PR closed without merging', {
      pr: pull_request.number,
      repo: repository.full_name,
    });

    // Could trigger cleanup tasks
  }

  /**
   * Handle review submitted
   */
  private async handleReviewSubmitted(payload: PullRequestReviewWebhookPayload): Promise<void> {
    const { review, pull_request, repository } = payload;

    logger.info('Review submitted', {
      pr: pull_request.number,
      repo: repository.full_name,
      state: review.state,
      reviewer: review.user.login,
    });

    // If changes requested, could trigger auto-fix agent
    if (review.state === 'changes_requested') {
      logger.info('Changes requested on PR', {
        pr: pull_request.number,
        reviewer: review.user.login,
      });
      // TODO: Trigger auto-fix agent (F4.5)
    }

    // If approved, could trigger auto-merge
    if (review.state === 'approved') {
      logger.info('PR approved', {
        pr: pull_request.number,
        reviewer: review.user.login,
      });
      // TODO: Check if auto-merge is enabled and trigger
    }
  }

  /**
   * Handle review dismissed
   */
  private async handleReviewDismissed(payload: PullRequestReviewWebhookPayload): Promise<void> {
    const { review, pull_request, repository } = payload;

    logger.info('Review dismissed', {
      pr: pull_request.number,
      repo: repository.full_name,
      reviewer: review.user.login,
    });

    // Could trigger re-review
  }

  /**
   * Trigger code review task
   */
  private async triggerCodeReview(
    payload: PullRequestWebhookPayload,
    priority: TaskPriority
  ): Promise<void> {
    const { pull_request, repository } = payload;

    // Create review task
    const task: ReviewRequest = {
      id: crypto.randomUUID(),
      type: 'REVIEW_REQUEST',
      agentType: AgentType.REVIEWER,
      status: TaskStatus.PENDING,
      priority,
      payload: {
        repository: {
          owner: repository.owner.login,
          repo: repository.name,
        },
        pullRequest: {
          number: pull_request.number,
          title: pull_request.title,
          description: pull_request.body || undefined,
        },
        reviewCriteria: {
          checkSecurity: true,
          checkPerformance: true,
          checkTestCoverage: true,
          checkDocumentation: true,
        },
      },
      metadata: {
        createdAt: Date.now(),
        createdBy: 'webhook-server',
      },
    };

    try {
      // Publish task to NATS
      await this.natsClient.publish(`tasks.${AgentType.REVIEWER}`, task);

      logger.info('Review task published', {
        taskId: task.id,
        pr: pull_request.number,
        repo: repository.full_name,
      });
    } catch (error) {
      logger.error('Failed to publish review task', {
        pr: pull_request.number,
        error,
      });
      throw error;
    }
  }
}
