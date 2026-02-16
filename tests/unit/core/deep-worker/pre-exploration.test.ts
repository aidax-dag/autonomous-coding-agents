/**
 * PreExploration Tests
 *
 * Tests both the custom executor path and the non-LLM default
 * fallback that uses filesystem/string analysis.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  PreExploration,
  createPreExploration,
  extractKeywords,
  collectFiles,
  scoreFile,
  detectPatterns,
  extractImports,
} from '../../../../src/core/deep-worker/pre-exploration';
import type { DeepWorkerContext } from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

const context: DeepWorkerContext = {
  workspaceDir: '/tmp/test',
  taskDescription: 'Implement auth feature',
};

// ── Helper: create a temp directory with sample project files ─────────
function createTempProject(): { rootDir: string; cleanup: () => void } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-explore-test-'));

  // Create directory structure
  fs.mkdirSync(path.join(rootDir, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'utils'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'node_modules', 'express'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });

  // Create source files
  fs.writeFileSync(
    path.join(rootDir, 'src', 'auth', 'login.ts'),
    `import { hashPassword } from '../utils/crypto';\nimport express from 'express';\n\nexport function login() { return true; }\n`,
  );
  fs.writeFileSync(
    path.join(rootDir, 'src', 'auth', 'middleware.ts'),
    `import { verify } from './login';\nimport jwt from 'jsonwebtoken';\n\nexport const authMiddleware = () => {};\n`,
  );
  fs.writeFileSync(
    path.join(rootDir, 'src', 'utils', 'crypto.ts'),
    `export function hashPassword(pw: string) { return pw; }\n`,
  );
  fs.writeFileSync(
    path.join(rootDir, 'src', 'index.ts'),
    `import { login } from './auth/login';\nconst app = require('express');\n`,
  );
  fs.writeFileSync(
    path.join(rootDir, 'tests', 'auth.test.ts'),
    `import { login } from '../src/auth/login';\ndescribe('auth', () => {});\n`,
  );

  // Create package.json
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      type: 'module',
      dependencies: {
        express: '^4.18.0',
        jsonwebtoken: '^9.0.0',
      },
      devDependencies: {
        jest: '^29.0.0',
        typescript: '^5.0.0',
      },
    }),
  );

  // Create tsconfig.json
  fs.writeFileSync(
    path.join(rootDir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { target: 'ES2022' } }),
  );

  // File inside node_modules (should be skipped)
  fs.writeFileSync(
    path.join(rootDir, 'node_modules', 'express', 'index.js'),
    'module.exports = {};',
  );

  // File inside dist (should be skipped)
  fs.writeFileSync(
    path.join(rootDir, 'dist', 'index.js'),
    'compiled output',
  );

  const cleanup = () => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  };

  return { rootDir, cleanup };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('PreExploration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Custom executor tests (preserved from original) ─────────────

  it('should use custom executor', async () => {
    const explorer = new PreExploration({
      executor: async (ctx) => ({
        relevantFiles: ['src/auth.ts'],
        patterns: ['middleware pattern'],
        dependencies: ['express'],
        summary: `Found files for: ${ctx.taskDescription}`,
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);

    expect(result.relevantFiles).toEqual(['src/auth.ts']);
    expect(result.patterns).toEqual(['middleware pattern']);
    expect(result.dependencies).toEqual(['express']);
  });

  it('should respect maxFiles limit with executor', async () => {
    const explorer = new PreExploration({
      maxFiles: 2,
      executor: async () => ({
        relevantFiles: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        patterns: [],
        dependencies: [],
        summary: 'many files',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(2);
  });

  it('should timeout long-running executor', async () => {
    const explorer = new PreExploration({
      timeout: 50,
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { relevantFiles: [], patterns: [], dependencies: [], summary: 'late', duration: 0 };
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('timed out');
  });

  it('should be created via factory', () => {
    expect(createPreExploration()).toBeInstanceOf(PreExploration);
  });

  it('should default maxFiles to 50 with executor', async () => {
    const files = Array.from({ length: 60 }, (_, i) => `file${i}.ts`);
    const explorer = new PreExploration({
      executor: async () => ({
        relevantFiles: files,
        patterns: [],
        dependencies: [],
        summary: 'many',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(50);
  });

  it('should not truncate when files are under maxFiles', async () => {
    const explorer = new PreExploration({
      maxFiles: 10,
      executor: async () => ({
        relevantFiles: ['a.ts', 'b.ts'],
        patterns: [],
        dependencies: [],
        summary: 'few',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(2);
  });

  it('should overwrite executor duration with actual elapsed time', async () => {
    const explorer = new PreExploration({
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          relevantFiles: [],
          patterns: [],
          dependencies: [],
          summary: 'done',
          duration: 999,
        };
      },
    });

    const result = await explorer.explore(context);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.duration).not.toBe(999);
  });

  it('should pass the full context to executor', async () => {
    const executorSpy = jest.fn().mockResolvedValue({
      relevantFiles: [],
      patterns: [],
      dependencies: [],
      summary: 'spy',
      duration: 0,
    });

    const fullContext: DeepWorkerContext = {
      workspaceDir: '/workspace',
      taskDescription: 'Fix bug #123',
      projectContext: 'Node.js backend',
      maxRetries: 3,
      stepTimeout: 5000,
      metadata: { priority: 'high' },
    };

    const explorer = new PreExploration({ executor: executorSpy });
    await explorer.explore(fullContext);

    expect(executorSpy).toHaveBeenCalledTimes(1);
    expect(executorSpy).toHaveBeenCalledWith(fullContext);
  });

  it('should preserve patterns and dependencies from executor', async () => {
    const explorer = new PreExploration({
      executor: async () => ({
        relevantFiles: ['index.ts'],
        patterns: ['singleton', 'factory', 'observer'],
        dependencies: ['lodash', 'express', 'pg'],
        summary: 'Rich exploration',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.patterns).toEqual(['singleton', 'factory', 'observer']);
    expect(result.dependencies).toEqual(['lodash', 'express', 'pg']);
    expect(result.summary).toBe('Rich exploration');
  });

  it('should propagate executor errors (non-timeout)', async () => {
    const explorer = new PreExploration({
      executor: async () => {
        throw new Error('Permission denied');
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('Permission denied');
  });

  it('should clear timeout after successful execution', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const explorer = new PreExploration({
      timeout: 5000,
      executor: async () => ({
        relevantFiles: [],
        patterns: [],
        dependencies: [],
        summary: 'fast',
        duration: 0,
      }),
    });

    await explorer.explore(context);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should accept factory options', () => {
    const explorer = createPreExploration({ maxFiles: 5, timeout: 1000 });
    expect(explorer).toBeInstanceOf(PreExploration);
  });

  it('should timeout error include the configured timeout value', async () => {
    const explorer = new PreExploration({
      timeout: 75,
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { relevantFiles: [], patterns: [], dependencies: [], summary: 'late', duration: 0 };
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('75ms');
  });

  it('should slice relevantFiles preserving order', async () => {
    const explorer = new PreExploration({
      maxFiles: 3,
      executor: async () => ({
        relevantFiles: ['first.ts', 'second.ts', 'third.ts', 'fourth.ts', 'fifth.ts'],
        patterns: [],
        dependencies: [],
        summary: 'ordered',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toEqual(['first.ts', 'second.ts', 'third.ts']);
  });

  // ── Default fallback: non-LLM exploration tests ─────────────────

  describe('default fallback (non-LLM)', () => {
    let rootDir: string;
    let cleanup: () => void;

    beforeEach(() => {
      const project = createTempProject();
      rootDir = project.rootDir;
      cleanup = project.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    it('should find relevant files matching keywords in task description', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix the login authentication middleware',
      };

      const result = await explorer.explore(ctx);

      expect(result.relevantFiles.length).toBeGreaterThan(0);
      // login.ts and middleware.ts should score high
      const hasLogin = result.relevantFiles.some((f) => f.includes('login'));
      const hasMiddleware = result.relevantFiles.some((f) => f.includes('middleware'));
      expect(hasLogin).toBe(true);
      expect(hasMiddleware).toBe(true);
    });

    it('should not include files from node_modules, .git, or dist', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix express index',
      };

      const result = await explorer.explore(ctx);

      for (const file of result.relevantFiles) {
        expect(file).not.toContain('node_modules');
        expect(file).not.toContain('.git');
        expect(file).not.toContain('dist');
      }
    });

    it('should detect project patterns from package.json', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login',
      };

      const result = await explorer.explore(ctx);

      expect(result.patterns).toContain('express');
      expect(result.patterns).toContain('jest');
      expect(result.patterns).toContain('typescript');
      expect(result.patterns).toContain('module:module');
    });

    it('should detect typescript from tsconfig.json', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login',
      };

      const result = await explorer.explore(ctx);
      expect(result.patterns).toContain('typescript');
    });

    it('should extract import dependencies from relevant files', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login middleware crypto',
      };

      const result = await explorer.explore(ctx);

      // Should find third-party package imports
      const hasExpressImport = result.dependencies.some((d) => d === 'express');
      const hasJwtImport = result.dependencies.some((d) => d === 'jsonwebtoken');
      expect(hasExpressImport || hasJwtImport).toBe(true);

      // Should find relative import paths (resolved to absolute)
      const hasRelativeImport = result.dependencies.some((d) => path.isAbsolute(d));
      expect(hasRelativeImport).toBe(true);
    });

    it('should respect maxFiles limit in default fallback', async () => {
      const explorer = new PreExploration({ maxFiles: 2 });
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'auth login middleware crypto index test',
      };

      const result = await explorer.explore(ctx);
      expect(result.relevantFiles.length).toBeLessThanOrEqual(2);
    });

    it('should return empty relevantFiles when no keywords match', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'zzz qqq xxx',
      };

      const result = await explorer.explore(ctx);
      expect(result.relevantFiles).toEqual([]);
    });

    it('should handle non-existent workspace directory gracefully', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: '/tmp/does-not-exist-pre-explore-test',
        taskDescription: 'Fix the login',
      };

      const result = await explorer.explore(ctx);
      expect(result.relevantFiles).toEqual([]);
      expect(result.dependencies).toEqual([]);
      // patterns will be empty since no package.json
      expect(result.patterns).toEqual([]);
    });

    it('should handle empty workspace directory gracefully', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-explore-empty-'));
      try {
        const explorer = new PreExploration();
        const ctx: DeepWorkerContext = {
          workspaceDir: emptyDir,
          taskDescription: 'Fix the login',
        };

        const result = await explorer.explore(ctx);
        expect(result.relevantFiles).toEqual([]);
        expect(result.patterns).toEqual([]);
        expect(result.dependencies).toEqual([]);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('should include summary with file count and patterns', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login middleware',
      };

      const result = await explorer.explore(ctx);

      expect(result.summary).toContain('Exploration of: Fix login middleware');
      if (result.relevantFiles.length > 0) {
        expect(result.summary).toContain('relevant file(s)');
      }
      if (result.patterns.length > 0) {
        expect(result.summary).toContain('Detected patterns');
      }
    });

    it('should produce fast duration (non-LLM)', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login',
      };

      const result = await explorer.explore(ctx);
      // Filesystem-only exploration should be very fast
      expect(result.duration).toBeLessThan(5000);
    });

    it('should rank files with exact name match higher', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'login',
      };

      const result = await explorer.explore(ctx);

      if (result.relevantFiles.length >= 2) {
        // login.ts should rank before files that merely contain 'login' in their path
        const loginIdx = result.relevantFiles.findIndex((f) =>
          path.basename(f, path.extname(f)) === 'login',
        );
        expect(loginIdx).toBeGreaterThanOrEqual(0);
        // First result should be the exact match
        expect(loginIdx).toBe(0);
      }
    });

    it('should handle context with empty taskDescription', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: '',
      };

      const result = await explorer.explore(ctx);
      // No keywords means no file matches
      expect(result.relevantFiles).toEqual([]);
      // Patterns should still be detected from package.json
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Exploration of: ');
    });

    it('should return relative file paths', async () => {
      const explorer = new PreExploration();
      const ctx: DeepWorkerContext = {
        workspaceDir: rootDir,
        taskDescription: 'Fix login',
      };

      const result = await explorer.explore(ctx);

      for (const filePath of result.relevantFiles) {
        expect(path.isAbsolute(filePath)).toBe(false);
      }
    });
  });
});

// ── Unit tests for exported helper functions ──────────────────────────

describe('extractKeywords', () => {
  it('should extract meaningful tokens from a description', () => {
    const keywords = extractKeywords('Fix the login authentication module');
    expect(keywords).toContain('login');
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('module');
    // Stop words should be excluded
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('fix');
  });

  it('should handle camelCase-style words', () => {
    const keywords = extractKeywords('update userProfile handler');
    expect(keywords).toContain('userprofile');
    expect(keywords).toContain('handler');
  });

  it('should handle file names in task description', () => {
    const keywords = extractKeywords('Fix bug in auth.controller.ts');
    expect(keywords).toContain('auth.controller.ts');
  });

  it('should deduplicate keywords', () => {
    const keywords = extractKeywords('auth auth auth login login');
    const authCount = keywords.filter((k) => k === 'auth').length;
    expect(authCount).toBe(1);
  });

  it('should return empty array for stop-words-only input', () => {
    const keywords = extractKeywords('the a an and or');
    expect(keywords).toEqual([]);
  });

  it('should filter tokens shorter than 2 characters', () => {
    const keywords = extractKeywords('a b c de fg');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('b');
    expect(keywords).not.toContain('c');
    expect(keywords).toContain('de');
    expect(keywords).toContain('fg');
  });
});

describe('collectFiles', () => {
  let rootDir: string;
  let cleanupFn: () => void;

  beforeEach(() => {
    const project = createTempProject();
    rootDir = project.rootDir;
    cleanupFn = project.cleanup;
  });

  afterEach(() => {
    cleanupFn();
  });

  it('should collect source files from the directory tree', () => {
    const files = collectFiles(rootDir);
    expect(files.length).toBeGreaterThan(0);

    const relFiles = files.map((f) => path.relative(rootDir, f));
    expect(relFiles).toContain(path.join('src', 'auth', 'login.ts'));
    expect(relFiles).toContain(path.join('src', 'utils', 'crypto.ts'));
    expect(relFiles).toContain(path.join('src', 'index.ts'));
  });

  it('should skip node_modules directory', () => {
    const files = collectFiles(rootDir);
    for (const f of files) {
      expect(f).not.toContain('node_modules');
    }
  });

  it('should skip .git directory', () => {
    const files = collectFiles(rootDir);
    for (const f of files) {
      expect(f).not.toContain(path.join('.git', ''));
    }
  });

  it('should skip dist directory', () => {
    const files = collectFiles(rootDir);
    for (const f of files) {
      expect(f).not.toContain(path.join('dist', ''));
    }
  });

  it('should return empty array for non-existent directory', () => {
    const files = collectFiles('/tmp/non-existent-collect-files-test');
    expect(files).toEqual([]);
  });

  it('should include package.json', () => {
    const files = collectFiles(rootDir);
    const relFiles = files.map((f) => path.relative(rootDir, f));
    expect(relFiles).toContain('package.json');
  });
});

describe('scoreFile', () => {
  it('should return 0 for empty keywords', () => {
    expect(scoreFile('/project/src/auth.ts', [])).toBe(0);
  });

  it('should give highest score for exact basename match', () => {
    const score = scoreFile('/project/src/auth.ts', ['auth']);
    expect(score).toBe(10);
  });

  it('should give medium score for basename contains', () => {
    const score = scoreFile('/project/src/auth-handler.ts', ['auth']);
    expect(score).toBe(5);
  });

  it('should give lower score for path segment match', () => {
    const score = scoreFile('/project/auth/index.ts', ['auth']);
    // 'auth' matches the path segment, not the basename 'index'
    expect(score).toBe(3);
  });

  it('should give lowest score for extension match', () => {
    const score = scoreFile('/project/src/main.go', ['go']);
    // 'go' not in basename 'main', not in path segments — only matches .go extension
    expect(score).toBe(1);
  });

  it('should accumulate scores for multiple keyword matches', () => {
    // 'auth' exact match (10) + 'handler' not matching anything (0)
    const score = scoreFile('/project/src/auth.ts', ['auth', 'xyz']);
    expect(score).toBe(10);
  });
});

describe('detectPatterns', () => {
  let rootDir: string;
  let cleanupFn: () => void;

  beforeEach(() => {
    const project = createTempProject();
    rootDir = project.rootDir;
    cleanupFn = project.cleanup;
  });

  afterEach(() => {
    cleanupFn();
  });

  it('should detect express from dependencies', () => {
    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('express');
  });

  it('should detect jest from devDependencies', () => {
    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('jest');
  });

  it('should detect typescript from devDependencies', () => {
    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('typescript');
  });

  it('should detect module type from package.json', () => {
    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('module:module');
  });

  it('should detect typescript from tsconfig.json file', () => {
    // Remove typescript from devDependencies but keep tsconfig.json
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    delete pkg.devDependencies.typescript;
    // Also remove ts-jest to prevent typescript detection from deps
    delete pkg.devDependencies['ts-jest'];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));

    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('typescript');
  });

  it('should return empty array for directory without package.json', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-patterns-empty-'));
    try {
      const patterns = detectPatterns(emptyDir);
      expect(patterns).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('should detect react from dependencies', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.dependencies.react = '^18.0.0';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));

    const patterns = detectPatterns(rootDir);
    expect(patterns).toContain('react');
  });
});

describe('extractImports', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-imports-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should extract ES import paths', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, `import { foo } from './utils/helper';\nimport bar from 'lodash';\n`);

    const imports = extractImports(filePath);
    expect(imports).toContain('lodash');
    const hasRelative = imports.some((i) => i.includes('utils'));
    expect(hasRelative).toBe(true);
  });

  it('should extract require paths', () => {
    const filePath = path.join(tmpDir, 'test.js');
    fs.writeFileSync(filePath, `const express = require('express');\nconst path = require('path');\n`);

    const imports = extractImports(filePath);
    expect(imports).toContain('express');
    expect(imports).toContain('path');
  });

  it('should extract dynamic import paths', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, `const mod = await import('./dynamic-module');\n`);

    const imports = extractImports(filePath);
    const hasDynamic = imports.some((i) => i.includes('dynamic-module'));
    expect(hasDynamic).toBe(true);
  });

  it('should extract scoped package names', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, `import { Anthropic } from '@anthropic-ai/sdk';\n`);

    const imports = extractImports(filePath);
    expect(imports).toContain('@anthropic-ai/sdk');
  });

  it('should return empty array for non-existent file', () => {
    const imports = extractImports('/tmp/non-existent-file.ts');
    expect(imports).toEqual([]);
  });

  it('should return empty array for file with no imports', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, `const x = 42;\nconsole.log(x);\n`);

    const imports = extractImports(filePath);
    expect(imports).toEqual([]);
  });

  it('should deduplicate repeated imports', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(
      filePath,
      `import { a } from 'lodash';\nimport { b } from 'lodash';\nconst c = require('lodash');\n`,
    );

    const imports = extractImports(filePath);
    const lodashCount = imports.filter((i) => i === 'lodash').length;
    expect(lodashCount).toBe(1);
  });
});
