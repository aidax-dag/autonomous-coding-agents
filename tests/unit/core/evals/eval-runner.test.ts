/**
 * EvalRunner Unit Tests
 */

import { join } from 'path';
import {
  EvalRunner,
  createEvalRunner,
  type EvalDefinition,
  type EvalExecutor,
} from '../../../../src/core/evals/index.js';

const DEFINITIONS_DIR = join(__dirname, '../../../../src/core/evals/definitions');

describe('EvalRunner', () => {
  let runner: EvalRunner;

  beforeEach(() => {
    runner = createEvalRunner({
      definitionsDir: DEFINITIONS_DIR,
      workspaceDir: '/tmp/test-evals',
    });
  });

  describe('loadDefinitions', () => {
    it('should load YAML definitions from directory', async () => {
      const definitions = await runner.loadDefinitions(DEFINITIONS_DIR);
      expect(definitions.length).toBeGreaterThan(0);
    });

    it('should load definitions from a single YAML file', async () => {
      const filePath = join(DEFINITIONS_DIR, 'code-quality.eval.yaml');
      const definitions = await runner.loadDefinitions(filePath);
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].category).toBe('code_quality');
    });

    it('should normalize definition fields', async () => {
      const definitions = await runner.loadDefinitions(DEFINITIONS_DIR);
      for (const def of definitions) {
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(['code_quality', 'task_completion', 'tool_usage', 'error_handling', 'hallucination']).toContain(def.category);
        expect(['ALWAYS_PASSES', 'USUALLY_PASSES']).toContain(def.severity);
        expect(typeof def.timeout).toBe('number');
      }
    });

    it('should handle missing directory gracefully', async () => {
      const definitions = await runner.loadDefinitions('/nonexistent/path');
      expect(definitions).toEqual([]);
    });

    it('should filter by category', async () => {
      const filtered = createEvalRunner({
        definitionsDir: DEFINITIONS_DIR,
        workspaceDir: '/tmp/test-evals',
        categories: ['code_quality'],
      });
      const definitions = await filtered.loadDefinitions(DEFINITIONS_DIR);
      expect(definitions.every((d) => d.category === 'code_quality')).toBe(true);
    });

    it('should filter by severity', async () => {
      const filtered = createEvalRunner({
        definitionsDir: DEFINITIONS_DIR,
        workspaceDir: '/tmp/test-evals',
        severities: ['ALWAYS_PASSES'],
      });
      const definitions = await filtered.loadDefinitions(DEFINITIONS_DIR);
      expect(definitions.every((d) => d.severity === 'ALWAYS_PASSES')).toBe(true);
    });
  });

  describe('runEval', () => {
    it('should run a single eval with executor', async () => {
      const mockExecutor: EvalExecutor = async () => ({
        output: 'function validateEmail(email: string) { return /@/.test(email); }',
        toolCalls: [],
        filesModified: [],
        duration: 100,
      });

      runner.setExecutor(mockExecutor);

      const definition: EvalDefinition = {
        id: 'test-eval',
        name: 'Test eval',
        category: 'code_quality',
        severity: 'ALWAYS_PASSES',
        timeout: 30000,
        input: { prompt: 'Create an email validator' },
        expectedBehavior: {
          outputContains: ['function|const'],
          outputExcludes: ['TODO'],
        },
      };

      const result = await runner.runEval(definition);
      expect(result.evalId).toBe('test-eval');
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should fail when output contains excluded pattern', async () => {
      const mockExecutor: EvalExecutor = async () => ({
        output: '// TODO: implement this\nfunction placeholder() {}',
        toolCalls: [],
        filesModified: [],
        duration: 100,
      });

      runner.setExecutor(mockExecutor);

      const definition: EvalDefinition = {
        id: 'test-fail',
        name: 'Test fail',
        category: 'code_quality',
        severity: 'ALWAYS_PASSES',
        timeout: 30000,
        input: { prompt: 'Create something' },
        expectedBehavior: {
          outputExcludes: ['TODO'],
        },
      };

      const result = await runner.runEval(definition);
      expect(result.passed).toBe(false);
    });

    it('should return error result for unknown category', async () => {
      const definition: EvalDefinition = {
        id: 'unknown-cat',
        name: 'Unknown',
        category: 'hallucination' as any,
        severity: 'ALWAYS_PASSES',
        timeout: 30000,
        input: { prompt: 'test' },
        expectedBehavior: {},
      };

      const result = await runner.runEval(definition);
      expect(result.passed).toBe(false);
      expect(result.error).toContain('No evaluator');
    });
  });

  describe('runSuite', () => {
    it('should run all evals in a category', async () => {
      const mockExecutor: EvalExecutor = async () => ({
        output: 'function validate(email: string): boolean { return true; }',
        toolCalls: [],
        filesModified: [],
        duration: 50,
      });

      runner.setExecutor(mockExecutor);
      await runner.loadDefinitions(DEFINITIONS_DIR);

      const result = await runner.runSuite('code_quality');
      expect(result.suiteName).toBe('code_quality');
      expect(result.totalEvals).toBeGreaterThan(0);
      expect(typeof result.alwaysPassRate).toBe('number');
      expect(typeof result.usuallyPassRate).toBe('number');
    });
  });

  describe('runAll', () => {
    it('should run all loaded definitions', async () => {
      const mockExecutor: EvalExecutor = async (def) => ({
        output: `Response for ${def.id}: function test() { return true; }`,
        toolCalls: [{ name: 'read_file', args: {}, timestamp: Date.now() }],
        filesModified: [],
        duration: 50,
      });

      runner.setExecutor(mockExecutor);
      await runner.loadDefinitions(DEFINITIONS_DIR);

      const result = await runner.runAll();
      expect(result.totalEvals).toBeGreaterThan(0);
      expect(result.passed + result.failed).toBe(result.totalEvals);
      expect(result.results.length).toBe(result.totalEvals);
    });

    it('should compute suite result metrics correctly', async () => {
      const mockExecutor: EvalExecutor = async () => ({
        output: '1. Testing\n2. Quality\n3. Speed\nfunction test(): string { return "ok"; }',
        toolCalls: [{ name: 'read_file', args: {}, timestamp: Date.now() }],
        filesModified: [],
        duration: 50,
      });

      runner.setExecutor(mockExecutor);
      await runner.loadDefinitions(DEFINITIONS_DIR);

      const result = await runner.runAll();
      expect(result.alwaysPassRate).toBeGreaterThanOrEqual(0);
      expect(result.alwaysPassRate).toBeLessThanOrEqual(1);
      expect(result.usuallyPassRate).toBeGreaterThanOrEqual(0);
      expect(result.usuallyPassRate).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('registerEvaluator', () => {
    it('should support custom evaluators', async () => {
      const customEvaluator = {
        name: 'custom',
        categories: ['hallucination' as const],
        evaluate: async (ctx: any) => ({
          evalId: ctx.definition.id,
          passed: true,
          severity: ctx.definition.severity,
          score: 1,
          details: 'Custom eval passed',
          duration: 0,
          assertions: [{ check: 'custom', passed: true }],
        }),
      };

      runner.registerEvaluator(customEvaluator);

      const definition: EvalDefinition = {
        id: 'custom-test',
        name: 'Custom test',
        category: 'hallucination',
        severity: 'USUALLY_PASSES',
        timeout: 30000,
        input: { prompt: 'test' },
        expectedBehavior: {},
      };

      const result = await runner.runEval(definition);
      expect(result.passed).toBe(true);
      expect(result.details).toBe('Custom eval passed');
    });
  });
});
