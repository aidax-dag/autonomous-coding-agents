/**
 * Parallel Executor
 *
 * Builds dependency-aware task groups and executes them in parallel batches.
 *
 * @module core/orchestrator/parallel-executor
 */

import type { EventEmitter } from 'events';
import type { TaskDocument } from '../workspace/task-document';
import type { WorkflowResult } from './orchestrator-runner';
import type {
  IAgentPool,
  IParallelExecutor,
  TaskNode,
  TaskGroup,
  TaskExecutorFn,
  ParallelExecutorConfig,
} from './interfaces/parallel.interface';
import { DEFAULT_PARALLEL_CONCURRENCY, DEFAULT_TASK_TIMEOUT_MS } from './constants';

/**
 * Parallel Executor
 *
 * Analyzes task dependencies, groups independent tasks, and executes batches
 * using Promise.allSettled for fault isolation.
 */

/** Internal resolved configuration with required scalar fields */
interface ResolvedParallelConfig {
  maxConcurrency: number;
  taskTimeout: number;
  failFast: boolean;
  agentPool?: IAgentPool;
  emitter?: EventEmitter;
}

export class ParallelExecutor implements IParallelExecutor {
  private config: ResolvedParallelConfig;

  constructor(config?: ParallelExecutorConfig) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? DEFAULT_PARALLEL_CONCURRENCY,
      taskTimeout: config?.taskTimeout ?? DEFAULT_TASK_TIMEOUT_MS,
      failFast: config?.failFast ?? false,
      agentPool: config?.agentPool,
      emitter: config?.emitter,
    };
  }

  async execute(
    tasks: TaskDocument[],
    executor: { executeTask: TaskExecutorFn },
  ): Promise<WorkflowResult[]> {
    if (tasks.length === 0) return [];

    // For simple case (no explicit dependencies), batch by maxConcurrency
    const nodes: TaskNode[] = tasks.map((task) => ({
      task,
      dependsOn: this.extractDependencies(task),
    }));

    const groups = this.buildGroups(nodes);
    const allResults: WorkflowResult[] = [];

    for (const group of groups) {
      this.config.emitter?.emit('parallel:batch-start', {
        groupId: group.groupId,
        taskCount: group.tasks.length,
      });
      const batchStart = Date.now();

      const batchResults = await this.executeBatch(group.tasks, executor.executeTask);
      allResults.push(...batchResults);

      this.config.emitter?.emit('parallel:batch-complete', {
        groupId: group.groupId,
        results: batchResults.length,
        duration: Date.now() - batchStart,
      });

      if (this.config.failFast && batchResults.some((r) => !r.success)) {
        // Mark remaining tasks as failed
        const remaining = groups
          .slice(groups.indexOf(group) + 1)
          .flatMap((g) => g.tasks);
        for (const task of remaining) {
          allResults.push({
            success: false,
            taskId: task.metadata.id,
            error: 'Skipped due to fail-fast',
            duration: 0,
            teamType: task.metadata.to,
          });
        }
        break;
      }
    }

    return allResults;
  }

  buildGroups(nodes: TaskNode[]): TaskGroup[] {
    const groups: TaskGroup[] = [];
    const completed = new Set<string>();
    let remaining = [...nodes];
    let groupIndex = 0;

    while (remaining.length > 0) {
      // Find tasks whose dependencies are all completed
      const ready = remaining.filter((n) =>
        n.dependsOn.every((dep) => completed.has(dep)),
      );

      if (ready.length === 0) {
        // Circular dependency or missing deps - force execute remaining
        ready.push(...remaining);
        remaining = [];
      } else {
        const readySet = new Set(ready);
        remaining = remaining.filter((n) => !readySet.has(n));
      }

      // Split ready tasks into chunks respecting maxConcurrency
      for (let i = 0; i < ready.length; i += this.config.maxConcurrency) {
        const chunk = ready.slice(i, i + this.config.maxConcurrency);
        groups.push({
          groupId: `group-${groupIndex++}`,
          tasks: chunk.map((n) => n.task),
          dependsOnGroups: groupIndex > 1 ? [`group-${groupIndex - 2}`] : [],
        });
      }

      for (const node of ready) {
        completed.add(node.task.metadata.id);
      }
    }

    return groups;
  }

  private async executeBatch(
    tasks: TaskDocument[],
    executorFn: TaskExecutorFn,
  ): Promise<WorkflowResult[]> {
    const promises = tasks.map(async (task) => {
      const provider = (task.metadata.extra?.['provider'] as string | undefined) ?? 'default';
      const taskId = task.metadata.id;

      if (this.config.agentPool) {
        await this.config.agentPool.acquire(provider);
        this.config.emitter?.emit('pool:acquired', { provider, taskId });
      }
      try {
        return await this.executeWithTimeout(task, executorFn);
      } finally {
        if (this.config.agentPool) {
          this.config.agentPool.release(provider);
          this.config.emitter?.emit('pool:released', { provider, taskId });
        }
      }
    });
    const settled = await Promise.allSettled(promises);

    return settled.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        taskId: tasks[i].metadata.id,
        error: result.reason?.message ?? 'Unknown error',
        duration: 0,
        teamType: tasks[i].metadata.to,
      };
    });
  }

  private executeWithTimeout(
    task: TaskDocument,
    executorFn: TaskExecutorFn,
  ): Promise<WorkflowResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task ${task.metadata.id} timed out after ${this.config.taskTimeout}ms`));
      }, this.config.taskTimeout);

      executorFn(task)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private extractDependencies(task: TaskDocument): string[] {
    const deps: string[] = [];
    if (task.metadata.dependencies) {
      for (const dep of task.metadata.dependencies) {
        if (typeof dep === 'object' && dep.taskId) {
          deps.push(dep.taskId);
        }
      }
    }
    return deps;
  }
}

/**
 * Create a parallel executor
 */
export function createParallelExecutor(config?: ParallelExecutorConfig): ParallelExecutor {
  return new ParallelExecutor(config);
}
