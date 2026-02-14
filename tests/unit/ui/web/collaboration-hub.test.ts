/**
 * Tests for CollaborationHub
 *
 * Validates session management, client management, messaging,
 * history truncation, event emission, and disposal.
 */

import {
  CollaborationHub,
  createCollaborationHub,
} from '@/ui/web/collaboration-hub';
import type {
  CollaborationMessage,
} from '@/ui/web/collaboration-hub';

describe('CollaborationHub', () => {
  let hub: CollaborationHub;

  beforeEach(() => {
    hub = new CollaborationHub();
  });

  afterEach(() => {
    hub.dispose();
  });

  // ── Session Management ───────────────────────────────────────

  describe('createSession', () => {
    it('should create a session and return it', () => {
      const session = hub.createSession('s1', 'Test Session', 'user-a');

      expect(session.id).toBe('s1');
      expect(session.name).toBe('Test Session');
      expect(session.createdBy).toBe('user-a');
      expect(session.participants).toEqual(['user-a']);
      expect(session.isActive).toBe(true);
      expect(session.createdAt).toBeDefined();
    });

    it('should emit session:created event', () => {
      const listener = jest.fn();
      hub.on('session:created', listener);

      const session = hub.createSession('s1', 'Test', 'user-a');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(session);
    });

    it('should initialize message history for the session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      expect(hub.getMessageHistory('s1')).toEqual([]);
    });
  });

  describe('joinSession', () => {
    it('should add a participant to the session', () => {
      hub.createSession('s1', 'Test', 'user-a');

      const session = hub.joinSession('s1', 'user-b');

      expect(session).not.toBeNull();
      expect(session!.participants).toContain('user-b');
      expect(session!.participants).toContain('user-a');
    });

    it('should not duplicate a participant who already joined', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.joinSession('s1', 'user-a');

      const session = hub.getSession('s1');
      expect(session!.participants.filter(p => p === 'user-a')).toHaveLength(1);
    });

    it('should return null for a non-existent session', () => {
      const result = hub.joinSession('nonexistent', 'user-a');
      expect(result).toBeNull();
    });

    it('should return null for an inactive session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.closeSession('s1');

      const result = hub.joinSession('s1', 'user-b');
      expect(result).toBeNull();
    });

    it('should emit session:joined event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('session:joined', listener);

      hub.joinSession('s1', 'user-b');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ sessionId: 's1', userId: 'user-b' });
    });
  });

  describe('leaveSession', () => {
    it('should remove participant from the session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.joinSession('s1', 'user-b');

      const result = hub.leaveSession('s1', 'user-b');

      expect(result).toBe(true);
      const session = hub.getSession('s1');
      expect(session!.participants).not.toContain('user-b');
      expect(session!.participants).toContain('user-a');
    });

    it('should return false for a non-existent session', () => {
      const result = hub.leaveSession('nonexistent', 'user-a');
      expect(result).toBe(false);
    });

    it('should remove client connections for the leaving user', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.addClient('c1', 'user-a', 's1');
      hub.addClient('c2', 'user-a', 's1');

      hub.leaveSession('s1', 'user-a');

      expect(hub.getSessionClients('s1')).toHaveLength(0);
    });

    it('should emit session:left event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('session:left', listener);

      hub.leaveSession('s1', 'user-a');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ sessionId: 's1', userId: 'user-a' });
    });
  });

  describe('closeSession', () => {
    it('should deactivate the session', () => {
      hub.createSession('s1', 'Test', 'user-a');

      const result = hub.closeSession('s1');

      expect(result).toBe(true);
      const session = hub.getSession('s1');
      expect(session!.isActive).toBe(false);
    });

    it('should remove all clients in the session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.addClient('c1', 'user-a', 's1');
      hub.addClient('c2', 'user-b', 's1');

      hub.closeSession('s1');

      expect(hub.getSessionClients('s1')).toHaveLength(0);
      expect(hub.getClientCount()).toBe(0);
    });

    it('should return false for a non-existent session', () => {
      const result = hub.closeSession('nonexistent');
      expect(result).toBe(false);
    });

    it('should emit session:closed event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('session:closed', listener);

      hub.closeSession('s1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('s1');
    });
  });

  // ── Client Management ────────────────────────────────────────

  describe('addClient', () => {
    it('should add a client to a valid active session', () => {
      hub.createSession('s1', 'Test', 'user-a');

      const client = hub.addClient('c1', 'user-a', 's1');

      expect(client).not.toBeNull();
      expect(client!.id).toBe('c1');
      expect(client!.userId).toBe('user-a');
      expect(client!.sessionId).toBe('s1');
      expect(client!.connectedAt).toBeDefined();
    });

    it('should return null for a non-existent session', () => {
      const client = hub.addClient('c1', 'user-a', 'nonexistent');
      expect(client).toBeNull();
    });

    it('should return null for an inactive session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.closeSession('s1');

      const client = hub.addClient('c1', 'user-a', 's1');
      expect(client).toBeNull();
    });

    it('should emit client:connected event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('client:connected', listener);

      const client = hub.addClient('c1', 'user-a', 's1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(client);
    });
  });

  describe('removeClient', () => {
    it('should remove an existing client', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.addClient('c1', 'user-a', 's1');

      const result = hub.removeClient('c1');

      expect(result).toBe(true);
      expect(hub.getClientCount()).toBe(0);
    });

    it('should return false for a non-existent client', () => {
      const result = hub.removeClient('nonexistent');
      expect(result).toBe(false);
    });

    it('should emit client:disconnected event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const client = hub.addClient('c1', 'user-a', 's1');
      const listener = jest.fn();
      hub.on('client:disconnected', listener);

      hub.removeClient('c1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(client);
    });
  });

  // ── Messaging ────────────────────────────────────────────────

  describe('broadcast', () => {
    it('should store message in history', () => {
      hub.createSession('s1', 'Test', 'user-a');

      const message: CollaborationMessage = {
        type: 'chat',
        senderId: 'user-a',
        sessionId: 's1',
        payload: { text: 'hello' },
        timestamp: new Date().toISOString(),
      };

      hub.broadcast(message);

      const history = hub.getMessageHistory('s1');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(message);
    });

    it('should emit message event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('message', listener);

      const message: CollaborationMessage = {
        type: 'status',
        senderId: 'user-a',
        sessionId: 's1',
        payload: { status: 'typing' },
        timestamp: new Date().toISOString(),
      };

      hub.broadcast(message);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(message);
    });

    it('should emit session-specific message event', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const listener = jest.fn();
      hub.on('message:s1', listener);

      const message: CollaborationMessage = {
        type: 'edit',
        senderId: 'user-a',
        sessionId: 's1',
        payload: { file: 'index.ts', line: 10 },
        timestamp: new Date().toISOString(),
      };

      hub.broadcast(message);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(message);
    });

    it('should truncate history at maxHistoryPerSession', () => {
      const smallHub = new CollaborationHub({ maxHistoryPerSession: 3 });
      smallHub.createSession('s1', 'Test', 'user-a');

      for (let i = 0; i < 5; i++) {
        smallHub.broadcast({
          type: 'chat',
          senderId: 'user-a',
          sessionId: 's1',
          payload: { index: i },
          timestamp: new Date().toISOString(),
        });
      }

      const history = smallHub.getMessageHistory('s1');
      expect(history).toHaveLength(3);
      // Should retain the last 3 messages (indices 2, 3, 4)
      expect((history[0].payload as { index: number }).index).toBe(2);
      expect((history[1].payload as { index: number }).index).toBe(3);
      expect((history[2].payload as { index: number }).index).toBe(4);

      smallHub.dispose();
    });

    it('should not fail when broadcasting to a session without history', () => {
      const message: CollaborationMessage = {
        type: 'chat',
        senderId: 'user-a',
        sessionId: 'nonexistent',
        payload: null,
        timestamp: new Date().toISOString(),
      };

      expect(() => hub.broadcast(message)).not.toThrow();
    });
  });

  // ── Queries ──────────────────────────────────────────────────

  describe('getSession', () => {
    it('should return a session by ID', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const session = hub.getSession('s1');
      expect(session).not.toBeNull();
      expect(session!.id).toBe('s1');
    });

    it('should return null for a non-existent session', () => {
      const session = hub.getSession('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should return all sessions', () => {
      hub.createSession('s1', 'Session 1', 'user-a');
      hub.createSession('s2', 'Session 2', 'user-b');
      hub.closeSession('s1');

      const sessions = hub.listSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      hub.createSession('s1', 'Session 1', 'user-a');
      hub.createSession('s2', 'Session 2', 'user-b');
      hub.closeSession('s1');

      const active = hub.getActiveSessions();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('s2');
    });
  });

  describe('getSessionClients', () => {
    it('should return clients for a specific session', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.createSession('s2', 'Other', 'user-b');
      hub.addClient('c1', 'user-a', 's1');
      hub.addClient('c2', 'user-b', 's2');
      hub.addClient('c3', 'user-c', 's1');

      const clients = hub.getSessionClients('s1');
      expect(clients).toHaveLength(2);
      expect(clients.map(c => c.id).sort()).toEqual(['c1', 'c3']);
    });

    it('should return empty array for a session with no clients', () => {
      hub.createSession('s1', 'Test', 'user-a');
      const clients = hub.getSessionClients('s1');
      expect(clients).toHaveLength(0);
    });
  });

  describe('getMessageHistory', () => {
    it('should return empty array for a non-existent session', () => {
      const history = hub.getMessageHistory('nonexistent');
      expect(history).toEqual([]);
    });
  });

  describe('getClientCount', () => {
    it('should return the total number of connected clients', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.createSession('s2', 'Test2', 'user-b');
      hub.addClient('c1', 'user-a', 's1');
      hub.addClient('c2', 'user-b', 's2');

      expect(hub.getClientCount()).toBe(2);
    });

    it('should return 0 when no clients are connected', () => {
      expect(hub.getClientCount()).toBe(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return the total number of sessions', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.createSession('s2', 'Test2', 'user-b');

      expect(hub.getSessionCount()).toBe(2);
    });

    it('should return 0 when no sessions exist', () => {
      expect(hub.getSessionCount()).toBe(0);
    });
  });

  // ── Lifecycle ────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clear all clients, sessions, and history', () => {
      hub.createSession('s1', 'Test', 'user-a');
      hub.addClient('c1', 'user-a', 's1');
      hub.broadcast({
        type: 'chat',
        senderId: 'user-a',
        sessionId: 's1',
        payload: 'hello',
        timestamp: new Date().toISOString(),
      });

      hub.dispose();

      expect(hub.getClientCount()).toBe(0);
      expect(hub.getSessionCount()).toBe(0);
      expect(hub.getMessageHistory('s1')).toEqual([]);
    });

    it('should remove all event listeners', () => {
      const listener = jest.fn();
      hub.on('message', listener);

      hub.dispose();

      expect(hub.listenerCount('message')).toBe(0);
    });
  });

  // ── Factory ──────────────────────────────────────────────────

  describe('createCollaborationHub factory', () => {
    it('should create a CollaborationHub instance', () => {
      const instance = createCollaborationHub();
      expect(instance).toBeInstanceOf(CollaborationHub);
      expect(instance.getClientCount()).toBe(0);
      expect(instance.getSessionCount()).toBe(0);
      instance.dispose();
    });

    it('should accept options', () => {
      const instance = createCollaborationHub({ maxHistoryPerSession: 50 });
      expect(instance).toBeInstanceOf(CollaborationHub);
      instance.dispose();
    });
  });
});
