/**
 * Parallel Execution Interfaces
 *
 * Defines contracts for parallel agent execution with dependency management.
 *
 * @module core/orchestrator/interfaces/parallel
 */

import type { TaskDocument } from '../../workspace/task-document';
import type { WorkflowResult } from '../orchestrator-runner';

/**
 * Task dependency graph node
 */
export interface TaskNode {
  task: TaskDocument;
  dependsOn: string[];
}

/**
 * Group of tasks that can execute in parallel
 */
export interface TaskGroup {
  groupId: string;
  tasks: TaskDocument[];
  /** Groups that must complete before this one */
  dependsOnGroups: string[];
}

/**
 * Parallel executor configuration
 */
export interface ParallelExecutorConfig {
  /** Maximum concurrent tasks per batch */
  maxConcurrency?: number;
  /** Task timeout in ms */
  taskTimeout?: number;
  /** Whether to fail fast on first error */
  failFast?: boolean;
}

/**
 * Task executor function type
 */
export type TaskExecutorFn = (task: TaskDocument) => Promise<WorkflowResult>;

/**
 * Parallel executor interface
 */
export interface IParallelExecutor {
  /** Execute tasks with dependency-aware parallelism */
  execute(
    tasks: TaskDocument[],
    executor: { executeTask: TaskExecutorFn },
  ): Promise<WorkflowResult[]>;

  /** Build parallel execution groups from tasks */
  buildGroups(tasks: TaskNode[]): TaskGroup[];
}

/**
 * Agent pool slot interface
 */
export interface IAgentPool {
  /** Acquire a slot for a provider */
  acquire(provider: string): Promise<void>;
  /** Release a slot for a provider */
  release(provider: string): void;
  /** Get current stats */
  stats(): PoolStats;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  providerStats: Record<string, { used: number; max: number }>;
}

/**
 * Background task handle
 */
export interface BackgroundTaskHandle {
  id: string;
  promise: Promise<WorkflowResult>;
  cancel: () => void;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
}
