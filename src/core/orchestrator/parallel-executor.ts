/**
 * Parallel Executor
 *
 * Builds dependency-aware task groups and executes them in parallel batches.
 *
 * @module core/orchestrator/parallel-executor
 */

import type { TaskDocument } from '../workspace/task-document';
import type { WorkflowResult } from './orchestrator-runner';
import type {
  IParallelExecutor,
  TaskNode,
  TaskGroup,
  TaskExecutorFn,
  ParallelExecutorConfig,
} from './interfaces/parallel.interface';

/**
 * Parallel Executor
 *
 * Analyzes task dependencies, groups independent tasks, and executes batches
 * using Promise.allSettled for fault isolation.
 */
export class ParallelExecutor implements IParallelExecutor {
  private config: Required<ParallelExecutorConfig>;

  constructor(config?: ParallelExecutorConfig) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 5,
      taskTimeout: config?.taskTimeout ?? 300000,
      failFast: config?.failFast ?? false,
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
      const batchResults = await this.executeBatch(group.tasks, executor.executeTask);
      allResults.push(...batchResults);

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
        remaining = remaining.filter((n) => !ready.includes(n));
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
    const promises = tasks.map((task) => this.executeWithTimeout(task, executorFn));
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
