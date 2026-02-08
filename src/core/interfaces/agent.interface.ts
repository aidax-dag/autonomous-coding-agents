/**
 * Agent Core Interfaces
 *
 * SOLID Principles:
 * - S: Each interface has a single responsibility
 * - L: All agent implementations can substitute IAgent
 * - I: Interfaces are segregated by concern
 * - D: High-level modules depend on abstractions
 *
 * @module core/interfaces/agent
 */

/**
 * Agent type enumeration
 */
export enum AgentType {
  ARCHITECT = 'architect',
  CODER = 'coder',
  REVIEWER = 'reviewer',
  TESTER = 'tester',
  DOC_WRITER = 'doc_writer',
  EXPLORER = 'explorer',
  LIBRARIAN = 'librarian',
  DESIGNER = 'designer',
  SECURITY_AUDITOR = 'security_auditor',
  REPO_MANAGER = 'repo_manager',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

/**
 * Maps between modern (lowercase) and legacy (UPPERCASE) AgentType values.
 * Use when crossing boundary between core/ and agents/ or messaging systems.
 */
export const AgentTypeNormalizer = {
  toLegacy(type: AgentType): string {
    return type.toUpperCase();
  },
  fromLegacy(value: string): AgentType | undefined {
    const lower = value.toLowerCase();
    return Object.values(AgentType).find((v) => v === lower);
  },
} as const;

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

/**
 * Agent metrics for monitoring
 */
export interface AgentMetrics {
  tasksProcessed: number;
  tasksFailed: number;
  averageTaskDuration: number;
  totalTokensUsed: number;
  uptime: number;
  lastActiveAt: Date | null;
  errorRate: number;
}

/**
 * Health status for agent
 */
export interface HealthStatus {
  healthy: boolean;
  status: AgentStatus;
  uptime: number;
  lastCheck: Date;
  details?: Record<string, unknown>;
}

/**
 * Agent state (immutable snapshot)
 */
export interface AgentState {
  readonly status: AgentStatus;
  readonly currentTask: ITask | null;
  readonly queuedTasks: number;
  readonly processedTasks: number;
  readonly lastActiveAt: Date | null;
}

/**
 * Task interface for agent processing
 */
export interface ITask {
  readonly id: string;
  readonly type: string;
  readonly agentType: AgentType;
  readonly priority: TaskPriority;
  readonly payload: Record<string, unknown>;
  readonly metadata?: TaskMetadata;
  readonly createdAt: Date;
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4,
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  requestId?: string;
  parentTaskId?: string;
  createdBy?: string;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  tags?: string[];
  workflowInstanceId?: string;
  stepId?: string;
}

/**
 * Task result interface
 */
export interface TaskResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly status: TaskResultStatus;
  readonly data?: Record<string, unknown>;
  readonly error?: TaskError;
  readonly metadata: TaskResultMetadata;
}

/**
 * Task result status
 */
export enum TaskResultStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Task error information
 */
export interface TaskError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  recoverable: boolean;
}

/**
 * Task result metadata
 */
export interface TaskResultMetadata {
  agentId: string;
  agentType: AgentType;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  tokensUsed?: number;
  retryAttempt?: number;
}

/**
 * Core Agent Interface
 *
 * Defines the contract that all agents must implement.
 * This is the primary abstraction for agent functionality.
 *
 * @interface IAgent
 */
export interface IAgent {
  // === Identification ===
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly version: string;

  // === Lifecycle ===
  /**
   * Initialize the agent (setup resources)
   */
  initialize(): Promise<void>;

  /**
   * Start the agent (begin accepting tasks)
   */
  start(): Promise<void>;

  /**
   * Pause the agent (stop accepting new tasks)
   */
  pause(): Promise<void>;

  /**
   * Resume the agent from paused state
   */
  resume(): Promise<void>;

  /**
   * Stop the agent gracefully
   */
  stop(): Promise<void>;

  /**
   * Dispose of all resources
   */
  dispose(): Promise<void>;

  // === Task Processing ===
  /**
   * Check if agent can handle a specific task
   */
  canHandle(task: ITask): boolean;

  /**
   * Process a task and return result
   */
  processTask(task: ITask): Promise<TaskResult>;

  // === State & Health ===
  /**
   * Get current agent state
   */
  getState(): AgentState;

  /**
   * Get health status
   */
  getHealth(): HealthStatus;

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[];

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics;
}

/**
 * Agent configuration interface
 */
export interface IAgentConfig {
  id: string;
  type: AgentType;
  name: string;
  version?: string;
  description?: string;
  llm: LLMConfig;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryAttempts?: number;
  capabilities?: AgentCapability[];
  metadata?: Record<string, unknown>;
}

/**
 * LLM configuration for agents
 */
export interface LLMConfig {
  provider: 'claude' | 'openai' | 'gemini';
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Agent Factory Interface
 *
 * Creates agent instances (Factory Pattern)
 */
export interface IAgentFactory {
  /**
   * Create an agent instance
   */
  createAgent(config: IAgentConfig): IAgent;

  /**
   * Register an agent class for a type
   */
  registerAgentClass(type: AgentType, agentClass: AgentConstructor): void;

  /**
   * Check if agent type is registered
   */
  hasAgentType(type: AgentType): boolean;

  /**
   * Get registered agent types
   */
  getRegisteredTypes(): AgentType[];
}

/**
 * Agent constructor type
 * Supports DI-style construction with dependencies
 * Generic parameter D allows type-safe dependency injection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentConstructor<D = any> = new (
  config: IAgentConfig,
  dependencies: D
) => IAgent;

/**
 * Agent Registry Interface
 *
 * Manages agent instances (Registry Pattern)
 */
export interface IAgentRegistry {
  /**
   * Register an agent instance
   */
  register(agent: IAgent): void;

  /**
   * Unregister an agent by ID
   */
  unregister(agentId: string): boolean;

  /**
   * Get an agent by ID
   */
  get(agentId: string): IAgent | undefined;

  /**
   * Get all agents of a specific type
   */
  getByType(type: AgentType): IAgent[];

  /**
   * Get all registered agents
   */
  getAll(): IAgent[];

  /**
   * Check if an agent is registered
   */
  has(agentId: string): boolean;

  /**
   * Get count of registered agents
   */
  count(): number;

  /**
   * Clear all registered agents
   */
  clear(): void;
}

/**
 * Agent Lifecycle Manager Interface
 *
 * Manages agent lifecycle transitions (SRP)
 */
export interface IAgentLifecycle {
  /**
   * Initialize an agent
   */
  initialize(agent: IAgent): Promise<void>;

  /**
   * Start an agent
   */
  start(agent: IAgent): Promise<void>;

  /**
   * Pause an agent
   */
  pause(agent: IAgent): Promise<void>;

  /**
   * Resume an agent
   */
  resume(agent: IAgent): Promise<void>;

  /**
   * Stop an agent
   */
  stop(agent: IAgent): Promise<void>;

  /**
   * Get lifecycle status
   */
  getStatus(agent: IAgent): AgentStatus;

  /**
   * Subscribe to status changes
   */
  onStatusChange(
    callback: (agentId: string, status: AgentStatus) => void
  ): () => void;
}
