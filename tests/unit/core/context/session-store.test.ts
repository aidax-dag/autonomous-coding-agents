/**
 * SessionStore Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStore, type SessionData, type SessionSummary } from '../../../../src/core/context/session-store';

describe('SessionStore', () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-store-'));
    store = new SessionStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
      id: 'sess-001',
      projectRoot: '/projects/my-app',
      startedAt: '2026-01-15T10:00:00.000Z',
      endedAt: null,
      metadata: {},
      decisions: [],
      artifacts: [],
      ...overrides,
    };
  }

  describe('save', () => {
    it('should create storage directory and write session file', async () => {
      const session = makeSession();

      await store.save(session);

      const filePath = path.join(tmpDir, '.aca/sessions', 'sess-001.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.id).toBe('sess-001');
      expect(parsed.projectRoot).toBe('/projects/my-app');
    });

    it('should overwrite an existing session file', async () => {
      await store.save(makeSession({ metadata: { version: 1 } }));
      await store.save(makeSession({ metadata: { version: 2 } }));

      const loaded = await store.load('sess-001');
      expect(loaded?.metadata).toEqual({ version: 2 });
    });
  });

  describe('load', () => {
    it('should load a previously saved session', async () => {
      const session = makeSession({
        decisions: ['use-postgres'],
        artifacts: ['src/db.ts'],
      });

      await store.save(session);
      const loaded = await store.load('sess-001');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('sess-001');
      expect(loaded!.decisions).toEqual(['use-postgres']);
      expect(loaded!.artifacts).toEqual(['src/db.ts']);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await store.load('does-not-exist');
      expect(loaded).toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty array when no sessions exist', async () => {
      const summaries = await store.list();
      expect(summaries).toEqual([]);
    });

    it('should list all saved sessions sorted by startedAt descending', async () => {
      await store.save(makeSession({
        id: 'sess-old',
        startedAt: '2026-01-10T08:00:00.000Z',
        artifacts: ['a.ts'],
      }));
      await store.save(makeSession({
        id: 'sess-new',
        startedAt: '2026-01-20T12:00:00.000Z',
        artifacts: ['b.ts', 'c.ts'],
      }));

      const summaries = await store.list();

      expect(summaries).toHaveLength(2);
      expect(summaries[0].id).toBe('sess-new');
      expect(summaries[0].taskCount).toBe(2);
      expect(summaries[1].id).toBe('sess-old');
      expect(summaries[1].taskCount).toBe(1);
    });

    it('should filter by projectRoot when provided', async () => {
      await store.save(makeSession({ id: 'a', projectRoot: '/app-a' }));
      await store.save(makeSession({ id: 'b', projectRoot: '/app-b' }));

      const filtered = await store.list('/app-a');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('a');
    });
  });

  describe('delete', () => {
    it('should delete an existing session file', async () => {
      await store.save(makeSession());
      await store.delete('sess-001');

      const loaded = await store.load('sess-001');
      expect(loaded).toBeNull();
    });

    it('should not throw when deleting a non-existent session', async () => {
      await expect(store.delete('ghost')).resolves.not.toThrow();
    });
  });

  describe('round-trip integrity', () => {
    it('should preserve all fields through save and load', async () => {
      const session = makeSession({
        endedAt: '2026-01-15T12:00:00.000Z',
        metadata: { agent: 'backend-architect', tags: ['auth', 'security'] },
        decisions: ['choose-jwt', 'use-bcrypt'],
        artifacts: ['src/auth/jwt.ts', 'src/auth/hash.ts'],
      });

      await store.save(session);
      const loaded = await store.load('sess-001');

      expect(loaded).toEqual(session);
    });
  });
});
