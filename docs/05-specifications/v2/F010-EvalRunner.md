# F010 -- EvalRunner

> Behavioral evaluation framework for measuring agent quality through pluggable evaluators.

## 1. Purpose

The EvalRunner module is designed to provide a structured framework for running behavioral evaluations against coding agents. It enables objective measurement of agent quality across dimensions such as correctness, style adherence, and task completion. According to the project memory, this module was planned with an EvalRunner orchestrator and three evaluators yielding 34 tests.

**Current Status**: The `src/core/evals/` directory does not exist on disk as of 2026-02-12. The module is referenced in project planning documents and memory but has not been implemented or has been removed. This specification documents the planned design for future implementation.

## 2. Interface

No interface file exists on disk. Based on project planning, the intended interface would include:

```typescript
interface IEvalRunner {
  /** Run a single evaluator against a task result */
  runEval(evaluator: IEvaluator, taskResult: TaskResult): Promise<EvalResult>;

  /** Run all registered evaluators against a task result */
  runAll(taskResult: TaskResult): Promise<EvalSuiteResult>;

  /** Register an evaluator */
  register(evaluator: IEvaluator): void;
}

interface IEvaluator {
  readonly name: string;
  evaluate(taskResult: TaskResult): Promise<EvalResult>;
}

interface EvalResult {
  evaluatorName: string;
  score: number;       // 0-1
  passed: boolean;
  details?: string;
  duration: number;
}
```

## 3. Implementation

- **Status**: Not implemented. No source files exist at `src/core/evals/`.
- **Planned components**: EvalRunner (orchestrator), plus individual evaluators for correctness, style, and completeness.
- **Planned pattern**: Factory function `createEvalRunner()` consistent with other modules.

## 4. Dependencies

- **Planned inbound**: Benchmark module (would use EvalRunner for scoring), orchestrator agents.
- **Planned outbound**: None identified beyond standard project utilities.

## 5. Testing

- **Test file location**: No test files exist. Tests were planned at `tests/unit/core/evals/`.
- **Test count**: 0 (planned: 34 per project memory).
- **Key test scenarios**: Not yet defined.
