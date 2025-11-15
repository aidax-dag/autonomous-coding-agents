import { LLMCompletionOptions } from '@/shared/llm/base-client';

/**
 * Agent Base Types and Interfaces
 *
 * Defines core types and interfaces for the agent system.
 *
 * Feature: F2.1 - Base Agent Class
 */

/**
 * Agent types
 */
export enum AgentType {
  CODER = 'CODER',
  REVIEWER = 'REVIEWER',
  REPO_MANAGER = 'REPO_MANAGER',
}

/**
 * Agent state
 */
export enum AgentState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  WORKING = 'WORKING',
  ERROR = 'ERROR',
  STOPPED = 'STOPPED',
}

/**
 * Task priority
 */
export enum TaskPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  description?: string;
  llm: {
    provider: 'claude' | 'openai' | 'gemini';
    model?: string;
    options?: LLMCompletionOptions;
  };
  nats: {
    servers: string[];
  };
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  timeout?: number; // milliseconds
}

/**
 * Task base interface
 */
export interface Task {
  id: string;
  type: string;
  agentType: AgentType;
  priority: TaskPriority;
  status: TaskStatus;
  payload: Record<string, unknown>;
  metadata?: {
    requestId?: string;
    parentTaskId?: string;
    createdBy?: string;
    createdAt: number;
    updatedAt?: number;
    retryCount?: number;
  };
}

/**
 * Task result base interface
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    completedAt: number;
    duration: number; // milliseconds
    agentId: string;
  };
}

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean;
  state: AgentState;
  uptime: number; // milliseconds
  lastTaskCompletedAt?: number;
  tasksProcessed: number;
  tasksFailed: number;
  averageTaskDuration?: number; // milliseconds
  errorRate?: number; // percentage
  details?: {
    currentTask?: string;
    queueSize?: number;
    memoryUsage?: number;
    lastError?: string;
  };
}

/**
 * Agent status (for external monitoring)
 */
export interface AgentStatus {
  id: string;
  type: AgentType;
  name: string;
  state: AgentState;
  health: HealthStatus;
  config: {
    maxConcurrentTasks: number;
    timeout: number;
  };
}

/**
 * Implementation request task (for Coder Agent)
 */
export interface ImplementationRequest extends Task {
  type: 'IMPLEMENTATION_REQUEST';
  agentType: AgentType.CODER;
  payload: {
    repository: {
      owner: string;
      repo: string;
      url: string;
    };
    branch?: string; // Branch to create from (default: main)
    featureBranch?: string; // Name of feature branch to create
    feature: {
      title: string;
      description: string;
      requirements: string[];
      acceptanceCriteria?: string[];
    };
    context?: {
      relatedFiles?: string[];
      existingCode?: Record<string, string>; // filename -> content
      constraints?: string[];
    };
  };
}

/**
 * Implementation result (from Coder Agent)
 */
export interface ImplementationResult extends TaskResult {
  data: {
    repository: {
      owner: string;
      repo: string;
    };
    branch: string;
    commits: Array<{
      sha: string;
      message: string;
      files: string[];
    }>;
    filesChanged: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted';
      additions?: number;
      deletions?: number;
    }>;
    summary: string;
    validationResults?: {
      syntaxCheck?: boolean;
      typeCheck?: boolean;
      errors?: string[];
    };
  };
}

/**
 * Review request task (for Reviewer Agent)
 */
export interface ReviewRequest extends Task {
  type: 'REVIEW_REQUEST';
  agentType: AgentType.REVIEWER;
  payload: {
    repository: {
      owner: string;
      repo: string;
    };
    pullRequest: {
      number: number;
      title: string;
      description?: string;
    };
    reviewCriteria?: {
      checkSecurity?: boolean;
      checkPerformance?: boolean;
      checkTestCoverage?: boolean;
      checkDocumentation?: boolean;
      customRules?: string[];
    };
  };
}

/**
 * Review comment
 */
export interface ReviewComment {
  path: string;
  line?: number;
  position?: number;
  body: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Review result (from Reviewer Agent)
 */
export interface ReviewResult extends TaskResult {
  data: {
    repository: {
      owner: string;
      repo: string;
    };
    pullRequest: {
      number: number;
    };
    review: {
      id: number;
      decision: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      summary: string;
      comments: ReviewComment[];
      stats: {
        filesReviewed: number;
        issuesFound: number;
        criticalIssues: number;
        warnings: number;
        suggestions: number;
      };
    };
  };
}

/**
 * Feature request task (for Repo Manager Agent)
 */
export interface FeatureRequest extends Task {
  type: 'FEATURE_REQUEST';
  agentType: AgentType.REPO_MANAGER;
  payload: {
    repository: {
      owner: string;
      repo: string;
      url: string;
    };
    feature: {
      title: string;
      description: string;
      requirements: string[];
      acceptanceCriteria?: string[];
    };
    workflow?: {
      autoMerge?: boolean;
      requireApproval?: boolean;
      notifyOnCompletion?: boolean;
    };
  };
}

/**
 * Feature result (from Repo Manager Agent)
 */
export interface FeatureResult extends TaskResult {
  data: {
    repository: {
      owner: string;
      repo: string;
    };
    feature: {
      title: string;
      description: string;
    };
    pullRequest: {
      number: number;
      url: string;
      merged: boolean;
      mergeCommitSha?: string;
    };
    implementation: {
      branch: string;
      commits: Array<{
        sha: string;
        message: string;
        files: string[];
      }>;
      filesChanged: Array<{
        path: string;
        status: 'added' | 'modified' | 'deleted';
        additions?: number;
        deletions?: number;
      }>;
    };
    review?: {
      decision: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      summary: string;
      issuesFound: number;
    };
  };
}

/**
 * Task creation options
 */
export interface CreateTaskOptions {
  type: string;
  agentType: AgentType;
  payload: Record<string, unknown>;
  priority?: TaskPriority;
  metadata?: {
    requestId?: string;
    parentTaskId?: string;
    createdBy?: string;
  };
}

/**
 * Agent event types
 */
export enum AgentEventType {
  STARTED = 'AGENT_STARTED',
  STOPPED = 'AGENT_STOPPED',
  TASK_RECEIVED = 'TASK_RECEIVED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  ERROR = 'AGENT_ERROR',
  STATE_CHANGED = 'STATE_CHANGED',
}

/**
 * Agent event
 */
export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  agentType: AgentType;
  timestamp: number;
  data?: Record<string, unknown>;
}
