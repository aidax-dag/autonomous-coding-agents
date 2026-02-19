/**
 * Agent Fallback Contracts
 *
 * Provides structured fallback results for team agents when LLM
 * integration is unavailable. Instead of returning placeholder strings,
 * agents return metadata-rich objects with file-based evidence and
 * actionable recommendations.
 *
 * @module core/orchestrator/agents
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Structured fallback result for agent execution without an LLM.
 *
 * Replaces placeholder strings with evidence-based analysis
 * derived from file system inspection and pattern matching.
 */
export interface AgentFallbackResult {
  /** Human-readable analysis summary based on available evidence */
  analysis: string;
  /** Confidence score from 0.0 (no confidence) to 1.0 (full confidence) */
  confidence: number;
  /** Files the fallback actually examined or discovered */
  sourceFiles: string[];
  /** What this fallback cannot do compared to a full LLM-backed execution */
  limitations: string[];
  /** Actionable recommendations for better results */
  recommendations: string[];
  /** Why the agent is operating in fallback mode */
  fallbackReason: string;
}

/**
 * Agent-specific limitation descriptions keyed by agent type.
 */
const AGENT_LIMITATIONS: Record<string, string[]> = {
  planning: [
    'Cannot intelligently decompose goals into sub-tasks',
    'Cannot estimate effort or identify dependencies between tasks',
    'Cannot perform risk assessment or assumption analysis',
  ],
  development: [
    'Cannot generate or modify code',
    'Cannot analyze implementation requirements deeply',
    'Cannot create meaningful code changes or diffs',
  ],
  qa: [
    'Cannot generate meaningful test cases',
    'Cannot perform intelligent code review',
    'Cannot accurately assess quality metrics',
  ],
  'code-quality': [
    'Cannot perform deep code pattern analysis',
    'Cannot generate targeted test cases',
    'Cannot identify complex refactoring opportunities',
  ],
  architecture: [
    'Cannot perform deep architectural analysis',
    'Cannot reason about design trade-offs',
    'Cannot generate component dependency graphs',
  ],
  security: [
    'Cannot perform deep security vulnerability analysis',
    'Cannot reason about complex attack vectors',
    'Cannot generate threat models',
  ],
  debugging: [
    'Cannot perform intelligent root cause analysis',
    'Cannot generate targeted hypotheses from context',
    'Cannot suggest precise code fixes',
  ],
  documentation: [
    'Cannot generate meaningful documentation content',
    'Cannot infer API semantics from code',
    'Cannot create contextual usage examples',
  ],
  exploration: [
    'Cannot perform intelligent codebase analysis',
    'Cannot identify design patterns from code structure',
    'Cannot generate dependency relationship insights',
  ],
  integration: [
    'Cannot verify actual component connections',
    'Cannot analyze data flow between systems',
    'Cannot detect subtle integration issues',
  ],
};

/**
 * Agent-specific recommendations keyed by agent type.
 */
const AGENT_RECOMMENDATIONS: Record<string, string[]> = {
  planning: [
    'Configure an LLM provider to enable intelligent planning',
    'Provide detailed goal descriptions for better task decomposition',
    'Use structured task templates to guide planning output',
  ],
  development: [
    'Configure an LLM code executor for implementation tasks',
    'Provide clear specifications and acceptance criteria',
    'Break down large tasks into smaller, well-defined units',
  ],
  qa: [
    'Configure an LLM executor for quality assurance tasks',
    'Run existing test suites to get baseline quality metrics',
    'Use static analysis tools alongside agent-based review',
  ],
  'code-quality': [
    'Configure LLM executors for test generation and review',
    'Run linters and static analysis tools for baseline findings',
    'Prioritize manual review for security-critical code paths',
  ],
  architecture: [
    'Configure an LLM analyzer for architectural analysis',
    'Provide system context and design constraints in task descriptions',
    'Document existing architectural decisions as reference material',
  ],
  security: [
    'Configure an LLM scanner for security analysis',
    'Run dedicated security tools (Snyk, npm audit, OWASP ZAP)',
    'Perform manual security review of authentication and authorization paths',
  ],
  debugging: [
    'Configure an LLM debugger for root cause analysis',
    'Add structured logging around error-prone code paths',
    'Reproduce issues in isolated test environments',
  ],
  documentation: [
    'Configure an LLM generator for documentation tasks',
    'Ensure source code has inline TSDoc/JSDoc comments',
    'Use documentation templates to structure output',
  ],
  exploration: [
    'Configure an LLM explorer for codebase analysis',
    'Use IDE tools for symbol navigation and dependency tracking',
    'Run dependency analysis tools for import graph visualization',
  ],
  integration: [
    'Configure an LLM verifier for integration testing',
    'Run integration test suites for connection verification',
    'Use monitoring tools to track inter-component communication',
  ],
};

