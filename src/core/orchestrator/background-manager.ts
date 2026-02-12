/**
 * Background Manager
 *
 * Manages background task lifecycle: launch, cancel, and await completion.
 *
 * @module core/orchestrator/background-manager
 */

import type { WorkflowResult } from './orchestrator-runner';
import type { BackgroundTaskHandle } from './interfaces/parallel.interface';

/**
 * Background Manager
 *
 * Tracks background tasks and provides lifecycle control.
 */
export class BackgroundManager {
  private tasks: Map<string, BackgroundTaskHandle> = new Map();
  private idCounter = 0;

  launch(
    taskFn: () => Promise<WorkflowResult>,
    id?: string,
  ): BackgroundTaskHandle {
    const taskId = id ?? `bg-${++this.idCounter}`;
    let cancelled = false;

    const handle: BackgroundTaskHandle = {
      id: taskId,
      promise: taskFn().then(
        (result) => {
          if (!cancelled) handle.status = 'completed';
          return result;
        },
        (error) => {
          if (!cancelled) handle.status = 'failed';
          throw error;
        },
      ),
      cancel: () => {
        cancelled = true;
        handle.status = 'cancelled';
      },
      status: 'running',
    };

    this.tasks.set(taskId, handle);
    return handle;
  }

  cancel(taskId: string): boolean {
    const handle = this.tasks.get(taskId);
    if (!handle || handle.status !== 'running') return false;
    handle.cancel();
    return true;
  }

  cancelAll(): void {
    for (const handle of this.tasks.values()) {
      if (handle.status === 'running') {
        handle.cancel();
      }
    }
  }

  async awaitAll(): Promise<Map<string, WorkflowResult | Error>> {
    const results = new Map<string, WorkflowResult | Error>();

    for (const [id, handle] of this.tasks) {
      try {
        const result = await handle.promise;
        results.set(id, result);
      } catch (error) {
        results.set(id, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return results;
  }

  get(taskId: string): BackgroundTaskHandle | undefined {
    return this.tasks.get(taskId);
  }

  getRunning(): BackgroundTaskHandle[] {
    return Array.from(this.tasks.values()).filter((h) => h.status === 'running');
  }

  count(): number {
    return this.tasks.size;
  }

  clear(): void {
    this.cancelAll();
    this.tasks.clear();
  }
}

/**
 * Create a background manager
 */
export function createBackgroundManager(): BackgroundManager {
  return new BackgroundManager();
}
