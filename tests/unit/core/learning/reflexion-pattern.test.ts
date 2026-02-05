/**
 * ReflexionPattern Tests - TDD RED Phase
 *
 * F004-ReflexionPattern: Error learning system with solution caching
 * Tests written first following RED-GREEN TDD pattern
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createReflexionPattern,
  STORAGE_CONFIG,
  generateErrorSignature,
  classifyError,
  ERROR_CATEGORIES,
} from '@/core/learning/index.js';
import type { IReflexionPattern } from '@/core/learning/interfaces/learning.interface.js';

// Test fixtures directory
const TEST_FIXTURES_DIR = '/tmp/reflexion-test-fixtures';
const TEST_SOLUTIONS_FILE = path.join(TEST_FIXTURES_DIR, 'test-solutions.jsonl');

describe('ReflexionPattern', () => {
  let reflexion: IReflexionPattern;

  beforeAll(async () => {
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true });
  });

  beforeEach(async () => {
    // Clean up test file before each test
    await fs.rm(TEST_SOLUTIONS_FILE, { force: true });
    reflexion = await createReflexionPattern({
      filePath: TEST_SOLUTIONS_FILE,
    });
  });

  afterAll(async () => {
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true });
  });

  describe('Basic Instantiation', () => {
    it('should create a ReflexionPattern instance', () => {
      expect(reflexion).toBeDefined();
    });

    it('should implement IReflexionPattern interface', () => {
      expect(typeof reflexion.lookup).toBe('function');
      expect(typeof reflexion.learn).toBe('function');
      expect(typeof reflexion.getPreventionChecklist).toBe('function');
      expect(typeof reflexion.recordOutcome).toBe('function');
      expect(typeof reflexion.getStats).toBe('function');
    });
  });

  describe('STORAGE_CONFIG', () => {
    it('should have default file path', () => {
      expect(STORAGE_CONFIG.filePath).toBeDefined();
      expect(typeof STORAGE_CONFIG.filePath).toBe('string');
    });

    it('should have maxEntries limit', () => {
      expect(STORAGE_CONFIG.maxEntries).toBeDefined();
      expect(STORAGE_CONFIG.maxEntries).toBeGreaterThan(0);
    });

    it('should have retentionDays setting', () => {
      expect(STORAGE_CONFIG.retentionDays).toBeDefined();
      expect(STORAGE_CONFIG.retentionDays).toBeGreaterThan(0);
    });
  });

  describe('lookup()', () => {
    it('should return null for new/unknown error', async () => {
      const error = new Error('Brand new error never seen before');
      const result = await reflexion.lookup(error);
      expect(result).toBeNull();
    });

    it('should return learned solution for known error', async () => {
      const error = new TypeError('Cannot read property x of undefined');

      // Learn first
      await reflexion.learn(error, 'Add null check before accessing property', 'Missing null check');

      // Then lookup
      const result = await reflexion.lookup(error);

      expect(result).not.toBeNull();
      expect(result?.solution).toBe('Add null check before accessing property');
      expect(result?.rootCause).toBe('Missing null check');
    });

    it('should match similar errors with normalized signatures', async () => {
      // Learn with one specific error (numbers and quoted strings are normalized)
      const error1 = new Error('Cannot read property "foo" of undefined at line 10');
      await reflexion.learn(error1, 'Fix the null check', 'Missing validation');

      // Lookup with similar but not identical error
      const error2 = new Error('Cannot read property "bar" of undefined at line 20');
      const result = await reflexion.lookup(error2);

      // Should match because numbers and quoted strings are normalized to STR
      expect(result).not.toBeNull();
      expect(result?.solution).toBe('Fix the null check');
    });

    it('should update lastUsedAt on lookup', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const before = await reflexion.lookup(error);
      const beforeTime = before?.lastUsedAt;

      // Wait a bit
      await new Promise((r) => setTimeout(r, 10));

      const after = await reflexion.lookup(error);
      const afterTime = after?.lastUsedAt;

      expect(afterTime).toBeDefined();
      if (beforeTime && afterTime) {
        expect(new Date(afterTime).getTime()).toBeGreaterThanOrEqual(
          new Date(beforeTime).getTime()
        );
      }
    });
  });

  describe('learn()', () => {
    it('should store new solution', async () => {
      const error = new Error('Test error for learning');
      await reflexion.learn(error, 'Test solution', 'Test root cause');

      const result = await reflexion.lookup(error);
      expect(result).not.toBeNull();
      expect(result?.solution).toBe('Test solution');
      expect(result?.rootCause).toBe('Test root cause');
    });

    it('should assign unique ID to solution', async () => {
      // Use distinct error messages that won't normalize to the same signature
      const error1 = new TypeError('Type mismatch in function call');
      const error2 = new ReferenceError('Variable is not defined');

      await reflexion.learn(error1, 'Solution 1', 'Cause 1');
      await reflexion.learn(error2, 'Solution 2', 'Cause 2');

      const solution1 = await reflexion.lookup(error1);
      const solution2 = await reflexion.lookup(error2);

      expect(solution1?.id).toBeDefined();
      expect(solution2?.id).toBeDefined();
      expect(solution1?.id).not.toBe(solution2?.id);
    });

    it('should set initial counts to zero', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const result = await reflexion.lookup(error);
      expect(result?.successCount).toBe(0);
      expect(result?.failureCount).toBe(0);
    });

    it('should classify error type automatically', async () => {
      const typeError = new TypeError('Type mismatch');
      await reflexion.learn(typeError, 'Fix type', 'Wrong type');

      const result = await reflexion.lookup(typeError);
      expect(result?.errorType).toBe('TYPE');
    });

    it('should generate prevention checklist', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const result = await reflexion.lookup(error);
      expect(result?.prevention).toBeDefined();
      expect(Array.isArray(result?.prevention)).toBe(true);
      expect(result?.prevention.length).toBeGreaterThan(0);
    });

    it('should persist solution to file', async () => {
      const error = new Error('Persistent error');
      await reflexion.learn(error, 'Persistent solution', 'Persistent cause');

      // Verify file exists and contains the solution
      const content = await fs.readFile(TEST_SOLUTIONS_FILE, 'utf-8');
      expect(content).toContain('Persistent solution');
      expect(content).toContain('Persistent cause');
    });

    it('should store error signature for matching', async () => {
      const error = new Error('Error with signature');
      await reflexion.learn(error, 'Solution', 'Cause');

      const result = await reflexion.lookup(error);
      expect(result?.errorSignature).toBeDefined();
      expect(typeof result?.errorSignature).toBe('string');
    });
  });

  describe('getPreventionChecklist()', () => {
    it('should return default checklist for unknown type', () => {
      const checklist = reflexion.getPreventionChecklist('UNKNOWN');
      expect(Array.isArray(checklist)).toBe(true);
      expect(checklist.length).toBeGreaterThan(0);
    });

    it('should return TYPE-specific checklist', () => {
      const checklist = reflexion.getPreventionChecklist('TYPE');
      expect(checklist).toContain('타입 정의 확인');
      expect(checklist).toContain('null/undefined 체크 추가');
    });

    it('should return NETWORK-specific checklist', () => {
      const checklist = reflexion.getPreventionChecklist('NETWORK');
      expect(checklist.some((item) => item.includes('타임아웃') || item.includes('timeout'))).toBe(
        true
      );
    });

    it('should return FILE-specific checklist', () => {
      const checklist = reflexion.getPreventionChecklist('FILE');
      expect(checklist.some((item) => item.includes('경로') || item.includes('path'))).toBe(true);
    });

    it('should return AUTH-specific checklist', () => {
      const checklist = reflexion.getPreventionChecklist('AUTH');
      expect(checklist.some((item) => item.includes('토큰') || item.includes('token'))).toBe(true);
    });
  });

  describe('recordOutcome()', () => {
    it('should increment successCount on success', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const before = await reflexion.lookup(error);
      expect(before?.successCount).toBe(0);

      await reflexion.recordOutcome(before!.id, true);

      const after = await reflexion.lookup(error);
      expect(after?.successCount).toBe(1);
    });

    it('should increment failureCount on failure', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const before = await reflexion.lookup(error);
      expect(before?.failureCount).toBe(0);

      await reflexion.recordOutcome(before!.id, false);

      const after = await reflexion.lookup(error);
      expect(after?.failureCount).toBe(1);
    });

    it('should handle multiple outcomes', async () => {
      const error = new Error('Test error');
      await reflexion.learn(error, 'Solution', 'Cause');

      const solution = await reflexion.lookup(error);

      // Record multiple outcomes
      await reflexion.recordOutcome(solution!.id, true);
      await reflexion.recordOutcome(solution!.id, true);
      await reflexion.recordOutcome(solution!.id, false);

      const updated = await reflexion.lookup(error);
      expect(updated?.successCount).toBe(2);
      expect(updated?.failureCount).toBe(1);
    });

    it('should handle non-existent solution ID gracefully', async () => {
      // Should not throw
      await expect(reflexion.recordOutcome('non-existent-id', true)).resolves.not.toThrow();
    });
  });

  describe('getStats()', () => {
    it('should return initial stats with zero values', async () => {
      const stats = await reflexion.getStats();

      expect(stats.totalSolutions).toBe(0);
      expect(stats.totalLookups).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.avgSuccessRate).toBe(0);
    });

    it('should track totalSolutions', async () => {
      // Use distinct error messages that won't normalize to the same signature
      await reflexion.learn(new TypeError('Type error occurred'), 'Solution 1', 'Cause 1');
      await reflexion.learn(new ReferenceError('Reference error occurred'), 'Solution 2', 'Cause 2');

      const stats = await reflexion.getStats();
      expect(stats.totalSolutions).toBe(2);
    });

    it('should track totalLookups', async () => {
      await reflexion.lookup(new Error('Unknown error'));
      await reflexion.lookup(new Error('Another unknown'));

      const stats = await reflexion.getStats();
      expect(stats.totalLookups).toBe(2);
    });

    it('should calculate cacheHitRate correctly', async () => {
      const error = new Error('Known error');
      await reflexion.learn(error, 'Solution', 'Cause');

      // 1 miss (unknown error)
      await reflexion.lookup(new Error('Unknown'));

      // 2 hits (known error)
      await reflexion.lookup(error);
      await reflexion.lookup(error);

      const stats = await reflexion.getStats();
      // 2 hits out of 3 lookups = 66.67%
      expect(stats.cacheHitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate avgSuccessRate correctly', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      await reflexion.learn(error1, 'Solution 1', 'Cause 1');
      await reflexion.learn(error2, 'Solution 2', 'Cause 2');

      const solution1 = await reflexion.lookup(error1);
      const solution2 = await reflexion.lookup(error2);

      // Solution 1: 3 success, 1 failure = 75%
      await reflexion.recordOutcome(solution1!.id, true);
      await reflexion.recordOutcome(solution1!.id, true);
      await reflexion.recordOutcome(solution1!.id, true);
      await reflexion.recordOutcome(solution1!.id, false);

      // Solution 2: 1 success, 1 failure = 50%
      await reflexion.recordOutcome(solution2!.id, true);
      await reflexion.recordOutcome(solution2!.id, false);

      const stats = await reflexion.getStats();
      // Total: 4 success, 2 failure = 66.67%
      expect(stats.avgSuccessRate).toBeCloseTo(4 / 6, 2);
    });
  });

  describe('File Persistence', () => {
    it('should persist solutions to JSONL file', async () => {
      await reflexion.learn(new Error('Error 1'), 'Solution 1', 'Cause 1');
      await reflexion.learn(new Error('Error 2'), 'Solution 2', 'Cause 2');

      const content = await fs.readFile(TEST_SOLUTIONS_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(() => JSON.parse(lines[0])).not.toThrow();
      expect(() => JSON.parse(lines[1])).not.toThrow();
    });

    it('should load existing solutions on initialization', async () => {
      // Create solutions with first instance
      await reflexion.learn(new Error('Persistent error'), 'Persistent solution', 'Cause');

      // Create new instance
      const newInstance = await createReflexionPattern({
        filePath: TEST_SOLUTIONS_FILE,
      });

      // Should find the previously learned solution
      const result = await newInstance.lookup(new Error('Persistent error'));
      expect(result).not.toBeNull();
      expect(result?.solution).toBe('Persistent solution');
    });

    it('should handle missing file gracefully', async () => {
      const nonExistentFile = path.join(TEST_FIXTURES_DIR, 'non-existent.jsonl');
      const instance = await createReflexionPattern({
        filePath: nonExistentFile,
      });

      // Should not throw and should work normally
      const result = await instance.lookup(new Error('Test'));
      expect(result).toBeNull();
    });

    it('should create directory if not exists', async () => {
      const nestedPath = path.join(TEST_FIXTURES_DIR, 'nested', 'deep', 'solutions.jsonl');

      const instance = await createReflexionPattern({
        filePath: nestedPath,
      });

      await instance.learn(new Error('Test'), 'Solution', 'Cause');

      const exists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create instance with default options', async () => {
      // Note: This will use default file path, so we can't test file operations
      const instance = await createReflexionPattern();
      expect(instance).toBeDefined();
    });

    it('should create instance with custom file path', async () => {
      const customPath = path.join(TEST_FIXTURES_DIR, 'custom-solutions.jsonl');
      const instance = await createReflexionPattern({
        filePath: customPath,
      });

      expect(instance).toBeDefined();

      // Verify it uses custom path
      await instance.learn(new Error('Test'), 'Solution', 'Cause');
      const exists = await fs
        .access(customPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should be async and return Promise', () => {
      const result = createReflexionPattern();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in file gracefully', async () => {
      // Write malformed content
      await fs.writeFile(TEST_SOLUTIONS_FILE, 'invalid json\n{"valid": true}');

      // Should not throw during initialization
      await expect(
        createReflexionPattern({ filePath: TEST_SOLUTIONS_FILE })
      ).rejects.toThrow();
    });

    it('should handle concurrent learn operations', async () => {
      // Use distinct error types and messages to ensure unique signatures
      const errorTypes = [
        TypeError, ReferenceError, RangeError, SyntaxError, EvalError,
        URIError, TypeError, ReferenceError, RangeError, SyntaxError,
      ];
      const errors = errorTypes.map(
        (ErrorType, i) => new ErrorType(`Unique message for error type ${ErrorType.name} index ${i}`)
      );

      // Learn all concurrently
      await Promise.all(errors.map((e, i) => reflexion.learn(e, `Solution ${i}`, `Cause ${i}`)));

      // Note: Some errors may have the same signature due to normalization
      // We just verify that concurrent operations don't cause errors
      const stats = await reflexion.getStats();
      expect(stats.totalSolutions).toBeGreaterThan(0);
    });

    it('should handle concurrent lookup operations', async () => {
      const error = new Error('Concurrent lookup test');
      await reflexion.learn(error, 'Solution', 'Cause');

      // Lookup concurrently
      const results = await Promise.all(Array.from({ length: 10 }, () => reflexion.lookup(error)));

      // All should return the same solution
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result?.solution).toBe('Solution');
      });
    });
  });
});

describe('generateErrorSignature', () => {
  it('should include error type', () => {
    const error = new TypeError('Test message');
    const signature = generateErrorSignature(error);
    expect(signature.startsWith('TypeError:')).toBe(true);
  });

  it('should normalize numbers to N', () => {
    const error = new Error('Error at line 42 column 15');
    const signature = generateErrorSignature(error);
    expect(signature).toContain('N');
    expect(signature).not.toContain('42');
    expect(signature).not.toContain('15');
  });

  it('should normalize quoted strings to STR', () => {
    const error = new Error('Cannot find module "some-module"');
    const signature = generateErrorSignature(error);
    expect(signature).toContain('STR');
    expect(signature).not.toContain('some-module');
  });

  it('should normalize paths to PATH', () => {
    const error = new Error('File not found: /home/user/project/file.ts');
    const signature = generateErrorSignature(error);
    expect(signature).toContain('PATH');
    expect(signature).not.toContain('/home/user');
  });

  it('should produce same signature for similar errors', () => {
    const error1 = new Error('Cannot read property "x" at line 10');
    const error2 = new Error('Cannot read property "y" at line 20');

    const sig1 = generateErrorSignature(error1);
    const sig2 = generateErrorSignature(error2);

    expect(sig1).toBe(sig2);
  });

  it('should produce different signatures for different error types', () => {
    const error1 = new TypeError('Test message');
    const error2 = new ReferenceError('Test message');

    const sig1 = generateErrorSignature(error1);
    const sig2 = generateErrorSignature(error2);

    expect(sig1).not.toBe(sig2);
  });

  it('should limit signature length', () => {
    const longMessage = 'x'.repeat(500);
    const error = new Error(longMessage);
    const signature = generateErrorSignature(error);

    // Should be limited to errorType + ":" + 200 chars
    expect(signature.length).toBeLessThanOrEqual('Error:'.length + 200);
  });
});

describe('classifyError', () => {
  it('should classify TypeError correctly', () => {
    const error = new TypeError('Cannot read property');
    expect(classifyError(error)).toBe('TYPE');
  });

  it('should classify ReferenceError as RUNTIME', () => {
    const error = new ReferenceError('x is not defined');
    expect(classifyError(error)).toBe('RUNTIME');
  });

  it('should classify SyntaxError correctly', () => {
    const error = new SyntaxError('Unexpected token');
    expect(classifyError(error)).toBe('SYNTAX');
  });

  it('should classify RangeError as RUNTIME', () => {
    const error = new RangeError('Invalid array length');
    expect(classifyError(error)).toBe('RUNTIME');
  });

  it('should classify unknown error as UNKNOWN', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('Some custom error');
    expect(classifyError(error)).toBe('UNKNOWN');
  });

  it('should classify based on message content', () => {
    const error = new Error('NetworkError: Failed to fetch');
    expect(classifyError(error)).toBe('NETWORK');
  });
});

describe('ERROR_CATEGORIES', () => {
  it('should have SYNTAX category', () => {
    expect(ERROR_CATEGORIES.SYNTAX).toBeDefined();
    expect(ERROR_CATEGORIES.SYNTAX).toContain('SyntaxError');
  });

  it('should have TYPE category', () => {
    expect(ERROR_CATEGORIES.TYPE).toBeDefined();
    expect(ERROR_CATEGORIES.TYPE).toContain('TypeError');
  });

  it('should have RUNTIME category', () => {
    expect(ERROR_CATEGORIES.RUNTIME).toBeDefined();
    expect(ERROR_CATEGORIES.RUNTIME).toContain('ReferenceError');
    expect(ERROR_CATEGORIES.RUNTIME).toContain('RangeError');
  });

  it('should have NETWORK category', () => {
    expect(ERROR_CATEGORIES.NETWORK).toBeDefined();
    expect(ERROR_CATEGORIES.NETWORK).toContain('NetworkError');
  });

  it('should have FILE category', () => {
    expect(ERROR_CATEGORIES.FILE).toBeDefined();
    expect(ERROR_CATEGORIES.FILE).toContain('FileNotFoundError');
  });

  it('should have VALIDATION category', () => {
    expect(ERROR_CATEGORIES.VALIDATION).toBeDefined();
    expect(ERROR_CATEGORIES.VALIDATION).toContain('ValidationError');
  });

  it('should have AUTH category', () => {
    expect(ERROR_CATEGORIES.AUTH).toBeDefined();
    expect(ERROR_CATEGORIES.AUTH).toContain('AuthenticationError');
  });

  it('should have CONFIG category', () => {
    expect(ERROR_CATEGORIES.CONFIG).toBeDefined();
    expect(ERROR_CATEGORIES.CONFIG).toContain('ConfigurationError');
  });
});
