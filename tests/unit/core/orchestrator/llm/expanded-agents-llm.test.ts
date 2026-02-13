/**
 * Expanded Agent LLM Executor Tests
 *
 * Tests all 6 expanded agent LLM executors:
 * Architecture, Security, Debugging, Documentation, Exploration, Integration.
 */

import {
  createArchitectureLLMExecutor,
  createSecurityLLMExecutor,
  createDebuggingLLMExecutor,
  createDocumentationLLMExecutor,
  createExplorationAgentLLMExecutor,
  createIntegrationLLMExecutor,
  validateArchitectureOutput,
  validateSecurityOutput,
  validateDebuggingOutput,
  validateDocumentationOutput,
  validateExplorationOutput,
  validateIntegrationOutput,
  ArchitecturePrompts,
  SecurityPrompts,
  DebuggingPrompts,
  DocumentationPrompts,
  ExplorationPrompts,
  IntegrationPrompts,
} from '../../../../../src/core/orchestrator/llm/expanded-agents-llm';
import type { TaskDocument } from '../../../../../src/core/workspace/task-document';
import type { TeamAgentLLMAdapter } from '../../../../../src/core/orchestrator/llm/team-agent-llm';

// ============================================================================
// Helpers
// ============================================================================

function makeTask(overrides: Partial<{
  title: string;
  type: string;
  content: string;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'analysis',
      from: 'orchestrator',
      to: 'design',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: [],
    },
    content: overrides.content || 'Analyze the system',
  } as unknown as TaskDocument;
}

function makeMockAdapter(parsedResult: unknown): TeamAgentLLMAdapter {
  return {
    execute: jest.fn().mockResolvedValue({ parsed: parsedResult }),
  } as unknown as TeamAgentLLMAdapter;
}

// ============================================================================
// Fixtures
// ============================================================================

const validArchitectureOutput = {
  components: [
    { name: 'AuthService', responsibility: 'Authentication', dependencies: ['UserRepo'] },
  ],
  patterns: ['Repository Pattern', 'Middleware Pattern'],
  tradeoffs: [
    { option: 'JWT vs Session', pros: ['Stateless'], cons: ['Token size'] },
  ],
  recommendation: 'Use JWT with short-lived tokens.',
};

const validSecurityOutput = {
  summary: 'Security scan complete',
  findings: [
    {
      severity: 'high' as const,
      category: 'Injection',
      location: 'src/api/handler.ts',
      description: 'SQL injection risk',
      recommendation: 'Use parameterized queries',
      referenceId: 'CWE-89',
    },
  ],
  riskScore: 45,
  complianceStatus: 'partial' as const,
  recommendations: ['Use parameterized queries'],
};

const validDebuggingOutput = {
  rootCause: 'Null pointer in user lookup',
  hypotheses: [
    { description: 'Missing null check', confidence: 0.9, verified: true },
  ],
  evidence: [
    { source: 'stack-trace', description: 'TypeError at line 42', relevance: 'high' as const },
  ],
  suggestedFix: 'Add null check before accessing user.name',
  nextSteps: ['Add regression test'],
};

const validDocumentationOutput = {
  sections: [
    { title: 'Overview', content: '# Auth Module', type: 'overview' as const },
    { title: 'API', content: '## login()', type: 'api' as const },
  ],
  summary: 'Documentation for auth module',
  format: 'markdown' as const,
  coveredFiles: ['src/auth.ts'],
};

const validExplorationOutput = {
  files: [
    { path: 'src/auth.ts', type: 'typescript', size: 2400 },
  ],
  symbols: [
    { name: 'login', type: 'function' as const, file: 'src/auth.ts', exported: true },
  ],
  patterns: ['Factory Pattern'],
  summary: 'Explored auth module',
  dependencies: [
    { source: 'src/auth.ts', target: 'src/db.ts', type: 'import' as const },
  ],
};

const validIntegrationOutput = {
  connections: [
    { source: 'API', target: 'Database', status: 'connected' as const, protocol: 'TCP', latency: 5 },
  ],
  issues: [
    { severity: 'warning' as const, component: 'cache', description: 'Cache miss rate high', suggestion: 'Tune TTL' },
  ],
  coverage: 85,
  healthStatus: 'degraded' as const,
  summary: 'Integration verified with minor issues',
};

// ============================================================================
// Architecture Agent
// ============================================================================

describe('createArchitectureLLMExecutor', () => {
  it('should call adapter.execute with architecture prompts', async () => {
    const adapter = makeMockAdapter(validArchitectureOutput);
    const executor = createArchitectureLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      ArchitecturePrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.components).toHaveLength(1);
    expect(result.recommendation).toBe('Use JWT with short-lived tokens.');
  });

  it('should include project context in user prompt', async () => {
    const adapter = makeMockAdapter(validArchitectureOutput);
    const executor = createArchitectureLLMExecutor({
      adapter,
      projectContext: 'Monorepo with 5 packages',
    });
    await executor(makeTask());

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('Monorepo with 5 packages');
  });

  it('should return parsed output directly', async () => {
    const adapter = makeMockAdapter(validArchitectureOutput);
    const executor = createArchitectureLLMExecutor({ adapter });
    const result = await executor(makeTask());
    expect(result).toEqual(validArchitectureOutput);
  });
});

describe('validateArchitectureOutput', () => {
  it('should validate correct output', () => {
    const result = validateArchitectureOutput(validArchitectureOutput);
    expect(result.components).toHaveLength(1);
  });

  it('should reject invalid output', () => {
    expect(() => validateArchitectureOutput({ bad: 'data' })).toThrow();
  });
});

