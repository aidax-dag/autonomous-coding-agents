/**
 * Task Tracker Component
 * Displays task progress tracking.
 * @module ui/tui/components
 */

import type { ITUIComponent, TUIRenderOutput, TaskProgress } from '../interfaces/tui.interface';

export interface TaskTrackerOptions {
  maxTasks?: number;
  showCompleted?: boolean;
}

export class TaskTracker implements ITUIComponent {
  readonly type = 'task-tracker' as const;
  private tasks: TaskProgress[] = [];
  private readonly maxTasks: number;
  private readonly showCompleted: boolean;

  constructor(options?: TaskTrackerOptions) {
    this.maxTasks = options?.maxTasks ?? 20;
    this.showCompleted = options?.showCompleted ?? true;
  }

  update(data: unknown): void {
    if (Array.isArray(data)) {
      this.tasks = (data as TaskProgress[]).slice(0, this.maxTasks);
    } else if (data && typeof data === 'object' && 'taskId' in (data as TaskProgress)) {
      const task = data as TaskProgress;
      const idx = this.tasks.findIndex(t => t.taskId === task.taskId);
      if (idx >= 0) {
        this.tasks[idx] = task;
      } else if (this.tasks.length < this.maxTasks) {
        this.tasks.push(task);
      }
    }
  }

  render(): TUIRenderOutput {
    const lines: string[] = ['=== Task Progress ==='];
    const visible = this.showCompleted
      ? this.tasks
      : this.tasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');

    if (visible.length === 0) {
      lines.push('  No tasks');
    } else {
      for (const task of visible) {
        const icon = this.getStatusIcon(task.status);
        const bar = this.renderProgressBar(task.progress);
        lines.push(`  ${icon} ${task.name} ${bar} ${task.progress}%`);
        if (task.error) {
          lines.push(`    \u2514\u2500 Error: ${task.error}`);
        }
      }
    }
    const width = Math.max(...lines.map(l => l.length));
    return { lines, width, height: lines.length };
  }

  private getStatusIcon(status: TaskProgress['status']): string {
    const icons: Record<TaskProgress['status'], string> = {
      pending: '\u25CB',
      running: '\u25CF',
      completed: '\u2713',
      failed: '\u2717',
      skipped: '\u2298',
    };
    return icons[status] ?? '?';
  }

  private renderProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  getTasks(): TaskProgress[] {
    return [...this.tasks];
  }

  getCompletedCount(): number {
    return this.tasks.filter(t => t.status === 'completed').length;
  }

  getTotalCount(): number {
    return this.tasks.length;
  }

  destroy(): void {
    this.tasks = [];
  }
}

export function createTaskTracker(options?: TaskTrackerOptions): TaskTracker {
  return new TaskTracker(options);
}
