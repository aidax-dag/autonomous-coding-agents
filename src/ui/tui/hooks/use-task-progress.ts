/**
 * Task Progress Hook
 * Subscribes to task progress updates via ACP message bus.
 * @module ui/tui/hooks
 */

import type { IACPMessageBus, ACPSubscription, ACPMessage } from '@/core/protocols';
import type { TaskProgress } from '../interfaces/tui.interface';

export interface TaskProgressState {
  tasks: Map<string, TaskProgress>;
  lastUpdate: string | null;
}

export class TaskProgressHook {
  private state: TaskProgressState = { tasks: new Map(), lastUpdate: null };
  private subscription: ACPSubscription | null = null;
  private readonly listeners: Set<(state: TaskProgressState) => void> = new Set();

  constructor(private readonly messageBus: IACPMessageBus) {}

  connect(): void {
    if (this.subscription) return;
    this.subscription = this.messageBus.on('task:status', async (msg: ACPMessage) => {
      const payload = msg.payload as { taskId: string } & Partial<TaskProgress>;
      if (payload.taskId) {
        const existing = this.state.tasks.get(payload.taskId);
        const updated: TaskProgress = {
          taskId: payload.taskId,
          name: payload.name ?? existing?.name ?? 'Unknown',
          status: payload.status ?? existing?.status ?? 'pending',
          progress: payload.progress ?? existing?.progress ?? 0,
          startedAt: payload.startedAt ?? existing?.startedAt,
          completedAt: payload.completedAt ?? existing?.completedAt,
          error: payload.error ?? existing?.error,
        };
        this.state.tasks.set(payload.taskId, updated);
        this.state.lastUpdate = msg.timestamp;
        this.notify();
      }
    });
  }

  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  getState(): TaskProgressState {
    return {
      tasks: new Map(this.state.tasks),
      lastUpdate: this.state.lastUpdate,
    };
  }

  getTaskList(): TaskProgress[] {
    return Array.from(this.state.tasks.values());
  }

  getCompletedCount(): number {
    let count = 0;
    for (const task of this.state.tasks.values()) {
      if (task.status === 'completed') count++;
    }
    return count;
  }

  getOverallProgress(): number {
    if (this.state.tasks.size === 0) return 0;
    let total = 0;
    for (const task of this.state.tasks.values()) {
      total += task.progress;
    }
    return Math.round(total / this.state.tasks.size);
  }

  onChange(listener: (state: TaskProgressState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  isConnected(): boolean {
    return this.subscription !== null;
  }
}

export function createTaskProgressHook(messageBus: IACPMessageBus): TaskProgressHook {
  return new TaskProgressHook(messageBus);
}
