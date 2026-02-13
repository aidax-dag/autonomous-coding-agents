/**
 * Skill LLM Executors
 *
 * Provides LLM-backed executors for the 8 analysis/generation skills.
 * Each factory creates an executor function matching the skill's
 * (input, context) => Promise<Output> signature.
 *
 * Feature: LLM Integration for Agent OS (A-5)
 */

import { z } from 'zod';
import type { SkillContext } from '../../skills/interfaces/skill.interface';
import type { PlanningOutput } from '../agents/planning-agent';
import type {
  TestGenerationOutput,
  DeepReviewOutput,
  RefactoringOutput,
} from '../agents/code-quality-agent';
import type { PlanningSkillInput } from '../../skills/skills/planning-skill';
import type { CodeReviewSkillInput } from '../../skills/skills/code-review-skill';
import type { TestGenerationSkillInput } from '../../skills/skills/test-generation-skill';
import type { RefactoringSkillInput } from '../../skills/skills/refactoring-skill';
import type {
  SecurityScanSkillInput,
  SecurityScanSkillOutput,
} from '../../skills/skills/security-scan-skill';
import type {
  DebuggingSkillInput,
  DebuggingSkillOutput,
} from '../../skills/skills/debugging-skill';
import type {
  DocumentationSkillInput,
  DocumentationSkillOutput,
} from '../../skills/skills/documentation-skill';
import type {
  PerformanceSkillInput,
  PerformanceSkillOutput,
} from '../../skills/skills/performance-skill';
import { TeamAgentLLMAdapter } from './team-agent-llm';
import { PlanningOutputSchema } from './planning-llm';
import {
  TestGenerationOutputSchema,
  DeepReviewOutputSchema,
  RefactoringOutputSchema,
} from './code-quality-llm';

// ============================================================================
// New Schemas (for skills without existing agent schemas)
// ============================================================================

/**
 * Schema for security scan skill output
 */
export const SecurityScanOutputSchema = z.object({
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number().optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.string(),
      message: z.string(),
    })
  ),
  summary: z.string(),
  score: z.number(),
});

/**
 * Schema for debugging skill output
 */
export const DebuggingOutputSchema = z.object({
  rootCause: z.string(),
  hypothesis: z.array(z.string()),
  suggestedFixes: z.array(
    z.object({
      description: z.string(),
      file: z.string().optional(),
      code: z.string().optional(),
    })
  ),
  confidence: z.number(),
});

/**
 * Schema for documentation skill output
 */
export const DocumentationOutputSchema = z.object({
  documents: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      format: z.string(),
    })
  ),
  summary: z.string(),
});

/**
 * Schema for performance skill output
 */
export const PerformanceOutputSchema = z.object({
  findings: z.array(
    z.object({
      file: z.string(),
      issue: z.string(),
      impact: z.string(),
      suggestion: z.string(),
    })
  ),
  overallScore: z.number(),
  bottlenecks: z.array(z.string()),
});

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Options for creating a skill LLM executor
 */
export interface SkillLLMExecutorOptions {
  /** LLM adapter for making calls */
  adapter: TeamAgentLLMAdapter;
  /** Additional project context */
  projectContext?: string;
}

// ============================================================================
// System Prompts
// ============================================================================

const planningSkillSystemPrompt = `You are a planning expert in a multi-agent software development system.
Your task is to decompose a goal into a structured plan with actionable sub-tasks.

Output JSON with:
- title: Plan title
- summary: Brief plan summary
- tasks: Array of { title, type, targetTeam, description, dependencies?, estimatedEffort? }
  - type: feature|bugfix|refactor|test|review|documentation|infrastructure|analysis|planning|design
  - targetTeam: orchestrator|planning|design|development|frontend|backend|qa|code-quality|infrastructure|pm|issue-response
  - estimatedEffort: small|medium|large
- phases?: Array of { name, taskIndices, description }
- risks?: Array of strings
- assumptions?: Array of strings`;

const codeReviewSkillSystemPrompt = `You are a senior code reviewer in a multi-agent software development system.
Analyze code for patterns, security, performance, maintainability, and best practices.

Output JSON with:
- summary: Review summary
- findings: Array of { type, severity, category, message, file, lineStart, lineEnd?, codeSnippet?, suggestedFix?, reference? }
  - type: pattern|security|performance|maintainability|best-practice
  - severity: critical|major|minor|suggestion
- metrics: { complexity, maintainability, testability, security, overall } (each 0-100)
- approved: boolean
- reason: Approval/rejection reason
- actionItems: Array of action strings`;

