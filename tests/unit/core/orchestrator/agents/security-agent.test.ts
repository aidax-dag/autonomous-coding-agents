/**
 * Security Agent Tests
 */

import {
  SecurityAgent,
  createSecurityAgent,
} from '../../../../../src/core/orchestrator/agents/security-agent';
import type { SecurityOutput } from '../../../../../src/core/orchestrator/agents/security-agent';
import type { DocumentQueue } from '../../../../../src/core/workspace/document-queue';
import type { TaskDocument } from '../../../../../src/core/workspace/task-document';

// ============================================================================
// Helpers
// ============================================================================

function makeMockQueue(): DocumentQueue {
  return {
    publish: jest.fn().mockImplementation(async (input: any) => ({
      metadata: { id: `task-${Date.now()}`, ...input },
      content: input.content || '',
    })),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getTask: jest.fn(),
  } as unknown as DocumentQueue;
}

function makeTask(
  overrides: Partial<{
    title: string;
    type: string;
    priority: string;
    content: string;
    tags: string[];
    id: string;
  }> = {}
): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'review',
      from: 'development',
      to: 'code-quality',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
    },
    content: overrides.content || 'Review the authentication module',
  } as TaskDocument;
}

// ============================================================================
// Tests
// ============================================================================

describe('SecurityAgent', () => {
  let queue: DocumentQueue;

  beforeEach(() => {
    queue = makeMockQueue();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new SecurityAgent({ queue });
      expect(agent.teamType).toBe('code-quality');
      expect(agent.config.name).toBe('Security Team');
      expect(agent.config.description).toBe('Security analysis and vulnerability detection');
    });

    it('should accept custom config', () => {
      const agent = new SecurityAgent({
        queue,
        config: { name: 'Custom Security' },
      });
      expect(agent.config.name).toBe('Custom Security');
    });

    it('should register handlers for review and analysis task types', () => {
      const agent = new SecurityAgent({ queue });
      expect(agent.canHandle('review')).toBe(true);
      expect(agent.canHandle('analysis')).toBe(true);
    });
  });

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  describe('capabilities', () => {
    it('should have vulnerability-analysis capability', () => {
      const agent = new SecurityAgent({ queue });
      const cap = agent.getCapability('review');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('vulnerability-analysis');
      expect(cap!.priority).toBe(92);
    });
  });

  // ==========================================================================
  // processTask
  // ==========================================================================

  describe('processTask', () => {
    it('should detect eval() vulnerability', async () => {
      const agent = new SecurityAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Code uses eval(userInput) for dynamic execution' });
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as SecurityOutput;
      const evalFinding = output.findings.find((f) => f.category === 'Injection');
      expect(evalFinding).toBeDefined();
      expect(evalFinding!.severity).toBe('critical');
      expect(output.complianceStatus).toBe('fail');
    });

    it('should detect password-related findings', async () => {
      const agent = new SecurityAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'const password = "secret123"' });
      const result = await agent.processTask(task);

      const output = result.result as SecurityOutput;
      const passFinding = output.findings.find((f) => f.category === 'Sensitive Data');
      expect(passFinding).toBeDefined();
      expect(passFinding!.severity).toBe('medium');
    });

    it('should return pass compliance when no critical issues found', async () => {
      const agent = new SecurityAgent({ queue });
      await agent.start();

      const task = makeTask({ content: 'Clean code with no security issues detected' });
      const result = await agent.processTask(task);

      const output = result.result as SecurityOutput;
      expect(output.complianceStatus).toBe('pass');
      expect(output.riskScore).toBe(0);
    });

    it('should use custom scan function when provided', async () => {
      const customOutput: SecurityOutput = {
        summary: 'Custom scan',
        findings: [],
        riskScore: 0,
        complianceStatus: 'pass',
        recommendations: [],
      };
      const agent = new SecurityAgent({
        queue,
        scanFunction: jest.fn().mockResolvedValue(customOutput),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect((result.result as SecurityOutput).summary).toBe('Custom scan');
    });

    it('should handle unregistered task types via default handler', async () => {
      const agent = new SecurityAgent({ queue });
      await agent.start();

      const task = makeTask({ type: 'feature' });
      const result = await agent.processTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // setScanFunction
  // ==========================================================================

  describe('setScanFunction', () => {
    it('should override scan function', async () => {
      const agent = new SecurityAgent({ queue });
      await agent.start();

      const customOutput: SecurityOutput = {
        summary: 'Overridden',
        findings: [],
        riskScore: 5,
        complianceStatus: 'partial',
        recommendations: [],
      };
      agent.setScanFunction(jest.fn().mockResolvedValue(customOutput));

      const result = await agent.processTask(makeTask());
      expect((result.result as SecurityOutput).summary).toBe('Overridden');
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure on scan function error', async () => {
      const agent = new SecurityAgent({
        queue,
        scanFunction: jest.fn().mockRejectedValue(new Error('Scan failed')),
      });
      await agent.start();

      const result = await agent.processTask(makeTask());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Scan failed');
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createSecurityAgent', () => {
  it('should create SecurityAgent', () => {
    const queue = makeMockQueue();
    const agent = createSecurityAgent(queue);
    expect(agent).toBeInstanceOf(SecurityAgent);
    expect(agent.teamType).toBe('code-quality');
  });
});
