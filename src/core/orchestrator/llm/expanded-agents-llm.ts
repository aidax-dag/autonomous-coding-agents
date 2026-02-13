/**
 * Expanded Agent LLM Executors
 *
 * Provides LLM-based execution for the 6 expanded agents:
 * Architecture, Security, Debugging, Documentation, Exploration, Integration.
 *
 * Each executor follows the same pattern as planning-llm.ts / development-llm.ts:
 * factory function returns a closure that calls adapter.execute with
 * agent-specific system prompt, user prompt, and Zod schema.
 *
 * @module core/orchestrator/llm
 */

import { z } from 'zod';
import { TaskDocument } from '../../workspace/task-document';
import type { ArchitectureOutput } from '../agents/architecture-agent';
import type { SecurityOutput } from '../agents/security-agent';
import type { DebuggingOutput } from '../agents/debugging-agent';
import type { DocumentationOutput } from '../agents/documentation-agent';
import type { ExplorationOutput } from '../agents/exploration-agent';
import type { IntegrationOutput } from '../agents/integration-agent';
import { TeamAgentLLMAdapter } from './team-agent-llm';
import { formatTaskForPrompt } from './team-agent-llm';

// ============================================================================
// Base prompt fragment
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an AI agent in a multi-agent software development system.
You work collaboratively with other specialized agents to complete software development tasks.
Always respond with structured JSON output as specified.
Be precise, thorough, and follow best practices for software development.`;

// ============================================================================
// Architecture Agent
// ============================================================================

const ArchitectureOutputSchema = z.object({
  components: z.array(
    z.object({
      name: z.string(),
      responsibility: z.string(),
      dependencies: z.array(z.string()),
    }),
  ),
  patterns: z.array(z.string()),
  tradeoffs: z.array(
    z.object({
      option: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    }),
  ),
  recommendation: z.string(),
});

export const ArchitecturePrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Architecture Agent, responsible for:
- Analyzing system structure and component relationships
- Identifying architectural patterns and anti-patterns
- Evaluating trade-offs between design options
- Recommending structural improvements

Output Format:
{
  "components": [{ "name": "...", "responsibility": "...", "dependencies": ["..."] }],
  "patterns": ["Pattern Name"],
  "tradeoffs": [{ "option": "...", "pros": ["..."], "cons": ["..."] }],
  "recommendation": "Final recommendation"
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Analyze the system architecture for this task.',
      'Identify components, patterns, and trade-offs.',
      'Provide a clear architectural recommendation.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export interface ExpandedAgentLLMExecutorOptions {
  adapter: TeamAgentLLMAdapter;
  projectContext?: string;
}

export function createArchitectureLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<ArchitectureOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<ArchitectureOutput> => {
    const response = await adapter.execute(
      ArchitecturePrompts.system,
      ArchitecturePrompts.user(task, projectContext),
      ArchitectureOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Security Agent
// ============================================================================

const SecurityFindingSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string(),
  location: z.string(),
  description: z.string(),
  recommendation: z.string(),
  referenceId: z.string().optional(),
});

const SecurityOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(SecurityFindingSchema),
  riskScore: z.number(),
  complianceStatus: z.enum(['pass', 'fail', 'partial']),
  recommendations: z.array(z.string()),
});

export const SecurityPrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Security Agent, responsible for:
- Analyzing code for security vulnerabilities (OWASP Top 10)
- Detecting insecure patterns and configurations
- Evaluating compliance with security best practices
- Providing risk scores and remediation guidance

Output Format:
{
  "summary": "Security analysis summary",
  "findings": [{ "severity": "critical|high|medium|low|info", "category": "...", "location": "...", "description": "...", "recommendation": "...", "referenceId": "CWE-XXX" }],
  "riskScore": 0-100,
  "complianceStatus": "pass|fail|partial",
  "recommendations": ["..."]
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Perform a security analysis of the provided code/task.',
      'Check for OWASP Top 10 vulnerabilities and insecure patterns.',
      'Provide a risk score and compliance status.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export function createSecurityLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<SecurityOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<SecurityOutput> => {
    const response = await adapter.execute(
      SecurityPrompts.system,
      SecurityPrompts.user(task, projectContext),
      SecurityOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Debugging Agent
// ============================================================================

const DebuggingOutputSchema = z.object({
  rootCause: z.string(),
  hypotheses: z.array(
    z.object({
      description: z.string(),
      confidence: z.number(),
      verified: z.boolean(),
    }),
  ),
  evidence: z.array(
    z.object({
      source: z.string(),
      description: z.string(),
      relevance: z.enum(['high', 'medium', 'low']),
    }),
  ),
  suggestedFix: z.string(),
  nextSteps: z.array(z.string()).optional(),
});

export const DebuggingPrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Debugging Agent, responsible for:
- Systematic root cause analysis of bugs and failures
- Generating and ranking hypotheses by confidence
- Collecting and evaluating evidence
- Suggesting targeted fixes

Output Format:
{
  "rootCause": "Identified root cause",
  "hypotheses": [{ "description": "...", "confidence": 0.0-1.0, "verified": true|false }],
  "evidence": [{ "source": "...", "description": "...", "relevance": "high|medium|low" }],
  "suggestedFix": "Recommended fix",
  "nextSteps": ["Additional investigation steps"]
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Investigate the reported issue systematically.',
      'Generate hypotheses, collect evidence, and identify the root cause.',
      'Suggest a fix and any follow-up investigation steps.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export function createDebuggingLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<DebuggingOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<DebuggingOutput> => {
    const response = await adapter.execute(
      DebuggingPrompts.system,
      DebuggingPrompts.user(task, projectContext),
      DebuggingOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Documentation Agent
// ============================================================================

const DocumentationSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  type: z.enum(['overview', 'api', 'guide', 'reference', 'example', 'changelog']),
});

const DocumentationOutputSchema = z.object({
  sections: z.array(DocumentationSectionSchema),
  summary: z.string(),
  format: z.enum(['markdown', 'html', 'jsdoc']),
  coveredFiles: z.array(z.string()).optional(),
});

export const DocumentationPrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Documentation Agent, responsible for:
- Generating comprehensive project documentation
- Creating API references, guides, and examples
- Maintaining consistent documentation structure
- Identifying undocumented areas

Output Format:
{
  "sections": [{ "title": "...", "content": "...", "type": "overview|api|guide|reference|example|changelog" }],
  "summary": "Documentation summary",
  "format": "markdown|html|jsdoc",
  "coveredFiles": ["file/path.ts"]
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Generate documentation for the provided code/task.',
      'Include relevant sections: overview, API reference, examples.',
      'Use clear, consistent formatting.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export function createDocumentationLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<DocumentationOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<DocumentationOutput> => {
    const response = await adapter.execute(
      DocumentationPrompts.system,
      DocumentationPrompts.user(task, projectContext),
      DocumentationOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Exploration Agent
// ============================================================================

const ExplorationOutputSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      size: z.number().optional(),
    }),
  ),
  symbols: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['function', 'class', 'variable', 'interface', 'type', 'enum']),
      file: z.string(),
      exported: z.boolean(),
    }),
  ),
  patterns: z.array(z.string()),
  summary: z.string(),
  dependencies: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        type: z.enum(['import', 'extends', 'implements', 'uses']),
      }),
    )
    .optional(),
});

export const ExplorationPrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Exploration Agent, responsible for:
- Mapping codebase structure (files, symbols, dependencies)
- Identifying design patterns and conventions
- Discovering relevant files for a given task
- Building dependency graphs

Output Format:
{
  "files": [{ "path": "...", "type": "typescript", "size": 1234 }],
  "symbols": [{ "name": "...", "type": "function|class|...", "file": "...", "exported": true }],
  "patterns": ["Pattern Name"],
  "summary": "Exploration summary",
  "dependencies": [{ "source": "...", "target": "...", "type": "import|extends|implements|uses" }]
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Explore the codebase relevant to this task.',
      'Map files, symbols, patterns, and dependencies.',
      'Provide a clear summary of findings.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export function createExplorationAgentLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<ExplorationOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<ExplorationOutput> => {
    const response = await adapter.execute(
      ExplorationPrompts.system,
      ExplorationPrompts.user(task, projectContext),
      ExplorationOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Integration Agent
// ============================================================================

const IntegrationConnectionSchema = z.object({
  source: z.string(),
  target: z.string(),
  status: z.enum(['connected', 'disconnected', 'degraded']),
  protocol: z.string().optional(),
  latency: z.number().optional(),
});

const IntegrationOutputSchema = z.object({
  connections: z.array(IntegrationConnectionSchema),
  issues: z.array(
    z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      component: z.string(),
      description: z.string(),
      suggestion: z.string(),
    }),
  ),
  coverage: z.number(),
  healthStatus: z.enum(['healthy', 'degraded', 'unhealthy']),
  summary: z.string(),
});

export const IntegrationPrompts = {
  system: `${BASE_SYSTEM_PROMPT}

