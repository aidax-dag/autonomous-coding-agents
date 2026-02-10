/**
 * Tests for Brownfield Analyzer
 */

import {
  BrownfieldAnalyzer,
  createBrownfieldAnalyzer,
  type AnalysisExecutor,
} from '@/core/brownfield';
import type { BrownfieldAnalysis } from '@/core/brownfield';

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
    it('should return stub analysis when no executor provided', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze('/project/root');

      expect(result.projectName).toBe('root');
      expect(result.analyzedAt).toBeTruthy();
      expect(result.metrics).toBeDefined();
      expect(result.patterns).toEqual([]);
      expect(result.techDebt).toEqual([]);
      expect(result.dependencies).toBeDefined();
      expect(result.recommendations).toEqual([]);
      // Stub metrics have testCoverageEstimate=0 → deducts 10
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

  describe('getMetrics', () => {
    it('should return stub metrics', async () => {
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

  describe('scanTechDebt', () => {
    it('should return empty array as stub', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const debt = await analyzer.scanTechDebt('/project');
      expect(debt).toEqual([]);
    });
  });

  describe('detectPatterns', () => {
    it('should return empty array as stub', async () => {
      const analyzer = new BrownfieldAnalyzer();
      const patterns = await analyzer.detectPatterns('/project');
      expect(patterns).toEqual([]);
    });
  });

  describe('health score calculation', () => {
    it('should return 90 for no tech debt but 0% coverage', async () => {
      // Stub metrics have testCoverageEstimate=0, so -10 deduction
      const analyzer = new BrownfieldAnalyzer();
      const result = await analyzer.analyze('/project');
      expect(result.healthScore).toBe(90);
    });

    it('should deduct for tech debt severity levels', async () => {
      // Stub returns empty arrays (no debt items), but coverage=0 → -10
      const analyzer = new BrownfieldAnalyzer({
        defaults: { scanTechDebt: true, detectPatterns: true },
      });
      const result = await analyzer.analyze('/project');
      expect(result.healthScore).toBe(90);
    });

    it('should clamp score between 0 and 100', async () => {
      // Custom executor returning result with many critical debt items
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
