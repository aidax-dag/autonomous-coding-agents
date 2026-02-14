/**
 * Tests for Multi-Agent Collaboration
 *
 * Covers FeedbackLoop, CollaborationManager, and integration scenarios.
 */

import { FeedbackLoop } from '@/core/collaboration/feedback-loop';
import { CollaborationManager } from '@/core/collaboration/collaboration-manager';
import type {
  AgentFeedback,
  FeedbackResponse,
  CollaborationConfig,
  CollaborationSession,
} from '@/core/collaboration/types';
import { DEFAULT_COLLABORATION_CONFIG } from '@/core/collaboration/types';

// ============================================================================
// Helpers
// ============================================================================

let feedbackIdCounter = 0;

function makeFeedback(
  overrides: Partial<AgentFeedback> = {},
): AgentFeedback {
  feedbackIdCounter++;
  return {
    id: `fb-${feedbackIdCounter}`,
    fromAgent: 'agent-a',
    toAgent: 'agent-b',
    taskId: 'task-1',
    type: 'suggestion',
    priority: 'normal',
    content: 'Test feedback content',
    timestamp: new Date().toISOString(),
    requiresResponse: true,
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<CollaborationConfig> = {},
): CollaborationConfig {
  return {
    ...DEFAULT_COLLABORATION_CONFIG,
    ...overrides,
  };
}

// ============================================================================
// FeedbackLoop
// ============================================================================

describe('FeedbackLoop', () => {
  let loop: FeedbackLoop;

  beforeEach(() => {
    feedbackIdCounter = 0;
    loop = new FeedbackLoop(makeConfig());
  });

  describe('sendFeedback', () => {
    it('should create a session when sending feedback', async () => {
      const feedback = makeFeedback();
      await loop.sendFeedback(feedback);

      const sessions = loop.getActiveSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].taskId).toBe('task-1');
      expect(sessions[0].participants).toContain('agent-a');
      expect(sessions[0].participants).toContain('agent-b');
    });

    it('should add feedback to existing session for same task and agents', async () => {
      const fb1 = makeFeedback({ id: 'fb-1' });
      const fb2 = makeFeedback({ id: 'fb-2' });

      await loop.sendFeedback(fb1);
      await loop.sendFeedback(fb2);

      const sessions = loop.getActiveSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].feedbackHistory).toHaveLength(2);
    });

    it('should create separate sessions for different tasks', async () => {
      await loop.sendFeedback(makeFeedback({ taskId: 'task-1' }));
      await loop.sendFeedback(makeFeedback({ taskId: 'task-2' }));

      const sessions = loop.getActiveSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should enforce max feedback rounds', async () => {
      const config = makeConfig({ maxFeedbackRounds: 2, autoEscalateOnConflict: true });
      loop = new FeedbackLoop(config);

      await loop.sendFeedback(makeFeedback({ id: 'fb-1' }));
      await loop.sendFeedback(makeFeedback({ id: 'fb-2' }));
      // Third feedback should trigger escalation, not be added
      await loop.sendFeedback(makeFeedback({ id: 'fb-3' }));

      const sessions = Array.from(loop.getAllSessions().values());
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('escalated');
      expect(sessions[0].feedbackHistory).toHaveLength(2);
    });

    it('should not escalate when autoEscalateOnConflict is false', async () => {
      const config = makeConfig({ maxFeedbackRounds: 2, autoEscalateOnConflict: false });
      loop = new FeedbackLoop(config);

      await loop.sendFeedback(makeFeedback({ id: 'fb-1' }));
      await loop.sendFeedback(makeFeedback({ id: 'fb-2' }));
      // Third feedback should still not be added (max rounds reached) but no escalation
      await loop.sendFeedback(makeFeedback({ id: 'fb-3' }));

      const sessions = Array.from(loop.getAllSessions().values());
      expect(sessions[0].status).toBe('active');
      // feedback not added because limit reached
      expect(sessions[0].feedbackHistory).toHaveLength(2);
    });

    it('should emit feedback:sent and feedback:received events', async () => {
      const sentEvents: AgentFeedback[] = [];
      const receivedEvents: AgentFeedback[] = [];

      loop.on('feedback:sent', (fb) => sentEvents.push(fb));
      loop.on('feedback:received', (fb) => receivedEvents.push(fb));

      const feedback = makeFeedback();
      await loop.sendFeedback(feedback);

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0].id).toBe(feedback.id);
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].id).toBe(feedback.id);
    });

    it('should emit session:created event on first feedback', async () => {
      const created: CollaborationSession[] = [];
      loop.on('session:created', (s) => created.push(s));

      await loop.sendFeedback(makeFeedback());

      expect(created).toHaveLength(1);
      expect(created[0].status).toBe('active');
    });
  });

  describe('respondToFeedback', () => {
    it('should add response to the correct session', async () => {
      const feedback = makeFeedback({ id: 'fb-target' });
      await loop.sendFeedback(feedback);

      const response: FeedbackResponse = {
        feedbackId: 'fb-target',
        fromAgent: 'agent-b',
        accepted: true,
        action: 'Will implement suggestion',
      };

      await loop.respondToFeedback(response);

      const sessions = loop.getActiveSessions();
      expect(sessions[0].responses).toHaveLength(1);
      expect(sessions[0].responses[0].accepted).toBe(true);
    });

    it('should emit feedback:response event', async () => {
      const responses: FeedbackResponse[] = [];
      loop.on('feedback:response', (r) => responses.push(r));

      await loop.sendFeedback(makeFeedback({ id: 'fb-resp' }));
      await loop.respondToFeedback({
        feedbackId: 'fb-resp',
        fromAgent: 'agent-b',
        accepted: false,
        action: 'Rejected',
      });

      expect(responses).toHaveLength(1);
      expect(responses[0].accepted).toBe(false);
    });

    it('should handle response for nonexistent feedback gracefully', async () => {
      // Should not throw
      await loop.respondToFeedback({
        feedbackId: 'nonexistent',
        fromAgent: 'agent-x',
        accepted: true,
        action: 'ignored',
      });
    });
  });

  describe('registerHandler', () => {
    it('should invoke handler when matching feedback type is sent', async () => {
      const handled: AgentFeedback[] = [];

      loop.registerHandler('suggestion', async (fb) => {
        handled.push(fb);
        return {
          feedbackId: fb.id,
          fromAgent: fb.toAgent,
          accepted: true,
          action: 'auto-accepted',
        };
      });

      await loop.sendFeedback(makeFeedback({ type: 'suggestion' }));

      expect(handled).toHaveLength(1);
    });

    it('should not invoke handler for non-matching feedback type', async () => {
      const handled: AgentFeedback[] = [];

      loop.registerHandler('rejection', async (fb) => {
        handled.push(fb);
        return null;
      });

      await loop.sendFeedback(makeFeedback({ type: 'suggestion' }));

      expect(handled).toHaveLength(0);
    });

    it('should support multiple handlers for same type', async () => {
      let callCount = 0;

      loop.registerHandler('clarification', async () => {
        callCount++;
        return null;
      });
      loop.registerHandler('clarification', async () => {
        callCount++;
        return null;
      });

      await loop.sendFeedback(makeFeedback({ type: 'clarification' }));

      expect(callCount).toBe(2);
    });

    it('should record handler response in session', async () => {
      loop.registerHandler('suggestion', async (fb) => ({
        feedbackId: fb.id,
        fromAgent: fb.toAgent,
        accepted: true,
        action: 'auto-handled',
      }));

      await loop.sendFeedback(makeFeedback({ id: 'fb-auto', type: 'suggestion' }));

      const sessions = loop.getActiveSessions();
      expect(sessions[0].responses).toHaveLength(1);
      expect(sessions[0].responses[0].action).toBe('auto-handled');
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      await loop.sendFeedback(makeFeedback());

      const sessions = loop.getActiveSessions();
      const sessionId = sessions[0].id;

      const session = loop.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return undefined for nonexistent session', () => {
      const session = loop.getSession('no-such-session');
      expect(session).toBeUndefined();
    });
  });

  describe('resolveSession', () => {
    it('should mark session as resolved with timestamp', async () => {
      await loop.sendFeedback(makeFeedback());
      const sessionId = loop.getActiveSessions()[0].id;

      await loop.resolveSession(sessionId);

      const session = loop.getSession(sessionId);
      expect(session?.status).toBe('resolved');
      expect(session?.resolvedAt).toBeDefined();
    });

    it('should emit session:resolved event', async () => {
      const resolved: CollaborationSession[] = [];
      loop.on('session:resolved', (s) => resolved.push(s));

      await loop.sendFeedback(makeFeedback());
      const sessionId = loop.getActiveSessions()[0].id;
      await loop.resolveSession(sessionId);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].status).toBe('resolved');
    });

    it('should throw for nonexistent session', async () => {
      await expect(loop.resolveSession('no-such')).rejects.toThrow(
        'Session not found',
      );
    });

    it('should throw when resolving already resolved session', async () => {
      await loop.sendFeedback(makeFeedback());
      const sessionId = loop.getActiveSessions()[0].id;
      await loop.resolveSession(sessionId);

      await expect(loop.resolveSession(sessionId)).rejects.toThrow(
        "Cannot resolve session in 'resolved' status",
      );
    });
  });

  describe('escalateSession', () => {
    it('should mark session as escalated', async () => {
      await loop.sendFeedback(makeFeedback());
      const sessionId = loop.getActiveSessions()[0].id;

      await loop.escalateSession(sessionId, 'Unresolvable conflict');

      const session = loop.getSession(sessionId);
      expect(session?.status).toBe('escalated');
    });

    it('should emit session:escalated event with reason', async () => {
      const escalated: { session: CollaborationSession; reason: string }[] = [];
      loop.on('session:escalated', (s, r) =>
        escalated.push({ session: s, reason: r }),
      );

      await loop.sendFeedback(makeFeedback());
      const sessionId = loop.getActiveSessions()[0].id;
      await loop.escalateSession(sessionId, 'Timeout');

      expect(escalated).toHaveLength(1);
      expect(escalated[0].reason).toBe('Timeout');
    });

    it('should throw for nonexistent session', async () => {
      await expect(
        loop.escalateSession('no-such', 'reason'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', async () => {
      await loop.sendFeedback(makeFeedback({ taskId: 'task-1' }));
      await loop.sendFeedback(makeFeedback({ taskId: 'task-2' }));

      const allActive = loop.getActiveSessions();
      expect(allActive).toHaveLength(2);

      // Resolve one
      await loop.resolveSession(allActive[0].id);

      expect(loop.getActiveSessions()).toHaveLength(1);
    });
  });
});

