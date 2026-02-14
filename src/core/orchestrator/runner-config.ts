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

  /** Enable expanded agent set (architecture, security, debugging, docs, exploration, integration) */
  enableExpandedAgents: z.boolean().default(false),

  /** Enable parallel task execution */
  enableParallelExecution: z.boolean().default(false),

  /** Max parallel concurrency */
  parallelConcurrency: z.number().int().positive().default(5),

  /** Enable OpenTelemetry tracing */
  enableTelemetry: z.boolean().default(false),

  /** Per-provider concurrency limits (e.g. { claude: 3, openai: 5 }) */
  providerLimits: z.record(z.number().int().positive()).optional(),

  /** Global concurrency cap across all providers */
  globalMax: z.number().int().positive().optional(),

  /** Enable fire-and-forget goal execution via BackgroundManager */
  enableBackgroundGoals: z.boolean().default(false),

  // --- A2A Protocol ---

  /** Enable Agent-to-Agent protocol */
  enableA2A: z.boolean().default(false),

  /** A2A server port */
  a2aPort: z.number().default(9090),

  /** A2A server host */
  a2aHost: z.string().default('localhost'),

  // --- MCP OAuth ---

  /** Enable MCP OAuth authentication */
  enableMCPOAuth: z.boolean().default(false),

  /** MCP OAuth redirect URI */
  mcpOAuthRedirectUri: z.string().optional(),

  // --- Seven Phase Workflow ---

  /** Enable seven-phase workflow execution */
  enableSevenPhase: z.boolean().default(false),

  /** Timeout per phase in milliseconds (default: 5 minutes) */
  sevenPhaseTimeout: z.number().default(300000),

  // --- Error Recovery ---

  /** Enable automatic error recovery (G-6) */
  enableErrorRecovery: z.boolean().default(false),

  /** Maximum retry attempts for error recovery */
  maxRetries: z.number().default(2),

  // --- Loop Detection ---

  /** Enable loop detection for agent execution */
  enableLoopDetection: z.boolean().default(true),

  /** Number of repeated actions before triggering loop detection */
  loopDetectionThreshold: z.number().default(3),

  /** Time window for loop detection in milliseconds (default: 1 minute) */
  loopDetectionWindow: z.number().default(60000),

  // --- Usage Tracking ---

  /** Enable usage tracking and metrics collection */
  enableUsageTracking: z.boolean().default(false),

  /** Interval for persisting usage data in milliseconds (default: 1 minute) */
  usagePersistInterval: z.number().default(60000),

  // --- Plugin Marketplace ---

  /** Enable plugin marketplace integration */
  enableMarketplace: z.boolean().default(false),

  /** Plugin marketplace registry URL */
  marketplaceRegistryUrl: z.string().optional(),

  // --- Desktop ---

  /** Enable desktop mode */
  enableDesktop: z.boolean().default(false),
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

  const expandedAgents = parseBoolean(env.ENABLE_EXPANDED_AGENTS);
  if (expandedAgents !== undefined) raw.enableExpandedAgents = expandedAgents;

  const parallelExecution = parseBoolean(env.ENABLE_PARALLEL_EXECUTION);
  if (parallelExecution !== undefined) raw.enableParallelExecution = parallelExecution;

  const parallelConcurrency = parseNumber(env.PARALLEL_CONCURRENCY);
  if (parallelConcurrency !== undefined) raw.parallelConcurrency = parallelConcurrency;

  const telemetry = parseBoolean(env.ENABLE_TELEMETRY);
  if (telemetry !== undefined) raw.enableTelemetry = telemetry;

  if (env.PROVIDER_LIMITS) {
    try {
      raw.providerLimits = JSON.parse(env.PROVIDER_LIMITS);
    } catch {
      /* ignore malformed JSON */
    }
  }

  const globalMax = parseNumber(env.GLOBAL_MAX);
  if (globalMax !== undefined) raw.globalMax = globalMax;

  const backgroundGoals = parseBoolean(env.ENABLE_BACKGROUND_GOALS);
  if (backgroundGoals !== undefined) raw.enableBackgroundGoals = backgroundGoals;

  // --- A2A Protocol ---
  const enableA2A = parseBoolean(env.ACA_A2A_ENABLED);
  if (enableA2A !== undefined) raw.enableA2A = enableA2A;

  const a2aPort = parseNumber(env.ACA_A2A_PORT);
  if (a2aPort !== undefined) raw.a2aPort = a2aPort;

  if (env.ACA_A2A_HOST) raw.a2aHost = env.ACA_A2A_HOST;

  // --- MCP OAuth ---
  const enableMCPOAuth = parseBoolean(env.ACA_MCP_OAUTH_ENABLED);
  if (enableMCPOAuth !== undefined) raw.enableMCPOAuth = enableMCPOAuth;

  if (env.ACA_MCP_OAUTH_REDIRECT_URI) raw.mcpOAuthRedirectUri = env.ACA_MCP_OAUTH_REDIRECT_URI;

  // --- Seven Phase Workflow ---
  const enableSevenPhase = parseBoolean(env.ACA_SEVEN_PHASE_ENABLED);
  if (enableSevenPhase !== undefined) raw.enableSevenPhase = enableSevenPhase;

  const sevenPhaseTimeout = parseNumber(env.ACA_SEVEN_PHASE_TIMEOUT);
  if (sevenPhaseTimeout !== undefined) raw.sevenPhaseTimeout = sevenPhaseTimeout;

  // --- Error Recovery ---
  const enableErrorRecovery = parseBoolean(env.ACA_ERROR_RECOVERY_ENABLED);
  if (enableErrorRecovery !== undefined) raw.enableErrorRecovery = enableErrorRecovery;

  const maxRetries = parseNumber(env.ACA_MAX_RETRIES);
  if (maxRetries !== undefined) raw.maxRetries = maxRetries;

  // --- Loop Detection ---
  const enableLoopDetection = parseBoolean(env.ACA_LOOP_DETECTION_ENABLED);
  if (enableLoopDetection !== undefined) raw.enableLoopDetection = enableLoopDetection;

  const loopDetectionThreshold = parseNumber(env.ACA_LOOP_DETECTION_THRESHOLD);
  if (loopDetectionThreshold !== undefined) raw.loopDetectionThreshold = loopDetectionThreshold;

  const loopDetectionWindow = parseNumber(env.ACA_LOOP_DETECTION_WINDOW);
  if (loopDetectionWindow !== undefined) raw.loopDetectionWindow = loopDetectionWindow;

  // --- Usage Tracking ---
  const enableUsageTracking = parseBoolean(env.ACA_USAGE_TRACKING_ENABLED);
  if (enableUsageTracking !== undefined) raw.enableUsageTracking = enableUsageTracking;

  const usagePersistInterval = parseNumber(env.ACA_USAGE_PERSIST_INTERVAL);
  if (usagePersistInterval !== undefined) raw.usagePersistInterval = usagePersistInterval;

  // --- Plugin Marketplace ---
  const enableMarketplace = parseBoolean(env.ACA_MARKETPLACE_ENABLED);
  if (enableMarketplace !== undefined) raw.enableMarketplace = enableMarketplace;

  if (env.ACA_MARKETPLACE_REGISTRY_URL) raw.marketplaceRegistryUrl = env.ACA_MARKETPLACE_REGISTRY_URL;

  // --- Desktop ---
  const enableDesktop = parseBoolean(env.ACA_DESKTOP_ENABLED);
  if (enableDesktop !== undefined) raw.enableDesktop = enableDesktop;

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
