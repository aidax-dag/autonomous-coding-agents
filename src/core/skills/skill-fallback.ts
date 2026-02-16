/**
 * Skill Fallback Contracts
 *
 * Provides structured fallback results for skills when LLM executors
 * are unavailable. Instead of returning simple stub strings, skills
 * return metadata-rich objects indicating limitations and next actions.
 *
 * @module core/skills
 */

/**
 * Reason why a skill is operating in fallback mode
 */
export type SkillFallbackReason = 'no_llm' | 'no_executor' | 'timeout' | 'error';

/**
 * Structured fallback result for skill execution without an LLM executor.
 *
 * Replaces plain stub strings with metadata that consumers can use
 * to understand confidence level, limitations, and recommended next steps.
 */
export interface SkillFallbackResult {
  /** Human-readable output describing what the fallback produced */
  output: string;
  /** Confidence score from 0.0 (no confidence) to 1.0 (full confidence) */
  confidence: number;
  /** What this fallback cannot do compared to a full LLM-backed execution */
  limitations: string[];
  /** Recommended actions for the user to obtain better results */
  nextActions: string[];
  /** Why the skill is operating in fallback mode */
  fallbackReason: SkillFallbackReason;
}

/**
 * Skill-specific limitation descriptions keyed by skill name.
 * Used by createSkillFallback to generate contextual limitations.
 */
const SKILL_LIMITATIONS: Record<string, string[]> = {
  planning: [
    'Cannot perform intelligent task decomposition',
    'Cannot estimate task dependencies accurately',
    'Cannot assess risk or complexity',
  ],
  'code-review': [
    'Cannot analyze code patterns or anti-patterns',
    'Cannot detect security vulnerabilities',
    'Cannot assess code quality metrics accurately',
  ],
  'test-generation': [
    'Cannot generate meaningful test logic',
    'Cannot identify edge cases or boundary conditions',
    'Cannot determine optimal test coverage strategy',
  ],
  refactoring: [
    'Cannot detect code smells or duplication',
    'Cannot suggest specific refactoring patterns',
    'Cannot assess technical debt accurately',
  ],
  'security-scan': [
    'Cannot perform deep security analysis',
    'Cannot detect complex vulnerability patterns',
    'Cannot assess OWASP compliance',
  ],
  'git-workflow': [
    'Cannot generate meaningful commit messages',
    'Cannot analyze change impact for PR descriptions',
    'Cannot suggest branch strategies based on changes',
  ],
  documentation: [
    'Cannot generate meaningful documentation content',
    'Cannot infer API contracts from code',
    'Cannot create usage examples from implementation',
  ],
  debugging: [
    'Cannot perform root cause analysis',
    'Cannot generate hypotheses from error context',
    'Cannot suggest targeted fixes',
  ],
  performance: [
    'Cannot identify performance bottlenecks in code',
    'Cannot suggest optimization strategies',
    'Cannot estimate performance impact of changes',
  ],
  migration: [
    'Cannot analyze API compatibility between versions',
    'Cannot generate migration code transformations',
    'Cannot identify breaking changes',
  ],
  'api-design': [
    'Cannot generate meaningful API schemas',
    'Cannot design endpoint contracts from requirements',
    'Cannot validate API design against best practices',
  ],
  'tdd-workflow': [
    'Cannot generate meaningful test cases from requirements',
    'Cannot create implementation code',
    'Cannot suggest refactoring improvements',
  ],
  database: [
    'Cannot optimize SQL queries',
    'Cannot design schema from requirements',
    'Cannot generate migration scripts',
  ],
  cicd: [
    'Cannot optimize pipeline configuration',
    'Cannot suggest platform-specific best practices',
    'Cannot analyze build performance',
  ],
};

/**
 * Skill-specific next action descriptions keyed by skill name.
 */
