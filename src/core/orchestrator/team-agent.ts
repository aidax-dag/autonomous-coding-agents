/**
 * Team Agent Interfaces
 *
 * Defines interfaces for team-based agents that communicate via document queue.
 * Teams represent functional groups (planning, development, qa, etc.) that
 * process tasks asynchronously through the file-based message queue.
 *
 * Feature: Orchestrator Core for Agent OS
 */

import { z } from 'zod';
import { TeamType, TaskDocument, TaskType } from '../workspace/task-document';

/**
 * Team agent status
 */
export enum TeamAgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Team agent capability
 */
export interface TeamCapability {
  /** Capability name */
  name: string;
  /** Description of what this capability does */
  description: string;
  /** Task types this capability handles */
  taskTypes: TaskType[];
  /** Priority level for this capability (higher = preferred) */
  priority: number;
}

/**
 * Team agent metrics
 */
export interface TeamMetrics {
  /** Total tasks processed */
  tasksProcessed: number;
  /** Tasks that failed */
  tasksFailed: number;
  /** Tasks currently in progress */
  tasksInProgress: number;
  /** Average task processing time in ms */
  averageProcessingTime: number;
  /** Agent uptime in ms */
  uptime: number;
  /** Last activity timestamp */
  lastActiveAt: Date | null;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Team agent configuration
 */
export interface TeamAgentConfig {
  /** Team type identifier */
  teamType: TeamType;
  /** Human-readable name */
  name: string;
  /** Description of team responsibilities */
  description: string;
  /** Capabilities this team provides */
  capabilities: TeamCapability[];
  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;
  /** Task timeout in ms */
  taskTimeout: number;
  /** Auto-start on registration */
  autoStart: boolean;
}

/**
 * Task handler function type
 */
export type TaskHandler = (task: TaskDocument) => Promise<TaskHandlerResult>;

/**
 * Task handler result
 */
export interface TaskHandlerResult {
  /** Whether task completed successfully */
  success: boolean;
  /** Result data if successful */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Output tasks to publish (delegation) */
  outputTasks?: TaskDocument[];
  /** Metrics from processing */
  metrics?: {
    processingTime: number;
    tokensUsed?: number;
  };
}

/**
 * Team Agent Interface
 *
 * Represents a team that processes tasks from its inbox.
 */
export interface ITeamAgent {
  /** Unique identifier */
  readonly id: string;
  /** Team type */
  readonly teamType: TeamType;
  /** Configuration */
  readonly config: TeamAgentConfig;
  /** Current status */
  readonly status: TeamAgentStatus;
  /** Current metrics */
  readonly metrics: TeamMetrics;

  /**
   * Start the team agent
   */
  start(): Promise<void>;

  /**
   * Stop the team agent
   */
  stop(): Promise<void>;

  /**
   * Pause task processing
   */
  pause(): Promise<void>;

  /**
   * Resume task processing
   */
  resume(): Promise<void>;

  /**
   * Check if team can handle a task type
   */
  canHandle(taskType: TaskType): boolean;

  /**
   * Register a task handler for specific task types
   */
  registerHandler(taskTypes: TaskType[], handler: TaskHandler): void;

  /**
   * Get capability for a task type
   */
  getCapability(taskType: TaskType): TeamCapability | undefined;

  /**
   * Get current load (0-1)
   */
  getLoad(): number;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean;
    status: TeamAgentStatus;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Team agent configuration schema
 */
export const TeamAgentConfigSchema = z.object({
  teamType: z.enum([
    'orchestrator',
    'planning',
    'design',
    'development',
    'frontend',
    'backend',
    'qa',
    'code-quality',
    'infrastructure',
    'pm',
    'issue-response',
  ]),
  name: z.string().min(1),
  description: z.string(),
  capabilities: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      taskTypes: z.array(
        z.enum([
          'feature',
          'bugfix',
          'refactor',
          'test',
          'review',
          'documentation',
          'infrastructure',
          'analysis',
          'planning',
          'design',
        ])
      ),
      priority: z.number().int().min(0).max(100).default(50),
    })
  ),
  maxConcurrentTasks: z.number().int().min(1).max(20).default(3),
  taskTimeout: z.number().int().min(1000).default(300000), // 5 minutes
  autoStart: z.boolean().default(true),
});

/**
 * Default team configurations
 */
