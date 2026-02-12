/**
 * Runner Configuration
 *
 * Bridges the configuration system with OrchestratorRunner.
 * Provides Zod-validated config loading from environment variables
 * and factory functions for creating a configured runner.
 *
 * @module core/orchestrator/runner-config
 */

import { z } from 'zod';
import type { Config } from '@/shared/config';
import { loadConfig, isCLIProvider, getLLMApiKey } from '@/shared/config';
import { createLLMClient, createCLILLMClient, createModelRouterFromConfig } from '@/shared/llm';
import type { ILLMClient } from '@/shared/llm';
import { RoutingStrategy } from './task-router';
import {
  OrchestratorRunner,
  createOrchestratorRunner,
  type OrchestratorRunnerConfig,
} from './orchestrator-runner';

/**
 * Zod schema for runner-specific environment configuration.
 * Validates the runner portion of the config independently.
 */
export const RunnerConfigSchema = z.object({
  /** Workspace directory (default: WORK_DIR or cwd) */
  workspaceDir: z.string().optional(),

  /** Routing strategy for task assignment */
  routingStrategy: z
    .nativeEnum(RoutingStrategy)
    .default(RoutingStrategy.LOAD_BALANCED),

  /** Maximum concurrent tasks */
  maxConcurrentTasks: z.number().int().positive().default(10),

  /** Task timeout in milliseconds */
  taskTimeout: z.number().int().positive().default(300000),

  /** Enable LLM-powered agents */
  enableLLM: z.boolean().default(true),

  /** Project context for agents */
  projectContext: z.string().default(''),

  /** Use real quality tools instead of LLM mock */
  useRealQualityTools: z.boolean().default(false),

  /** Enable pre/post validation hooks */
  enableValidation: z.boolean().default(false),

  /** Enable error learning hooks */
  enableLearning: z.boolean().default(false),

  /** Enable context management hooks */
  enableContextManagement: z.boolean().default(false),

  /** Enable security module (SandboxEscalation) */
  enableSecurity: z.boolean().default(false),

  /** Enable session persistence module */
  enableSession: z.boolean().default(false),

  /** Enable MCP protocol integration */
  enableMCP: z.boolean().default(false),

  /** Enable LSP integration */
  enableLSP: z.boolean().default(false),

  /** Enable plugin system */
  enablePlugins: z.boolean().default(false),

  /** Plugin discovery directory */
  pluginsDir: z.string().optional(),

  /** Enable planning context module */
  enablePlanningContext: z.boolean().default(false),
});

export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;

/**
 * Load runner-specific configuration from environment variables.
 * Returns a validated RunnerConfig.
 */
