/**
 * Eval Runner
 *
 * Executes eval definitions against a pluggable executor and collects results.
 * Checks agent output against expected behavior criteria including success,
 * output patterns, duration limits, tool usage, and quality scores.
 *
 * @module core/evals
 */

import { createAgentLogger } from '../../shared/logging/logger';
import type {
  IEvalRunner,
  EvalDefinition,
  EvalExecutor,
  EvalResult,
  EvalSuiteResult,
  EvalCheck,
  EvalExecutionResult,
} from './interfaces/eval.interface';

const logger = createAgentLogger('eval-runner');

/**
 * Build an array of checks by comparing execution result against expected behavior
 */
function buildChecks(
  definition: EvalDefinition,
  executionResult: EvalExecutionResult,
): EvalCheck[] {
  const checks: EvalCheck[] = [];
  const expected = definition.expectedBehavior;

  // 1. Success check
  checks.push({
    name: 'success_check',
    passed: executionResult.success === expected.shouldSucceed,
    message: executionResult.success === expected.shouldSucceed
      ? `Task ${expected.shouldSucceed ? 'succeeded' : 'failed'} as expected`
      : `Expected ${expected.shouldSucceed ? 'success' : 'failure'} but got ${executionResult.success ? 'success' : 'failure'}`,
  });

  // 2. Output pattern checks
  if (expected.outputPatterns && expected.outputPatterns.length > 0) {
    for (const pattern of expected.outputPatterns) {
      const regex = new RegExp(pattern);
      const matched = executionResult.output ? regex.test(executionResult.output) : false;
      checks.push({
        name: `output_pattern: /${pattern}/`,
        passed: matched,
        message: matched
          ? `Output matched pattern "/${pattern}/"`
          : `Output did not match pattern "/${pattern}/"`,
      });
    }
  }

  // 3. Duration check
  if (expected.maxDuration !== undefined) {
    const withinLimit = executionResult.duration <= expected.maxDuration;
    checks.push({
      name: 'duration_check',
      passed: withinLimit,
      message: withinLimit
        ? `Duration ${executionResult.duration}ms within limit ${expected.maxDuration}ms`
        : `Duration ${executionResult.duration}ms exceeded limit ${expected.maxDuration}ms`,
    });
  }

  // 4. Tool usage check
  if (expected.expectedToolUsage && expected.expectedToolUsage.length > 0) {
    const usedTools = executionResult.toolsUsed ?? [];
    for (const tool of expected.expectedToolUsage) {
      const used = usedTools.includes(tool);
      checks.push({
        name: `tool_usage: ${tool}`,
        passed: used,
        message: used
          ? `Tool "${tool}" was used as expected`
          : `Tool "${tool}" was not used`,
      });
    }
  }

  // 5. Quality score check
  if (expected.minQualityScore !== undefined) {
    const actualScore = executionResult.qualityScore ?? 0;
    const meetsMinimum = actualScore >= expected.minQualityScore;
    checks.push({
      name: 'quality_score_check',
      passed: meetsMinimum,
      message: meetsMinimum
        ? `Quality score ${actualScore} meets minimum ${expected.minQualityScore}`
        : `Quality score ${actualScore} below minimum ${expected.minQualityScore}`,
    });
  }

  return checks;
}

/**
 * Execute a task with a timeout wrapper
 */
async function executeWithTimeout(
  executor: EvalExecutor,
  definition: EvalDefinition,
): Promise<EvalExecutionResult> {
  return new Promise<EvalExecutionResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Eval "${definition.id}" timed out after ${definition.timeout}ms`));
    }, definition.timeout);

    executor
      .execute(definition.input)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Eval runner implementation
 */
export class EvalRunner implements IEvalRunner {
  private definitions: EvalDefinition[] = [];

  loadDefinitions(definitions: EvalDefinition[]): void {
    this.definitions = [...definitions];
    logger.info('Loaded eval definitions', { count: definitions.length });
  }

  getDefinitions(): EvalDefinition[] {
    return [...this.definitions];
  }

  async runEval(definition: EvalDefinition, executor: EvalExecutor): Promise<EvalResult> {
    const startTime = Date.now();
    logger.info('Running eval', { evalId: definition.id, evalName: definition.name });

    let executionResult: EvalExecutionResult;

    try {
      executionResult = await executeWithTimeout(executor, definition);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Eval execution failed', { evalId: definition.id, error: errorMessage });

      return {
        evalId: definition.id,
        evalName: definition.name,
        passed: false,
        severity: definition.severity,
        score: 0,
        details: `Execution error: ${errorMessage}`,
        duration,
        checks: [
          {
            name: 'execution',
            passed: false,
            message: `Execution failed: ${errorMessage}`,
          },
        ],
      };
    }

    const duration = Date.now() - startTime;
    const checks = buildChecks(definition, executionResult);

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? passedChecks / checks.length : 0;
    const passed = checks.every((c) => c.passed);

    const failedCheckNames = checks
      .filter((c) => !c.passed)
      .map((c) => c.name);

    const details = passed
      ? `All ${checks.length} checks passed`
      : `Failed checks: ${failedCheckNames.join(', ')}`;

    logger.info('Eval completed', {
      evalId: definition.id,
      passed,
      score,
      duration,
    });

    return {
      evalId: definition.id,
      evalName: definition.name,
      passed,
      severity: definition.severity,
      score,
      details,
      duration,
      checks,
    };
  }

  async runSuite(suiteName: string, executor: EvalExecutor): Promise<EvalSuiteResult> {
    const startTime = Date.now();
    logger.info('Running eval suite', { suiteName, definitionCount: this.definitions.length });

    const results: EvalResult[] = [];

    for (const definition of this.definitions) {
      const result = await this.runEval(definition, executor);
      results.push(result);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    // Calculate pass rates by severity
    const alwaysPassEvals = results.filter((r) => r.severity === 'ALWAYS_PASSES');
    const usuallyPassEvals = results.filter((r) => r.severity === 'USUALLY_PASSES');

    const alwaysPassRate = alwaysPassEvals.length > 0
      ? alwaysPassEvals.filter((r) => r.passed).length / alwaysPassEvals.length
      : 1;

    const usuallyPassRate = usuallyPassEvals.length > 0
      ? usuallyPassEvals.filter((r) => r.passed).length / usuallyPassEvals.length
      : 1;

    const suiteResult: EvalSuiteResult = {
      suiteName,
      timestamp: new Date().toISOString(),
      totalEvals: results.length,
      passed,
      failed,
      skipped: 0,
      alwaysPassRate,
      usuallyPassRate,
      results,
      regressions: [],
      duration,
    };

    logger.info('Eval suite completed', {
      suiteName,
      totalEvals: suiteResult.totalEvals,
      passed: suiteResult.passed,
      failed: suiteResult.failed,
      alwaysPassRate: suiteResult.alwaysPassRate,
      usuallyPassRate: suiteResult.usuallyPassRate,
      duration,
    });

    return suiteResult;
  }
}

/**
 * Factory function
 */
export function createEvalRunner(): EvalRunner {
  return new EvalRunner();
}
