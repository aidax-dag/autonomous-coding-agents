/**
 * Team Types and Interfaces
 *
 * Core type definitions for the Team System.
 * Defines team types, capabilities, and communication protocols.
 *
 * Feature: Team System
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

/**
 * Team type classification
 */
export enum TeamType {
  /** Strategic planning and task decomposition */
  PLANNING = 'planning',
  /** Architecture and system design */
  DESIGN = 'design',
  /** Frontend development */
  FRONTEND = 'frontend',
  /** Backend development */
  BACKEND = 'backend',
  /** Full-stack development */
  FULLSTACK = 'fullstack',
  /** Quality assurance and testing */
  QA = 'qa',
  /** Code quality and review */
  CODE_QUALITY = 'code_quality',
  /** DevOps and infrastructure */
  DEVOPS = 'devops',
  /** Security analysis */
  SECURITY = 'security',
  /** Documentation */
  DOCUMENTATION = 'documentation',
  /** Support and maintenance */
  SUPPORT = 'support',
}

/**
 * Team capability areas
 */
export enum TeamCapability {
  /** Can decompose requirements into tasks */
  TASK_DECOMPOSITION = 'task_decomposition',
  /** Can write code */
  CODE_GENERATION = 'code_generation',
  /** Can review code */
  CODE_REVIEW = 'code_review',
  /** Can write tests */
  TEST_GENERATION = 'test_generation',
  /** Can run tests */
  TEST_EXECUTION = 'test_execution',
  /** Can analyze architecture */
  ARCHITECTURE_ANALYSIS = 'architecture_analysis',
  /** Can generate documentation */
  DOCUMENTATION = 'documentation',
  /** Can analyze security */
  SECURITY_ANALYSIS = 'security_analysis',
  /** Can manage deployments */
  DEPLOYMENT = 'deployment',
  /** Can debug issues */
  DEBUGGING = 'debugging',
  /** Can refactor code */
  REFACTORING = 'refactoring',
  /** Can estimate effort */
  ESTIMATION = 'estimation',
  /** Can design user interfaces */
  UI_DESIGN = 'ui_design',
  /** Can design APIs */
  API_DESIGN = 'api_design',
  /** Can design database schemas */
  DATABASE_DESIGN = 'database_design',
  /** Can audit security */
  SECURITY_AUDIT = 'security_audit',
}

/**
 * Team status
 */
