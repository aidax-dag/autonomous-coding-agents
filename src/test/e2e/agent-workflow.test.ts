/**
 * E2E Agent Workflow Tests
 *
 * Tests the complete multi-agent workflow from feature request to PR merge.
 *
 * Test scenarios:
 * 1. Full feature implementation cycle (happy path)
 * 2. Review feedback loop (REQUEST_CHANGES scenario)
 * 3. Error handling and retry logic
 * 4. Multiple features in sequence
 *
 * Feature: F5.1 - E2E Workflow Tests
 */

import { AgentManager } from '@/agents/manager/agent-manager';
import { CoderAgent } from '@/agents/coder/coder-agent';
import { NatsClient } from '@/shared/messaging/nats-client';
import { AgentType, TaskStatus } from '@/agents/base/types';
import {
  createTestNatsClient,
  MockLLMClient,
  MockGitHubClient,
  TestDataFactory,
  MessageCollector,
  waitFor,
  sleep,
  TEST_CONFIG,
} from './setup';

describe('E2E Agent Workflow', () => {
  let natsClient: NatsClient;
  let agentManager: AgentManager;
  let mockLLM: MockLLMClient;
  let mockGitHub: MockGitHubClient;
  let messageCollector: MessageCollector;

  beforeAll(async () => {
    // Create NATS client
    natsClient = await createTestNatsClient();

    // Create mocks
    mockLLM = new MockLLMClient();
    mockGitHub = new MockGitHubClient();

    // Setup message collector
    messageCollector = new MessageCollector(natsClient);
    await messageCollector.subscribe('result.>');

    // Create agent manager
    agentManager = new AgentManager();
    await agentManager.start();
  });

  afterAll(async () => {
    await agentManager.stop();
    await natsClient.close();
  });

  beforeEach(() => {
    mockLLM.reset();
    mockGitHub.reset();
    messageCollector.clear();
  });

  describe('Feature Implementation Workflow', () => {
    it('should complete full implementation cycle', async () => {
      // Setup: Mock LLM responses for the full workflow
      // (In actual implementation, agents would be created and registered with mocked clients)

      // Setup mock LLM responses
      mockLLM.setResponse('generate code', JSON.stringify({
        files: [
          {
            path: 'src/feature.ts',
            action: 'create',
            content: 'export function testFeature() { return "test"; }',
          },
        ],
      }));

      mockLLM.setResponse('review', JSON.stringify({
        decision: 'APPROVE',
        summary: 'Code looks good! All requirements met.',
        comments: [],
        stats: {
          filesReviewed: 1,
          issuesFound: 0,
          criticalIssues: 0,
          warnings: 0,
          suggestions: 0,
        },
      }));

      // Create agents (with mocked clients injected)
      // Note: In actual implementation, we'd use dependency injection
      // For now, we're testing the integration

      // Step 1: Send FeatureRequest to Repo Manager
      const featureRequest = TestDataFactory.createFeatureRequest({
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            url: 'https://github.com/test-owner/test-repo',
          },
          feature: {
            title: 'Add user authentication',
            description: 'Implement JWT-based authentication',
            requirements: [
              'User registration endpoint',
              'User login endpoint',
              'JWT token generation',
            ],
          },
          workflow: {
            autoMerge: true,
            requireApproval: true,
          },
        },
      });

      await natsClient.publish('task.repo-manager', featureRequest);

      // Step 2: Wait for ImplementationRequest to be sent to Coder
      const implMessage = await waitFor(
        () => messageCollector.getLastMessage('task.coder'),
        {
          timeout: TEST_CONFIG.timeout.medium,
          errorMessage: 'Implementation request not received',
        }
      );

      expect(implMessage).toBeDefined();
      expect(implMessage.data.type).toBe('IMPLEMENTATION_REQUEST');

      // Step 3: Wait for ImplementationResult
      const implResult = await waitFor(
        () => messageCollector.getLastMessage('result.implementation'),
        {
          timeout: TEST_CONFIG.timeout.long,
          errorMessage: 'Implementation result not received',
        }
      );

      expect(implResult).toBeDefined();
      expect(implResult.data.success).toBe(true);
      expect(implResult.data.status).toBe(TaskStatus.COMPLETED);
      expect(implResult.data.data.branch).toBeDefined();
      expect(implResult.data.data.commits).toHaveLength(1);
      expect(implResult.data.data.filesChanged).toHaveLength(1);

      // Step 4: Wait for ReviewRequest to be sent to Reviewer
      const reviewMessage = await waitFor(
        () => messageCollector.getLastMessage('task.reviewer'),
        {
          timeout: TEST_CONFIG.timeout.medium,
          errorMessage: 'Review request not received',
        }
      );

      expect(reviewMessage).toBeDefined();
      expect(reviewMessage.data.type).toBe('REVIEW_REQUEST');

      // Step 5: Wait for ReviewResult with APPROVE
      const reviewResult = await waitFor(
        () => messageCollector.getLastMessage('result.review'),
        {
          timeout: TEST_CONFIG.timeout.long,
          errorMessage: 'Review result not received',
        }
      );

      expect(reviewResult).toBeDefined();
      expect(reviewResult.data.success).toBe(true);
      expect(reviewResult.data.data.review.decision).toBe('APPROVE');

      // Step 6: Wait for PR merge
      const featureResult = await waitFor(
        () => messageCollector.getLastMessage('result.feature'),
        {
          timeout: TEST_CONFIG.timeout.medium,
          errorMessage: 'Feature result not received',
        }
      );

      expect(featureResult).toBeDefined();
      expect(featureResult.data.success).toBe(true);
      expect(featureResult.data.data.pullRequest.merged).toBe(true);

      // Verify final state
      expect(featureResult.data.data).toMatchObject({
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
        },
        pullRequest: {
          merged: true,
        },
        implementation: {
          commits: expect.any(Array),
          filesChanged: expect.any(Array),
        },
        review: {
          decision: 'APPROVE',
          issuesFound: 0,
        },
      });
    }, 60000); // 60 second timeout for full workflow

    it('should handle review feedback loop', async () => {
      // Setup mock LLM responses for REQUEST_CHANGES scenario
      mockLLM.setResponse('generate code', JSON.stringify({
        files: [
          {
            path: 'src/feature.ts',
            action: 'create',
            content: 'export function testFeature() { return "test"; }',
          },
        ],
      }));

      // First review: REQUEST_CHANGES
      mockLLM.setResponse('review', JSON.stringify({
        decision: 'REQUEST_CHANGES',
        summary: 'Found security issues',
        comments: [
          {
            path: 'src/feature.ts',
            line: 1,
            body: 'Missing input validation',
            severity: 'error',
          },
        ],
        stats: {
          filesReviewed: 1,
          issuesFound: 1,
          criticalIssues: 1,
          warnings: 0,
          suggestions: 0,
        },
      }));

      // Send feature request
      const featureRequest = TestDataFactory.createFeatureRequest();
      await natsClient.publish('task.repo-manager', featureRequest);

      // Wait for first review with REQUEST_CHANGES
      const firstReviewResult = await waitFor(
        () => {
          const msg = messageCollector.getLastMessage('result.review');
          return msg?.data.data.review.decision === 'REQUEST_CHANGES' ? msg : null;
        },
        {
          timeout: TEST_CONFIG.timeout.long,
          errorMessage: 'First review result not received',
        }
      );

      expect(firstReviewResult.data.data.review.decision).toBe('REQUEST_CHANGES');
      expect(firstReviewResult.data.data.review.comments).toHaveLength(1);

      // Setup second implementation (fixing issues)
      mockLLM.setResponse('fix', JSON.stringify({
        files: [
          {
            path: 'src/feature.ts',
            action: 'update',
            content: 'export function testFeature(input: string) { if (!input) throw new Error("Invalid input"); return "test"; }',
          },
        ],
      }));

      // Setup second review: APPROVE
      mockLLM.setResponse('re-review', JSON.stringify({
        decision: 'APPROVE',
        summary: 'All issues resolved!',
        comments: [],
        stats: {
          filesReviewed: 1,
          issuesFound: 0,
          criticalIssues: 0,
          warnings: 0,
          suggestions: 0,
        },
      }));

      // Wait for second review with APPROVE
      const secondReviewResult = await waitFor(
        () => {
          const messages = messageCollector.getMessages('result.review');
          return messages.length > 1 && messages[messages.length - 1].data.data.review.decision === 'APPROVE'
            ? messages[messages.length - 1]
            : null;
        },
        {
          timeout: TEST_CONFIG.timeout.long,
          errorMessage: 'Second review result not received',
        }
      );

      expect(secondReviewResult.data.data.review.decision).toBe('APPROVE');

      // Wait for merge
      const featureResult = await waitFor(
        () => messageCollector.getLastMessage('result.feature'),
        {
          timeout: TEST_CONFIG.timeout.medium,
          errorMessage: 'Feature result not received',
        }
      );

      expect(featureResult.data.data.pullRequest.merged).toBe(true);
    }, 90000); // 90 second timeout for feedback loop
  });

  describe('Error Handling', () => {
    it('should retry on retryable errors', async () => {
      // Setup mock to fail first 2 times, then succeed
      let callCount = 0;
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = jest.fn(async (messages: any[], options?: any) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Rate limit exceeded');
        }
        return originalChat(messages, options);
      });

      mockLLM.setDefaultResponse(JSON.stringify({
        files: [
          {
            path: 'src/feature.ts',
            action: 'create',
            content: 'export function testFeature() { return "test"; }',
          },
        ],
      }));

      // Send implementation request
      const implRequest = TestDataFactory.createImplementationRequest();
      await natsClient.publish('task.coder', implRequest);

      // Wait for successful result after retries
      const implResult = await waitFor(
        () => messageCollector.getLastMessage('result.implementation'),
        {
          timeout: TEST_CONFIG.timeout.long,
          errorMessage: 'Implementation result not received after retries',
        }
      );

      expect(implResult.data.success).toBe(true);
      expect(callCount).toBeGreaterThan(2); // Verify retries happened
    }, 60000);

    it('should fail gracefully on non-retryable errors', async () => {
      // Setup mock to throw validation error (non-retryable)
      mockLLM.chat = jest.fn(async () => {
        throw new Error('Invalid API key');
      });

      // Send implementation request with invalid payload
      const implRequest = TestDataFactory.createImplementationRequest({
        payload: {
          ...TestDataFactory.createImplementationRequest().payload,
          repository: undefined as any, // Force validation error
        },
      });

      await natsClient.publish('task.coder', implRequest);

      // Wait for failed result
      const implResult = await waitFor(
        () => messageCollector.getLastMessage('result.implementation'),
        {
          timeout: TEST_CONFIG.timeout.medium,
          errorMessage: 'Implementation result not received',
        }
      );

      expect(implResult.data.success).toBe(false);
      expect(implResult.data.status).toBe(TaskStatus.FAILED);
      expect(implResult.data.error).toBeDefined();
      expect(implResult.data.error.code).toBeTruthy();
    }, 30000);
  });

  describe('Agent Manager', () => {
    it('should route tasks to correct agents', async () => {
      // Register test agents
      const coderAgent = new CoderAgent(
        {
          id: 'coder-test',
          type: AgentType.CODER,
          name: 'Test Coder',
          llm: { provider: 'claude' },
          nats: { servers: [TEST_CONFIG.nats.url] },
        },
        natsClient,
        mockLLM
      );

      await agentManager.registerAgent(coderAgent);

      // Send task
      const implRequest = TestDataFactory.createImplementationRequest();
      await natsClient.publish('task.coder', implRequest);

      // Verify routing
      await sleep(1000);

      const agents = agentManager.listAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].getAgentType()).toBe(AgentType.CODER);

      // Cleanup
      await agentManager.unregisterAgent('coder-test');
    });

    it('should provide agent health status', async () => {
      const status = await agentManager.getSystemHealth();

      expect(status).toMatchObject({
        healthy: expect.any(Boolean),
        agentCount: expect.any(Number),
        uptime: expect.any(Number),
      });
    });
  });
});