const testGenerationSkillSystemPrompt = `You are a test engineering expert in a multi-agent software development system.
Generate comprehensive test suites for the given source files.

Output JSON with:
- summary: Generation summary
- tests: Array of { name, type, code, target, filePath, dependencies? }
  - type: unit|integration|e2e
- totalGenerated: number
- estimatedCoverage: { functions, branches, lines } (each 0-100)
- manualTestRecommendations?: Array of strings`;

const refactoringSkillSystemPrompt = `You are a refactoring expert in a multi-agent software development system.
Identify code improvement opportunities and technical debt.

Output JSON with:
- summary: Analysis summary
- suggestions: Array of { type, priority, target, reason, description, before?, after?, effort, impact }
  - type: extract-method|extract-class|rename|move|inline|decompose-conditional|replace-magic-number|introduce-parameter-object|other
  - priority: high|medium|low
  - target: { file, lineStart, lineEnd, symbolName? }
  - effort: trivial|easy|moderate|complex
  - impact: isolated|localized|widespread
- technicalDebtScore: number (0-100)
- codeHealth: { duplications, complexity, coupling, cohesion } (each 0-100)
- prioritizedOrder: Array of suggestion descriptions`;

const securityScanSkillSystemPrompt = `You are a security analyst in a multi-agent software development system.
Scan code for security vulnerabilities following OWASP guidelines.

Focus on: injection flaws, XSS, broken authentication, cryptographic issues,
insecure deserialization, and missing access controls.

Output JSON with:
- findings: Array of { file, line?, severity, category, message }
  - severity: low|medium|high|critical
- summary: Scan summary
- score: Overall security score (0-100, higher is safer)`;

const debuggingSkillSystemPrompt = `You are a debugging expert in a multi-agent software development system.
Analyze errors, stack traces, and context to identify root causes.

Output JSON with:
- rootCause: Root cause description
- hypothesis: Array of hypothesis strings
- suggestedFixes: Array of { description, file?, code? }
- confidence: Confidence level (0-1)`;

const documentationSkillSystemPrompt = `You are a documentation expert in a multi-agent software development system.
Generate clear, comprehensive documentation for code files.

Output JSON with:
- documents: Array of { path, content, format }
- summary: Generation summary`;

const performanceSkillSystemPrompt = `You are a performance engineer in a multi-agent software development system.
Analyze code for performance bottlenecks and optimization opportunities.

Focus on: algorithmic complexity, memory usage, I/O patterns, caching opportunities,
and resource management.

Output JSON with:
- findings: Array of { file, issue, impact, suggestion }
- overallScore: Performance score (0-100, higher is better)
- bottlenecks: Array of bottleneck descriptions`;

// ============================================================================
// User Prompt Builders
// ============================================================================

