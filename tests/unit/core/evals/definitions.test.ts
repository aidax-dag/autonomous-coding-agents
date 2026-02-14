/**
 * Tests for Predefined Eval Definitions
 */

import {
  ALL_EVAL_DEFINITIONS,
  CODE_QUALITY_EVAL,
  CODE_QUALITY_ADVANCED_EVAL,
  CONTEXT_MANAGEMENT_EVAL,
  DEBUGGING_EVAL,
  ERROR_RECOVERY_EVAL,
  GENERALIST_EVAL,
  MULTI_FILE_EDIT_EVAL,
  PLAN_MODE_EVAL,
  SECURITY_SCAN_EVAL,
  SUBAGENT_DELEGATION_EVAL,
  TASK_COMPLETION_EVAL,
  TOOL_ACCURACY_EVAL,
  TOOL_USAGE_EVAL,
} from '@/core/evals';
import type { EvalDefinition, EvalCategory } from '@/core/evals';

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

  it('should use valid category values', () => {
    const validCategories: EvalCategory[] = [
      'code_quality', 'tool_usage', 'error_handling', 'task_completion',
    ];

    for (const def of ALL_EVAL_DEFINITIONS) {
      expect(validCategories).toContain(def.category);
    }
  });

  it('should export individual definitions matching the aggregate array', () => {
    expect(ALL_EVAL_DEFINITIONS).toContain(CODE_QUALITY_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(CODE_QUALITY_ADVANCED_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(CONTEXT_MANAGEMENT_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(DEBUGGING_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(ERROR_RECOVERY_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(GENERALIST_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(MULTI_FILE_EDIT_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(PLAN_MODE_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(SECURITY_SCAN_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(SUBAGENT_DELEGATION_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(TASK_COMPLETION_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(TOOL_ACCURACY_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toContain(TOOL_USAGE_EVAL);
    expect(ALL_EVAL_DEFINITIONS).toHaveLength(13);
  });

  it('should use kebab-case for all IDs', () => {
    const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

    for (const def of ALL_EVAL_DEFINITIONS) {
      expect(def.id).toMatch(kebabCasePattern);
    }
  });

  it('should have tags on every definition', () => {
    for (const def of ALL_EVAL_DEFINITIONS) {
      expect(def.tags).toBeDefined();
      expect(Array.isArray(def.tags)).toBe(true);
      expect(def.tags!.length).toBeGreaterThan(0);
    }
  });

  it('should cover all four eval categories', () => {
    const categories = new Set(ALL_EVAL_DEFINITIONS.map((d) => d.category));

    expect(categories.has('code_quality')).toBe(true);
    expect(categories.has('tool_usage')).toBe(true);
    expect(categories.has('error_handling')).toBe(true);
    expect(categories.has('task_completion')).toBe(true);
    expect(categories.size).toBe(4);
  });

  it('should use both severity levels', () => {
    const severities = new Set(ALL_EVAL_DEFINITIONS.map((d) => d.severity));

    expect(severities.has('ALWAYS_PASSES')).toBe(true);
    expect(severities.has('USUALLY_PASSES')).toBe(true);
    expect(severities.size).toBe(2);
  });

  it('should have diverse tags across definitions', () => {
    const allTags = new Set<string>();

    for (const def of ALL_EVAL_DEFINITIONS) {
      for (const tag of def.tags ?? []) {
        allTags.add(tag);
      }
    }

    // Should have at least 15 distinct tags across all definitions
    expect(allTags.size).toBeGreaterThanOrEqual(15);
  });

  it('should have timeouts matching maxDuration when both are set', () => {
    for (const def of ALL_EVAL_DEFINITIONS) {
      if (def.expectedBehavior.maxDuration !== undefined) {
        expect(def.timeout).toBeGreaterThanOrEqual(def.expectedBehavior.maxDuration);
      }
    }
  });
});
