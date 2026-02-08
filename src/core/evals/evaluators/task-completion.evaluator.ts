/**
 * Task Completion Evaluator
 *
 * Evaluates whether the agent completed the requested task:
 * output relevance, completeness, and adherence to instructions.
 *
 * @module core/evals/evaluators
 */

import type {
  IEvaluator,
  EvalCategory,
  EvalContext,
  EvalResult,
  AssertionResult,
} from '../interfaces/eval.interface.js';

/**
 * Evaluates task completion aspects of agent behavior
 */
export class TaskCompletionEvaluator implements IEvaluator {
  readonly name = 'task-completion';
  readonly categories: EvalCategory[] = ['task_completion'];

  async evaluate(context: EvalContext): Promise<EvalResult> {
    const startTime = Date.now();
    const assertions: AssertionResult[] = [];
    const { definition, output, duration } = context;
    const expected = definition.expectedBehavior;

    // Check output is non-empty
    assertions.push({
      check: 'output is non-empty',
      passed: output.trim().length > 0,
      expected: 'non-empty output',
      actual: output.trim().length > 0 ? `${output.trim().length} chars` : 'empty',
    });

    // Check output contains expected patterns
    if (expected.outputContains) {
      for (const pattern of expected.outputContains) {
        const regex = new RegExp(pattern, 'i');
        assertions.push({
          check: `output matches /${pattern}/`,
          passed: regex.test(output),
          expected: pattern,
          actual: regex.test(output) ? 'matched' : 'not matched',
        });
      }
    }

    // Check output excludes forbidden patterns
    if (expected.outputExcludes) {
      for (const pattern of expected.outputExcludes) {
        const regex = new RegExp(pattern, 'i');
        assertions.push({
          check: `output excludes /${pattern}/`,
          passed: !regex.test(output),
          expected: 'absent',
          actual: regex.test(output) ? 'found' : 'absent',
        });
      }
    }

    // Check execution time within timeout
    assertions.push({
      check: 'completed within timeout',
      passed: duration <= definition.timeout,
      expected: `<= ${definition.timeout}ms`,
      actual: `${duration}ms`,
    });

    // Check files modified
    if (expected.filesModified) {
      for (const file of expected.filesModified) {
        const wasModified = context.filesModified.includes(file);
        assertions.push({
          check: `file modified: ${file}`,
          passed: wasModified,
          expected: 'modified',
          actual: wasModified ? 'modified' : 'not modified',
        });
      }
    }

    const passedCount = assertions.filter((a) => a.passed).length;
    const score = assertions.length > 0 ? passedCount / assertions.length : 1;
    const passed = score >= (expected.minScore ?? 1);

    return {
      evalId: definition.id,
      passed,
      severity: definition.severity,
      score,
      details: summarizeAssertions(assertions),
      duration: Date.now() - startTime,
      assertions,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createTaskCompletionEvaluator(): TaskCompletionEvaluator {
  return new TaskCompletionEvaluator();
}

// ============================================================================
// Helpers
// ============================================================================

function summarizeAssertions(assertions: AssertionResult[]): string {
  const passed = assertions.filter((a) => a.passed).length;
  const failed = assertions.filter((a) => !a.passed);
  if (failed.length === 0) return `All ${passed} checks passed`;
  const failDetails = failed.map((f) => `  - ${f.check}: expected ${f.expected}, got ${f.actual}`);
  return `${passed}/${assertions.length} passed\nFailed:\n${failDetails.join('\n')}`;
}