function buildPlanningSkillUserPrompt(
  input: PlanningSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Goal\n${input.goal}`];

  if (input.constraints && input.constraints.length > 0) {
    parts.push(`\n## Constraints\n${input.constraints.map((c) => `- ${c}`).join('\n')}`);
  }
  if (input.maxTasks) {
    parts.push(`\n## Limit\nMaximum ${input.maxTasks} sub-tasks.`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildCodeReviewSkillUserPrompt(
  input: CodeReviewSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Files to Review\n${input.files.map((f) => `- ${f}`).join('\n')}`];

  if (input.focus && input.focus.length > 0) {
    parts.push(`\n## Focus Areas\n${input.focus.join(', ')}`);
  }
  if (input.minSeverity) {
    parts.push(`\n## Minimum Severity\n${input.minSeverity}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildTestGenerationSkillUserPrompt(
  input: TestGenerationSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Source Files\n${input.sourceFiles.map((f) => `- ${f}`).join('\n')}`];

  if (input.testTypes && input.testTypes.length > 0) {
    parts.push(`\n## Test Types\n${input.testTypes.join(', ')}`);
  }
  if (input.framework) {
    parts.push(`\n## Framework\n${input.framework}`);
  }
  if (input.targetCoverage) {
    parts.push(`\n## Target Coverage\n${input.targetCoverage}%`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildRefactoringSkillUserPrompt(
  input: RefactoringSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Files to Analyze\n${input.files.map((f) => `- ${f}`).join('\n')}`];

  if (input.refactoringTypes && input.refactoringTypes.length > 0) {
    parts.push(`\n## Refactoring Types\n${input.refactoringTypes.join(', ')}`);
  }
  if (input.minPriority) {
    parts.push(`\n## Minimum Priority\n${input.minPriority}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildSecurityScanSkillUserPrompt(
  input: SecurityScanSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Files to Scan\n${input.files.map((f) => `- ${f}`).join('\n')}`];

  if (input.checks && input.checks.length > 0) {
    parts.push(`\n## Checks\n${input.checks.join(', ')}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildDebuggingSkillUserPrompt(
  input: DebuggingSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Error\n${input.error}`];

  if (input.stackTrace) {
    parts.push(`\n## Stack Trace\n\`\`\`\n${input.stackTrace}\n\`\`\``);
  }
  if (input.context) {
    parts.push(`\n## Additional Context\n${input.context}`);
  }
  if (input.files && input.files.length > 0) {
    parts.push(`\n## Related Files\n${input.files.map((f) => `- ${f}`).join('\n')}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildDocumentationSkillUserPrompt(
  input: DocumentationSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Files to Document\n${input.files.map((f) => `- ${f}`).join('\n')}`];

  if (input.format) {
    parts.push(`\n## Format\n${input.format}`);
  }
  if (input.scope) {
    parts.push(`\n## Scope\n${input.scope}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

function buildPerformanceSkillUserPrompt(
  input: PerformanceSkillInput,
  context: SkillContext,
  projectContext?: string,
): string {
  const parts = [`## Files to Analyze\n${input.files.map((f) => `- ${f}`).join('\n')}`];

  if (input.metrics && input.metrics.length > 0) {
    parts.push(`\n## Metrics\n${input.metrics.join(', ')}`);
  }
  if (input.threshold !== undefined) {
    parts.push(`\n## Threshold\n${input.threshold}`);
  }
  if (projectContext || context.projectContext) {
    parts.push(`\n## Project Context\n${projectContext || context.projectContext}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Executor Factories
// ============================================================================

/**
 * Create a planning skill LLM executor
 */
export function createPlanningSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: PlanningSkillInput, context: SkillContext) => Promise<PlanningOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      planningSkillSystemPrompt,
      buildPlanningSkillUserPrompt(input, context, options.projectContext),
      PlanningOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a code review skill LLM executor
 */
export function createCodeReviewSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: CodeReviewSkillInput, context: SkillContext) => Promise<DeepReviewOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      codeReviewSkillSystemPrompt,
      buildCodeReviewSkillUserPrompt(input, context, options.projectContext),
      DeepReviewOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a test generation skill LLM executor
 */
export function createTestGenerationSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: TestGenerationSkillInput, context: SkillContext) => Promise<TestGenerationOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      testGenerationSkillSystemPrompt,
      buildTestGenerationSkillUserPrompt(input, context, options.projectContext),
      TestGenerationOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a refactoring skill LLM executor
 */
export function createRefactoringSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: RefactoringSkillInput, context: SkillContext) => Promise<RefactoringOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      refactoringSkillSystemPrompt,
      buildRefactoringSkillUserPrompt(input, context, options.projectContext),
      RefactoringOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a security scan skill LLM executor
 */
export function createSecurityScanSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: SecurityScanSkillInput, context: SkillContext) => Promise<SecurityScanSkillOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      securityScanSkillSystemPrompt,
      buildSecurityScanSkillUserPrompt(input, context, options.projectContext),
      SecurityScanOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a debugging skill LLM executor
 */
export function createDebuggingSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: DebuggingSkillInput, context: SkillContext) => Promise<DebuggingSkillOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      debuggingSkillSystemPrompt,
      buildDebuggingSkillUserPrompt(input, context, options.projectContext),
      DebuggingOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a documentation skill LLM executor
 */
export function createDocumentationSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: DocumentationSkillInput, context: SkillContext) => Promise<DocumentationSkillOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      documentationSkillSystemPrompt,
      buildDocumentationSkillUserPrompt(input, context, options.projectContext),
      DocumentationOutputSchema,
    );
    return response.parsed;
  };
}

/**
 * Create a performance skill LLM executor
 */
export function createPerformanceSkillLLMExecutor(
  options: SkillLLMExecutorOptions,
): (input: PerformanceSkillInput, context: SkillContext) => Promise<PerformanceSkillOutput> {
  return async (input, context) => {
    const response = await options.adapter.execute(
      performanceSkillSystemPrompt,
      buildPerformanceSkillUserPrompt(input, context, options.projectContext),
      PerformanceOutputSchema,
    );
    return response.parsed;
  };
}
