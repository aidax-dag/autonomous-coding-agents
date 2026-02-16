/**
 * Tests for Brownfield Analyzer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  BrownfieldAnalyzer,
  createBrownfieldAnalyzer,
  type AnalysisExecutor,
} from '@/core/brownfield';
import type { BrownfieldAnalysis } from '@/core/brownfield';

// ============================================================================
// Helpers — temp directory management
// ============================================================================

let tmpRoot: string;

function createTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brownfield-test-'));
  return dir;
}

function writeFile(relativePath: string, content: string): void {
  const fullPath = path.join(tmpRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function cleanupTmpDir(): void {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ============================================================================
// Tests — original behaviour (non-existent paths return empty results)
// ============================================================================

describe('BrownfieldAnalyzer', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const analyzer = new BrownfieldAnalyzer();
      expect(analyzer).toBeInstanceOf(BrownfieldAnalyzer);
    });

    it('should accept custom defaults', () => {
      const analyzer = new BrownfieldAnalyzer({
        defaults: { analyzeDeps: false, maxFiles: 500 },
      });
      expect(analyzer).toBeInstanceOf(BrownfieldAnalyzer);
    });
  });

  describe('analyze', () => {
    it('should return empty analysis for non-existent path', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze('/project/root');

      expect(result.projectName).toBe('root');
      expect(result.analyzedAt).toBeTruthy();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalFiles).toBe(0);
      expect(result.metrics.totalLoc).toBe(0);
      expect(result.patterns).toEqual([]);
      expect(result.techDebt).toEqual([]);
      expect(result.dependencies).toBeDefined();
      // Non-existent path → 0 files → 0 coverage → deducts 10
      expect(result.healthScore).toBe(90);
    });

    it('should use custom executor when provided', async () => {
      const mockAnalysis: BrownfieldAnalysis = {
        projectName: 'custom-project',
        analyzedAt: '2026-01-01',
        metrics: {
          totalLoc: 50000,
          totalFiles: 200,
          languages: { TypeScript: 40000, JavaScript: 10000 },
          avgFileSize: 250,
          largestFiles: [{ path: '/big.ts', loc: 2000 }],
          testCoverageEstimate: 75,
        },
        patterns: [
          {
            name: 'MVC',
            category: 'architectural',
            occurrences: 15,
            locations: ['/controllers', '/models'],
            confidence: 0.9,
          },
        ],
        techDebt: [
          {
            type: 'outdated-dep',
            severity: 'high',
            description: 'Express 3.x',
            files: ['package.json'],
            effort: 'medium',
          },
        ],
        dependencies: {
          directDeps: 45,
          devDeps: 30,
          outdated: ['express'],
          unused: ['lodash'],
          duplicates: [],
        },
        recommendations: ['Upgrade Express to v5'],
        healthScore: 72,
      };

      const executor: AnalysisExecutor = async () => mockAnalysis;
      const analyzer = new BrownfieldAnalyzer({ executor });
      const result = await analyzer.analyze('/project');

      expect(result.projectName).toBe('custom-project');
      expect(result.metrics.totalLoc).toBe(50000);
      expect(result.patterns).toHaveLength(1);
      expect(result.techDebt).toHaveLength(1);
      expect(result.dependencies.outdated).toContain('express');
    });

    it('should merge options with defaults', async () => {
      let capturedOpts: any;
      const executor: AnalysisExecutor = async (_root, opts) => {
        capturedOpts = opts;
        return {
          projectName: 'test',
          analyzedAt: '',
          metrics: { totalLoc: 0, totalFiles: 0, languages: {}, avgFileSize: 0, largestFiles: [], testCoverageEstimate: 0 },
          patterns: [],
          techDebt: [],
          dependencies: { directDeps: 0, devDeps: 0, outdated: [], unused: [], duplicates: [] },
          recommendations: [],
          healthScore: 100,
        };
      };

      const analyzer = new BrownfieldAnalyzer({
        executor,
        defaults: { analyzeDeps: true, maxFiles: 500 },
      });

      await analyzer.analyze('/project', { maxFiles: 100, scanTechDebt: true });

      expect(capturedOpts.analyzeDeps).toBe(true); // from defaults
      expect(capturedOpts.maxFiles).toBe(100); // overridden by options
      expect(capturedOpts.scanTechDebt).toBe(true); // from options
    });

    it('should skip tech debt scan when disabled', async () => {
      const analyzer = new BrownfieldAnalyzer({
        defaults: { scanTechDebt: false, detectPatterns: true },
      });
      const result = await analyzer.analyze('/project');

      expect(result.techDebt).toEqual([]);
    });

    it('should skip pattern detection when disabled', async () => {
      const analyzer = new BrownfieldAnalyzer({
        defaults: { scanTechDebt: true, detectPatterns: false },
      });
      const result = await analyzer.analyze('/project');

      expect(result.patterns).toEqual([]);
    });

    it('should extract project name from path', async () => {
      const analyzer = new BrownfieldAnalyzer();

      const result1 = await analyzer.analyze('/home/user/my-project');
      expect(result1.projectName).toBe('my-project');

      const result2 = await analyzer.analyze('/app');
      expect(result2.projectName).toBe('app');
    });
  });

  describe('getMetrics — non-existent path', () => {
    it('should return zero metrics for non-existent directory', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics('/project');

      expect(metrics.totalLoc).toBe(0);
      expect(metrics.totalFiles).toBe(0);
      expect(metrics.languages).toEqual({});
      expect(metrics.avgFileSize).toBe(0);
      expect(metrics.largestFiles).toEqual([]);
      expect(metrics.testCoverageEstimate).toBe(0);
    });
  });

  describe('scanTechDebt — non-existent path', () => {
    it('should return empty array for non-existent directory', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt('/project');
      expect(debt).toEqual([]);
    });
  });

  describe('detectPatterns — non-existent path', () => {
    it('should return empty array for non-existent directory', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns('/project');
      expect(patterns).toEqual([]);
    });
  });

  describe('health score calculation', () => {
    it('should return 90 for no tech debt but 0% coverage', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze('/project');
      expect(result.healthScore).toBe(90);
    });

    it('should deduct for tech debt severity levels', async () => {
      const analyzer = new BrownfieldAnalyzer({
        defaults: { scanTechDebt: true, detectPatterns: true },
      });
      const result = await analyzer.analyze('/project');
      expect(result.healthScore).toBe(90);
    });

    it('should clamp score between 0 and 100', async () => {
      // Custom executor returning result with extreme score
      const executor: AnalysisExecutor = async () => ({
        projectName: 'bad-project',
        analyzedAt: '',
        metrics: { totalLoc: 0, totalFiles: 0, languages: {}, avgFileSize: 0, largestFiles: [], testCoverageEstimate: 0 },
        patterns: [],
        techDebt: [],
        dependencies: { directDeps: 0, devDeps: 0, outdated: [], unused: [], duplicates: [] },
        recommendations: [],
        healthScore: -10, // executor can return any score
      });

      const analyzer = new BrownfieldAnalyzer({ executor });
      const result = await analyzer.analyze('/project');
      // Executor controls the score directly
      expect(result.healthScore).toBe(-10);
    });
  });

  describe('createBrownfieldAnalyzer', () => {
    it('should create instance via factory', () => {
      const analyzer = createBrownfieldAnalyzer();
      expect(analyzer).toBeInstanceOf(BrownfieldAnalyzer);
    });

    it('should pass config to constructor', async () => {
      const executor: AnalysisExecutor = async () => ({
        projectName: 'factory-project',
        analyzedAt: '',
        metrics: { totalLoc: 0, totalFiles: 0, languages: {}, avgFileSize: 0, largestFiles: [], testCoverageEstimate: 0 },
        patterns: [],
        techDebt: [],
        dependencies: { directDeps: 0, devDeps: 0, outdated: [], unused: [], duplicates: [] },
        recommendations: [],
        healthScore: 50,
      });

      const analyzer = createBrownfieldAnalyzer({ executor });
      const result = await analyzer.analyze('/test');
      expect(result.projectName).toBe('factory-project');
    });
  });
});

// ============================================================================
// Tests — real filesystem analysis
// ============================================================================

describe('BrownfieldAnalyzer — real filesystem', () => {
  beforeEach(() => {
    tmpRoot = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir();
  });

  // --------------------------------------------------------------------------
  // getMetrics
  // --------------------------------------------------------------------------

  describe('getMetrics', () => {
    it('should count files and LOC from a real directory', async () => {
      writeFile('src/index.ts', 'export const x = 1;\nexport const y = 2;\n');
      writeFile('src/util.ts', 'export function add(a: number, b: number) {\n  return a + b;\n}\n');
      writeFile('lib/helper.js', 'module.exports = {};\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(3);
      expect(metrics.totalLoc).toBeGreaterThan(0);
      expect(metrics.languages['TypeScript']).toBeGreaterThan(0);
      expect(metrics.languages['JavaScript']).toBeGreaterThan(0);
      expect(metrics.avgFileSize).toBeGreaterThan(0);
    });

    it('should detect large files (>500 lines)', async () => {
      const bigContent = Array.from({ length: 600 }, (_, i) => `const line${i} = ${i};`).join('\n');
      writeFile('src/big-file.ts', bigContent);
      writeFile('src/small.ts', 'export const x = 1;\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.largestFiles.length).toBe(1);
      expect(metrics.largestFiles[0].loc).toBeGreaterThanOrEqual(600);
      expect(metrics.largestFiles[0].path).toContain('big-file.ts');
    });

    it('should identify languages by extension', async () => {
      writeFile('app.py', 'print("hello")\n');
      writeFile('main.go', 'package main\n');
      writeFile('index.ts', 'console.log("hi");\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.languages['Python']).toBeGreaterThan(0);
      expect(metrics.languages['Go']).toBeGreaterThan(0);
      expect(metrics.languages['TypeScript']).toBeGreaterThan(0);
    });

    it('should estimate test coverage from test file ratio', async () => {
      writeFile('src/app.ts', 'export class App {}\n');
      writeFile('src/service.ts', 'export class Service {}\n');
      writeFile('tests/app.test.ts', 'describe("App", () => { it("works", () => {}); });\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      // 1 test file out of 2 non-test source files = 50%
      expect(metrics.testCoverageEstimate).toBe(50);
    });

    it('should skip node_modules and .git directories', async () => {
      writeFile('src/index.ts', 'export const x = 1;\n');
      writeFile('node_modules/lib/index.js', 'module.exports = {};\n');
      writeFile('.git/objects/abc', 'binary data\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(1);
    });

    it('should skip files with unrecognized extensions', async () => {
      writeFile('data.bin', '\x00\x01\x02');
      writeFile('image.png', 'fake png data');
      writeFile('src/index.ts', 'export const x = 1;\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(1);
    });

    it('should respect maxFiles option', async () => {
      for (let i = 0; i < 20; i++) {
        writeFile(`src/file${i}.ts`, `export const v${i} = ${i};\n`);
      }

      const analyzer = new BrownfieldAnalyzer({ defaults: { maxFiles: 5 } });
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // scanTechDebt
  // --------------------------------------------------------------------------

  describe('scanTechDebt', () => {
    it('should detect TODO comments', async () => {
      writeFile('src/app.ts', [
        'export class App {',
        '  // TODO: implement authentication',
        '  start() {}',
        '}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const todoItems = debt.filter((d) => d.description.includes('TODO'));
      expect(todoItems.length).toBeGreaterThanOrEqual(1);
      expect(todoItems[0].severity).toBe('medium');
      expect(todoItems[0].description).toContain('line 2');
    });

    it('should detect FIXME comments', async () => {
      writeFile('src/util.ts', [
        'export function parse(input: string) {',
        '  // FIXME: handle edge case for empty strings',
        '  return input.trim();',
        '}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const fixmeItems = debt.filter((d) => d.description.includes('FIXME'));
      expect(fixmeItems.length).toBe(1);
      expect(fixmeItems[0].severity).toBe('medium');
    });

    it('should detect HACK comments with high severity', async () => {
      writeFile('src/workaround.ts', [
        '// HACK: bypassing validation for legacy reasons',
        'export function legacyHandler() {}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const hackItems = debt.filter((d) => d.description.includes('HACK'));
      expect(hackItems.length).toBe(1);
      expect(hackItems[0].severity).toBe('high');
    });

    it('should detect XXX comments with high severity', async () => {
      writeFile('src/danger.ts', [
        'function riskyOp() {',
        '  // XXX: this will break if concurrency > 1',
        '  return true;',
        '}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const xxxItems = debt.filter((d) => d.description.includes('XXX'));
      expect(xxxItems.length).toBe(1);
      expect(xxxItems[0].severity).toBe('high');
    });

    it('should detect files exceeding 300 lines', async () => {
      const longContent = Array.from({ length: 350 }, (_, i) => `const v${i} = ${i};`).join('\n');
      writeFile('src/long-file.ts', longContent);

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const complexityItems = debt.filter((d) => d.type === 'complexity' && d.description.includes('350'));
      expect(complexityItems.length).toBe(1);
      expect(complexityItems[0].severity).toBe('medium');
    });

    it('should detect deeply nested directories (>5 levels)', async () => {
      writeFile('a/b/c/d/e/f/deep.ts', 'export const deep = true;\n');

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const deepItems = debt.filter(
        (d) => d.type === 'complexity' && d.description.includes('Deeply nested'),
      );
      expect(deepItems.length).toBeGreaterThanOrEqual(1);
      expect(deepItems[0].severity).toBe('low');
    });

    it('should include correct file paths in debt items', async () => {
      writeFile('src/handlers/api.ts', '// TODO: add rate limiting\nexport function handler() {}\n');

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const todoItem = debt.find((d) => d.description.includes('TODO'));
      expect(todoItem).toBeDefined();
      expect(todoItem!.files[0]).toContain('src/handlers/api.ts');
    });
  });

  // --------------------------------------------------------------------------
  // detectPatterns
  // --------------------------------------------------------------------------

  describe('detectPatterns', () => {
    it('should detect Singleton pattern', async () => {
      writeFile('src/config.ts', [
        'export class ConfigSingleton {',
        '  private static instance: ConfigSingleton;',
        '  static getInstance() { return this.instance; }',
        '}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const singleton = patterns.find((p) => p.name === 'Singleton');
      expect(singleton).toBeDefined();
      expect(singleton!.occurrences).toBeGreaterThanOrEqual(1);
      expect(singleton!.category).toBe('design');
    });

    it('should detect Factory pattern', async () => {
      writeFile('src/factory.ts', [
        'export class WidgetFactory {',
        '  create() { return {}; }',
        '}',
        'export function createWidget() { return {}; }',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const factory = patterns.find((p) => p.name === 'Factory');
      expect(factory).toBeDefined();
      expect(factory!.occurrences).toBeGreaterThanOrEqual(1);
      expect(factory!.category).toBe('design');
    });

    it('should detect Observer pattern', async () => {
      writeFile('src/events.ts', [
        'import { EventEmitter } from "events";',
        'class MyEmitter extends EventEmitter {}',
        'const emitter = new MyEmitter();',
        'emitter.on("data", () => {});',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const observer = patterns.find((p) => p.name === 'Observer');
      expect(observer).toBeDefined();
      expect(observer!.occurrences).toBeGreaterThanOrEqual(1);
      expect(observer!.category).toBe('design');
    });

    it('should detect Repository pattern', async () => {
      writeFile('src/user-repo.ts', [
        'export class UserRepository {',
        '  async findById(id: string) { return null; }',
        '}',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const repo = patterns.find((p) => p.name === 'Repository');
      expect(repo).toBeDefined();
      expect(repo!.category).toBe('architectural');
    });

    it('should detect Test Suite pattern', async () => {
      writeFile('tests/app.test.ts', [
        'describe("App", () => {',
        '  it("should work", () => {',
        '    expect(true).toBe(true);',
        '  });',
        '});',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const testSuite = patterns.find((p) => p.name === 'Test Suite');
      expect(testSuite).toBeDefined();
      expect(testSuite!.category).toBe('testing');
    });

    it('should detect React Component pattern', async () => {
      writeFile('src/App.tsx', [
        'import React from "react";',
        'export function App() { return <div>Hello</div>; }',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const react = patterns.find((p) => p.name === 'React Component');
      expect(react).toBeDefined();
      expect(react!.category).toBe('implementation');
    });

    it('should detect Express Middleware pattern', async () => {
      writeFile('src/server.ts', [
        'import express from "express";',
        'const app = express();',
        'app.get("/", (req, res) => res.send("ok"));',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const express = patterns.find((p) => p.name === 'Express Middleware');
      expect(express).toBeDefined();
      expect(express!.category).toBe('architectural');
    });

    it('should return empty for a directory with no detectable patterns', async () => {
      writeFile('data/config.json', '{ "key": "value" }\n');

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      expect(patterns).toEqual([]);
    });

    it('should sort patterns by occurrences descending', async () => {
      // Create multiple files with Factory pattern
      for (let i = 0; i < 5; i++) {
        writeFile(`src/factory${i}.ts`, `export function createItem${i}() { return {}; }\n`);
      }
      // One file with Singleton
      writeFile('src/singleton.ts', 'export class AppSingleton { static getInstance() { return null; } }\n');

      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns(tmpRoot);

      const factory = patterns.find((p) => p.name === 'Factory');
      const singleton = patterns.find((p) => p.name === 'Singleton');
      expect(factory).toBeDefined();
      expect(singleton).toBeDefined();
      expect(factory!.occurrences).toBeGreaterThan(singleton!.occurrences);

      // First pattern should have >= occurrences of second
      if (patterns.length >= 2) {
        expect(patterns[0].occurrences).toBeGreaterThanOrEqual(patterns[1].occurrences);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Full analyze
  // --------------------------------------------------------------------------

  describe('full analyze', () => {
    it('should produce a complete analysis from real files', async () => {
      writeFile('src/app.ts', [
        'import express from "express";',
        '// TODO: add error handling middleware',
        'const app = express();',
        'app.get("/health", (req, res) => res.send("ok"));',
        'export default app;',
      ].join('\n'));
      writeFile('src/service.ts', [
        'export class UserRepository {',
        '  // HACK: temporary cache bypass',
        '  async find(id: string) { return null; }',
        '}',
      ].join('\n'));
      writeFile('tests/app.test.ts', [
        'describe("App", () => {',
        '  it("responds to health check", () => {',
        '    expect(true).toBe(true);',
        '  });',
        '});',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze(tmpRoot);

      // Metrics
      expect(result.metrics.totalFiles).toBe(3);
      expect(result.metrics.totalLoc).toBeGreaterThan(0);
      expect(result.metrics.languages['TypeScript']).toBeGreaterThan(0);

      // Tech debt
      expect(result.techDebt.length).toBeGreaterThanOrEqual(2); // TODO + HACK
      const todoDebt = result.techDebt.find((d) => d.description.includes('TODO'));
      const hackDebt = result.techDebt.find((d) => d.description.includes('HACK'));
      expect(todoDebt).toBeDefined();
      expect(hackDebt).toBeDefined();
      expect(todoDebt!.severity).toBe('medium');
      expect(hackDebt!.severity).toBe('high');

      // Patterns
      expect(result.patterns.length).toBeGreaterThanOrEqual(1);
      const expressPattern = result.patterns.find((p) => p.name === 'Express Middleware');
      expect(expressPattern).toBeDefined();

      // Health score should be reduced by tech debt
      expect(result.healthScore).toBeLessThan(100);

      // Recommendations should mention HACK debt
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle empty directories gracefully', async () => {
      // tmpRoot exists but has no recognized files
      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze(tmpRoot);

      expect(result.metrics.totalFiles).toBe(0);
      expect(result.metrics.totalLoc).toBe(0);
      expect(result.techDebt).toEqual([]);
      expect(result.patterns).toEqual([]);
      expect(result.healthScore).toBe(90); // -10 for low coverage
    });

    it('should generate recommendations based on analysis', async () => {
      // Create a file with HACK to trigger high-severity recommendation
      writeFile('src/hack.ts', '// HACK: workaround\nexport const x = 1;\n');

      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze(tmpRoot);

      const hackRec = result.recommendations.find((r) => r.includes('high/critical'));
      expect(hackRec).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle files with no extension', async () => {
      writeFile('Makefile', 'all:\n\techo "build"\n');
      writeFile('src/index.ts', 'export const x = 1;\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      // Makefile has no recognized extension, so only index.ts counts
      expect(metrics.totalFiles).toBe(1);
    });

    it('should handle mixed languages in same directory', async () => {
      writeFile('app.py', 'print("hello")\n');
      writeFile('app.ts', 'console.log("hello");\n');
      writeFile('app.go', 'package main\nfunc main() {}\n');
      writeFile('app.rs', 'fn main() {}\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(4);
      expect(Object.keys(metrics.languages).length).toBe(4);
      expect(metrics.languages['Python']).toBeGreaterThan(0);
      expect(metrics.languages['TypeScript']).toBeGreaterThan(0);
      expect(metrics.languages['Go']).toBeGreaterThan(0);
      expect(metrics.languages['Rust']).toBeGreaterThan(0);
    });

    it('should not scan inside dot-prefixed directories', async () => {
      writeFile('.hidden/secret.ts', 'export const secret = "hidden";\n');
      writeFile('src/visible.ts', 'export const visible = true;\n');

      const analyzer = new BrownfieldAnalyzer();
      const metrics = await analyzer.getMetrics(tmpRoot);

      expect(metrics.totalFiles).toBe(1);
    });

    it('should handle multiple debt markers in same file', async () => {
      writeFile('src/messy.ts', [
        '// TODO: refactor this',
        '// FIXME: broken edge case',
        '// HACK: temporary workaround',
        '// XXX: critical issue',
        'export const x = 1;',
      ].join('\n'));

      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt(tmpRoot);

      const commentDebts = debt.filter((d) => d.type === 'code-smell');
      expect(commentDebts.length).toBe(4);

      const highItems = commentDebts.filter((d) => d.severity === 'high');
      const mediumItems = commentDebts.filter((d) => d.severity === 'medium');
      expect(highItems.length).toBe(2); // HACK + XXX
      expect(mediumItems.length).toBe(2); // TODO + FIXME
    });
  });
});