// ============================================================================
// Security Agent
// ============================================================================

describe('createSecurityLLMExecutor', () => {
  it('should call adapter.execute with security prompts', async () => {
    const adapter = makeMockAdapter(validSecurityOutput);
    const executor = createSecurityLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      SecurityPrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.findings).toHaveLength(1);
    expect(result.riskScore).toBe(45);
  });

  it('should include project context in user prompt', async () => {
    const adapter = makeMockAdapter(validSecurityOutput);
    const executor = createSecurityLLMExecutor({
      adapter,
      projectContext: 'Financial app with PCI compliance',
    });
    await executor(makeTask());

    const userPrompt = (adapter.execute as jest.Mock).mock.calls[0][1];
    expect(userPrompt).toContain('Financial app with PCI compliance');
  });
});

describe('validateSecurityOutput', () => {
  it('should validate correct output', () => {
    const result = validateSecurityOutput(validSecurityOutput);
    expect(result.complianceStatus).toBe('partial');
  });

  it('should reject invalid output', () => {
    expect(() => validateSecurityOutput({ riskScore: 'not-a-number' })).toThrow();
  });
});

// ============================================================================
// Debugging Agent
// ============================================================================

describe('createDebuggingLLMExecutor', () => {
  it('should call adapter.execute with debugging prompts', async () => {
    const adapter = makeMockAdapter(validDebuggingOutput);
    const executor = createDebuggingLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      DebuggingPrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.rootCause).toBe('Null pointer in user lookup');
    expect(result.hypotheses).toHaveLength(1);
  });

  it('should return parsed output directly', async () => {
    const adapter = makeMockAdapter(validDebuggingOutput);
    const executor = createDebuggingLLMExecutor({ adapter });
    const result = await executor(makeTask());
    expect(result).toEqual(validDebuggingOutput);
  });
});

describe('validateDebuggingOutput', () => {
  it('should validate correct output', () => {
    const result = validateDebuggingOutput(validDebuggingOutput);
    expect(result.suggestedFix).toContain('null check');
  });

  it('should reject invalid output', () => {
    expect(() => validateDebuggingOutput({})).toThrow();
  });
});

// ============================================================================
// Documentation Agent
// ============================================================================

describe('createDocumentationLLMExecutor', () => {
  it('should call adapter.execute with documentation prompts', async () => {
    const adapter = makeMockAdapter(validDocumentationOutput);
    const executor = createDocumentationLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      DocumentationPrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.sections).toHaveLength(2);
    expect(result.format).toBe('markdown');
  });

  it('should return parsed output directly', async () => {
    const adapter = makeMockAdapter(validDocumentationOutput);
    const executor = createDocumentationLLMExecutor({ adapter });
    const result = await executor(makeTask());
    expect(result).toEqual(validDocumentationOutput);
  });
});

describe('validateDocumentationOutput', () => {
  it('should validate correct output', () => {
    const result = validateDocumentationOutput(validDocumentationOutput);
    expect(result.sections[0].type).toBe('overview');
  });

  it('should reject invalid output', () => {
    expect(() => validateDocumentationOutput({ format: 'invalid' })).toThrow();
  });
});

// ============================================================================
// Exploration Agent
// ============================================================================

describe('createExplorationAgentLLMExecutor', () => {
  it('should call adapter.execute with exploration prompts', async () => {
    const adapter = makeMockAdapter(validExplorationOutput);
    const executor = createExplorationAgentLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      ExplorationPrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.files).toHaveLength(1);
    expect(result.symbols).toHaveLength(1);
  });

  it('should return parsed output directly', async () => {
    const adapter = makeMockAdapter(validExplorationOutput);
    const executor = createExplorationAgentLLMExecutor({ adapter });
    const result = await executor(makeTask());
    expect(result).toEqual(validExplorationOutput);
  });
});

describe('validateExplorationOutput', () => {
  it('should validate correct output', () => {
    const result = validateExplorationOutput(validExplorationOutput);
    expect(result.patterns).toContain('Factory Pattern');
  });

  it('should reject invalid output', () => {
    expect(() => validateExplorationOutput({ symbols: 'not-array' })).toThrow();
  });
});

// ============================================================================
// Integration Agent
// ============================================================================

describe('createIntegrationLLMExecutor', () => {
  it('should call adapter.execute with integration prompts', async () => {
    const adapter = makeMockAdapter(validIntegrationOutput);
    const executor = createIntegrationLLMExecutor({ adapter });
    const result = await executor(makeTask());

    expect(adapter.execute).toHaveBeenCalledWith(
      IntegrationPrompts.system,
      expect.any(String),
      expect.anything(),
    );
    expect(result.connections).toHaveLength(1);
    expect(result.healthStatus).toBe('degraded');
  });

  it('should return parsed output directly', async () => {
    const adapter = makeMockAdapter(validIntegrationOutput);
    const executor = createIntegrationLLMExecutor({ adapter });
    const result = await executor(makeTask());
    expect(result).toEqual(validIntegrationOutput);
  });
});

describe('validateIntegrationOutput', () => {
  it('should validate correct output', () => {
    const result = validateIntegrationOutput(validIntegrationOutput);
    expect(result.coverage).toBe(85);
  });

  it('should reject invalid output', () => {
    expect(() => validateIntegrationOutput({ healthStatus: 'unknown' })).toThrow();
  });
});
