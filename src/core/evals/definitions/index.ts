/**
 * Predefined Eval Definitions
 *
 * Standard evaluation scenarios for verifying agent behavior.
 * Each definition describes an input, expected behavior, and pass criteria.
 *
 * @module core/evals/definitions
 */

import type { EvalDefinition } from '../interfaces/eval.interface';

/**
 * Basic code quality eval -- verifies the agent produces working code
 * that follows conventions.
 */
export const CODE_QUALITY_EVAL: EvalDefinition = {
  id: 'code-quality-basic',
  name: 'Basic Code Quality',
  description: 'Verifies agent produces working code that follows conventions',
  category: 'code_quality',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Create a utility function that validates email addresses',
    expectedFiles: ['utils/validate-email.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['function', 'email', 'return'],
    maxDuration: 30000,
    minQualityScore: 0.7,
  },
  timeout: 30000,
  tags: ['code', 'quality', 'basic'],
};

/**
 * Task completion eval -- verifies the agent can complete a multi-step
 * task and produce the expected output structure.
 */
export const TASK_COMPLETION_EVAL: EvalDefinition = {
  id: 'task-completion-basic',
  name: 'Basic Task Completion',
  description: 'Verifies agent completes multi-step tasks and produces expected output',
  category: 'task_completion',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Create a TypeScript interface for a User model with id, name, and email fields, then create a factory function that returns a default User',
    expectedFiles: ['models/user.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['interface', 'User', 'function'],
    maxDuration: 45000,
    minQualityScore: 0.6,
  },
  timeout: 45000,
  tags: ['task', 'completion', 'basic'],
};

/**
 * Tool usage eval -- verifies the agent selects and uses
 * appropriate tools for the task.
 */
export const TOOL_USAGE_EVAL: EvalDefinition = {
  id: 'tool-usage-basic',
  name: 'Basic Tool Usage',
  description: 'Verifies agent selects appropriate tools for file operations',
  category: 'tool_usage',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Read the contents of config.json, update the version field to 2.0.0, and write the file back',
    context: '{"name": "test-app", "version": "1.0.0"}',
    expectedFiles: ['config.json'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    expectedToolUsage: ['file-read', 'file-write'],
    maxDuration: 20000,
  },
  timeout: 20000,
  tags: ['tools', 'file-ops', 'basic'],
};

/**
 * All predefined eval definitions
 */
export const ALL_EVAL_DEFINITIONS: EvalDefinition[] = [
  CODE_QUALITY_EVAL,
  TASK_COMPLETION_EVAL,
  TOOL_USAGE_EVAL,
];
