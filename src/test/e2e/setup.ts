/**
 * E2E Test Setup Utilities
 *
 * Provides test infrastructure for end-to-end agent workflow testing:
 * - NATS client initialization
 * - Mock LLM client
 * - Mock GitHub client
 * - Test data factories
 *
 * Feature: F5.1 - E2E Workflow Tests
 */

import { NatsClient, NatsClientConfig } from '@/shared/messaging/nats-client';
import { ILLMClient, LLMCompletionOptions, LLMMessage, LLMCompletionResult, LLMStreamCallback } from '@/shared/llm/base-client';
import { GitHubClient, GitHubRepo, PullRequest, Review } from '@/shared/github/client';
import {
  AgentType,
  TaskPriority,
  TaskStatus,
  FeatureRequest,
  ImplementationRequest,
  ReviewRequest,
} from '@/agents/base/types';

/**
 * Test environment configuration
 */
export const TEST_CONFIG = {
  nats: {
    url: process.env.TEST_NATS_URL || 'localhost:4222',
    reconnect: false,
    maxReconnectAttempts: 1,
  },
  timeout: {
    short: 1000,
    medium: 5000,
    long: 30000,
  },
};

/**
 * Wait for condition with timeout
 */
export async function waitFor<T>(
  fn: () => Promise<T> | T,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { timeout = TEST_CONFIG.timeout.medium, interval = 100, errorMessage } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      // Continue waiting
    }

    await sleep(interval);
  }

  throw new Error(errorMessage || `waitFor timeout after ${timeout}ms`);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create test NATS client
 */
export async function createTestNatsClient(): Promise<NatsClient> {
  const config: NatsClientConfig = {
    url: TEST_CONFIG.nats.url,
    reconnect: TEST_CONFIG.nats.reconnect,
    maxReconnectAttempts: TEST_CONFIG.nats.maxReconnectAttempts,
  };

  const client = new NatsClient(config);
  await client.connect();

  return client;
}

/**
 * Mock LLM Client for testing
 */
export class MockLLMClient implements ILLMClient {
  private responses: Map<string, string> = new Map();
  public callCount = 0;
  public lastMessages: LLMMessage[] = [];

  setResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }

  setDefaultResponse(response: string): void {
    this.responses.set('__default__', response);
  }

  getProvider(): string {
    return 'mock';
  }

  getDefaultModel(): string {
    return 'mock-model-1';
  }

  async chat(messages: LLMMessage[], _options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.callCount++;
    this.lastMessages = messages;

    // Try to find specific response based on last message content
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';

    let responseContent = this.responses.get('__default__') || '{}';

    for (const [key, response] of this.responses.entries()) {
      if (content.includes(key)) {
        responseContent = response;
        break;
      }
    }

    return {
      content: responseContent,
      model: 'mock-model-1',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
    };
  }

  async chatStream(
    _messages: LLMMessage[],
    _callback: LLMStreamCallback,
    _options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    throw new Error('chatStream not implemented in MockLLMClient');
  }

  getMaxContextLength(_model?: string): number {
    return 100000;
  }

  reset(): void {
    this.responses.clear();
    this.callCount = 0;
    this.lastMessages = [];
  }
}

/**
 * Mock GitHub Client for testing
 */
export class MockGitHubClient extends GitHubClient {
  public prs: Map<number, PullRequest> = new Map();
  public reviews: Map<number, Review[]> = new Map();
  public mergedPRs: Set<number> = new Set();

  private prCounter = 1;
  private reviewCounter = 1;

  constructor() {
    super('test-token');
  }