/**
 * Maximum number of files to scan in a directory for evidence gathering.
 * Keeps fallback execution fast and bounded.
 */
const MAX_FILE_SCAN = 50;

/**
 * File extensions relevant to source code analysis.
 */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
  '.java', '.kt', '.swift', '.rb', '.php', '.cs',
  '.json', '.yaml', '.yml', '.toml',
]);

/**
 * Scan a project directory to discover source files for evidence.
 * Limited to top-level and one level deep to keep it fast.
 *
 * @param projectPath - Path to the project root
 * @returns Array of discovered file paths (relative to projectPath)
 */
function discoverProjectFiles(projectPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (count >= MAX_FILE_SCAN) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext) || entry.name === 'package.json' || entry.name === 'tsconfig.json') {
          files.push(entry.name);
          count++;
        }
      } else if (entry.isDirectory()) {
        // Scan one level deep for key directories
        try {
          const subEntries = fs.readdirSync(path.join(projectPath, entry.name), { withFileTypes: true });
          for (const sub of subEntries) {
            if (count >= MAX_FILE_SCAN) break;
            if (sub.isFile()) {
              const ext = path.extname(sub.name).toLowerCase();
              if (SOURCE_EXTENSIONS.has(ext)) {
                files.push(path.join(entry.name, sub.name));
                count++;
              }
            }
          }
        } catch {
          // Silently skip unreadable subdirectories
        }
      }
    }
  } catch {
    // If we cannot read the directory, return empty array
  }

  return files;
}

/**
 * Detect project characteristics from discovered files.
 *
 * @param files - Discovered file paths
 * @returns Brief analysis string
 */
function analyzeProjectStructure(files: string[]): string {
  const characteristics: string[] = [];

  // Detect language distribution
  const extCounts = new Map<string, number>();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
  }

  const topExtensions = [...extCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ext, count]) => `${ext} (${count})`);

  if (topExtensions.length > 0) {
    characteristics.push(`Primary file types: ${topExtensions.join(', ')}`);
  }

  // Check for package.json
  const hasPackageJson = files.includes('package.json');
  if (hasPackageJson) {
    characteristics.push('Node.js/TypeScript project detected (package.json present)');
  }

  // Check for tsconfig
  const hasTsConfig = files.some((f) => f.startsWith('tsconfig'));
  if (hasTsConfig) {
    characteristics.push('TypeScript configuration present');
  }

  // Detect directory structure
  const dirs = new Set(files.filter((f) => f.includes(path.sep)).map((f) => f.split(path.sep)[0]));
  if (dirs.size > 0) {
    characteristics.push(`Top-level directories examined: ${[...dirs].join(', ')}`);
  }

  return characteristics.length > 0
    ? characteristics.join('. ') + '.'
    : 'No project structure could be determined from available files.';
}

/**
 * Create a structured fallback result for a team agent.
 *
 * Performs lightweight file-based evidence gathering to provide
 * some useful context even without LLM capabilities.
 *
 * @param agentType - Type of agent producing the fallback (e.g., 'planning', 'security')
 * @param projectPath - Path to the project being analyzed
 * @param reason - Why the agent is operating in fallback mode
 * @returns A structured AgentFallbackResult with file-based evidence
 */
export function createAgentFallback(
  agentType: string,
  projectPath: string,
  reason: string,
): AgentFallbackResult {
  const sourceFiles = discoverProjectFiles(projectPath);
  const structureAnalysis = analyzeProjectStructure(sourceFiles);

  const limitations = AGENT_LIMITATIONS[agentType] ?? [
    `Cannot perform full ${agentType} analysis without an LLM executor`,
  ];
  const recommendations = AGENT_RECOMMENDATIONS[agentType] ?? [
    `Configure an LLM executor for the ${agentType} agent`,
  ];

  const analysis = [
    `[Fallback] ${agentType} agent: ${reason}.`,
    `Project scan discovered ${sourceFiles.length} source file(s) at "${projectPath}".`,
    structureAnalysis,
    'This is a static file-based analysis with no semantic understanding.',
  ].join(' ');

  return {
    analysis,
    confidence: 0.1,
    sourceFiles,
    limitations,
    recommendations,
    fallbackReason: reason,
  };
}
