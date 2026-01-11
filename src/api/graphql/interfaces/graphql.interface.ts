/**
 * GraphQL API Interfaces
 *
 * Feature: F4.3 - GraphQL API
 *
 * Provides TypeScript interfaces for the GraphQL API layer including
 * context, resolver types, and subscription support.
 *
 * @module api/graphql/interfaces
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MercuriusContext } from 'mercurius';
import type { AuthContext } from '../../interfaces/api.interface.js';

// ==================== Enums ====================

/**
 * GraphQL operation types
 */
export enum GraphQLOperationType {
  QUERY = 'query',
  MUTATION = 'mutation',
  SUBSCRIPTION = 'subscription',
}

/**
 * Agent status enum for GraphQL
 */
export enum GqlAgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

/**
 * Workflow status enum for GraphQL
 */
export enum GqlWorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

/**
 * Task status enum for GraphQL
 */
export enum GqlTaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Tool type enum for GraphQL
 */
export enum GqlToolType {
  BUILTIN = 'BUILTIN',
  CUSTOM = 'CUSTOM',
  MCP = 'MCP',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Hook trigger type enum for GraphQL
 */
export enum GqlHookTrigger {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  ON_ERROR = 'ON_ERROR',
  ON_SUCCESS = 'ON_SUCCESS',
}

/**
 * Subscription event types
 */
export enum GqlSubscriptionEvent {
  AGENT_CREATED = 'AGENT_CREATED',
  AGENT_UPDATED = 'AGENT_UPDATED',
  AGENT_DELETED = 'AGENT_DELETED',
  AGENT_STATUS_CHANGED = 'AGENT_STATUS_CHANGED',
  WORKFLOW_CREATED = 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED = 'WORKFLOW_UPDATED',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  TOOL_EXECUTED = 'TOOL_EXECUTED',
  HOOK_TRIGGERED = 'HOOK_TRIGGERED',
  METRICS_UPDATED = 'METRICS_UPDATED',
}

// ==================== Context Types ====================

/**
 * GraphQL context for resolvers
 */
export interface GraphQLContext extends MercuriusContext {
  request: FastifyRequest;
  reply: FastifyReply;
  auth?: AuthContext;
  requestId: string;
  timestamp: Date;
}

/**
 * Subscription context for real-time events
 */
export interface SubscriptionContext {
  connectionId: string;
  auth?: AuthContext;
  subscriptions: Set<string>;
  createdAt: Date;
}

// ==================== Input Types ====================

/**
 * Pagination input for queries
 */
export interface PaginationInput {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort input for queries
 */
export interface SortInput {
  field: string;
  order: 'ASC' | 'DESC';
}

/**
 * Date range filter input
 */
export interface DateRangeInput {
  from?: Date;
  to?: Date;
}

/**
 * Agent filter input
 */
export interface AgentFilterInput {
  status?: GqlAgentStatus[];
  type?: string[];
  createdAt?: DateRangeInput;
  search?: string;
}

/**
 * Workflow filter input
 */
export interface WorkflowFilterInput {
  status?: GqlWorkflowStatus[];
  agentId?: string;
  createdAt?: DateRangeInput;
  search?: string;
}

/**
 * Task filter input
 */
export interface TaskFilterInput {
  status?: GqlTaskStatus[];
  workflowId?: string;
  agentId?: string;
  createdAt?: DateRangeInput;
  search?: string;
}

/**
 * Create agent input
 */
export interface CreateAgentInput {
  name: string;
  type: string;
  description?: string;
  config?: Record<string, unknown>;
  tools?: string[];
  hooks?: string[];
}

/**
 * Update agent input
 */
export interface UpdateAgentInput {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  tools?: string[];
  hooks?: string[];
}

/**
 * Create workflow input
 */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  agentId: string;
  steps: WorkflowStepInput[];
  config?: Record<string, unknown>;
}

/**
 * Workflow step input
 */
export interface WorkflowStepInput {
  name: string;
  type: string;
  config?: Record<string, unknown>;
  dependencies?: string[];
}

/**
 * Update workflow input
 */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  steps?: WorkflowStepInput[];
  config?: Record<string, unknown>;
}