export function loadRunnerConfig(): RunnerConfig {
  const env = process.env;

  const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined || value === '') return undefined;
    return value.toLowerCase() === 'true';
  };

  const parseNumber = (value: string | undefined): number | undefined => {
    if (value === undefined || value === '') return undefined;
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  };

  const raw: Record<string, unknown> = {};

  if (env.WORK_DIR) raw.workspaceDir = env.WORK_DIR;
  if (env.ROUTING_STRATEGY) raw.routingStrategy = env.ROUTING_STRATEGY;

  const maxTasks = parseNumber(env.MAX_CONCURRENT_TASKS);
  if (maxTasks !== undefined) raw.maxConcurrentTasks = maxTasks;

  const timeout = parseNumber(env.TASK_TIMEOUT);
  if (timeout !== undefined) raw.taskTimeout = timeout;

  const enableLLM = parseBoolean(env.ENABLE_LLM);
  if (enableLLM !== undefined) raw.enableLLM = enableLLM;

  if (env.PROJECT_CONTEXT) raw.projectContext = env.PROJECT_CONTEXT;

  const realQuality = parseBoolean(env.USE_REAL_QUALITY_TOOLS);
  if (realQuality !== undefined) raw.useRealQualityTools = realQuality;

  const validation = parseBoolean(env.ENABLE_VALIDATION);
  if (validation !== undefined) raw.enableValidation = validation;

  const learning = parseBoolean(env.ENABLE_LEARNING);
  if (learning !== undefined) raw.enableLearning = learning;

  const context = parseBoolean(env.ENABLE_CONTEXT_MANAGEMENT);
  if (context !== undefined) raw.enableContextManagement = context;

  const security = parseBoolean(env.ENABLE_SECURITY);
  if (security !== undefined) raw.enableSecurity = security;

  const session = parseBoolean(env.ENABLE_SESSION);
  if (session !== undefined) raw.enableSession = session;

  const mcp = parseBoolean(env.ENABLE_MCP);
  if (mcp !== undefined) raw.enableMCP = mcp;

  const lsp = parseBoolean(env.ENABLE_LSP);
  if (lsp !== undefined) raw.enableLSP = lsp;

  const plugins = parseBoolean(env.ENABLE_PLUGINS);
  if (plugins !== undefined) raw.enablePlugins = plugins;

  if (env.PLUGINS_DIR) raw.pluginsDir = env.PLUGINS_DIR;

  const planningContext = parseBoolean(env.ENABLE_PLANNING_CONTEXT);
  if (planningContext !== undefined) raw.enablePlanningContext = planningContext;

  return RunnerConfigSchema.parse(raw);
}

/**
 * Create an LLM client from a shared/config Config object.
 */
function createLLMClientFromSharedConfig(config: Config): ILLMClient {
  const { provider, defaultModel, ollamaHost } = config.llm;

  if (isCLIProvider(provider)) {
    return createCLILLMClient(provider, defaultModel, ollamaHost);
  }

  const apiKey = getLLMApiKey(config);
  return createLLMClient(provider, apiKey, defaultModel);
}

/**
 * Create an LLM client or ModelRouter based on routing configuration.
 * When routing is enabled, returns a ModelRouter; otherwise a plain ILLMClient.
 */
function createLLMClientOrRouter(config: Config): ILLMClient {
  if (config.routing?.enabled) {
    return createModelRouterFromConfig(config);
  }
  return createLLMClientFromSharedConfig(config);
}

/**
 * Create an OrchestratorRunner from a shared/config Config object.
 *
 * Uses Config for LLM client creation and merges with runner-specific
 * settings (from env or explicit overrides).
 */
export function createRunnerFromConfig(
  config: Config,
  overrides?: Partial<RunnerConfig>,
): OrchestratorRunner {
  const runnerConfig = loadRunnerConfig();
  const merged = { ...runnerConfig, ...overrides };
  const llmClient = createLLMClientOrRouter(config);

  const fullConfig: OrchestratorRunnerConfig = {
    llmClient,
    agentModelMap: config.routing?.agentModelMap,
    ...merged,
  };

  return createOrchestratorRunner(fullConfig);
}

/**
 * Create an OrchestratorRunner from environment variables.
 *
 * Loads shared config (LLM keys, etc.) via loadConfig() and
 * runner-specific settings via loadRunnerConfig(), then creates the runner.
 *
 * This is the main convenience factory for CLI and programmatic usage.
 */
export function createRunnerFromEnv(
  overrides?: Partial<RunnerConfig>,
): OrchestratorRunner {
  const config = loadConfig();
  return createRunnerFromConfig(config, overrides);
}

/**
 * Create an OrchestratorRunnerConfig (without instantiating the runner)
 * from a shared/config Config and optional overrides.
 *
 * Useful when you need to inspect or modify the config before creating the runner.
 */
export function buildRunnerConfig(
  config: Config,
  overrides?: Partial<RunnerConfig>,
): OrchestratorRunnerConfig {
  const runnerConfig = loadRunnerConfig();
  const merged = { ...runnerConfig, ...overrides };
  const llmClient = createLLMClientOrRouter(config);

  return {
    llmClient,
    agentModelMap: config.routing?.agentModelMap,
    ...merged,
  };
}
