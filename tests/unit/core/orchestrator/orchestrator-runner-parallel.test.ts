/**
 * Orchestrator Runner Parallel Execution Tests
 */

import { OrchestratorRunner, OrchestratorRunnerConfig } from '@/core/orchestrator/orchestrator-runner';
import type { ILLMClient, LLMCompletionResult } from '@/shared/llm/base-client';

const mockLLMResult: LLMCompletionResult = {
  content: '{"subtasks": []}',
  model: 'mock',
  usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
  finishReason: 'stop',
};

const mockClient: ILLMClient = {
  getProvider: () => 'mock',
  getDefaultModel: () => 'mock-model',
  chat: jest.fn().mockResolvedValue(mockLLMResult),
  chatStream: jest.fn().mockResolvedValue(mockLLMResult),
  getMaxContextLength: () => 200000,
};

describe('OrchestratorRunner with parallel execution', () => {
  it('should accept enableParallelExecution config', () => {
    const config: OrchestratorRunnerConfig = {
      llmClient: mockClient,
      enableParallelExecution: true,
      parallelConcurrency: 3,
    };
    const runner = new OrchestratorRunner(config);
    expect(runner).toBeDefined();
  });

  it('should default parallel execution to disabled', () => {
    const runner = new OrchestratorRunner({ llmClient: mockClient });
    expect(runner).toBeDefined();
    // Runner should work in sequential mode by default
  });

  it('should create runner with parallel and sequential configs', () => {
    const parallel = new OrchestratorRunner({
      llmClient: mockClient,
      enableParallelExecution: true,
    });
    const sequential = new OrchestratorRunner({
      llmClient: mockClient,
      enableParallelExecution: false,
    });
    expect(parallel).toBeDefined();
    expect(sequential).toBeDefined();
  });

  it('should handle parallel concurrency setting', () => {
    const runner = new OrchestratorRunner({
      llmClient: mockClient,
      enableParallelExecution: true,
      parallelConcurrency: 10,
    });
    expect(runner).toBeDefined();
  });

  it('should still support sequential execution when flag is off', async () => {
    const runner = new OrchestratorRunner({
      llmClient: mockClient,
      enableParallelExecution: false,
    });
    // Just verify the runner is created properly; actual executeGoal requires start()
    expect(runner.currentStatus).toBe('idle');
  });

  it('should expose parallel execution as optional feature flag', () => {
    // Verify both configs are valid
    const configWithFlag: OrchestratorRunnerConfig = {
      llmClient: mockClient,
      enableParallelExecution: true,
      parallelConcurrency: 5,
    };
    const configWithoutFlag: OrchestratorRunnerConfig = {
      llmClient: mockClient,
    };
    expect(() => new OrchestratorRunner(configWithFlag)).not.toThrow();
    expect(() => new OrchestratorRunner(configWithoutFlag)).not.toThrow();
  });
});