/**
 * Execute tool input
 */
export interface ExecuteToolInput {
  toolId: string;
  params?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Create hook input
 */
export interface CreateHookInput {
  name: string;
  trigger: GqlHookTrigger;
  targetType: string;
  targetId?: string;
  handler: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * Update hook input
 */
export interface UpdateHookInput {
  name?: string;
  handler?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

// ==================== Output Types ====================

/**
 * Page info for pagination
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Generic connection type for pagination
 */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Generic edge type for cursor-based pagination
 */
export interface Edge<T> {
  node: T;
  cursor: string;
}

/**
 * Agent type
 */
export interface GqlAgent {
  id: string;
  name: string;
  type: string;
  description?: string;
  status: GqlAgentStatus;
  config?: Record<string, unknown>;
  tools: GqlTool[];
  hooks: GqlHook[];
  metrics?: GqlAgentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent metrics type
 */
export interface GqlAgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageExecutionTime: number;
  uptime: number;
  lastActiveAt?: Date;
}

/**
 * Workflow type
 */
export interface GqlWorkflow {
  id: string;
  name: string;
  description?: string;
  status: GqlWorkflowStatus;
  agent: GqlAgent;
  steps: GqlWorkflowStep[];
  config?: Record<string, unknown>;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow step type
 */
export interface GqlWorkflowStep {
  id: string;
  name: string;
  type: string;
  status: GqlTaskStatus;
  config?: Record<string, unknown>;
  dependencies: string[];
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Task type
 */
export interface GqlTask {
  id: string;
  name: string;
  status: GqlTaskStatus;
  workflow?: GqlWorkflow;
  agent?: GqlAgent;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tool type
 */
export interface GqlTool {
  id: string;
  name: string;
  type: GqlToolType;
  description?: string;
  version?: string;
  schema?: Record<string, unknown>;
  config?: Record<string, unknown>;
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tool execution result
 */
export interface GqlToolResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

/**
 * Hook type
 */
export interface GqlHook {
  id: string;
  name: string;
  trigger: GqlHookTrigger;
  targetType: string;
  targetId?: string;
  handler: string;
  config?: Record<string, unknown>;
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * System metrics type
 */
export interface GqlSystemMetrics {
  agents: GqlResourceMetrics;
  workflows: GqlResourceMetrics;
  tasks: GqlResourceMetrics;
  tools: GqlResourceMetrics;
  hooks: GqlResourceMetrics;
  system: GqlSystemResourceMetrics;
}

/**
 * Resource metrics
 */
export interface GqlResourceMetrics {
  total: number;
  active: number;
  completed?: number;
  failed?: number;
}

/**
 * System resource metrics
 */
export interface GqlSystemResourceMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestsPerSecond: number;
  averageResponseTime: number;
}

/**
 * Health status type
 */
export interface GqlHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  services: GqlServiceHealth[];
}

/**
 * Service health type
 */
export interface GqlServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
}

// ==================== Subscription Payload Types ====================

/**
 * Agent event payload
 */
export interface AgentEventPayload {
  event: GqlSubscriptionEvent;
  agent: GqlAgent;
  previousStatus?: GqlAgentStatus;
  timestamp: Date;
}

/**
 * Workflow event payload
 */
export interface WorkflowEventPayload {
  event: GqlSubscriptionEvent;
  workflow: GqlWorkflow;
  previousStatus?: GqlWorkflowStatus;
  timestamp: Date;
}

/**
 * Task event payload
 */
export interface TaskEventPayload {
  event: GqlSubscriptionEvent;
  task: GqlTask;
  previousStatus?: GqlTaskStatus;
  timestamp: Date;
}

/**
 * Tool execution event payload
 */
export interface ToolExecutionEventPayload {
  event: GqlSubscriptionEvent;
  tool: GqlTool;
  result: GqlToolResult;
  agentId?: string;
  timestamp: Date;
}

/**
 * Hook triggered event payload
 */
export interface HookTriggeredEventPayload {
  event: GqlSubscriptionEvent;
  hook: GqlHook;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Metrics update event payload
 */
export interface MetricsUpdateEventPayload {
  event: GqlSubscriptionEvent;
  metrics: GqlSystemMetrics;
  timestamp: Date;
}

// ==================== Resolver Types ====================

/**
 * Base resolver function type
 */
export type ResolverFn<TResult, TParent = unknown, TArgs = unknown> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: unknown
) => TResult | Promise<TResult>;

/**
 * Subscription resolver type
 */
export interface SubscriptionResolver<TPayload, TArgs = unknown> {
  subscribe: (
    parent: unknown,
    args: TArgs,
    context: GraphQLContext
  ) => AsyncIterable<TPayload>;
  resolve?: (payload: TPayload) => unknown;
}

/**
 * Resolver map type
 */
export interface Resolvers {
  Query?: Record<string, ResolverFn<unknown>>;
  Mutation?: Record<string, ResolverFn<unknown>>;
  Subscription?: Record<string, SubscriptionResolver<unknown>>;
  // Additional type resolvers
  [key: string]: Record<string, unknown> | undefined;
}

// ==================== Configuration Types ====================

/**
 * GraphQL server configuration
 */
export interface GraphQLConfig {
  /** Enable GraphQL endpoint */
  enabled: boolean;
  /** GraphQL endpoint path */
  path?: string;
  /** GraphQL IDE path (GraphiQL/Playground) */
  idePath?: string;
  /** Enable GraphQL IDE */
  ideEnabled?: boolean;
  /** Enable introspection */
  introspection?: boolean;
  /** Enable subscriptions */
  subscriptions?: boolean;
  /** Subscription path */
  subscriptionPath?: string;
  /** Query depth limit */
  queryDepthLimit?: number;
  /** Query complexity limit */
  queryComplexityLimit?: number;
  /** Enable query caching */
  caching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable query batching */
  batching?: boolean;
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Enable federation */
  federation?: boolean;
  /** Federation service name */
  federationServiceName?: string;
  /** Enable tracing */
  tracing?: boolean;
  /** Enable validation */
  validation?: boolean;
  /** Custom directives */
  directives?: GraphQLDirectiveConfig[];
}

/**
 * GraphQL directive configuration
 */
export interface GraphQLDirectiveConfig {
  name: string;
  locations: string[];
  handler: (next: () => unknown) => unknown;
}

/**
 * Default GraphQL configuration
 */
export const DEFAULT_GRAPHQL_CONFIG: Required<GraphQLConfig> = {
  enabled: true,
  path: '/graphql',
  idePath: '/graphiql',
  ideEnabled: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  subscriptions: true,
  subscriptionPath: '/graphql/subscriptions',
  queryDepthLimit: 10,
  queryComplexityLimit: 1000,
  caching: true,
  cacheTTL: 60000,
  batching: true,
  maxBatchSize: 10,
  federation: false,
  federationServiceName: 'autonomous-agents',
  tracing: process.env.NODE_ENV !== 'production',
  validation: true,
  directives: [],
};

// ==================== Error Types ====================

/**
 * GraphQL error codes
 */
export const GRAPHQL_ERROR_CODES = {
  // Authentication/Authorization
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Operation errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

/**
 * GraphQL error code type
 */
export type GraphQLErrorCode = (typeof GRAPHQL_ERROR_CODES)[keyof typeof GRAPHQL_ERROR_CODES];

/**
 * Custom GraphQL error
 */
export interface GraphQLErrorExtensions {
  code: GraphQLErrorCode;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}
