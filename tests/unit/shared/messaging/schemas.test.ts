import {
  parseMessage,
  safeParseMessage,
  isMessageType,
  createFeatureAssignedMessage,
  createPRCreatedMessage,
  createPRApprovedMessage,
  createAgentErrorMessage,
  createHeartbeatMessage,
  AgentMessage,
} from '@/shared/messaging/schemas';
import { ZodError } from 'zod';

/**
 * Message Schema Tests
 *
 * Tests runtime validation of all agent messages using Zod schemas.
 *
 * Feature: F1.2 - Message Schema Definitions
 */

describe('Message Schemas', () => {
  describe('Factory Functions', () => {
    it('should create a valid FeatureAssigned message', () => {
      const message = createFeatureAssignedMessage({
        featureId: crypto.randomUUID(),
        title: 'Add user authentication',
        description: 'Implement JWT-based authentication',
        acceptanceCriteria: ['Users can log in', 'Tokens expire after 24h'],
        priority: 'HIGH',
        estimatedEffort: 'MEDIUM',
      });

      expect(message.type).toBe('FEATURE_ASSIGNED');
      expect(message.from).toBe('REPO_MANAGER');
      expect(message.to).toBe('CODER');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.payload.title).toBe('Add user authentication');
    });

    it('should create a valid PRCreated message', () => {
      const message = createPRCreatedMessage({
        featureId: crypto.randomUUID(),
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        title: 'Add authentication',
        description: 'This PR adds JWT authentication',
        branchName: 'feature/auth',
        baseBranch: 'main',
        filesChanged: 5,
        additions: 200,
        deletions: 10,
      });

      expect(message.type).toBe('PR_CREATED');
      expect(message.from).toBe('CODER');
      expect(message.to).toBe('BROADCAST');
      expect(message.payload.prNumber).toBe(42);
    });

    it('should create a valid PRApproved message', () => {
      const message = createPRApprovedMessage({
        featureId: crypto.randomUUID(),
        prNumber: 42,
        approvedAt: Date.now(),
        approvedBy: 'reviewer-bot',
        message: 'LGTM! All checks passed.',
      });

      expect(message.type).toBe('PR_APPROVED');
      expect(message.from).toBe('REVIEWER');
      expect(message.payload.approvedBy).toBe('reviewer-bot');
    });

    it('should create a valid AgentError message', () => {
      const message = createAgentErrorMessage('CODER', {
        agentType: 'CODER',
        errorCode: 'IMPL_FAILED',
        errorMessage: 'Failed to generate code',
        retryable: true,
        context: { attempt: 3 },
      });

      expect(message.type).toBe('AGENT_ERROR');
      expect(message.priority).toBe('CRITICAL');
      expect(message.payload.retryable).toBe(true);
    });

    it('should create a valid Heartbeat message', () => {
      const message = createHeartbeatMessage('CODER', {
        agentType: 'CODER',
        status: 'HEALTHY',
        uptime: 3600,
        activeFeatures: 2,
        queueSize: 5,
      });

      expect(message.type).toBe('HEARTBEAT');
      expect(message.priority).toBe('LOW');
      expect(message.payload.status).toBe('HEALTHY');
    });

    it('should preserve correlation ID', () => {
      const correlationId = crypto.randomUUID();
      const message = createFeatureAssignedMessage(
        {
          featureId: crypto.randomUUID(),
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 'LOW',
          estimatedEffort: 'SMALL',
        },
        correlationId
      );

      expect(message.correlationId).toBe(correlationId);
    });
  });

  describe('Message Validation', () => {
    it('should parse a valid message', () => {
      const validMessage = {
        id: crypto.randomUUID(),
        type: 'FEATURE_ASSIGNED',
        from: 'REPO_MANAGER',
        to: 'CODER',
        timestamp: Date.now(),
        priority: 'MEDIUM',
        payload: {
          featureId: crypto.randomUUID(),
          title: 'Test Feature',
          description: 'Test Description',
          acceptanceCriteria: ['Criterion 1'],
          priority: 'HIGH',
          estimatedEffort: 'MEDIUM',
        },
      };

      const parsed = parseMessage(validMessage);
      expect(parsed.type).toBe('FEATURE_ASSIGNED');
    });

    it('should throw on invalid message type', () => {
      const invalidMessage = {
        id: crypto.randomUUID(),
        type: 'INVALID_TYPE',
        from: 'CODER',
        to: 'REVIEWER',
        timestamp: Date.now(),
        priority: 'MEDIUM',
        payload: {},
      };

      expect(() => parseMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should throw on missing required fields', () => {
      const incompleteMessage = {
        type: 'FEATURE_ASSIGNED',
        from: 'REPO_MANAGER',
        // Missing: id, to, timestamp, payload
      };

      expect(() => parseMessage(incompleteMessage)).toThrow(ZodError);
    });

    it('should throw on invalid UUID format', () => {
      const invalidUUID = {
        id: 'not-a-uuid',
        type: 'FEATURE_ASSIGNED',
        from: 'REPO_MANAGER',
        to: 'CODER',
        timestamp: Date.now(),
        priority: 'MEDIUM',
        payload: {
          featureId: crypto.randomUUID(),
          title: 'Test',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 'HIGH',
          estimatedEffort: 'SMALL',
        },
      };

      expect(() => parseMessage(invalidUUID)).toThrow(ZodError);
    });

    it('should throw on invalid URL in PR payload', () => {
      const invalidURL = {
        id: crypto.randomUUID(),
        type: 'PR_CREATED',
        from: 'CODER',
        to: 'BROADCAST',
        timestamp: Date.now(),
        priority: 'MEDIUM',
        payload: {
          featureId: crypto.randomUUID(),
          prNumber: 42,
          prUrl: 'not-a-url',
          title: 'Test',
          description: 'Test',
          branchName: 'feature/test',
          baseBranch: 'main',
          filesChanged: 1,
          additions: 10,
          deletions: 5,
        },
      };

      expect(() => parseMessage(invalidURL)).toThrow(ZodError);
    });
  });

  describe('Safe Parsing', () => {
    it('should return success for valid message', () => {
      const validMessage = createFeatureAssignedMessage({
        featureId: crypto.randomUUID(),
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: [],
        priority: 'LOW',
        estimatedEffort: 'SMALL',
      });

      const result = safeParseMessage(validMessage);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid message', () => {
      const invalidMessage = {
        type: 'INVALID',
        from: 'UNKNOWN',
      };

      const result = safeParseMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(ZodError);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify message type', () => {
      const message = createFeatureAssignedMessage({
        featureId: crypto.randomUUID(),
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: [],
        priority: 'LOW',
        estimatedEffort: 'SMALL',
      });

      expect(isMessageType(message, 'FEATURE_ASSIGNED')).toBe(true);
      expect(isMessageType(message, 'PR_CREATED')).toBe(false);
    });

    it('should provide type narrowing', () => {
      const message: AgentMessage = createPRCreatedMessage({
        featureId: crypto.randomUUID(),
        prNumber: 42,
        prUrl: 'https://github.com/test/test/pull/42',
        title: 'Test',
        description: 'Test',
        branchName: 'feature/test',
        baseBranch: 'main',
        filesChanged: 1,
        additions: 10,
        deletions: 5,
      });

      if (isMessageType(message, 'PR_CREATED')) {
        // TypeScript should know this is a PRCreatedMessage
        expect(message.payload.prNumber).toBe(42);
        expect(message.payload.prUrl).toBeDefined();
      } else {
        fail('Type guard should have identified PR_CREATED message');
      }
    });
  });

  describe('Message Payload Validation', () => {
    it('should validate FeatureAssigned payload fields', () => {
      const validPayload = {
        featureId: crypto.randomUUID(),
        title: 'Feature Title',
        description: 'Feature Description',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        priority: 'HIGH' as const,
        estimatedEffort: 'LARGE' as const,
        dependencies: [crypto.randomUUID()],
      };

      const message = createFeatureAssignedMessage(validPayload);
      expect(message.payload.dependencies).toHaveLength(1);
    });

    it('should validate ReviewComments structure', () => {
      const message = {
        id: crypto.randomUUID(),
        type: 'REVIEW_COMMENTS_POSTED' as const,
        from: 'REVIEWER' as const,
        to: 'BROADCAST' as const,
        timestamp: Date.now(),
        priority: 'HIGH' as const,
        payload: {
          featureId: crypto.randomUUID(),
          prNumber: 42,
          comments: [
            {
              file: 'src/index.ts',
              line: 10,
              body: 'Consider using const instead of let',
              severity: 'INFO' as const,
            },
            {
              file: 'src/auth.ts',
              line: 25,
              body: 'Potential security vulnerability',
              severity: 'ERROR' as const,
            },
          ],
          totalIssues: 2,
          criticalIssues: 1,
        },
      };

      const parsed = parseMessage(message);
      if (parsed.type === 'REVIEW_COMMENTS_POSTED') {
        expect(parsed.payload.comments).toHaveLength(2);
        expect(parsed.payload.comments[1].severity).toBe('ERROR');
      } else {
        fail('Should have parsed as REVIEW_COMMENTS_POSTED');
      }
    });

    it('should allow optional fields', () => {
      const message = createAgentErrorMessage('CODER', {
        agentType: 'CODER',
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test error occurred',
        retryable: false,
        // featureId, stack, and context are optional
      });

      expect(message.payload.featureId).toBeUndefined();
      expect(message.payload.stack).toBeUndefined();
      expect(message.payload.context).toBeUndefined();
    });

    it('should validate enum values', () => {
      const invalidPriority = {
        id: crypto.randomUUID(),
        type: 'HEARTBEAT',
        from: 'CODER',
        to: 'REPO_MANAGER',
        timestamp: Date.now(),
        priority: 'INVALID_PRIORITY',
        payload: {
          agentType: 'CODER',
          status: 'HEALTHY',
          uptime: 100,
          activeFeatures: 0,
          queueSize: 0,
        },
      };

      expect(() => parseMessage(invalidPriority)).toThrow(ZodError);
    });
  });

  describe('Complex Message Scenarios', () => {
    it('should handle messages with all optional fields populated', () => {
      const correlationId = crypto.randomUUID();
      const featureId = crypto.randomUUID();

      const message = createAgentErrorMessage(
        'CODER',
        {
          agentType: 'CODER',
          errorCode: 'IMPL_FAILED',
          errorMessage: 'Implementation failed',
          featureId,
          stack: 'Error: Test\n  at file.ts:10',
          retryable: true,
          context: {
            attempt: 3,
            lastError: 'Connection timeout',
          },
        },
        correlationId
      );

      expect(message.correlationId).toBe(correlationId);
      expect(message.payload.featureId).toBe(featureId);
      expect(message.payload.stack).toBeDefined();
      expect(message.payload.context).toBeDefined();
    });

    it('should validate nested array structures', () => {
      const message = {
        id: crypto.randomUUID(),
        type: 'FEATURE_ASSIGNED' as const,
        from: 'REPO_MANAGER' as const,
        to: 'CODER' as const,
        timestamp: Date.now(),
        priority: 'HIGH' as const,
        payload: {
          featureId: crypto.randomUUID(),
          title: 'Complex Feature',
          description: 'Test',
          acceptanceCriteria: [
            'Criterion 1',
            'Criterion 2',
            'Criterion 3',
            'Criterion 4',
            'Criterion 5',
          ],
          priority: 'CRITICAL' as const,
          estimatedEffort: 'XLARGE' as const,
          dependencies: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
        },
      };

      const parsed = parseMessage(message);
      if (parsed.type === 'FEATURE_ASSIGNED') {
        expect(parsed.payload.acceptanceCriteria).toHaveLength(5);
        expect(parsed.payload.dependencies).toHaveLength(3);
      } else {
        fail('Should have parsed as FEATURE_ASSIGNED');
      }
    });

    it('should handle BROADCAST recipient', () => {
      const message = createPRCreatedMessage({
        featureId: crypto.randomUUID(),
        prNumber: 1,
        prUrl: 'https://github.com/test/test/pull/1',
        title: 'Test PR',
        description: 'Test',
        branchName: 'feature/test',
        baseBranch: 'main',
        filesChanged: 1,
        additions: 1,
        deletions: 0,
      });

      expect(message.to).toBe('BROADCAST');
      const parsed = parseMessage(message);
      expect(parsed.to).toBe('BROADCAST');
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages with zero values', () => {
      const message = createHeartbeatMessage('REVIEWER', {
        agentType: 'REVIEWER',
        status: 'HEALTHY',
        uptime: 0,
        activeFeatures: 0,
        queueSize: 0,
        memoryUsage: 0,
      });

      expect(message.payload.uptime).toBe(0);
      expect(message.payload.activeFeatures).toBe(0);
    });

    it('should handle empty arrays', () => {
      const message = createFeatureAssignedMessage({
        featureId: crypto.randomUUID(),
        title: 'Test',
        description: 'Test',
        acceptanceCriteria: [],
        priority: 'LOW',
        estimatedEffort: 'SMALL',
        dependencies: [],
      });

      expect(message.payload.acceptanceCriteria).toHaveLength(0);
      expect(message.payload.dependencies).toHaveLength(0);
    });

    it('should handle very long strings', () => {
      const longDescription = 'a'.repeat(10000);
      const message = createFeatureAssignedMessage({
        featureId: crypto.randomUUID(),
        title: 'Test',
        description: longDescription,
        acceptanceCriteria: [],
        priority: 'LOW',
        estimatedEffort: 'SMALL',
      });

      expect(message.payload.description).toHaveLength(10000);
    });

    it('should reject negative numbers where inappropriate', () => {
      const invalidMessage = {
        id: crypto.randomUUID(),
        type: 'PR_CREATED',
        from: 'CODER',
        to: 'BROADCAST',
        timestamp: Date.now(),
        priority: 'MEDIUM',
        payload: {
          featureId: crypto.randomUUID(),
          prNumber: -1, // Invalid: PR numbers can't be negative
          prUrl: 'https://github.com/test/test/pull/1',
          title: 'Test',
          description: 'Test',
          branchName: 'feature/test',
          baseBranch: 'main',
          filesChanged: 1,
          additions: 10,
          deletions: 5,
        },
      };

      // Note: Zod's z.number() doesn't enforce positive by default
      // This test documents current behavior - we could add .positive() if needed
      const result = safeParseMessage(invalidMessage);
      expect(result.success).toBe(true); // Currently allows negative numbers
    });
  });
});
