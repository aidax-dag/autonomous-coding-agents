/**
 * Tool Usage Evaluator
 *
 * Evaluates whether the agent used appropriate tools:
 * correct tool selection, proper arguments, and no unnecessary calls.
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
 * Evaluates tool usage behavior of the agent
 */
export class ToolUsageEvaluator implements IEvaluator {
  readonly name = 'tool-usage';
  readonly categories: EvalCategory[] = ['tool_usage'];

  async evaluate(context: EvalContext): Promise<EvalResult> {
    const startTime = Date.now();
    const assertions: AssertionResult[] = [];
    const { definition, toolCalls } = context;
    const expected = definition.expectedBehavior;
    const calledToolNames = toolCalls.map((tc) => tc.name);

    // Check required tools were called
    if (expected.toolsCalled) {
      for (const tool of expected.toolsCalled) {
        const wasCalled = calledToolNames.includes(tool);
        assertions.push({
          check: `tool called: ${tool}`,
          passed: wasCalled,
          expected: 'called',
          actual: wasCalled ? 'called' : 'not called',
        });
      }
    }

    // Check forbidden tools were not called
    if (expected.toolsNotCalled) {
      for (const tool of expected.toolsNotCalled) {
        const wasCalled = calledToolNames.includes(tool);
        assertions.push({
          check: `tool not called: ${tool}`,
          passed: !wasCalled,
          expected: 'not called',
          actual: wasCalled ? 'called' : 'not called',
        });
      }
    }

    // Check at least one tool was called (agent should use tools, not just chat)
    if (expected.toolsCalled && expected.toolsCalled.length > 0) {
      assertions.push({
        check: 'at least one tool was used',
        passed: toolCalls.length > 0,
        expected: '>= 1 tool call',
        actual: `${toolCalls.length} tool calls`,
      });
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

export function createToolUsageEvaluator(): ToolUsageEvaluator {
  return new ToolUsageEvaluator();
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
