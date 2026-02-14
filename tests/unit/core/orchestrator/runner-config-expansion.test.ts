/**
 * Runner Config Expansion Unit Tests
 *
 * Tests for newly added config fields: A2A, MCP OAuth, SevenPhaseWorkflow,
 * ErrorRecovery, LoopDetection, UsageTracking, Marketplace, Desktop.
 */

import {
  RunnerConfigSchema,
  loadRunnerConfig,
} from '../../../../src/core/orchestrator/runner-config';

// Save original env and restore after each test
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// ==========================================================================
// RunnerConfigSchema — Default values for new fields
// ==========================================================================
describe('RunnerConfigSchema — new field defaults', () => {
  it('should default A2A fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableA2A).toBe(false);
    expect(result.a2aPort).toBe(9090);
    expect(result.a2aHost).toBe('localhost');
  });

  it('should default MCP OAuth fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableMCPOAuth).toBe(false);
    expect(result.mcpOAuthRedirectUri).toBeUndefined();
  });

  it('should default Seven Phase Workflow fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableSevenPhase).toBe(false);
    expect(result.sevenPhaseTimeout).toBe(300000);
  });

  it('should default Error Recovery fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableErrorRecovery).toBe(false);
    expect(result.maxRetries).toBe(2);
  });

  it('should default Loop Detection fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableLoopDetection).toBe(true);
    expect(result.loopDetectionThreshold).toBe(3);
    expect(result.loopDetectionWindow).toBe(60000);
  });

  it('should default Usage Tracking fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableUsageTracking).toBe(false);
    expect(result.usagePersistInterval).toBe(60000);
  });

  it('should default Marketplace fields correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableMarketplace).toBe(false);
    expect(result.marketplaceRegistryUrl).toBeUndefined();
  });

  it('should default Desktop field correctly', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.enableDesktop).toBe(false);
  });
});

// ==========================================================================
// RunnerConfigSchema — Validation of new fields
// ==========================================================================
describe('RunnerConfigSchema — new field validation', () => {
  it('should accept valid A2A overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableA2A: true,
      a2aPort: 8080,
      a2aHost: '0.0.0.0',
    });
    expect(result.enableA2A).toBe(true);
    expect(result.a2aPort).toBe(8080);
    expect(result.a2aHost).toBe('0.0.0.0');
  });

  it('should accept valid MCP OAuth overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableMCPOAuth: true,
      mcpOAuthRedirectUri: 'http://localhost:3000/callback',
    });
    expect(result.enableMCPOAuth).toBe(true);
    expect(result.mcpOAuthRedirectUri).toBe('http://localhost:3000/callback');
  });

  it('should accept valid Seven Phase overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableSevenPhase: true,
      sevenPhaseTimeout: 600000,
    });
    expect(result.enableSevenPhase).toBe(true);
    expect(result.sevenPhaseTimeout).toBe(600000);
  });

  it('should accept valid Error Recovery overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableErrorRecovery: true,
      maxRetries: 5,
    });
    expect(result.enableErrorRecovery).toBe(true);
    expect(result.maxRetries).toBe(5);
  });

  it('should accept valid Loop Detection overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableLoopDetection: false,
      loopDetectionThreshold: 10,
      loopDetectionWindow: 120000,
    });
    expect(result.enableLoopDetection).toBe(false);
    expect(result.loopDetectionThreshold).toBe(10);
    expect(result.loopDetectionWindow).toBe(120000);
  });

  it('should accept valid Usage Tracking overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableUsageTracking: true,
      usagePersistInterval: 30000,
    });
    expect(result.enableUsageTracking).toBe(true);
    expect(result.usagePersistInterval).toBe(30000);
  });

  it('should accept valid Marketplace overrides', () => {
    const result = RunnerConfigSchema.parse({
      enableMarketplace: true,
      marketplaceRegistryUrl: 'https://registry.example.com',
    });
    expect(result.enableMarketplace).toBe(true);
    expect(result.marketplaceRegistryUrl).toBe('https://registry.example.com');
  });

  it('should accept valid Desktop override', () => {
    const result = RunnerConfigSchema.parse({
      enableDesktop: true,
    });
    expect(result.enableDesktop).toBe(true);
  });

  it('should reject non-number for a2aPort', () => {
    expect(() => RunnerConfigSchema.parse({ a2aPort: 'abc' })).toThrow();
  });

  it('should reject non-number for sevenPhaseTimeout', () => {
    expect(() => RunnerConfigSchema.parse({ sevenPhaseTimeout: 'fast' })).toThrow();
  });

  it('should reject non-number for maxRetries', () => {
    expect(() => RunnerConfigSchema.parse({ maxRetries: 'many' })).toThrow();
  });

  it('should reject non-number for loopDetectionThreshold', () => {
    expect(() => RunnerConfigSchema.parse({ loopDetectionThreshold: true })).toThrow();
  });

  it('should parse a full config with all new fields', () => {
    const result = RunnerConfigSchema.parse({
      enableA2A: true,
      a2aPort: 7070,
      a2aHost: '192.168.1.1',
      enableMCPOAuth: true,
      mcpOAuthRedirectUri: 'https://app.example.com/oauth',
      enableSevenPhase: true,
      sevenPhaseTimeout: 120000,
      enableErrorRecovery: true,
      maxRetries: 3,
      enableLoopDetection: false,
      loopDetectionThreshold: 5,
      loopDetectionWindow: 30000,
      enableUsageTracking: true,
      usagePersistInterval: 5000,
      enableMarketplace: true,
      marketplaceRegistryUrl: 'https://marketplace.aca.dev',
      enableDesktop: true,
    });

    expect(result.enableA2A).toBe(true);
    expect(result.a2aPort).toBe(7070);
    expect(result.a2aHost).toBe('192.168.1.1');
    expect(result.enableMCPOAuth).toBe(true);
    expect(result.mcpOAuthRedirectUri).toBe('https://app.example.com/oauth');
    expect(result.enableSevenPhase).toBe(true);
    expect(result.sevenPhaseTimeout).toBe(120000);
    expect(result.enableErrorRecovery).toBe(true);
    expect(result.maxRetries).toBe(3);
    expect(result.enableLoopDetection).toBe(false);
    expect(result.loopDetectionThreshold).toBe(5);
    expect(result.loopDetectionWindow).toBe(30000);
    expect(result.enableUsageTracking).toBe(true);
    expect(result.usagePersistInterval).toBe(5000);
    expect(result.enableMarketplace).toBe(true);
    expect(result.marketplaceRegistryUrl).toBe('https://marketplace.aca.dev');
    expect(result.enableDesktop).toBe(true);
  });
});

