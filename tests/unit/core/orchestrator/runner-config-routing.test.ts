/**
 * Runner Config - Routing Integration Tests
 *
 * Tests the routing branch in runner-config:
 * - createLLMClientOrRouter dispatching
 * - agentModelMap propagation
 * - Backward compatibility when routing is disabled
 */

import {
  createRunnerFromConfig,
  buildRunnerConfig,
} from '../../../../src/core/orchestrator/runner-config';
import { ModelRouter } from '../../../../src/shared/llm/model-router';
import type { Config } from '../../../../src/shared/config';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: 'test',
    llm: {
      provider: 'claude',
      anthropicApiKey: 'test-anthropic-key',
      defaultModel: 'claude-sonnet-4-5-20250929',
    },
    github: { token: 'test-token', owner: 'test-owner' },
    agent: {
      autoMergeEnabled: false,
      humanApprovalRequired: true,
      maxConcurrentFeatures: 3,
      timeoutMinutes: 240,
      maxTurnsPerFeature: 50,
    },
    logging: { level: 'info', toFile: false, directory: './logs' },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('runner-config routing', () => {
  describe('routing disabled (default)', () => {
    it('should create a plain ILLMClient when routing is not configured', () => {
      const config = makeConfig();
      const runnerConfig = buildRunnerConfig(config);
      // Should be a plain ClaudeClient, not a ModelRouter
      expect(runnerConfig.llmClient.getProvider()).toBe('claude');
      expect(runnerConfig.llmClient).not.toBeInstanceOf(ModelRouter);
    });

    it('should not set agentModelMap when routing is not configured', () => {
      const config = makeConfig();
      const runnerConfig = buildRunnerConfig(config);
      expect(runnerConfig.agentModelMap).toBeUndefined();
    });
  });

  describe('routing enabled', () => {
    it('should create a ModelRouter when routing.enabled is true', () => {
      const config = makeConfig({
        routing: { enabled: true, defaultProfile: 'balanced' },
      });
      const runnerConfig = buildRunnerConfig(config);
      expect(runnerConfig.llmClient).toBeInstanceOf(ModelRouter);
      expect(runnerConfig.llmClient.getProvider()).toBe('model-router');
    });

    it('should pass agentModelMap from routing config', () => {
      const config = makeConfig({
        routing: {
          enabled: true,
          defaultProfile: 'balanced',
          agentModelMap: {
            planning: 'claude-opus-4-6',
            development: 'claude-sonnet-4-5-20250929',
          },
        },
      });
      const runnerConfig = buildRunnerConfig(config);
      expect(runnerConfig.agentModelMap).toEqual({
        planning: 'claude-opus-4-6',
        development: 'claude-sonnet-4-5-20250929',
      });
    });
  });

  describe('createRunnerFromConfig', () => {
    it('should create a runner with routing enabled', () => {
      const config = makeConfig({
        routing: { enabled: true, defaultProfile: 'balanced' },
      });
      const runner = createRunnerFromConfig(config);
      expect(runner).toBeDefined();
      expect(runner.currentStatus).toBe('idle');
    });

    it('should create a runner with routing disabled', () => {
      const config = makeConfig();
      const runner = createRunnerFromConfig(config);
      expect(runner).toBeDefined();
      expect(runner.currentStatus).toBe('idle');
    });
  });
});
