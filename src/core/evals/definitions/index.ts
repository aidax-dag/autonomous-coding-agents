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
 * Advanced code quality eval -- verifies the agent can identify complex
 * code quality issues including SOLID violations and excessive complexity.
 */
export const CODE_QUALITY_ADVANCED_EVAL: EvalDefinition = {
  id: 'code-quality-advanced',
  name: 'Advanced Code Quality',
  description: 'Verifies agent identifies complex quality issues like SOLID violations and high cyclomatic complexity',
  category: 'code_quality',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Review a complex TypeScript class for SOLID principle violations, DRY issues, and cyclomatic complexity. Provide refactoring suggestions.',
    context: 'class OrderProcessor { process(order: any) { if (order.type === "online") { /* 200 lines */ } else if (order.type === "store") { /* 150 lines */ } } }',
    expectedFiles: ['services/order-processor.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['single responsibility', 'complexity', 'refactor'],
    maxDuration: 60000,
    minQualityScore: 0.7,
  },
  timeout: 60000,
  tags: ['code-quality', 'advanced', 'patterns', 'solid'],
};

/**
 * Context management eval -- verifies the agent can efficiently manage
 * a large context window by prioritizing relevant information.
 */
export const CONTEXT_MANAGEMENT_EVAL: EvalDefinition = {
  id: 'context-management-basic',
  name: 'Basic Context Management',
  description: 'Verifies agent efficiently manages large context by prioritizing relevant information',
  category: 'task_completion',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Given a large codebase with 20+ files, identify the 3 most relevant files to modify for adding a new authentication middleware and explain your prioritization',
    context: 'Project has src/routes/, src/middleware/, src/models/, src/utils/, src/config/, src/services/, src/controllers/ directories with 5+ files each',
    expectedFiles: ['src/middleware/auth.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['middleware', 'auth', 'priorit'],
    maxDuration: 45000,
    minQualityScore: 0.6,
  },
  timeout: 45000,
  tags: ['context-management', 'memory', 'optimization'],
};

/**
 * Debugging eval -- verifies the agent can systematically debug code
 * and perform root cause analysis.
 */
export const DEBUGGING_EVAL: EvalDefinition = {
  id: 'debugging-basic',
  name: 'Basic Debugging',
  description: 'Verifies agent systematically debugs code and identifies root causes',
  category: 'error_handling',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Debug a function that returns incorrect results. The calculateTotal function returns NaN for some inputs. Identify the root cause and fix it.',
    context: 'function calculateTotal(items: {price: number; qty: number}[]) { return items.reduce((sum, item) => sum + item.price * item.qty, undefined as any); }',
    expectedFiles: ['utils/calculate-total.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    expectedToolUsage: ['debugging'],
    outputPatterns: ['undefined', 'initial value', 'reduce'],
    maxDuration: 30000,
    minQualityScore: 0.7,
  },
  timeout: 30000,
  tags: ['debugging', 'root-cause', 'analysis'],
};

/**
 * Error recovery eval -- verifies the agent can gracefully recover
 * from errors encountered during task execution.
 */
export const ERROR_RECOVERY_EVAL: EvalDefinition = {
  id: 'error-recovery-basic',
  name: 'Basic Error Recovery',
  description: 'Verifies agent recovers gracefully from errors during task execution',
  category: 'error_handling',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Attempt to read and parse a malformed JSON config file, handle the parse error, and create a valid config with sensible defaults',
    context: '{ "port": 3000, "host": "localhost", "database": { "url": "postgres://localhost }',
    expectedFiles: ['config/defaults.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['error', 'default', 'config'],
    maxDuration: 30000,
    minQualityScore: 0.6,
  },
  timeout: 30000,
  tags: ['error-handling', 'recovery', 'resilience'],
};

/**
 * Generalist eval -- verifies the agent can handle diverse, unstructured
 * tasks that require interpretation and multi-step reasoning.
 */
export const GENERALIST_EVAL: EvalDefinition = {
  id: 'generalist-multi-task',
  name: 'Generalist Multi-Task',
  description: 'Verifies agent handles diverse unstructured tasks requiring interpretation and multi-step reasoning',
  category: 'task_completion',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Look at the project structure, identify what testing framework is used, then create a simple test for the most recently modified utility function',
    expectedFiles: ['tests/utils.test.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['test', 'expect', 'describe'],
    maxDuration: 60000,
    minQualityScore: 0.5,
  },
  timeout: 60000,
  tags: ['generalist', 'multi-task', 'reasoning'],
};

/**
 * Multi-file edit eval -- verifies the agent can coordinate edits
 * across multiple files during a refactoring operation.
 */
