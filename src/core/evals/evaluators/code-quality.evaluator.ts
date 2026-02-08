/**
 * Code Quality Evaluator
 *
 * Evaluates agent output for code quality indicators:
 * syntax correctness, style adherence, and common anti-patterns.
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
 * Evaluates code quality aspects of agent behavior
 */
export class CodeQualityEvaluator implements IEvaluator {
  readonly name = 'code-quality';
  readonly categories: EvalCategory[] = ['code_quality'];

  async evaluate(context: EvalContext): Promise<EvalResult> {
    const startTime = Date.now();
    const assertions: AssertionResult[] = [];
    const { definition, output } = context;
    const expected = definition.expectedBehavior;

    // Check output contains expected patterns
    if (expected.outputContains) {
      for (const pattern of expected.outputContains) {
        const regex = new RegExp(pattern, 'i');
        assertions.push({
          check: `output contains /${pattern}/`,
          passed: regex.test(output),
          expected: pattern,
          actual: regex.test(output) ? 'found' : 'not found',
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

    // Check no TODO/FIXME left in output code
    const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b/;
    if (output.includes('```')) {
      const codeBlocks = extractCodeBlocks(output);
      const hasTodos = codeBlocks.some((block) => todoPattern.test(block));
      assertions.push({
        check: 'no TODO/FIXME in generated code',
        passed: !hasTodos,
        expected: 'no TODO/FIXME',
        actual: hasTodos ? 'found TODO/FIXME' : 'clean',
      });
    }

    // Check files were modified as expected
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

export function createCodeQualityEvaluator(): CodeQualityEvaluator {
  return new CodeQualityEvaluator();
}

// ============================================================================
// Helpers
// ============================================================================

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```[\w]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function summarizeAssertions(assertions: AssertionResult[]): string {
  const passed = assertions.filter((a) => a.passed).length;
  const failed = assertions.filter((a) => !a.passed);
  if (failed.length === 0) return `All ${passed} checks passed`;
  const failDetails = failed.map((f) => `  - ${f.check}: expected ${f.expected}, got ${f.actual}`);
  return `${passed}/${assertions.length} passed\nFailed:\n${failDetails.join('\n')}`;
}
