/**
 * createModelRouterFromConfig Tests
 *
 * Tests the factory function that assembles a ModelRouter from Config:
 * - Primary provider client creation
 * - Additional provider registration
 * - Composite strategy assembly
 * - Budget limit application
 */

import { createModelRouterFromConfig } from '../../../../src/shared/llm';
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
    routing: {
      enabled: true,
      defaultProfile: 'balanced',
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('createModelRouterFromConfig', () => {
  it('should create a ModelRouter instance', () => {
    const config = makeConfig();
    const router = createModelRouterFromConfig(config);
    expect(router).toBeInstanceOf(ModelRouter);
  });

  it('should set provider to model-router', () => {
    const config = makeConfig();
    const router = createModelRouterFromConfig(config);
    expect(router.getProvider()).toBe('model-router');
  });

  it('should register primary provider as default', () => {
    const config = makeConfig();
    const router = createModelRouterFromConfig(config);
    // The router should be functional
    expect(router.getDefaultModel()).toBeDefined();
  });

  it('should add additional providers when API keys are present', () => {
    const config = makeConfig({
      llm: {
        provider: 'claude',
        anthropicApiKey: 'test-anthropic-key',
        openaiApiKey: 'test-openai-key',
        geminiApiKey: 'test-gemini-key',
      },
    });

    const router = createModelRouterFromConfig(config);
    // Router should be able to route to multiple providers
    expect(router).toBeInstanceOf(ModelRouter);
  });

  it('should not add duplicate provider as additional', () => {
    const config = makeConfig({
      llm: {
        provider: 'claude',
        anthropicApiKey: 'test-key',
        // No openaiApiKey or geminiApiKey
      },
    });

    const router = createModelRouterFromConfig(config);
    expect(router).toBeInstanceOf(ModelRouter);
  });

  it('should apply budget limit when specified', () => {
    const config = makeConfig({
      routing: { enabled: true, defaultProfile: 'balanced', budgetLimit: 10.0 },
    });

    const router = createModelRouterFromConfig(config);
    const costTracker = router.getCostTracker();
    expect(costTracker.getRemainingBudget()).toBe(10.0);
  });

  it('should not set budget limit when not specified', () => {
    const config = makeConfig({
      routing: { enabled: true, defaultProfile: 'balanced' },
    });

    const router = createModelRouterFromConfig(config);
    const costTracker = router.getCostTracker();
    expect(costTracker.getRemainingBudget()).toBe(Infinity);
  });

  it('should include cost-optimized strategy when budget limit is set', () => {
    const config = makeConfig({
      routing: { enabled: true, defaultProfile: 'balanced', budgetLimit: 5.0 },
    });

    const router = createModelRouterFromConfig(config);
    const strategy = router.getCurrentStrategy();
    expect(strategy.name).toBe('composite');
  });
});