export const MULTI_FILE_EDIT_EVAL: EvalDefinition = {
  id: 'multi-file-edit-basic',
  name: 'Basic Multi-File Edit',
  description: 'Verifies agent coordinates edits across multiple files during refactoring',
  category: 'task_completion',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Rename the User interface to Account across all files that import and use it, updating type annotations, variable names, and import statements',
    context: 'interface User { id: string; name: string; } is defined in models/user.ts and imported in services/user-service.ts, controllers/user-controller.ts, and tests/user.test.ts',
    expectedFiles: ['models/user.ts', 'services/user-service.ts', 'controllers/user-controller.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['Account', 'import', 'rename'],
    maxDuration: 60000,
    minQualityScore: 0.6,
  },
  timeout: 60000,
  tags: ['multi-file', 'refactoring', 'coordination'],
};

/**
 * Plan mode eval -- verifies the agent can decompose a complex task
 * into a structured plan before execution.
 */
export const PLAN_MODE_EVAL: EvalDefinition = {
  id: 'plan-mode-basic',
  name: 'Basic Plan Mode',
  description: 'Verifies agent decomposes complex tasks into structured plans before execution',
  category: 'task_completion',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Plan and implement a REST API endpoint for user registration including input validation, password hashing, database storage, and response formatting',
    expectedFiles: ['routes/register.ts', 'validators/user.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    expectedToolUsage: ['planning'],
    outputPatterns: ['step', 'validate', 'hash'],
    maxDuration: 90000,
    minQualityScore: 0.6,
  },
  timeout: 90000,
  tags: ['plan-mode', 'decomposition', 'strategy'],
};

/**
 * Security scan eval -- verifies the agent can detect common
 * security vulnerability patterns in code.
 */
export const SECURITY_SCAN_EVAL: EvalDefinition = {
  id: 'security-scan-basic',
  name: 'Basic Security Scan',
  description: 'Verifies agent detects common security vulnerability patterns in code',
  category: 'code_quality',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Review the following code for security vulnerabilities and suggest fixes',
    context: 'app.get("/user", (req, res) => { const query = `SELECT * FROM users WHERE id = ${req.query.id}`; db.query(query).then(r => res.json(r)); });',
    expectedFiles: ['routes/user.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    expectedToolUsage: ['security-scan'],
    outputPatterns: ['injection', 'parameterized', 'sanitiz'],
    maxDuration: 30000,
    minQualityScore: 0.8,
  },
  timeout: 30000,
  tags: ['security', 'vulnerability', 'scan'],
};

/**
 * Subagent delegation eval -- verifies the agent properly delegates
 * sub-tasks to specialized agents when appropriate.
 */
export const SUBAGENT_DELEGATION_EVAL: EvalDefinition = {
  id: 'subagent-delegation-basic',
  name: 'Basic Subagent Delegation',
  description: 'Verifies agent properly delegates sub-tasks to specialized agents',
  category: 'tool_usage',
  severity: 'USUALLY_PASSES',
  input: {
    taskDescription: 'Build a feature that requires frontend UI changes, backend API updates, and database migration. Delegate each part to the appropriate specialist.',
    expectedFiles: ['components/feature.tsx', 'api/feature.ts', 'migrations/add-feature.sql'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['delegate', 'frontend', 'backend'],
    maxDuration: 120000,
    minQualityScore: 0.5,
  },
  timeout: 120000,
  tags: ['subagent', 'delegation', 'orchestration'],
};

/**
 * Tool accuracy eval -- verifies the agent uses tools precisely
 * and correctly, avoiding unnecessary or incorrect tool invocations.
 */
export const TOOL_ACCURACY_EVAL: EvalDefinition = {
  id: 'tool-use-accuracy',
  name: 'Tool Use Accuracy',
  description: 'Verifies agent uses tools precisely and avoids unnecessary invocations',
  category: 'tool_usage',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Read a TypeScript file, identify the exported function, and add JSDoc documentation to it without modifying any logic',
    context: 'export function parseConfig(raw: string): Config { return JSON.parse(raw); }',
    expectedFiles: ['utils/parse-config.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    expectedToolUsage: ['file-read', 'file-write'],
    outputPatterns: ['JSDoc', '@param', '@returns'],
    maxDuration: 30000,
    minQualityScore: 0.8,
  },
  timeout: 30000,
  tags: ['tool-accuracy', 'precision', 'correctness'],
};

/**
 * All predefined eval definitions
 */
export const ALL_EVAL_DEFINITIONS: EvalDefinition[] = [
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
];