You are the Integration Agent, responsible for:
- Verifying component connections and data flow
- Testing cross-module communication
- Identifying integration issues and incompatibilities
- Measuring integration coverage

Output Format:
{
  "connections": [{ "source": "...", "target": "...", "status": "connected|disconnected|degraded", "protocol": "...", "latency": 100 }],
  "issues": [{ "severity": "critical|warning|info", "component": "...", "description": "...", "suggestion": "..." }],
  "coverage": 85,
  "healthStatus": "healthy|degraded|unhealthy",
  "summary": "Integration summary"
}`,

  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [formatTaskForPrompt(task)];
    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }
    parts.push(
      '',
      '### Instructions',
      '',
      'Verify integration between system components.',
      'Check connections, data flow, and compatibility.',
      'Identify issues and provide remediation suggestions.',
      'Respond with the JSON structure specified in your system prompt.',
    );
    return parts.join('\n');
  },
};

export function createIntegrationLLMExecutor(
  options: ExpandedAgentLLMExecutorOptions,
): (task: TaskDocument) => Promise<IntegrationOutput> {
  const { adapter, projectContext } = options;

  return async (task: TaskDocument): Promise<IntegrationOutput> => {
    const response = await adapter.execute(
      IntegrationPrompts.system,
      IntegrationPrompts.user(task, projectContext),
      IntegrationOutputSchema,
    );
    return response.parsed;
  };
}

// ============================================================================
// Validation helpers
// ============================================================================

export function validateArchitectureOutput(output: unknown): ArchitectureOutput {
  return ArchitectureOutputSchema.parse(output);
}

export function validateSecurityOutput(output: unknown): SecurityOutput {
  return SecurityOutputSchema.parse(output);
}

export function validateDebuggingOutput(output: unknown): DebuggingOutput {
  return DebuggingOutputSchema.parse(output);
}

export function validateDocumentationOutput(output: unknown): DocumentationOutput {
  return DocumentationOutputSchema.parse(output);
}

export function validateExplorationOutput(output: unknown): ExplorationOutput {
  return ExplorationOutputSchema.parse(output);
}

export function validateIntegrationOutput(output: unknown): IntegrationOutput {
  return IntegrationOutputSchema.parse(output);
}
