/**
 * Code Quality Agent LLM Executor
 *
 * Provides LLM-based execution for the Code Quality Agent.
 * Handles test generation, deep code review, and refactoring suggestions.
 *
 * Feature: QA + Code Quality Team for Agent OS
 */

import { z } from 'zod';
import { TaskDocument } from '../../workspace/task-document';
import {
  TestGenerationOutput,
  DeepReviewOutput,
  RefactoringOutput,
} from '../agents/code-quality-agent';
import { TeamAgentLLMAdapter } from './team-agent-llm';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for generated test case
 */
const GeneratedTestCaseSchema = z.object({
  name: z.string(),
  type: z.enum(['unit', 'integration', 'e2e']),
  code: z.string(),
  target: z.string(),
  filePath: z.string(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Schema for test generation output
 */
export const TestGenerationOutputSchema = z.object({
  summary: z.string(),
  tests: z.array(GeneratedTestCaseSchema),
  totalGenerated: z.number(),
  estimatedCoverage: z.object({
    functions: z.number(),
    branches: z.number(),
    lines: z.number(),
  }),
  manualTestRecommendations: z.array(z.string()).optional(),
});

/**
 * Schema for code review finding
 */
const CodeReviewFindingSchema = z.object({
  type: z.enum(['pattern', 'security', 'performance', 'maintainability', 'best-practice']),
  severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
  category: z.string(),
  message: z.string(),
  file: z.string(),
  lineStart: z.number(),
  lineEnd: z.number().optional(),
  codeSnippet: z.string().optional(),
  suggestedFix: z.string().optional(),
  reference: z.string().optional(),
});

/**
 * Schema for deep review output
 */
export const DeepReviewOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(CodeReviewFindingSchema),
  metrics: z.object({
    complexity: z.number(),
    maintainability: z.number(),
    testability: z.number(),
    security: z.number(),
    overall: z.number(),
  }),
  approved: z.boolean(),
  reason: z.string(),
  actionItems: z.array(z.string()),
});

/**
 * Schema for refactoring suggestion
 */
const RefactoringSuggestionSchema = z.object({
  type: z.enum([
    'extract-method',
    'extract-class',
    'rename',
    'move',
    'inline',
    'decompose-conditional',
    'replace-magic-number',
    'introduce-parameter-object',
    'other',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  target: z.object({
    file: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    symbolName: z.string().optional(),
  }),
  reason: z.string(),
  description: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  effort: z.enum(['trivial', 'easy', 'moderate', 'complex']),
  impact: z.enum(['isolated', 'localized', 'widespread']),
});

/**
 * Schema for refactoring output
 */
export const RefactoringOutputSchema = z.object({
  summary: z.string(),
  suggestions: z.array(RefactoringSuggestionSchema),
  technicalDebtScore: z.number(),
  codeHealth: z.object({
    duplications: z.number(),
    complexity: z.number(),
    coupling: z.number(),
    cohesion: z.number(),
  }),
  prioritizedOrder: z.array(z.string()),
});

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Code Quality prompts
 */
export const CodeQualityPrompts = {
  // Test Generation
  testGenerationSystem: `You are an expert test engineer specializing in generating comprehensive test suites.

Your responsibilities:
1. Analyze code and identify testable functions, methods, and classes
2. Generate unit tests with proper setup, execution, and assertions
3. Include edge cases, error handling, and boundary conditions
4. Follow testing best practices (AAA pattern, single responsibility per test)
5. Consider mocking dependencies appropriately

Output format: JSON matching the TestGenerationOutput schema
- Include clear, descriptive test names
- Generate actual test code (not placeholders)
- Estimate coverage percentages realistically
- Suggest areas needing manual testing`,

  testGenerationUser: (task: TaskDocument, sourceCode?: string) => {
    const parts = [`## Task: ${task.metadata.title}`, '', task.content];

    if (sourceCode) {
      parts.push('', '## Source Code to Test', '```', sourceCode, '```');
    }

    if (task.metadata.files && task.metadata.files.length > 0) {
      parts.push('', '## Files');
      for (const file of task.metadata.files) {
        parts.push(`- ${file.path}: ${file.description || 'No description'}`);
      }
    }

    parts.push(
      '',
      '## Instructions',
      'Generate comprehensive unit tests for the provided code.',
      'Return JSON with: summary, tests array, totalGenerated, estimatedCoverage, manualTestRecommendations'
    );

    return parts.join('\n');
  },

  // Deep Code Review
  deepReviewSystem: `You are a senior software architect conducting deep code reviews.

Your review focuses on:
1. **Patterns**: Design patterns, anti-patterns, code organization
2. **Security**: Vulnerabilities, input validation, authentication/authorization
3. **Performance**: Algorithmic complexity, memory usage, caching opportunities
4. **Maintainability**: Readability, documentation, naming conventions
5. **Best Practices**: Language-specific idioms, SOLID principles, DRY/KISS

Scoring criteria:
- Complexity: Cyclomatic complexity, nesting depth
- Maintainability: Code clarity, modularity
- Testability: Dependency injection, pure functions
- Security: Vulnerability presence
- Overall: Weighted average

Output format: JSON matching the DeepReviewOutput schema`,

  deepReviewUser: (task: TaskDocument, codeToReview?: string) => {
    const parts = [`## Code Review Request: ${task.metadata.title}`, '', task.content];

    if (codeToReview) {
      parts.push('', '## Code to Review', '```', codeToReview, '```');
    }

    if (task.metadata.files && task.metadata.files.length > 0) {
      parts.push('', '## Files Under Review');
      for (const file of task.metadata.files) {
        parts.push(`- ${file.path}`);
      }
    }

    parts.push(
      '',
      '## Instructions',
      'Perform a deep code review analyzing patterns, security, performance, and maintainability.',
      'Return JSON with: summary, findings, metrics, approved, reason, actionItems'
    );

    return parts.join('\n');
  },

  // Refactoring Analysis
  refactoringSystem: `You are a refactoring expert identifying code improvement opportunities.

Analyze code for:
1. **Code Smells**: Long methods, large classes, duplicate code, dead code
2. **Coupling Issues**: Tight coupling, circular dependencies, god objects
3. **Cohesion Problems**: Low cohesion, feature envy, data clumps
4. **Complexity**: Deep nesting, complex conditionals, magic numbers

Suggest refactorings:
- Extract Method/Class
- Rename (variables, functions, classes)
- Move functionality
- Inline (if over-abstracted)
- Decompose conditionals
- Replace magic numbers with constants
- Introduce parameter objects

Prioritize by:
- Impact on maintainability
- Risk of introducing bugs
- Effort required

Output format: JSON matching the RefactoringOutput schema`,

  refactoringUser: (task: TaskDocument, codeToAnalyze?: string) => {
    const parts = [`## Refactoring Analysis: ${task.metadata.title}`, '', task.content];

    if (codeToAnalyze) {
      parts.push('', '## Code to Analyze', '```', codeToAnalyze, '```');
    }

    if (task.metadata.files && task.metadata.files.length > 0) {
      parts.push('', '## Files to Analyze');
      for (const file of task.metadata.files) {
        parts.push(`- ${file.path}`);
      }
    }

    parts.push(
      '',
      '## Instructions',
      'Identify refactoring opportunities and technical debt.',
      'Return JSON with: summary, suggestions, technicalDebtScore, codeHealth, prioritizedOrder'
    );

    return parts.join('\n');
  },
};

// ============================================================================
// Executor Options
// ============================================================================

/**
 * Test Generation LLM Executor Options
 */
export interface TestGenerationLLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Source code to generate tests for */
  sourceCode?: string;
  /** Testing framework preference */
  framework?: 'jest' | 'vitest' | 'mocha' | 'pytest';
}

/**
 * Deep Review LLM Executor Options
 */
export interface DeepReviewLLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Code to review */
  codeToReview?: string;
  /** Focus areas */
  focusAreas?: ('security' | 'performance' | 'maintainability' | 'patterns')[];
}

/**
 * Refactoring LLM Executor Options
 */
export interface RefactoringLLMExecutorOptions {
  /** LLM adapter */
  adapter: TeamAgentLLMAdapter;
  /** Code to analyze */
  codeToAnalyze?: string;
  /** Maximum suggestions to return */
  maxSuggestions?: number;
}

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Create a test generation executor using LLM
 */
export function createTestGenerationLLMExecutor(
  options: TestGenerationLLMExecutorOptions
): (task: TaskDocument) => Promise<TestGenerationOutput> {
  const { adapter, sourceCode } = options;

  return async (task: TaskDocument): Promise<TestGenerationOutput> => {
    const response = await adapter.execute(
      CodeQualityPrompts.testGenerationSystem,
      CodeQualityPrompts.testGenerationUser(task, sourceCode),
      TestGenerationOutputSchema
    );

    return response.parsed;
  };
}

/**
 * Create a deep review executor using LLM
 */
export function createDeepReviewLLMExecutor(
  options: DeepReviewLLMExecutorOptions
): (task: TaskDocument) => Promise<DeepReviewOutput> {
  const { adapter, codeToReview } = options;

  return async (task: TaskDocument): Promise<DeepReviewOutput> => {
    const response = await adapter.execute(
      CodeQualityPrompts.deepReviewSystem,
      CodeQualityPrompts.deepReviewUser(task, codeToReview),
      DeepReviewOutputSchema
    );

    return response.parsed;
  };
}

/**
 * Create a refactoring analyzer using LLM
 */
export function createRefactoringLLMExecutor(
  options: RefactoringLLMExecutorOptions
): (task: TaskDocument) => Promise<RefactoringOutput> {
  const { adapter, codeToAnalyze, maxSuggestions = 10 } = options;

  return async (task: TaskDocument): Promise<RefactoringOutput> => {
    const response = await adapter.execute(
      CodeQualityPrompts.refactoringSystem,
      CodeQualityPrompts.refactoringUser(task, codeToAnalyze),
      RefactoringOutputSchema
    );

    // Limit suggestions if needed
    const result = response.parsed;
    if (result.suggestions.length > maxSuggestions) {
      result.suggestions = result.suggestions.slice(0, maxSuggestions);
    }

    return result;
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate test generation output
 */
export function validateTestGenerationOutput(output: unknown): TestGenerationOutput {
  return TestGenerationOutputSchema.parse(output);
}

/**
 * Validate deep review output
 */
export function validateDeepReviewOutput(output: unknown): DeepReviewOutput {
  return DeepReviewOutputSchema.parse(output);
}

/**
 * Validate refactoring output
 */
export function validateRefactoringOutput(output: unknown): RefactoringOutput {
  return RefactoringOutputSchema.parse(output);
}
