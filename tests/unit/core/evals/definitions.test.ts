/**
 * Tests for Predefined Eval Definitions
 */

import {
  ALL_EVAL_DEFINITIONS,
  CODE_QUALITY_EVAL,
  TASK_COMPLETION_EVAL,
  TOOL_USAGE_EVAL,
} from '@/core/evals';
import type { EvalDefinition } from '@/core/evals';

// Mock the logger since the barrel import loads eval-runner which depends on it
jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Predefined Eval Definitions', () => {
  it('should have all required fields on every definition', () => {
    const requiredStringFields: (keyof EvalDefinition)[] = [
      'id', 'name', 'description', 'category', 'severity',
    ];

    for (const def of ALL_EVAL_DEFINITIONS) {
      for (const field of requiredStringFields) {
        expect(def[field]).toBeDefined();
        expect(typeof def[field]).toBe('string');
      }

      expect(def.input).toBeDefined();
      expect(typeof def.input.taskDescription).toBe('string');
      expect(def.expectedBehavior).toBeDefined();
      expect(typeof def.expectedBehavior.shouldSucceed).toBe('boolean');
      expect(typeof def.timeout).toBe('number');
      expect(def.timeout).toBeGreaterThan(0);
    }
  });

  it('should have unique IDs across all definitions', () => {
    const ids = ALL_EVAL_DEFINITIONS.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should use valid severity levels', () => {
    const validSeverities = ['ALWAYS_PASSES', 'USUALLY_PASSES'];

    for (const def of ALL_EVAL_DEFINITIONS) {
      expect(validSeverities).toContain(def.severity);
    }
  });

  it('should export individual definitions matching the aggregate array', () => {
    expect(ALL_EVAL_DEFINITIONS).toContain(CODE_QUALITY_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(TASK_COMPLETION_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(TOOL_USAGE_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toHaveLength(3);
  });
});
