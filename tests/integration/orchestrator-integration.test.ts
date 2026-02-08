/**
 * Orchestrator Integration Tests
 *
 * Verifies integration modules (validation, learning, context) work
 * correctly when wired into the OrchestratorRunner pipeline.
 */

import { createMockRunner, RunnerStatus } from '../../src/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '../../src/core/services/service-registry';
import type { ILLMClient } from '../../src/shared/llm';

// Helper: create a mock LLM client
function createMockLLMClient(): ILLMClient {
  return {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async () => ({
      content: '```json\n{"summary":"mock"}\n```',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop' as const,
    }),
    chatStream: async (_msgs, callback) => {
      const result = {
        content: '```json\n{"summary":"mock"}\n```',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop' as const,
      };
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };
}

describe('Orchestrator Integration', () => {
  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      // ignore
    }
    ServiceRegistry.resetInstance();
  });

  describe('Feature flags disabled (regression)', () => {
    it('should work identically to original when all flags are false', async () => {
      const runner = createMockRunner({ workspaceDir: '/tmp/test-orca-int-1' });

      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.stop();
      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);

      await runner.destroy();
    });
  });

  describe('Feature flags enabled', () => {
    it('should initialize with enableValidation', async () => {
      const { OrchestratorRunner: Runner } = await import('../../src/core/orchestrator/orchestrator-runner');
      const runner = new Runner({
        llmClient: createMockLLMClient(),
        workspaceDir: '/tmp/test-orca-int-2',
        enableValidation: true,
        enableLLM: false,
      });

      await runner.start();

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).not.toBeNull();

      await runner.destroy();
    });

    it('should initialize with enableContextManagement', async () => {
      const { OrchestratorRunner: Runner } = await import('../../src/core/orchestrator/orchestrator-runner');
      const runner = new Runner({
        llmClient: createMockLLMClient(),
        workspaceDir: '/tmp/test-orca-int-3',
        enableContextManagement: true,
        enableLLM: false,
      });

      await runner.start();

      const registry = ServiceRegistry.getInstance();
      expect(registry.getContextManager()).not.toBeNull();

      await runner.destroy();
    });

    it('should gracefully handle module initialization failures', async () => {
      const { OrchestratorRunner: Runner } = await import('../../src/core/orchestrator/orchestrator-runner');
      const runner = new Runner({
        llmClient: createMockLLMClient(),
        workspaceDir: '/tmp/test-orca-int-4',
        enableLearning: true,
        enableLLM: false,
      });

      // Start should succeed even if learning modules fail to init
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
    });
  });

  describe('Goal verification', () => {
    it('should initialize GoalBackwardVerifier when enableValidation is true', async () => {
      const { OrchestratorRunner: Runner } = await import('../../src/core/orchestrator/orchestrator-runner');
      const runner = new Runner({
        llmClient: createMockLLMClient(),
        workspaceDir: '/tmp/test-orca-int-6',
        enableValidation: true,
        enableLLM: false,
      });

      await runner.start();

      const registry = ServiceRegistry.getInstance();
      expect(registry.getGoalBackwardVerifier()).not.toBeNull();

      await runner.destroy();
    });
  });

  describe('destroy cleanup', () => {
    it('should dispose ServiceRegistry on destroy', async () => {
      const { OrchestratorRunner: Runner } = await import('../../src/core/orchestrator/orchestrator-runner');
      const runner = new Runner({
        llmClient: createMockLLMClient(),
        workspaceDir: '/tmp/test-orca-int-5',
        enableValidation: true,
        enableLLM: false,
      });

      await runner.start();
      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);

      await runner.destroy();
      expect(registry.isInitialized()).toBe(false);
    });
  });
});
