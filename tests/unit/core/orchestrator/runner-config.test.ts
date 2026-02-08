/**
 * Runner Config Unit Tests
 */

import {
  RunnerConfigSchema,
  loadRunnerConfig,
  buildRunnerConfig,
} from '../../../../src/core/orchestrator/runner-config';
import { RoutingStrategy } from '../../../../src/core/orchestrator/task-router';

// Save original env and restore after each test
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// ==========================================================================
// RunnerConfigSchema
// ==========================================================================
describe('RunnerConfigSchema', () => {
  it('should apply defaults for empty input', () => {
    const result = RunnerConfigSchema.parse({});
    expect(result.routingStrategy).toBe(RoutingStrategy.LOAD_BALANCED);
    expect(result.maxConcurrentTasks).toBe(10);
    expect(result.taskTimeout).toBe(300000);
    expect(result.enableLLM).toBe(true);
    expect(result.projectContext).toBe('');
    expect(result.useRealQualityTools).toBe(false);
    expect(result.enableValidation).toBe(false);
    expect(result.enableLearning).toBe(false);
    expect(result.enableContextManagement).toBe(false);
  });

  it('should accept valid overrides', () => {
    const result = RunnerConfigSchema.parse({
      workspaceDir: '/tmp/test',
      maxConcurrentTasks: 5,
      taskTimeout: 60000,
      enableValidation: true,
      enableLearning: true,
      enableContextManagement: true,
    });
    expect(result.workspaceDir).toBe('/tmp/test');
    expect(result.maxConcurrentTasks).toBe(5);
    expect(result.taskTimeout).toBe(60000);
    expect(result.enableValidation).toBe(true);
    expect(result.enableLearning).toBe(true);
    expect(result.enableContextManagement).toBe(true);
  });

  it('should reject invalid maxConcurrentTasks', () => {
    expect(() => RunnerConfigSchema.parse({ maxConcurrentTasks: -1 })).toThrow();
    expect(() => RunnerConfigSchema.parse({ maxConcurrentTasks: 0 })).toThrow();
  });

  it('should reject invalid taskTimeout', () => {
    expect(() => RunnerConfigSchema.parse({ taskTimeout: -100 })).toThrow();
  });
});

// ==========================================================================
// loadRunnerConfig()
// ==========================================================================
describe('loadRunnerConfig', () => {
  it('should return defaults when no env vars are set', () => {
    const config = loadRunnerConfig();
    expect(config.maxConcurrentTasks).toBe(10);
    expect(config.taskTimeout).toBe(300000);
    expect(config.enableLLM).toBe(true);
    expect(config.enableValidation).toBe(false);
  });

  it('should read WORK_DIR', () => {
    process.env.WORK_DIR = '/tmp/runner-test';
    const config = loadRunnerConfig();
    expect(config.workspaceDir).toBe('/tmp/runner-test');
  });

  it('should read MAX_CONCURRENT_TASKS', () => {
    process.env.MAX_CONCURRENT_TASKS = '20';
    const config = loadRunnerConfig();
    expect(config.maxConcurrentTasks).toBe(20);
  });

  it('should read TASK_TIMEOUT', () => {
    process.env.TASK_TIMEOUT = '60000';
    const config = loadRunnerConfig();
    expect(config.taskTimeout).toBe(60000);
  });

  it('should read boolean flags', () => {
    process.env.ENABLE_VALIDATION = 'true';
    process.env.ENABLE_LEARNING = 'true';
    process.env.ENABLE_CONTEXT_MANAGEMENT = 'true';
    process.env.USE_REAL_QUALITY_TOOLS = 'true';
    process.env.ENABLE_LLM = 'false';

    const config = loadRunnerConfig();
    expect(config.enableValidation).toBe(true);
    expect(config.enableLearning).toBe(true);
    expect(config.enableContextManagement).toBe(true);
    expect(config.useRealQualityTools).toBe(true);
    expect(config.enableLLM).toBe(false);
  });

  it('should read PROJECT_CONTEXT', () => {
    process.env.PROJECT_CONTEXT = 'My test project';
    const config = loadRunnerConfig();
    expect(config.projectContext).toBe('My test project');
  });

  it('should ignore invalid number values', () => {
    process.env.MAX_CONCURRENT_TASKS = 'abc';
    // NaN should be ignored and default applied
    const config = loadRunnerConfig();
    expect(config.maxConcurrentTasks).toBe(10);
  });

  it('should ignore empty string env vars', () => {
    process.env.ENABLE_VALIDATION = '';
    const config = loadRunnerConfig();
    expect(config.enableValidation).toBe(false);
  });
});

// ==========================================================================
// buildRunnerConfig()
// ==========================================================================
describe('buildRunnerConfig', () => {
  const mockConfig = {
    nodeEnv: 'test' as const,
    llm: {
      provider: 'claude-cli' as const,
    },
    github: { token: 'ghp_test', owner: 'test' },
    nats: { url: 'nats://localhost:4222' },
    database: { url: 'postgresql://localhost/test' },
    agent: {
      autoMergeEnabled: false,
      humanApprovalRequired: true,
      maxConcurrentFeatures: 3,
      timeoutMinutes: 240,
      maxTurnsPerFeature: 50,
    },
    logging: { level: 'info' as const, toFile: false, directory: './logs' },
    notifications: {},
    server: { port: 3000 },
  };

  it('should build a valid OrchestratorRunnerConfig', () => {
    const result = buildRunnerConfig(mockConfig);
    expect(result).toBeDefined();
    expect(result.llmClient).toBeDefined();
    expect(result.maxConcurrentTasks).toBe(10);
    expect(result.taskTimeout).toBe(300000);
  });

  it('should apply overrides', () => {
    const result = buildRunnerConfig(mockConfig, {
      maxConcurrentTasks: 5,
      enableValidation: true,
      workspaceDir: '/tmp/override',
    });
    expect(result.maxConcurrentTasks).toBe(5);
    expect(result.enableValidation).toBe(true);
    expect(result.workspaceDir).toBe('/tmp/override');
  });

  it('should create an LLM client for CLI provider', () => {
    const result = buildRunnerConfig(mockConfig);
    expect(result.llmClient).toBeDefined();
    expect(result.llmClient.getProvider()).toBe('claude-cli');
  });
});
