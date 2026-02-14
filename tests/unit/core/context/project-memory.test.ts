/**
 * ProjectMemory Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectMemory } from '../../../../src/core/context/project-memory';

describe('ProjectMemory', () => {
  let memory: ProjectMemory;

  beforeEach(() => {
    memory = new ProjectMemory();
  });

  describe('set and get', () => {
    it('should store and retrieve a string value', () => {
      memory.set('language', 'TypeScript');
      expect(memory.get<string>('language')).toBe('TypeScript');
    });

    it('should store and retrieve an object value', () => {
      const conventions = { indent: 2, quotes: 'single' };
      memory.set('codingConventions', conventions);

      expect(memory.get<typeof conventions>('codingConventions')).toEqual(conventions);
    });

    it('should store and retrieve an array value', () => {
      memory.set('patterns', ['singleton', 'factory']);
      expect(memory.get<string[]>('patterns')).toEqual(['singleton', 'factory']);
    });

    it('should overwrite an existing value', () => {
      memory.set('db', 'mysql');
      memory.set('db', 'postgres');

      expect(memory.get<string>('db')).toBe('postgres');
    });

    it('should return undefined for a missing key', () => {
      expect(memory.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for an existing key', () => {
      memory.set('key', 'value');
      expect(memory.has('key')).toBe(true);
    });

    it('should return false for a missing key', () => {
      expect(memory.has('missing')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove an existing entry and return true', () => {
      memory.set('temp', 42);

      expect(memory.delete('temp')).toBe(true);
      expect(memory.has('temp')).toBe(false);
    });

    it('should return false for a non-existent key', () => {
      expect(memory.delete('ghost')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty object when no entries exist', () => {
      expect(memory.getAll()).toEqual({});
    });

    it('should return all entries as a plain object', () => {
      memory.set('a', 1);
      memory.set('b', 'two');
      memory.set('c', [3]);

      const all = memory.getAll();

      expect(all).toEqual({ a: 1, b: 'two', c: [3] });
    });

    it('should return a snapshot not affected by subsequent changes', () => {
      memory.set('x', 10);
      const snapshot = memory.getAll();

      memory.set('y', 20);

      expect(snapshot).toEqual({ x: 10 });
    });
  });

  describe('persistence', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-memory-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should save and load all entries', async () => {
      const filePath = path.join(tmpDir, 'memory.json');

      memory.set('codingConventions', { indent: 2 });
      memory.set('teamPreferences', { reviewers: ['alice', 'bob'] });
      await memory.save(filePath);

      const loaded = new ProjectMemory();
      await loaded.load(filePath);

      expect(loaded.get('codingConventions')).toEqual({ indent: 2 });
      expect(loaded.get('teamPreferences')).toEqual({ reviewers: ['alice', 'bob'] });
    });

    it('should replace in-memory state when loading', async () => {
      const filePath = path.join(tmpDir, 'memory.json');

      memory.set('before', 'old');
      await memory.save(filePath);

      memory.set('extra', 'should-be-gone');
      await memory.load(filePath);

      expect(memory.has('before')).toBe(true);
      expect(memory.has('extra')).toBe(false);
    });

    it('should handle loading from non-existent file gracefully', async () => {
      const filePath = path.join(tmpDir, 'missing.json');

      memory.set('pre-existing', true);
      await memory.load(filePath);

      expect(memory.getAll()).toEqual({});
    });

    it('should produce valid JSON on disk', async () => {
      const filePath = path.join(tmpDir, 'memory.json');

      memory.set('number', 42);
      memory.set('nested', { a: { b: 'c' } });
      await memory.save(filePath);

      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed.number).toBe(42);
      expect(parsed.nested.a.b).toBe('c');
    });
  });
});
