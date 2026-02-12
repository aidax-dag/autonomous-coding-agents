/**
 * Routing Integration Tests
 *
 * End-to-end tests verifying the full routing pipeline:
 * Config → ModelRouter → AgentFactory → TeamAgentLLMAdapter → chatWithContext
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { createOrchestratorRunner } from '../../src/core/orchestrator/orchestrator-runner';
import { ModelRouter } from '../../src/shared/llm/model-router';
import { ModelProfileRegistry } from '../../src/shared/llm/model-profiles';
import { createCapabilityBasedStrategy } from '../../src/shared/llm/routing-strategies';
import type { ILLMClient, LLMCompletionResult } from '../../src/shared/llm/base-client';

// ============================================================================
// Helpers
// ============================================================================

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('claude'),
    getDefaultModel: jest.fn().mockReturnValue('claude-sonnet-4-5-20250929'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"plan": "test"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(200000),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Routing Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'routing-int-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('OrchestratorRunner with ModelRouter', () => {
    it('should accept a ModelRouter as llmClient', () => {
      const mockClient = makeMockClient();
      const clients = new Map<string, ILLMClient>();
      clients.set('claude', mockClient);

      const router = new ModelRouter({
        clients,
        strategy: createCapabilityBasedStrategy(),
        profileRegistry: new ModelProfileRegistry(),
      });

      const runner = createOrchestratorRunner({
        llmClient: router,
        workspaceDir: tmpDir,
        enableLLM: true,
      });

      expect(runner).toBeDefined();
      expect(runner.currentStatus).toBe('idle');
    });

    it('should return CostTracker via getCostTracker() when using ModelRouter', () => {
      const mockClient = makeMockClient();
      const clients = new Map<string, ILLMClient>();
      clients.set('claude', mockClient);

      const router = new ModelRouter({
        clients,
        strategy: createCapabilityBasedStrategy(),
        profileRegistry: new ModelProfileRegistry(),
        budgetLimit: 10.0,
      });

      const runner = createOrchestratorRunner({
        llmClient: router,
        workspaceDir: tmpDir,
      });

      const tracker = runner.getCostTracker();
      expect(tracker).not.toBeNull();
      expect(tracker!.getRemainingBudget()).toBe(10.0);
    });

    it('should return null from getCostTracker() when using plain client', () => {
      const mockClient = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: mockClient,
        workspaceDir: tmpDir,
      });

      expect(runner.getCostTracker()).toBeNull();
    });
  });

  describe('agentModelMap propagation', () => {
    it('should propagate agentModelMap through runner config', () => {
      const mockClient = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: mockClient,
        agentModelMap: { planning: 'claude-opus-4-6' },
        workspaceDir: tmpDir,
      });

      expect(runner).toBeDefined();
    });
  });

  describe('full start/stop lifecycle with routing', () => {
    it('should start and stop cleanly with a ModelRouter', async () => {
      const mockClient = makeMockClient();
      const clients = new Map<string, ILLMClient>();
      clients.set('claude', mockClient);

      const router = new ModelRouter({
        clients,
        strategy: createCapabilityBasedStrategy(),
        profileRegistry: new ModelProfileRegistry(),
      });

      const runner = createOrchestratorRunner({
        llmClient: router,
        workspaceDir: tmpDir,
        enableLLM: true,
        agentModelMap: { planning: 'claude-opus-4-6' },
      });

      await runner.start();
      expect(runner.currentStatus).toBe('running');

      await runner.stop();
      expect(runner.currentStatus).toBe('stopped');

      await runner.destroy();
    });
  });
});
