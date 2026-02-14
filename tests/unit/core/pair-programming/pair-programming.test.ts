import { CursorSync } from '@/core/pair-programming/cursor-sync';
import { SuggestionManager } from '@/core/pair-programming/suggestion-manager';
import { PairSessionManager } from '@/core/pair-programming/pair-session-manager';
import { DEFAULT_PAIR_CONFIG } from '@/core/pair-programming/types';
import type {
  CursorPosition,
  CursorEvent,
  CodeSuggestion,
  PairConfig,
  PairSession,
} from '@/core/pair-programming/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCursorPosition(overrides?: Partial<CursorPosition>): CursorPosition {
  return {
    file: 'src/main.ts',
    line: 10,
    column: 5,
    ...overrides,
  };
}

function makeSuggestionParams(
  overrides?: Partial<Omit<CodeSuggestion, 'id' | 'status' | 'createdAt' | 'expiresAt'>>,
) {
  return {
    agentId: 'agent-1',
    file: 'src/main.ts',
    range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 20 },
    originalContent: 'const x = 1;',
    suggestedContent: 'const x = 42;',
    description: 'Use meaningful value',
    confidence: 0.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CursorSync
// ---------------------------------------------------------------------------

describe('CursorSync', () => {
  let cursorSync: CursorSync;

  beforeEach(() => {
    cursorSync = new CursorSync();
  });

  test('should update and get a cursor position', () => {
    const pos = makeCursorPosition();
    cursorSync.updateCursor('user-1', 'driver', pos);
    expect(cursorSync.getCursor('user-1')).toEqual(pos);
  });

  test('should return undefined for unknown user cursor', () => {
    expect(cursorSync.getCursor('nonexistent')).toBeUndefined();
  });

  test('should return all cursors', () => {
    const pos1 = makeCursorPosition({ line: 1 });
    const pos2 = makeCursorPosition({ line: 2 });
    cursorSync.updateCursor('user-1', 'driver', pos1);
    cursorSync.updateCursor('user-2', 'navigator', pos2);

    const all = cursorSync.getAllCursors();
    expect(all.size).toBe(2);
    expect(all.get('user-1')).toEqual(pos1);
    expect(all.get('user-2')).toEqual(pos2);
  });

  test('getAllCursors should return a copy', () => {
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition());
    const all = cursorSync.getAllCursors();
    all.delete('user-1');
    expect(cursorSync.getCursor('user-1')).toBeDefined();
  });

  test('should track cursor history', () => {
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 1 }));
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 2 }));
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 3 }));

    const history = cursorSync.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].position.line).toBe(1);
    expect(history[2].position.line).toBe(3);
  });

  test('should respect history limit', () => {
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 1 }));
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 2 }));
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition({ line: 3 }));

    const limited = cursorSync.getHistory(2);
    expect(limited).toHaveLength(2);
    expect(limited[0].position.line).toBe(2);
    expect(limited[1].position.line).toBe(3);
  });

  test('should clear history', () => {
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition());
    cursorSync.clearHistory();
    expect(cursorSync.getHistory()).toHaveLength(0);
    // Cursor position should still be preserved
    expect(cursorSync.getCursor('user-1')).toBeDefined();
  });

  test('should emit cursor:moved event for non-selection moves', () => {
    const events: CursorEvent[] = [];
    cursorSync.on('cursor:moved', (e: CursorEvent) => events.push(e));

    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition());
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('move');
    expect(events[0].userId).toBe('user-1');
  });

  test('should emit cursor:selected event for selection moves', () => {
    const events: CursorEvent[] = [];
    cursorSync.on('cursor:selected', (e: CursorEvent) => events.push(e));

    const pos = makeCursorPosition({
      selection: { startLine: 1, startColumn: 0, endLine: 3, endColumn: 10 },
    });
    cursorSync.updateCursor('user-1', 'driver', pos);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('select');
  });

  test('should emit cursor:disconnected when removing a cursor', () => {
    const events: Array<{ userId: string }> = [];
    cursorSync.on('cursor:disconnected', (e) => events.push(e));

    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition());
    cursorSync.removeCursor('user-1');

    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe('user-1');
    expect(cursorSync.getCursor('user-1')).toBeUndefined();
  });

  test('should clear all cursors and history', () => {
    cursorSync.updateCursor('user-1', 'driver', makeCursorPosition());
    cursorSync.updateCursor('user-2', 'navigator', makeCursorPosition());
    cursorSync.clear();

    expect(cursorSync.getAllCursors().size).toBe(0);
    expect(cursorSync.getHistory()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SuggestionManager
// ---------------------------------------------------------------------------

describe('SuggestionManager', () => {
  let manager: SuggestionManager;
  const config: PairConfig = { ...DEFAULT_PAIR_CONFIG };

  beforeEach(() => {
    manager = new SuggestionManager(config);
  });

  test('should create a suggestion with generated fields', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams());
    expect(suggestion).not.toBeNull();
    expect(suggestion!.id).toBeTruthy();
    expect(suggestion!.status).toBe('pending');
    expect(suggestion!.createdAt).toBeGreaterThan(0);
    expect(suggestion!.expiresAt).toBe(suggestion!.createdAt + config.suggestionExpiryMs);
  });

  test('should emit suggestion:created event', () => {
    const events: CodeSuggestion[] = [];
    manager.on('suggestion:created', (s: CodeSuggestion) => events.push(s));

    manager.createSuggestion(makeSuggestionParams());
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('pending');
  });

  test('should accept a pending suggestion', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    const accepted = manager.acceptSuggestion(suggestion.id);

    expect(accepted).not.toBeNull();
    expect(accepted!.status).toBe('accepted');
    expect(manager.getSuggestion(suggestion.id)?.status).toBe('accepted');
  });

  test('should emit suggestion:accepted event', () => {
    const events: CodeSuggestion[] = [];
    manager.on('suggestion:accepted', (s: CodeSuggestion) => events.push(s));

    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    manager.acceptSuggestion(suggestion.id);
    expect(events).toHaveLength(1);
  });

  test('should reject a pending suggestion', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    const rejected = manager.rejectSuggestion(suggestion.id);

    expect(rejected).not.toBeNull();
    expect(rejected!.status).toBe('rejected');
  });

  test('should emit suggestion:rejected event', () => {
    const events: CodeSuggestion[] = [];
    manager.on('suggestion:rejected', (s: CodeSuggestion) => events.push(s));

    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    manager.rejectSuggestion(suggestion.id);
    expect(events).toHaveLength(1);
  });

  test('should not accept an already rejected suggestion', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    manager.rejectSuggestion(suggestion.id);
    expect(manager.acceptSuggestion(suggestion.id)).toBeNull();
  });

  test('should not reject an already accepted suggestion', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    manager.acceptSuggestion(suggestion.id);
    expect(manager.rejectSuggestion(suggestion.id)).toBeNull();
  });

  test('should expire old suggestions', () => {
    const shortConfig: PairConfig = { ...config, suggestionExpiryMs: 1 };
    const shortManager = new SuggestionManager(shortConfig);

    shortManager.createSuggestion(makeSuggestionParams());

    // Wait just enough for expiry
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy-wait a few ms
    }

    const expired = shortManager.expireOld();
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe('expired');
  });

  test('should emit suggestion:expired for each expired suggestion', () => {
    const shortConfig: PairConfig = { ...config, suggestionExpiryMs: 1 };
    const shortManager = new SuggestionManager(shortConfig);
    const events: CodeSuggestion[] = [];
    shortManager.on('suggestion:expired', (s: CodeSuggestion) => events.push(s));

    shortManager.createSuggestion(makeSuggestionParams());

    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy-wait
    }

    shortManager.expireOld();
    expect(events).toHaveLength(1);
  });

  test('should enforce maxActiveSuggestions limit', () => {
    const limitedConfig: PairConfig = { ...config, maxActiveSuggestions: 2 };
    const limitedManager = new SuggestionManager(limitedConfig);

    expect(limitedManager.createSuggestion(makeSuggestionParams())).not.toBeNull();
    expect(limitedManager.createSuggestion(makeSuggestionParams())).not.toBeNull();
    expect(limitedManager.createSuggestion(makeSuggestionParams())).toBeNull();
  });

  test('should allow new suggestions after accepting one past the limit', () => {
    const limitedConfig: PairConfig = { ...config, maxActiveSuggestions: 1 };
    const limitedManager = new SuggestionManager(limitedConfig);

    const first = limitedManager.createSuggestion(makeSuggestionParams())!;
    expect(limitedManager.createSuggestion(makeSuggestionParams())).toBeNull();

    limitedManager.acceptSuggestion(first.id);
    expect(limitedManager.createSuggestion(makeSuggestionParams())).not.toBeNull();
  });

  test('should return correct metrics', () => {
    const s1 = manager.createSuggestion(makeSuggestionParams())!;
    const s2 = manager.createSuggestion(makeSuggestionParams())!;
    manager.createSuggestion(makeSuggestionParams());

    manager.acceptSuggestion(s1.id);
    manager.rejectSuggestion(s2.id);

    const metrics = manager.getMetrics();
    expect(metrics.total).toBe(3);
    expect(metrics.accepted).toBe(1);
    expect(metrics.rejected).toBe(1);
    expect(metrics.pending).toBe(1);
    expect(metrics.expired).toBe(0);
  });

  test('should get active (pending) suggestions only', () => {
    const s1 = manager.createSuggestion(makeSuggestionParams())!;
    manager.createSuggestion(makeSuggestionParams());

    manager.acceptSuggestion(s1.id);

    const active = manager.getActiveSuggestions();
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe('pending');
  });

  test('should get a suggestion by id', () => {
    const suggestion = manager.createSuggestion(makeSuggestionParams())!;
    expect(manager.getSuggestion(suggestion.id)).toBe(suggestion);
    expect(manager.getSuggestion('nonexistent')).toBeUndefined();
  });

  test('should clear all suggestions', () => {
    manager.createSuggestion(makeSuggestionParams());
    manager.createSuggestion(makeSuggestionParams());
    manager.clear();

    expect(manager.getActiveSuggestions()).toHaveLength(0);
    expect(manager.getMetrics().total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PairSessionManager
// ---------------------------------------------------------------------------

describe('PairSessionManager', () => {
  let sessionManager: PairSessionManager;

  beforeEach(() => {
    sessionManager = new PairSessionManager();
  });

  test('should create a session with default config', () => {
    const session = sessionManager.createSession();
    expect(session.id).toBeTruthy();
    expect(session.status).toBe('waiting');
    expect(session.participants).toHaveLength(0);
    expect(session.config).toEqual(DEFAULT_PAIR_CONFIG);
  });

  test('should create a session with custom config', () => {
    const session = sessionManager.createSession({ maxActiveSuggestions: 10 });
    expect(session.config.maxActiveSuggestions).toBe(10);
    expect(session.config.suggestionExpiryMs).toBe(DEFAULT_PAIR_CONFIG.suggestionExpiryMs);
  });

  test('should emit session:created event', () => {
    const events: PairSession[] = [];
    sessionManager.on('session:created', (s: PairSession) => events.push(s));

    sessionManager.createSession();
    expect(events).toHaveLength(1);
  });

  test('should join a participant to a session', () => {
    const session = sessionManager.createSession();
    const participant = sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });

    expect(participant.connected).toBe(true);
    expect(participant.name).toBe('Alice');
    expect(session.participants).toHaveLength(1);
  });

  test('should emit participant:joined event', () => {
    const events: Array<{ sessionId: string }> = [];
    sessionManager.on('participant:joined', (e) => events.push(e));

    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });

    expect(events).toHaveLength(1);
    expect(events[0].sessionId).toBe(session.id);
  });

  test('should throw when joining a nonexistent session', () => {
    expect(() =>
      sessionManager.joinSession('fake-id', {
        id: 'user-1',
        name: 'Alice',
        role: 'driver',
        isAgent: false,
      }),
    ).toThrow("Session 'fake-id' not found");
  });

  test('should throw when joining an ended session', () => {
    const session = sessionManager.createSession();
    sessionManager.endSession(session.id);

    expect(() =>
      sessionManager.joinSession(session.id, {
        id: 'user-1',
        name: 'Alice',
        role: 'driver',
        isAgent: false,
      }),
    ).toThrow('has ended');
  });

  test('should leave a session and disconnect participant', () => {
    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });

    sessionManager.leaveSession(session.id, 'user-1');

    const participant = session.participants.find((p) => p.id === 'user-1');
    expect(participant?.connected).toBe(false);
  });

  test('should emit participant:left event', () => {
    const events: Array<{ sessionId: string; participantId: string }> = [];
    sessionManager.on('participant:left', (e) => events.push(e));

    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });
    sessionManager.leaveSession(session.id, 'user-1');

    expect(events).toHaveLength(1);
    expect(events[0].participantId).toBe('user-1');
  });

  test('should throw when leaving with unknown participant', () => {
    const session = sessionManager.createSession();
    expect(() => sessionManager.leaveSession(session.id, 'unknown')).toThrow(
      'not found in session',
    );
  });

  test('should start a waiting session', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);
    expect(session.status).toBe('active');
  });

  test('should emit session:started event', () => {
    const events: Array<{ sessionId: string }> = [];
    sessionManager.on('session:started', (e) => events.push(e));

    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);

    expect(events).toHaveLength(1);
  });

  test('should pause an active session', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);
    sessionManager.pauseSession(session.id);
    expect(session.status).toBe('paused');
  });

  test('should emit session:paused event', () => {
    const events: Array<{ sessionId: string }> = [];
    sessionManager.on('session:paused', (e) => events.push(e));

    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);
    sessionManager.pauseSession(session.id);

    expect(events).toHaveLength(1);
  });

  test('should throw when pausing a non-active session', () => {
    const session = sessionManager.createSession();
    expect(() => sessionManager.pauseSession(session.id)).toThrow('is not active');
  });

  test('should end a session and return metrics', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);

    const metrics = sessionManager.endSession(session.id);
    expect(session.status).toBe('ended');
    expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
    expect(metrics.totalSuggestions).toBe(0);
  });

  test('should emit session:ended event with metrics', () => {
    const events: Array<{ sessionId: string; metrics: unknown }> = [];
    sessionManager.on('session:ended', (e) => events.push(e));

    const session = sessionManager.createSession();
    sessionManager.endSession(session.id);

    expect(events).toHaveLength(1);
    expect(events[0].sessionId).toBe(session.id);
  });

  test('should disconnect all participants on end', () => {
    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });
    sessionManager.joinSession(session.id, {
      id: 'agent-1',
      name: 'AI Agent',
      role: 'navigator',
      isAgent: true,
    });

    sessionManager.endSession(session.id);

    for (const p of session.participants) {
      expect(p.connected).toBe(false);
    }
  });

  test('should get a session by id', () => {
    const session = sessionManager.createSession();
    expect(sessionManager.getSession(session.id)).toBe(session);
    expect(sessionManager.getSession('nonexistent')).toBeUndefined();
  });

  test('should get only active (non-ended) sessions', () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    sessionManager.endSession(s1.id);

    const active = sessionManager.getActiveSessions();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(s2.id);
  });

  test('should add a suggestion to an active session', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);

    const suggestion = sessionManager.addSuggestion(
      session.id,
      makeSuggestionParams(),
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion!.status).toBe('pending');
    expect(session.activeSuggestions).toHaveLength(1);
  });

  test('should return null when adding suggestion to non-active session', () => {
    const session = sessionManager.createSession();
    // Session is in 'waiting' status, not 'active'
    const result = sessionManager.addSuggestion(session.id, makeSuggestionParams());
    expect(result).toBeNull();
  });

  test('should respond to a suggestion (accept)', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);
    const suggestion = sessionManager.addSuggestion(
      session.id,
      makeSuggestionParams(),
    )!;

    const accepted = sessionManager.respondToSuggestion(
      session.id,
      suggestion.id,
      true,
    );
    expect(accepted).not.toBeNull();
    expect(accepted!.status).toBe('accepted');
  });

  test('should respond to a suggestion (reject)', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);
    const suggestion = sessionManager.addSuggestion(
      session.id,
      makeSuggestionParams(),
    )!;

    const rejected = sessionManager.respondToSuggestion(
      session.id,
      suggestion.id,
      false,
    );
    expect(rejected).not.toBeNull();
    expect(rejected!.status).toBe('rejected');
  });

  test('should update cursor for a participant in a session', () => {
    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });

    const pos = makeCursorPosition({ line: 42 });
    sessionManager.updateCursor(session.id, 'user-1', pos);

    const participant = session.participants.find((p) => p.id === 'user-1');
    expect(participant?.cursorPosition).toEqual(pos);
  });

  test('should track cursor history in session', () => {
    const session = sessionManager.createSession();
    sessionManager.joinSession(session.id, {
      id: 'user-1',
      name: 'Alice',
      role: 'driver',
      isAgent: false,
    });

    sessionManager.updateCursor(session.id, 'user-1', makeCursorPosition({ line: 1 }));
    sessionManager.updateCursor(session.id, 'user-1', makeCursorPosition({ line: 2 }));

    expect(session.cursorHistory).toHaveLength(2);
  });

  test('should throw when updating cursor for unknown participant', () => {
    const session = sessionManager.createSession();
    expect(() =>
      sessionManager.updateCursor(session.id, 'unknown', makeCursorPosition()),
    ).toThrow('not found in session');
  });

  test('should return session metrics with suggestion counts', () => {
    const session = sessionManager.createSession();
    sessionManager.startSession(session.id);

    const s1 = sessionManager.addSuggestion(session.id, makeSuggestionParams())!;
    const s2 = sessionManager.addSuggestion(session.id, makeSuggestionParams())!;
    sessionManager.addSuggestion(session.id, makeSuggestionParams());

    sessionManager.respondToSuggestion(session.id, s1.id, true);
    sessionManager.respondToSuggestion(session.id, s2.id, false);

    const metrics = sessionManager.endSession(session.id);
    expect(metrics.totalSuggestions).toBe(3);
    expect(metrics.acceptedSuggestions).toBe(1);
    expect(metrics.rejectedSuggestions).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Pair Programming Integration', () => {
  test('full pair session lifecycle', () => {
    const manager = new PairSessionManager();

    // Create and configure session
    const session = manager.createSession({
      maxActiveSuggestions: 3,
      suggestionExpiryMs: 60000,
    });
    expect(session.status).toBe('waiting');

    // Join participants
    manager.joinSession(session.id, {
      id: 'dev-1',
      name: 'Developer',
      role: 'driver',
      isAgent: false,
    });
    manager.joinSession(session.id, {
      id: 'ai-1',
      name: 'AI Assistant',
      role: 'navigator',
      isAgent: true,
    });
    expect(session.participants).toHaveLength(2);

    // Start session
    manager.startSession(session.id);
    expect(session.status).toBe('active');

    // Cursor movement
    manager.updateCursor(session.id, 'dev-1', makeCursorPosition({ line: 10 }));
    manager.updateCursor(session.id, 'ai-1', makeCursorPosition({ line: 15 }));

    // AI makes a suggestion
    const suggestion = manager.addSuggestion(session.id, {
      agentId: 'ai-1',
      file: 'src/main.ts',
      range: { startLine: 10, startColumn: 0, endLine: 12, endColumn: 0 },
      originalContent: 'function old() {}',
      suggestedContent: 'function improved() { return true; }',
      description: 'Improve function implementation',
      confidence: 0.85,
    });
    expect(suggestion).not.toBeNull();
    expect(session.activeSuggestions).toHaveLength(1);

    // Developer accepts
    const accepted = manager.respondToSuggestion(session.id, suggestion!.id, true);
    expect(accepted!.status).toBe('accepted');

    // End session
    const metrics = manager.endSession(session.id);
    expect(metrics.totalSuggestions).toBe(1);
    expect(metrics.acceptedSuggestions).toBe(1);
    expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
    expect(session.status).toBe('ended');
  });

  test('multi-participant cursor tracking', () => {
    const manager = new PairSessionManager();
    const session = manager.createSession();

    const participants = [
      { id: 'p1', name: 'Alice', role: 'driver' as const, isAgent: false },
      { id: 'p2', name: 'Bob', role: 'navigator' as const, isAgent: false },
      { id: 'p3', name: 'AI', role: 'observer' as const, isAgent: true },
    ];

    for (const p of participants) {
      manager.joinSession(session.id, p);
    }

    manager.updateCursor(session.id, 'p1', makeCursorPosition({ line: 1 }));
    manager.updateCursor(session.id, 'p2', makeCursorPosition({ line: 20 }));
    manager.updateCursor(session.id, 'p3', makeCursorPosition({ line: 35 }));

    expect(session.cursorHistory).toHaveLength(3);

    const cursorSync = manager.getCursorSync(session.id);
    expect(cursorSync).toBeDefined();
    expect(cursorSync!.getAllCursors().size).toBe(3);
  });

  test('suggestion flow with accept and reject', () => {
    const manager = new PairSessionManager();
    const session = manager.createSession({ maxActiveSuggestions: 5 });
    manager.startSession(session.id);

    // Create multiple suggestions
    const s1 = manager.addSuggestion(session.id, makeSuggestionParams({ description: 'First' }))!;
    const s2 = manager.addSuggestion(session.id, makeSuggestionParams({ description: 'Second' }))!;
    const s3 = manager.addSuggestion(session.id, makeSuggestionParams({ description: 'Third' }))!;

    // Accept first, reject second, leave third pending
    manager.respondToSuggestion(session.id, s1.id, true);
    manager.respondToSuggestion(session.id, s2.id, false);

    const suggestionManager = manager.getSuggestionManager(session.id)!;
    const metrics = suggestionManager.getMetrics();

    expect(metrics.total).toBe(3);
    expect(metrics.accepted).toBe(1);
    expect(metrics.rejected).toBe(1);
    expect(metrics.pending).toBe(1);
  });

  test('metrics collection across full session', () => {
    const manager = new PairSessionManager();
    const session = manager.createSession();
    manager.joinSession(session.id, {
      id: 'dev-1',
      name: 'Dev',
      role: 'driver',
      isAgent: false,
    });
    manager.startSession(session.id);

    // Add and respond to suggestions
    for (let i = 0; i < 4; i++) {
      const s = manager.addSuggestion(session.id, makeSuggestionParams())!;
      if (i < 2) {
        manager.respondToSuggestion(session.id, s.id, true);
      } else if (i === 2) {
        manager.respondToSuggestion(session.id, s.id, false);
      }
      // i === 3 left pending
    }

    const metrics = manager.endSession(session.id);
    expect(metrics.totalSuggestions).toBe(4);
    expect(metrics.acceptedSuggestions).toBe(2);
    expect(metrics.rejectedSuggestions).toBe(1);
    expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
  });

  test('pause and resume session preserves state', () => {
    const manager = new PairSessionManager();
    const session = manager.createSession();
    manager.joinSession(session.id, {
      id: 'dev-1',
      name: 'Dev',
      role: 'driver',
      isAgent: false,
    });
    manager.startSession(session.id);

    // Add a suggestion before pausing
    const s = manager.addSuggestion(session.id, makeSuggestionParams())!;
    manager.updateCursor(session.id, 'dev-1', makeCursorPosition({ line: 50 }));

    // Pause
    manager.pauseSession(session.id);
    expect(session.status).toBe('paused');

    // Resume
    manager.startSession(session.id);
    expect(session.status).toBe('active');

    // Suggestion and cursor state should be preserved
    expect(session.activeSuggestions).toHaveLength(1);
    expect(session.activeSuggestions[0].id).toBe(s.id);
    expect(session.cursorHistory).toHaveLength(1);

    const participant = session.participants.find((p) => p.id === 'dev-1');
    expect(participant?.cursorPosition?.line).toBe(50);
  });
});