const SKILL_NEXT_ACTIONS: Record<string, string[]> = {
  planning: [
    'Configure an LLM executor for intelligent planning',
    'Provide more detailed goal descriptions for better decomposition',
    'Break down the goal manually into sub-tasks',
  ],
  'code-review': [
    'Configure an LLM executor for deep code analysis',
    'Run static analysis tools (ESLint, SonarQube) as a complement',
    'Request manual peer review for critical code paths',
  ],
  'test-generation': [
    'Configure an LLM executor for intelligent test generation',
    'Write tests manually using the generated stubs as starting points',
    'Use coverage tools to identify untested code paths',
  ],
  refactoring: [
    'Configure an LLM executor for refactoring analysis',
    'Run complexity analysis tools (e.g., ESLint complexity rules)',
    'Review files manually for code smell patterns',
  ],
  'security-scan': [
    'Configure an LLM executor for security analysis',
    'Run dedicated security scanning tools (Snyk, npm audit)',
    'Perform manual security review of critical paths',
  ],
  'git-workflow': [
    'Configure an LLM executor for git workflow operations',
    'Use conventional commits for structured commit messages',
    'Review git diff output manually before committing',
  ],
  documentation: [
    'Configure an LLM executor for documentation generation',
    'Use TSDoc/JSDoc comments in source code as documentation source',
    'Write documentation manually using the generated stubs as templates',
  ],
  debugging: [
    'Configure an LLM executor for debugging analysis',
    'Add detailed logging around the error location',
    'Use a debugger to step through the failing code path',
  ],
  performance: [
    'Configure an LLM executor for performance analysis',
    'Use profiling tools to measure actual performance',
    'Run benchmarks to identify bottlenecks empirically',
  ],
  migration: [
    'Configure an LLM executor for migration planning',
    'Review migration guides from the framework documentation',
    'Test migration changes in an isolated environment first',
  ],
  'api-design': [
    'Configure an LLM executor for API design',
    'Use OpenAPI or GraphQL schema editors for interactive design',
    'Review API design against REST/GraphQL best practices manually',
  ],
  'tdd-workflow': [
    'Configure an LLM executor for TDD workflow',
    'Write failing tests manually based on requirements',
    'Use the generated test stubs as a starting framework',
  ],
  database: [
    'Configure an LLM executor for database operations',
    'Use EXPLAIN ANALYZE to profile query performance',
    'Review schema design using database modeling tools',
  ],
  cicd: [
    'Configure an LLM executor for CI/CD configuration',
    'Review platform documentation for best practices',
    'Use pipeline templates from the CI/CD platform',
  ],
};

/**
 * Fallback reason descriptions for human-readable output.
 */
const REASON_DESCRIPTIONS: Record<SkillFallbackReason, string> = {
  no_llm: 'No LLM provider is configured',
  no_executor: 'No executor function was provided for this skill',
  timeout: 'The LLM request timed out',
  error: 'An error occurred during LLM execution',
};

/**
 * Create a structured fallback result for a skill.
 *
 * @param skillName - Name of the skill producing the fallback
 * @param reason - Why the skill is operating in fallback mode
 * @param context - Optional additional context (e.g., input parameters, error details)
 * @returns A structured SkillFallbackResult with metadata
 */
export function createSkillFallback(
  skillName: string,
  reason: SkillFallbackReason,
  context?: Record<string, unknown>,
): SkillFallbackResult {
  const reasonDesc = REASON_DESCRIPTIONS[reason] ?? reason;
  const limitations = SKILL_LIMITATIONS[skillName] ?? [
    `Cannot perform full ${skillName} analysis without an LLM executor`,
  ];
  const nextActions = SKILL_NEXT_ACTIONS[skillName] ?? [
    `Configure an LLM executor for the ${skillName} skill`,
  ];

  const contextInfo = context
    ? ` Context: ${Object.entries(context).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}.`
    : '';

  return {
    output: `[Fallback] ${skillName}: ${reasonDesc}. Results are stub data with no analytical value.${contextInfo}`,
    confidence: 0.1,
    limitations,
    nextActions,
    fallbackReason: reason,
  };
}