export enum TeamStatus {
  /** Team is initializing */
  INITIALIZING = 'initializing',
  /** Team is idle, waiting for work */
  IDLE = 'idle',
  /** Team is actively working */
  WORKING = 'working',
  /** Team is blocked on dependencies */
  BLOCKED = 'blocked',
  /** Team is paused */
  PAUSED = 'paused',
  /** Team has encountered an error */
  ERROR = 'error',
  /** Team is shutting down */
  SHUTTING_DOWN = 'shutting_down',
  /** Team has terminated */
  TERMINATED = 'terminated',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/**
 * Task status
 */
export enum TaskStatus {
  /** Task is pending assignment */
  PENDING = 'pending',
  /** Task is assigned to a team */
  ASSIGNED = 'assigned',
  /** Task is in progress */
  IN_PROGRESS = 'in_progress',
  /** Task is waiting for dependencies */
  WAITING = 'waiting',
  /** Task is blocked */
  BLOCKED = 'blocked',
  /** Task is under review */
  IN_REVIEW = 'in_review',
  /** Task is completed */
  COMPLETED = 'completed',
  /** Task has failed */
  FAILED = 'failed',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Team configuration schema
 */
export const TeamConfigSchema = z.object({
  /** Team identifier */
  id: z.string(),
  /** Team name */
  name: z.string(),
  /** Team type */
  type: z.nativeEnum(TeamType),
  /** Team capabilities */
  capabilities: z.array(z.nativeEnum(TeamCapability)),
  /** Maximum concurrent tasks */
  maxConcurrentTasks: z.number().min(1).default(3),
  /** Task timeout in milliseconds */
  taskTimeoutMs: z.number().min(1000).default(300000),
  /** Enable auto-retry on failure */
  autoRetry: z.boolean().default(true),
  /** Maximum retry attempts */
  maxRetries: z.number().min(0).default(3),
  /** Inbox path for receiving tasks */
  inboxPath: z.string().optional(),
  /** Outbox path for completed tasks */
  outboxPath: z.string().optional(),
  /** LLM provider to use */
  llmProvider: z.string().optional(),
  /** LLM model to use */
  llmModel: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Task document schema
 */
export const TaskDocumentSchema = z.object({
  /** Task identifier */
  id: z.string(),
  /** Task title */
  title: z.string(),
  /** Task description */
  description: z.string(),
  /** Task type */
  type: z.string(),
  /** Task priority */
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
  /** Task status */
  status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
  /** Assigned team */
  assignedTeam: z.string().optional(),
  /** Parent task ID */
  parentId: z.string().optional(),
  /** Subtask IDs */
  subtaskIds: z.array(z.string()).default([]),
  /** Dependency task IDs */
  dependencies: z.array(z.string()).default([]),
  /** Task inputs */
  inputs: z.record(z.unknown()).default({}),
  /** Task outputs */
  outputs: z.record(z.unknown()).default({}),
  /** Acceptance criteria */
  acceptanceCriteria: z.array(z.string()).default([]),
  /** Creation timestamp */
  createdAt: z.date().default(() => new Date()),
  /** Last update timestamp */
  updatedAt: z.date().default(() => new Date()),
  /** Start timestamp */
  startedAt: z.date().optional(),
  /** Completion timestamp */
  completedAt: z.date().optional(),
  /** Deadline */
  deadline: z.date().optional(),
  /** Estimated effort in hours */
  estimatedEffort: z.number().optional(),
  /** Actual effort in hours */
  actualEffort: z.number().optional(),
  /** Error message if failed */
  error: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Team message schema
 */
export const TeamMessageSchema = z.object({
  /** Message identifier */
  id: z.string(),
  /** Message type */
  type: z.enum([
    'task_assignment',
    'task_update',
    'task_completed',
    'task_failed',
    'status_request',
    'status_response',
    'capability_query',
    'capability_response',
    'collaboration_request',
    'collaboration_response',
    'feedback',
    'notification',
  ]),
  /** Sender team ID */
  from: z.string(),
  /** Recipient team ID */
  to: z.string(),
  /** Message subject */
  subject: z.string(),
  /** Message body */
  body: z.unknown(),
  /** Reference to related task */
  taskId: z.string().optional(),
  /** Correlation ID for request/response */
  correlationId: z.string().optional(),
  /** Message timestamp */
  timestamp: z.date().default(() => new Date()),
  /** Message priority */
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
  /** Requires acknowledgment */
  requiresAck: z.boolean().default(false),
  /** Acknowledgment received */
  acknowledged: z.boolean().default(false),
  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),
});

// ============================================================================
// Types
// ============================================================================

export type TeamConfig = z.infer<typeof TeamConfigSchema>;
export type TaskDocument = z.infer<typeof TaskDocumentSchema>;
export type TeamMessage = z.infer<typeof TeamMessageSchema>;

/**
 * Team statistics
 */
export interface TeamStats {
  /** Total tasks received */
  tasksReceived: number;
  /** Tasks completed */
  tasksCompleted: number;
  /** Tasks failed */
  tasksFailed: number;
  /** Tasks currently in progress */
  tasksInProgress: number;
  /** Average task duration in ms */
  averageTaskDuration: number;
  /** Total tokens used */
  totalTokensUsed: number;
  /** Uptime in ms */
  uptime: number;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Task result
 */
export interface TaskResult {
  /** Task ID */
  taskId: string;
  /** Success flag */
  success: boolean;
  /** Output data */
  outputs: Record<string, unknown>;
  /** Subtasks generated */
  subtasks: TaskDocument[];
  /** Artifacts produced */
  artifacts: TaskArtifact[];
  /** Duration in ms */
  duration: number;
  /** Tokens used */
  tokensUsed: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Task artifact
 */
export interface TaskArtifact {
  /** Artifact ID */
  id: string;
  /** Artifact type */
  type: 'file' | 'code' | 'document' | 'report' | 'diagram' | 'test';
  /** Artifact name */
  name: string;
  /** File path if applicable */
  path?: string;
  /** Content if inline */
  content?: string;
  /** MIME type */
  mimeType?: string;
  /** Size in bytes */
  size?: number;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Team event types
 */
export interface TeamEvents {
  'team:initialized': (teamId: string) => void;
  'team:started': (teamId: string) => void;
  'team:stopped': (teamId: string) => void;
  'team:error': (teamId: string, error: Error) => void;
  'team:status_changed': (teamId: string, status: TeamStatus) => void;
  'task:received': (teamId: string, task: TaskDocument) => void;
  'task:started': (teamId: string, task: TaskDocument) => void;
  'task:completed': (teamId: string, result: TaskResult) => void;
  'task:failed': (teamId: string, task: TaskDocument, error: Error) => void;
  'message:received': (teamId: string, message: TeamMessage) => void;
  'message:sent': (teamId: string, message: TeamMessage) => void;
}

/**
 * Agent role within a team
 */
export interface AgentRole {
  /** Role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description: string;
  /** Required capabilities */
  capabilities: TeamCapability[];
  /** System prompt for the agent */
  systemPrompt: string;
  /** Tool access */
  tools: string[];
}

/**
 * Team member (agent instance)
 */
export interface TeamMember {
  /** Member identifier */
  id: string;
  /** Role assignment */
  role: AgentRole;
  /** Current status */
  status: 'idle' | 'busy' | 'error';
  /** Current task if busy */
  currentTask?: string;
  /** Tasks completed */
  tasksCompleted: number;
  /** Last activity */
  lastActivity: Date;
}

// ============================================================================
// Defaults
// ============================================================================

/**
 * Default team configuration
 */
export const DEFAULT_TEAM_CONFIG: Omit<TeamConfig, 'id' | 'name' | 'type' | 'capabilities'> = {
  maxConcurrentTasks: 3,
  taskTimeoutMs: 300000,
  autoRetry: true,
  maxRetries: 3,
  metadata: {},
};

/**
 * Team type to capabilities mapping
 */
export const TEAM_CAPABILITIES: Record<TeamType, TeamCapability[]> = {
  [TeamType.PLANNING]: [
    TeamCapability.TASK_DECOMPOSITION,
    TeamCapability.ESTIMATION,
    TeamCapability.ARCHITECTURE_ANALYSIS,
  ],
  [TeamType.DESIGN]: [
    TeamCapability.ARCHITECTURE_ANALYSIS,
    TeamCapability.DOCUMENTATION,
  ],
  [TeamType.FRONTEND]: [
    TeamCapability.CODE_GENERATION,
    TeamCapability.TEST_GENERATION,
    TeamCapability.DEBUGGING,
    TeamCapability.REFACTORING,
    TeamCapability.UI_DESIGN,
  ],
  [TeamType.BACKEND]: [
    TeamCapability.CODE_GENERATION,
    TeamCapability.TEST_GENERATION,
    TeamCapability.DEBUGGING,
    TeamCapability.REFACTORING,
    TeamCapability.API_DESIGN,
    TeamCapability.DATABASE_DESIGN,
  ],
  [TeamType.FULLSTACK]: [
    TeamCapability.CODE_GENERATION,
    TeamCapability.TEST_GENERATION,
    TeamCapability.DEBUGGING,
    TeamCapability.REFACTORING,
    TeamCapability.ARCHITECTURE_ANALYSIS,
    TeamCapability.UI_DESIGN,
    TeamCapability.API_DESIGN,
    TeamCapability.DATABASE_DESIGN,
  ],
  [TeamType.QA]: [
    TeamCapability.TEST_GENERATION,
    TeamCapability.TEST_EXECUTION,
    TeamCapability.DEBUGGING,
  ],
  [TeamType.CODE_QUALITY]: [
    TeamCapability.CODE_REVIEW,
    TeamCapability.REFACTORING,
    TeamCapability.SECURITY_ANALYSIS,
  ],
  [TeamType.DEVOPS]: [
    TeamCapability.DEPLOYMENT,
    TeamCapability.SECURITY_ANALYSIS,
  ],
  [TeamType.SECURITY]: [
    TeamCapability.SECURITY_ANALYSIS,
    TeamCapability.CODE_REVIEW,
  ],
  [TeamType.DOCUMENTATION]: [
    TeamCapability.DOCUMENTATION,
  ],
  [TeamType.SUPPORT]: [
    TeamCapability.DEBUGGING,
    TeamCapability.DOCUMENTATION,
  ],
};