export const DEFAULT_TEAM_CONFIGS: Record<TeamType, Partial<TeamAgentConfig>> = {
  orchestrator: {
    name: 'CEO Orchestrator',
    description: 'Coordinates all teams and manages high-level task decomposition',
    capabilities: [
      {
        name: 'task-decomposition',
        description: 'Break down complex tasks into sub-tasks',
        taskTypes: ['planning', 'analysis'],
        priority: 100,
      },
    ],
    maxConcurrentTasks: 5,
  },
  planning: {
    name: 'Planning Team',
    description: 'Creates implementation plans and architectural designs',
    capabilities: [
      {
        name: 'implementation-planning',
        description: 'Create detailed implementation plans',
        taskTypes: ['planning', 'analysis'],
        priority: 90,
      },
    ],
    maxConcurrentTasks: 3,
  },
  design: {
    name: 'Design Team',
    description: 'Creates UI/UX designs and system architectures',
    capabilities: [
      {
        name: 'ui-design',
        description: 'Create user interface designs',
        taskTypes: ['design'],
        priority: 80,
      },
    ],
    maxConcurrentTasks: 2,
  },
  development: {
    name: 'Development Team',
    description: 'General development team for implementation',
    capabilities: [
      {
        name: 'feature-development',
        description: 'Implement features and fix bugs',
        taskTypes: ['feature', 'bugfix', 'refactor'],
        priority: 70,
      },
    ],
    maxConcurrentTasks: 5,
  },
  frontend: {
    name: 'Frontend Team',
    description: 'Specializes in frontend development',
    capabilities: [
      {
        name: 'frontend-development',
        description: 'Implement frontend features',
        taskTypes: ['feature', 'bugfix', 'refactor'],
        priority: 75,
      },
    ],
    maxConcurrentTasks: 3,
  },
  backend: {
    name: 'Backend Team',
    description: 'Specializes in backend development',
    capabilities: [
      {
        name: 'backend-development',
        description: 'Implement backend features and APIs',
        taskTypes: ['feature', 'bugfix', 'refactor'],
        priority: 75,
      },
    ],
    maxConcurrentTasks: 3,
  },
  qa: {
    name: 'QA Team',
    description: 'Quality assurance and testing',
    capabilities: [
      {
        name: 'testing',
        description: 'Write and execute tests',
        taskTypes: ['test', 'review'],
        priority: 80,
      },
    ],
    maxConcurrentTasks: 4,
  },
  'code-quality': {
    name: 'Code Quality Team',
    description: 'Code review and quality checks',
    capabilities: [
      {
        name: 'code-review',
        description: 'Review code for quality and best practices',
        taskTypes: ['review', 'refactor'],
        priority: 85,
      },
    ],
    maxConcurrentTasks: 4,
  },
  infrastructure: {
    name: 'Infrastructure Team',
    description: 'DevOps and infrastructure management',
    capabilities: [
      {
        name: 'infrastructure',
        description: 'Manage deployment and infrastructure',
        taskTypes: ['infrastructure'],
        priority: 70,
      },
    ],
    maxConcurrentTasks: 2,
  },
  pm: {
    name: 'Project Management',
    description: 'Project coordination and tracking',
    capabilities: [
      {
        name: 'project-management',
        description: 'Coordinate projects and track progress',
        taskTypes: ['planning', 'documentation'],
        priority: 60,
      },
    ],
    maxConcurrentTasks: 3,
  },
  'issue-response': {
    name: 'Issue Response Team',
    description: 'Handles incoming issues and support requests',
    capabilities: [
      {
        name: 'issue-triage',
        description: 'Triage and respond to issues',
        taskTypes: ['bugfix', 'analysis'],
        priority: 90,
      },
    ],
    maxConcurrentTasks: 5,
  },
};

/**
 * Create a team agent configuration with defaults
 */
export function createTeamConfig(
  teamType: TeamType,
  overrides?: Partial<TeamAgentConfig>
): TeamAgentConfig {
  const defaults = DEFAULT_TEAM_CONFIGS[teamType] || {};

  return {
    teamType,
    name: overrides?.name || defaults.name || teamType,
    description: overrides?.description || defaults.description || '',
    capabilities: overrides?.capabilities || defaults.capabilities || [],
    maxConcurrentTasks: overrides?.maxConcurrentTasks || defaults.maxConcurrentTasks || 3,
    taskTimeout: overrides?.taskTimeout || 300000,
    autoStart: overrides?.autoStart ?? true,
  };
}