  async createPullRequest(
    _repo: GitHubRepo,
    options: any
  ): Promise<PullRequest> {
    const prNumber = this.prCounter++;

    const pr: PullRequest = {
      number: prNumber,
      title: options.title,
      body: options.body,
      state: 'open',
      head: {
        ref: options.head,
        sha: `head-sha-${prNumber}`,
      },
      base: {
        ref: options.base,
        sha: `base-sha-${prNumber}`,
      },
      user: {
        login: 'test-user',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `https://github.com/${_repo.owner}/${_repo.repo}/pull/${prNumber}`,
    };

    this.prs.set(prNumber, pr);
    return pr;
  }

  async getPullRequest(_repo: GitHubRepo, prNumber: number): Promise<PullRequest> {
    const pr = this.prs.get(prNumber);
    if (!pr) {
      throw new Error(`PR #${prNumber} not found`);
    }
    return pr;
  }

  async createReview(
    _repo: GitHubRepo,
    prNumber: number,
    _options: any
  ): Promise<Review> {
    const reviewId = this.reviewCounter++;

    const review: Review = {
      id: reviewId,
      body: _options?.body || '',
      state: _options?.event === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED',
      user: {
        login: 'test-reviewer',
      },
      submittedAt: new Date().toISOString(),
    };

    const existingReviews = this.reviews.get(prNumber) || [];
    existingReviews.push(review);
    this.reviews.set(prNumber, existingReviews);

    return review;
  }

  async mergePullRequest(
    _repo: GitHubRepo,
    prNumber: number,
    _options?: any
  ): Promise<{ merged: boolean; sha: string; message: string }> {
    const pr = this.prs.get(prNumber);
    if (!pr) {
      throw new Error(`PR #${prNumber} not found`);
    }

    this.mergedPRs.add(prNumber);

    return {
      merged: true,
      sha: `merge-sha-${prNumber}`,
      message: 'Pull Request successfully merged',
    };
  }

  reset(): void {
    this.prs.clear();
    this.reviews.clear();
    this.mergedPRs.clear();
    this.prCounter = 1;
    this.reviewCounter = 1;
  }
}

/**
 * Test data factories
 */
export class TestDataFactory {
  static createFeatureRequest(overrides?: Partial<FeatureRequest>): FeatureRequest {
    const id = `feature-${Date.now()}`;

    return {
      id,
      type: 'FEATURE_REQUEST',
      agentType: AgentType.REPO_MANAGER,
      priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      payload: {
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
          url: 'https://github.com/test-owner/test-repo',
        },
        feature: {
          title: 'Test Feature',
          description: 'A test feature for E2E testing',
          requirements: ['Requirement 1', 'Requirement 2'],
        },
        workflow: {
          autoMerge: true,
          requireApproval: true,
        },
      },
      metadata: {
        createdAt: Date.now(),
      },
      ...overrides,
    };
  }

  static createImplementationRequest(
    overrides?: Partial<ImplementationRequest>
  ): ImplementationRequest {
    const id = `impl-${Date.now()}`;

    return {
      id,
      type: 'IMPLEMENTATION_REQUEST',
      agentType: AgentType.CODER,
      priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      payload: {
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
          url: 'https://github.com/test-owner/test-repo',
        },
        branch: 'main',
        featureBranch: 'feature/test-feature',
        feature: {
          title: 'Test Feature',
          description: 'A test feature for E2E testing',
          requirements: ['Requirement 1', 'Requirement 2'],
        },
      },
      metadata: {
        createdAt: Date.now(),
      },
      ...overrides,
    };
  }

  static createReviewRequest(overrides?: Partial<ReviewRequest>): ReviewRequest {
    const id = `review-${Date.now()}`;

    return {
      id,
      type: 'REVIEW_REQUEST',
      agentType: AgentType.REVIEWER,
      priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      payload: {
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
        },
        pullRequest: {
          number: 1,
          title: 'Test PR',
          description: 'A test PR for E2E testing',
        },
        reviewCriteria: {
          checkSecurity: true,
          checkPerformance: true,
          checkTestCoverage: false,
        },
      },
      metadata: {
        createdAt: Date.now(),
      },
      ...overrides,
    };
  }
}

/**
 * Message collector for testing
 */
export class MessageCollector {
  private messages: any[] = [];
  private natsClient: NatsClient;

  constructor(natsClient: NatsClient) {
    this.natsClient = natsClient;
  }

  async subscribe(subject: string): Promise<void> {
    await this.natsClient.subscribe(subject, async (data) => {
      this.messages.push({
        subject,
        data,
        timestamp: Date.now(),
      });
    });
  }

  getMessages(subject?: string): any[] {
    if (subject) {
      return this.messages.filter((m) => m.subject === subject);
    }
    return this.messages;
  }

  getLastMessage(subject?: string): any | undefined {
    const messages = this.getMessages(subject);
    return messages[messages.length - 1];
  }

  clear(): void {
    this.messages = [];
  }
}