// ==========================================================================
// loadRunnerConfig() — Env variable mapping for new fields
// ==========================================================================
describe('loadRunnerConfig — new env variable mapping', () => {
  it('should read ACA_A2A_ENABLED, ACA_A2A_PORT, ACA_A2A_HOST', () => {
    process.env.ACA_A2A_ENABLED = 'true';
    process.env.ACA_A2A_PORT = '8080';
    process.env.ACA_A2A_HOST = '0.0.0.0';
    const config = loadRunnerConfig();
    expect(config.enableA2A).toBe(true);
    expect(config.a2aPort).toBe(8080);
    expect(config.a2aHost).toBe('0.0.0.0');
  });

  it('should read ACA_MCP_OAUTH_ENABLED and ACA_MCP_OAUTH_REDIRECT_URI', () => {
    process.env.ACA_MCP_OAUTH_ENABLED = 'true';
    process.env.ACA_MCP_OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
    const config = loadRunnerConfig();
    expect(config.enableMCPOAuth).toBe(true);
    expect(config.mcpOAuthRedirectUri).toBe('http://localhost:3000/callback');
  });

  it('should read ACA_SEVEN_PHASE_ENABLED and ACA_SEVEN_PHASE_TIMEOUT', () => {
    process.env.ACA_SEVEN_PHASE_ENABLED = 'true';
    process.env.ACA_SEVEN_PHASE_TIMEOUT = '600000';
    const config = loadRunnerConfig();
    expect(config.enableSevenPhase).toBe(true);
    expect(config.sevenPhaseTimeout).toBe(600000);
  });

  it('should read ACA_ERROR_RECOVERY_ENABLED and ACA_MAX_RETRIES', () => {
    process.env.ACA_ERROR_RECOVERY_ENABLED = 'true';
    process.env.ACA_MAX_RETRIES = '5';
    const config = loadRunnerConfig();
    expect(config.enableErrorRecovery).toBe(true);
    expect(config.maxRetries).toBe(5);
  });

  it('should read ACA_LOOP_DETECTION_ENABLED and ACA_LOOP_DETECTION_THRESHOLD', () => {
    process.env.ACA_LOOP_DETECTION_ENABLED = 'false';
    process.env.ACA_LOOP_DETECTION_THRESHOLD = '10';
    const config = loadRunnerConfig();
    expect(config.enableLoopDetection).toBe(false);
    expect(config.loopDetectionThreshold).toBe(10);
  });

  it('should read ACA_USAGE_TRACKING_ENABLED', () => {
    process.env.ACA_USAGE_TRACKING_ENABLED = 'true';
    const config = loadRunnerConfig();
    expect(config.enableUsageTracking).toBe(true);
  });

  it('should read ACA_MARKETPLACE_ENABLED and ACA_MARKETPLACE_REGISTRY_URL', () => {
    process.env.ACA_MARKETPLACE_ENABLED = 'true';
    process.env.ACA_MARKETPLACE_REGISTRY_URL = 'https://registry.example.com';
    const config = loadRunnerConfig();
    expect(config.enableMarketplace).toBe(true);
    expect(config.marketplaceRegistryUrl).toBe('https://registry.example.com');
  });

  it('should read ACA_DESKTOP_ENABLED', () => {
    process.env.ACA_DESKTOP_ENABLED = 'true';
    const config = loadRunnerConfig();
    expect(config.enableDesktop).toBe(true);
  });

  it('should default new fields when no env vars set', () => {
    const config = loadRunnerConfig();
    expect(config.enableA2A).toBe(false);
    expect(config.a2aPort).toBe(9090);
    expect(config.a2aHost).toBe('localhost');
    expect(config.enableMCPOAuth).toBe(false);
    expect(config.mcpOAuthRedirectUri).toBeUndefined();
    expect(config.enableSevenPhase).toBe(false);
    expect(config.sevenPhaseTimeout).toBe(300000);
    expect(config.enableErrorRecovery).toBe(false);
    expect(config.maxRetries).toBe(2);
    expect(config.enableLoopDetection).toBe(true);
    expect(config.loopDetectionThreshold).toBe(3);
    expect(config.loopDetectionWindow).toBe(60000);
    expect(config.enableUsageTracking).toBe(false);
    expect(config.usagePersistInterval).toBe(60000);
    expect(config.enableMarketplace).toBe(false);
    expect(config.marketplaceRegistryUrl).toBeUndefined();
    expect(config.enableDesktop).toBe(false);
  });
});
