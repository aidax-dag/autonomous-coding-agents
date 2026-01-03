/**
 * System-wide Dependency Injection Tokens
 *
 * Naming Conventions:
 * - Infrastructure: Direct service name
 * - Agents: Agent*
 * - Tools: Tool*
 * - Services: *Service
 *
 * @module core/di/tokens
 */

import { createToken, createMultiToken } from './create-token';
import type {
  IAgent,
  IAgentFactory,
  IAgentRegistry,
  IAgentLifecycle,
  ITool,
  IToolRegistry,
  IToolExecutor,
  IHook,
  IHookRegistry,
  IHookExecutor,
  IEventBus,
} from '../../interfaces';

// Forward declarations for types not yet implemented
// These will be properly imported as we implement each module

interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

interface IConfig {
  get<T>(key: string): T | undefined;
  getRequired<T>(key: string): T;
  has(key: string): boolean;
  set(key: string, value: unknown): void;
}

interface IMessageBroker {
  publish(topic: string, message: unknown): Promise<void>;
  subscribe(topic: string, handler: (message: unknown) => void): Promise<() => void>;
}

interface IDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

interface ICache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

interface ILLMFactory {
  createClient(provider: string, model: string): unknown;
}

interface ILLMClient {
  complete(prompt: string, options?: unknown): Promise<string>;
  stream(prompt: string, options?: unknown): AsyncIterable<string>;
}

interface IModelOrchestrator {
  selectModel(task: unknown): string;
  executeWithFallback(task: unknown): Promise<unknown>;
}

interface IOrchestratorService {
  executeWorkflow(workflow: unknown): Promise<unknown>;
}

interface IProjectService {
  createProject(config: unknown): Promise<unknown>;
}

interface IWorkflowService {
  createWorkflow(definition: unknown): unknown;
}

interface IAgentService {
  assignTask(agentType: string, task: unknown): Promise<unknown>;
}

interface ISecurityManager {
  verifyPlugin(plugin: unknown): Promise<unknown>;
}

interface IPermissionManager {
  checkPermission(agent: unknown, action: string): boolean;
}

interface IAuditLogger {
  log(entry: unknown): void;
}

interface ITokenBudgetManager {
  createBudget(config: unknown): unknown;
  checkBudget(budgetId?: string): unknown;
}

interface IErrorRecovery {
  retry<T>(operation: () => Promise<T>, options?: unknown): Promise<T>;
}

interface ISessionManager {
  createSession(config?: unknown): Promise<unknown>;
}

interface IMCPHealthMonitor {
  checkHealth(serverId: string): Promise<unknown>;
}

interface IDebugToolkit {
  traceAgent(agentId: string): unknown;
}

interface IAgentTestRunner {
  runTest(test: unknown): Promise<unknown>;
}

interface IMockLLMClient extends ILLMClient {
  setResponse(pattern: string | RegExp, response: unknown): void;
}

/**
 * System Tokens
 *
 * All dependency injection tokens organized by layer
 */
export const TOKENS = {
  // === Infrastructure Layer ===
  Logger: createToken<ILogger>('Logger'),
  Config: createToken<IConfig>('Config'),
  MessageBroker: createToken<IMessageBroker>('MessageBroker'),
  Database: createToken<IDatabase>('Database'),
  Cache: createToken<ICache>('Cache'),
  EventBus: createToken<IEventBus>('EventBus'),

  // === LLM Layer ===
  LLMFactory: createToken<ILLMFactory>('LLMFactory'),
  LLMClient: createToken<ILLMClient>('LLMClient'),
  ModelOrchestrator: createToken<IModelOrchestrator>('ModelOrchestrator'),

  // === Agent Layer ===
  AgentFactory: createToken<IAgentFactory>('AgentFactory'),
  AgentRegistry: createToken<IAgentRegistry>('AgentRegistry'),
  AgentLifecycle: createToken<IAgentLifecycle>('AgentLifecycle'),
  Agents: createMultiToken<IAgent>('Agents'),

  // === Tool Layer ===
  ToolRegistry: createToken<IToolRegistry>('ToolRegistry'),
  ToolExecutor: createToken<IToolExecutor>('ToolExecutor'),
  Tools: createMultiToken<ITool>('Tools'),

  // === Hook Layer ===
  HookRegistry: createToken<IHookRegistry>('HookRegistry'),
  HookExecutor: createToken<IHookExecutor>('HookExecutor'),
  Hooks: createMultiToken<IHook>('Hooks'),

  // === Service Layer ===
  OrchestratorService: createToken<IOrchestratorService>('OrchestratorService'),
  ProjectService: createToken<IProjectService>('ProjectService'),
  WorkflowService: createToken<IWorkflowService>('WorkflowService'),
  AgentService: createToken<IAgentService>('AgentService'),

  // === Security Layer ===
  SecurityManager: createToken<ISecurityManager>('SecurityManager'),
  PermissionManager: createToken<IPermissionManager>('PermissionManager'),
  AuditLogger: createToken<IAuditLogger>('AuditLogger'),

  // === DX Layer ===
  TokenBudgetManager: createToken<ITokenBudgetManager>('TokenBudgetManager'),
  ErrorRecovery: createToken<IErrorRecovery>('ErrorRecovery'),
  SessionManager: createToken<ISessionManager>('SessionManager'),
  MCPHealthMonitor: createToken<IMCPHealthMonitor>('MCPHealthMonitor'),
  DebugToolkit: createToken<IDebugToolkit>('DebugToolkit'),

  // === Testing Layer ===
  AgentTestRunner: createToken<IAgentTestRunner>('AgentTestRunner'),
  MockLLMClient: createToken<IMockLLMClient>('MockLLMClient'),
} as const;

/**
 * Type alias for token keys
 */
export type TokenKey = keyof typeof TOKENS;

/**
 * Get token by name (for dynamic resolution)
 */
export function getToken<K extends TokenKey>(name: K): typeof TOKENS[K] {
  return TOKENS[name];
}
