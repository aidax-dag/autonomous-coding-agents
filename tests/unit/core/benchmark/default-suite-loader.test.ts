/**
 * Tests for DefaultSuiteLoader
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createDefaultSuiteLoader,
  getBuiltinSuite,
} from '../../../../src/core/benchmark/default-suite-loader';

describe('DefaultSuiteLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aca-loader-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getBuiltinSuite', () => {
    it('should return built-in fallback tasks', () => {
      const suite = getBuiltinSuite();

      expect(suite.length).toBeGreaterThanOrEqual(2);
      expect(suite.every((t) => t.id.startsWith('builtin-'))).toBe(true);
      expect(suite.every((t) => t.tags.includes('builtin'))).toBe(true);
      expect(suite.every((t) => typeof t.repo === 'string')).toBe(true);
      expect(suite.every((t) => typeof t.description === 'string')).toBe(true);
    });

    it('should return a new copy each time', () => {
      const a = getBuiltinSuite();
      const b = getBuiltinSuite();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('directory does not exist', () => {
    it('should return built-in suite with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const loader = createDefaultSuiteLoader({
        benchmarksDir: '/tmp/nonexistent-aca-benchmark-dir-xyz',
      });

      const tasks = await loader('any-suite');

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].id).toContain('builtin');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('benchmarks/ directory not found'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('loading from JSON files', () => {
    it('should load tasks from a suite object format', async () => {
      const suite = {
        name: 'Test Suite',
        description: 'A test suite',
        tasks: [
          {
            id: 'test-1',
            name: 'Task One',
            description: 'First task',
            language: 'typescript',
          },
          {
            id: 'test-2',
            name: 'Task Two',
            description: 'Second task',
            language: 'python',
          },
        ],
      };
      await writeFile(join(tempDir, 'my-suite.json'), JSON.stringify(suite));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('my-suite');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('test-1');
      expect(tasks[0].description).toBe('First task');
      expect(tasks[0].tags).toContain('typescript');
      expect(tasks[0].repo).toBe('unknown/repo'); // default
      expect(tasks[0].difficulty).toBe('medium'); // default
      expect(tasks[1].id).toBe('test-2');
      expect(tasks[1].tags).toContain('python');
    });

    it('should load tasks from a plain array format', async () => {
      const tasks = [
        { id: 'arr-1', name: 'Arr One', description: 'Array task 1' },
        { id: 'arr-2', name: 'Arr Two', description: 'Array task 2' },
      ];
      await writeFile(join(tempDir, 'arr-suite.json'), JSON.stringify(tasks));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const result = await loader('arr-suite');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('arr-1');
      expect(result[1].id).toBe('arr-2');
    });

    it('should match suite name to file without extension', async () => {
      const suite = {
        name: 'Named Suite',
        tasks: [{ id: 'named-1', name: 'Named Task', description: 'Task' }],
      };
      await writeFile(join(tempDir, 'specific-suite.json'), JSON.stringify(suite));
      // Also write another file that should NOT be loaded
      await writeFile(
        join(tempDir, 'other-suite.json'),
        JSON.stringify({ name: 'Other', tasks: [{ id: 'other-1', name: 'Other', description: 'Other' }] }),
      );

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('specific-suite');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('named-1');
    });

    it('should load all files when suite name does not match any file', async () => {
      await writeFile(
        join(tempDir, 'a-suite.json'),
        JSON.stringify({ name: 'A', tasks: [{ id: 'a-1', name: 'A1', description: 'A task' }] }),
      );
      await writeFile(
        join(tempDir, 'b-suite.json'),
        JSON.stringify({ name: 'B', tasks: [{ id: 'b-1', name: 'B1', description: 'B task' }] }),
      );

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('no-match');

      expect(tasks).toHaveLength(2);
      const ids = tasks.map((t) => t.id);
      expect(ids).toContain('a-1');
      expect(ids).toContain('b-1');
    });

    it('should preserve custom fields from raw tasks', async () => {
      const suite = {
        name: 'Custom Fields',
        tasks: [
          {
            id: 'custom-1',
            name: 'Custom',
            description: 'Custom task',
            repo: 'owner/project',
            difficulty: 'hard',
            testCommands: ['npm test'],
            tags: ['security'],
            expectedPatch: 'diff --git a/file.ts',
          },
        ],
      };
      await writeFile(join(tempDir, 'custom.json'), JSON.stringify(suite));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('custom');

      expect(tasks[0].repo).toBe('owner/project');
      expect(tasks[0].difficulty).toBe('hard');
      expect(tasks[0].testCommands).toEqual(['npm test']);
      expect(tasks[0].tags).toEqual(['security']);
      expect(tasks[0].expectedPatch).toBe('diff --git a/file.ts');
    });
  });

  describe('loading from JSONL files', () => {
    it('should parse JSONL files (one task per line)', async () => {
      const lines = [
        JSON.stringify({ id: 'jl-1', name: 'JL One', description: 'JSONL task 1' }),
        JSON.stringify({ id: 'jl-2', name: 'JL Two', description: 'JSONL task 2' }),
      ];
      await writeFile(join(tempDir, 'lines.jsonl'), lines.join('\n'));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('lines');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('jl-1');
      expect(tasks[1].id).toBe('jl-2');
    });

    it('should skip blank lines in JSONL', async () => {
      const lines = [
        JSON.stringify({ id: 'jl-1', name: 'JL One', description: 'Task' }),
        '',
        '   ',
        JSON.stringify({ id: 'jl-2', name: 'JL Two', description: 'Task' }),
      ];
      await writeFile(join(tempDir, 'sparse.jsonl'), lines.join('\n'));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('sparse');

      expect(tasks).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('should skip tasks missing id', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const suite = {
        name: 'Bad Tasks',
        tasks: [
          { name: 'No ID', description: 'Missing id field' },
          { id: 'valid-1', name: 'Valid', description: 'Has all fields' },
        ],
      };
      await writeFile(join(tempDir, 'bad.json'), JSON.stringify(suite));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('bad');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('valid-1');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing a valid "id"'),
      );

      warnSpy.mockRestore();
    });

    it('should skip tasks missing name', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const suite = {
        name: 'Bad Tasks',
        tasks: [
          { id: 'no-name', description: 'Missing name' },
          { id: 'valid-1', name: 'Valid', description: 'Has all fields' },
        ],
      };
      await writeFile(join(tempDir, 'bad-name.json'), JSON.stringify(suite));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('bad-name');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('valid-1');

      warnSpy.mockRestore();
    });

    it('should skip tasks missing description', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const suite = {
        name: 'Bad Tasks',
        tasks: [
          { id: 'no-desc', name: 'No Description' },
          { id: 'valid-1', name: 'Valid', description: 'Has all fields' },
        ],
      };
      await writeFile(join(tempDir, 'bad-desc.json'), JSON.stringify(suite));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('bad-desc');

      expect(tasks).toHaveLength(1);

      warnSpy.mockRestore();
    });

    it('should skip files with invalid JSON', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await writeFile(join(tempDir, 'broken.json'), '{not valid json!!!');
      await writeFile(
        join(tempDir, 'valid.json'),
        JSON.stringify({ name: 'Valid', tasks: [{ id: 'v1', name: 'V', description: 'D' }] }),
      );

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      // Requesting a non-matching name loads all files
      const tasks = await loader('all');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('v1');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid JSON'),
      );

      warnSpy.mockRestore();
    });

    it('should skip files with unexpected structure', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await writeFile(join(tempDir, 'string.json'), JSON.stringify('just a string'));

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      // "string" matches "string.json", but the content is invalid suite structure
      const tasks = await loader('string');

      // parseSuiteFile returns [] for invalid structure
      expect(tasks).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('expected object with "tasks" array'),
      );

      warnSpy.mockRestore();
    });

    it('should return builtin suite when directory is empty', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('anything');

      // Empty dir with no matching file falls back to loadAllFiles
      // which finds nothing and returns builtin
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].id).toContain('builtin');

      warnSpy.mockRestore();
    });
  });

  describe('non-json files', () => {
    it('should ignore non-json/jsonl files in directory', async () => {
      await writeFile(join(tempDir, 'readme.md'), '# Readme');
      await writeFile(join(tempDir, 'data.csv'), 'id,name\n1,test');
      await writeFile(
        join(tempDir, 'valid.json'),
        JSON.stringify({ name: 'Suite', tasks: [{ id: 's1', name: 'S', description: 'D' }] }),
      );

      const loader = createDefaultSuiteLoader({ benchmarksDir: tempDir });
      const tasks = await loader('unmatched');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('s1');
    });
  });
});