// ============================================================================
// CollaborationManager
// ============================================================================

describe('CollaborationManager', () => {
  let manager: CollaborationManager;

  beforeEach(() => {
    feedbackIdCounter = 0;
    manager = new CollaborationManager(makeConfig());
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('agent registration', () => {
    it('should register an agent', () => {
      manager.registerAgent('a1', 'Agent One', ['coding', 'testing']);
      const agents = manager.getRegisteredAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({
        id: 'a1',
        name: 'Agent One',
        capabilities: ['coding', 'testing'],
      });
    });

    it('should unregister an agent', () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.unregisterAgent('a1');

      expect(manager.getRegisteredAgents()).toHaveLength(0);
    });

    it('should emit agent:registered event', () => {
      const events: unknown[] = [];
      manager.on('agent:registered', (a) => events.push(a));

      manager.registerAgent('a1', 'Agent One', ['coding']);

      expect(events).toHaveLength(1);
    });

    it('should emit agent:unregistered event', () => {
      const events: string[] = [];
      manager.on('agent:unregistered', (id) => events.push(id));

      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.unregisterAgent('a1');

      expect(events).toEqual(['a1']);
    });

    it('should not emit unregistered event for unknown agent', () => {
      const events: string[] = [];
      manager.on('agent:unregistered', (id) => events.push(id));

      manager.unregisterAgent('nonexistent');

      expect(events).toHaveLength(0);
    });
  });

  describe('requestFeedback', () => {
    it('should create and route feedback between registered agents', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      const feedback = await manager.requestFeedback(
        'a1',
        'a2',
        'task-1',
        'suggestion',
        'Consider using async/await',
      );

      expect(feedback.fromAgent).toBe('a1');
      expect(feedback.toAgent).toBe('a2');
      expect(feedback.type).toBe('suggestion');
      expect(feedback.content).toBe('Consider using async/await');
    });

    it('should throw when sender is not registered', async () => {
      manager.registerAgent('a2', 'Agent Two', ['review']);

      await expect(
        manager.requestFeedback('unknown', 'a2', 'task-1', 'suggestion', 'test'),
      ).rejects.toThrow('Agent not registered: unknown');
    });

    it('should throw when receiver is not registered', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);

      await expect(
        manager.requestFeedback('a1', 'unknown', 'task-1', 'suggestion', 'test'),
      ).rejects.toThrow('Agent not registered: unknown');
    });

    it('should set high priority for conflict type', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      const feedback = await manager.requestFeedback(
        'a1',
        'a2',
        'task-1',
        'conflict',
        'Conflicting approach',
      );

      expect(feedback.priority).toBe('high');
    });

    it('should update metrics on feedback', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      await manager.requestFeedback('a1', 'a2', 'task-1', 'suggestion', 'test');

      const metrics = manager.getMetrics();
      expect(metrics.totalFeedbacksSent).toBe(1);
      expect(metrics.totalFeedbacksReceived).toBe(1);
    });
  });

  describe('delegateTask', () => {
    it('should delegate to agent with matching capability', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['testing']);

      const targetId = await manager.delegateTask('a1', 'task-1', 'testing');

      expect(targetId).toBe('a2');
    });

    it('should return null when no capable agent found', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);

      const targetId = await manager.delegateTask('a1', 'task-1', 'design');

      expect(targetId).toBeNull();
    });

    it('should not delegate to the requesting agent', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding', 'testing']);
      manager.registerAgent('a2', 'Agent Two', ['testing']);

      const targetId = await manager.delegateTask('a1', 'task-1', 'testing');

      expect(targetId).toBe('a2');
    });

    it('should emit task:delegated event', async () => {
      const delegated: { from: string; to: string; task: string }[] = [];
      manager.on('task:delegated', (from, to, task) =>
        delegated.push({ from, to, task }),
      );

      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['testing']);

      await manager.delegateTask('a1', 'task-1', 'testing');

      expect(delegated).toHaveLength(1);
      expect(delegated[0]).toEqual({
        from: 'a1',
        to: 'a2',
        task: 'task-1',
      });
    });

    it('should increment delegationsCompleted metric', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['testing']);

      await manager.delegateTask('a1', 'task-1', 'testing');

      expect(manager.getMetrics().delegationsCompleted).toBe(1);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve session and update metrics', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      await manager.requestFeedback('a1', 'a2', 'task-1', 'conflict', 'Merge conflict');

      const feedbackLoop = manager.getFeedbackLoop();
      const session = feedbackLoop.getActiveSessions()[0];

      await manager.resolveConflict(session.id, 'Used agent-a approach');

      const resolved = feedbackLoop.getSession(session.id);
      expect(resolved?.status).toBe('resolved');
      expect(manager.getMetrics().conflictsResolved).toBe(1);
    });

    it('should emit conflict:resolved event', async () => {
      const events: { sessionId: string; resolution: string }[] = [];
      manager.on('conflict:resolved', (sid, res) =>
        events.push({ sessionId: sid, resolution: res }),
      );

      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      await manager.requestFeedback('a1', 'a2', 'task-1', 'conflict', 'issue');

      const session = manager.getFeedbackLoop().getActiveSessions()[0];
      await manager.resolveConflict(session.id, 'Resolved by consensus');

      expect(events).toHaveLength(1);
      expect(events[0].resolution).toBe('Resolved by consensus');
    });
  });

  describe('metrics', () => {
    it('should start with zero metrics', () => {
      const metrics = manager.getMetrics();

      expect(metrics.totalFeedbacksSent).toBe(0);
      expect(metrics.totalFeedbacksReceived).toBe(0);
      expect(metrics.averageResolutionTime).toBe(0);
      expect(metrics.conflictsResolved).toBe(0);
      expect(metrics.delegationsCompleted).toBe(0);
    });

    it('should track metrics across multiple operations', async () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review', 'testing']);

      await manager.requestFeedback('a1', 'a2', 'task-1', 'suggestion', 'fb1');
      await manager.requestFeedback('a1', 'a2', 'task-2', 'suggestion', 'fb2');
      await manager.delegateTask('a1', 'task-3', 'testing');

      const metrics = manager.getMetrics();
      expect(metrics.totalFeedbacksSent).toBe(2);
      expect(metrics.totalFeedbacksReceived).toBe(2);
      expect(metrics.delegationsCompleted).toBe(1);
    });

    it('should emit metrics:updated event', async () => {
      const updates: unknown[] = [];
      manager.on('metrics:updated', (m) => updates.push(m));

      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      await manager.requestFeedback('a1', 'a2', 'task-1', 'suggestion', 'test');

      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('should return a copy of metrics (immutable)', () => {
      const metrics1 = manager.getMetrics();
      const metrics2 = manager.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('dispose', () => {
    it('should clear all agents and listeners', () => {
      manager.registerAgent('a1', 'Agent One', ['coding']);
      manager.registerAgent('a2', 'Agent Two', ['review']);

      manager.dispose();

      expect(manager.getRegisteredAgents()).toHaveLength(0);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Collaboration Integration', () => {
  let manager: CollaborationManager;

  beforeEach(() => {
    feedbackIdCounter = 0;
    manager = new CollaborationManager(makeConfig());
    manager.registerAgent('coder', 'Coder Agent', ['coding', 'refactoring']);
    manager.registerAgent('reviewer', 'Reviewer Agent', ['review', 'testing']);
    manager.registerAgent('architect', 'Architect Agent', ['design', 'review']);
  });

  afterEach(() => {
    manager.dispose();
  });

  it('should complete a full feedback cycle: request -> response -> resolution', async () => {
    // 1. Coder requests review from reviewer
    const feedback = await manager.requestFeedback(
      'coder',
      'reviewer',
      'task-impl-1',
      'suggestion',
      'Please review this implementation',
    );

    // 2. Reviewer responds
    const feedbackLoop = manager.getFeedbackLoop();
    await feedbackLoop.respondToFeedback({
      feedbackId: feedback.id,
      fromAgent: 'reviewer',
      accepted: true,
      action: 'Approved with minor suggestions',
      details: 'Add error handling to line 42',
    });

    // 3. Resolve the session
    const session = feedbackLoop.getActiveSessions()[0];
    await manager.resolveConflict(session.id, 'Review completed');

    const resolved = feedbackLoop.getSession(session.id);
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.feedbackHistory).toHaveLength(1);
    expect(resolved?.responses).toHaveLength(1);
    expect(manager.getMetrics().conflictsResolved).toBe(1);
  });

  it('should handle multi-agent delegation chain', async () => {
    // Coder delegates testing to reviewer
    const testAgent = await manager.delegateTask('coder', 'task-1', 'testing');
    expect(testAgent).toBe('reviewer');

    // Coder delegates design to architect
    const designAgent = await manager.delegateTask('coder', 'task-2', 'design');
    expect(designAgent).toBe('architect');

    // Verify delegation metrics
    expect(manager.getMetrics().delegationsCompleted).toBe(2);
  });

  it('should detect conflict and escalate', async () => {
    const config = makeConfig({ maxFeedbackRounds: 2, autoEscalateOnConflict: true });
    const mgr = new CollaborationManager(config);
    mgr.registerAgent('a1', 'Agent One', ['coding']);
    mgr.registerAgent('a2', 'Agent Two', ['review']);

    const escalated: string[] = [];
    mgr.getFeedbackLoop().on('session:escalated', (_s, reason) =>
      escalated.push(reason),
    );

    // Send max rounds of feedback
    await mgr.requestFeedback('a1', 'a2', 'task-1', 'conflict', 'Approach A');
    await mgr.requestFeedback('a2', 'a1', 'task-1', 'conflict', 'Approach B');
    // Third feedback triggers escalation
    await mgr.requestFeedback('a1', 'a2', 'task-1', 'conflict', 'Still disagree');

    expect(escalated).toHaveLength(1);
    expect(escalated[0]).toContain('Maximum feedback rounds');

    mgr.dispose();
  });

  it('should accumulate metrics across multiple sessions', async () => {
    // Session 1: feedback between coder and reviewer
    await manager.requestFeedback('coder', 'reviewer', 'task-1', 'suggestion', 'fb1');
    const session1 = manager.getFeedbackLoop().getActiveSessions()[0];
    await manager.resolveConflict(session1.id, 'resolved');

    // Session 2: feedback between coder and architect
    await manager.requestFeedback('coder', 'architect', 'task-2', 'clarification', 'fb2');

    // Delegation
    await manager.delegateTask('coder', 'task-3', 'testing');

    const metrics = manager.getMetrics();
    expect(metrics.totalFeedbacksSent).toBe(2);
    expect(metrics.totalFeedbacksReceived).toBe(2);
    expect(metrics.conflictsResolved).toBe(1);
    expect(metrics.delegationsCompleted).toBe(1);
  });
});
