/**
 * Tests for TaskTracker TUI Component
 */

import { TaskTracker, createTaskTracker } from '@/ui/tui/components/task-tracker';
import type { TaskProgress } from '@/ui/tui/interfaces/tui.interface';

function makeTask(overrides: Partial<TaskProgress> = {}): TaskProgress {
  return {
    taskId: 'task-1',
    name: 'Build feature',
    status: 'running',
    progress: 50,
    ...overrides,
  };
}

describe('TaskTracker', () => {
  it('should render with no tasks', () => {
    const tracker = new TaskTracker();
    const output = tracker.render();

    expect(output.lines[0]).toBe('=== Task Progress ===');
    expect(output.lines[1]).toBe('  No tasks');
    expect(output.height).toBe(2);
  });

  it('should render with tasks', () => {
    const tracker = new TaskTracker();
    tracker.update([
      makeTask({ taskId: 't1', name: 'Auth module', status: 'completed', progress: 100 }),
      makeTask({ taskId: 't2', name: 'API layer', status: 'running', progress: 60 }),
    ]);
    const output = tracker.render();

    expect(output.lines[0]).toBe('=== Task Progress ===');
    expect(output.lines.length).toBe(3); // header + 2 tasks
    expect(output.lines[1]).toContain('Auth module');
    expect(output.lines[1]).toContain('100%');
    expect(output.lines[2]).toContain('API layer');
    expect(output.lines[2]).toContain('60%');
  });

  it('should render progress bar correctly', () => {
    const tracker = new TaskTracker();
    tracker.update([makeTask({ progress: 50 })]);
    const output = tracker.render();

    // 50% of 20 chars = 10 filled + 10 empty
    expect(output.lines[1]).toContain('[');
    expect(output.lines[1]).toContain(']');
  });

  it('should update a single task by taskId', () => {
    const tracker = new TaskTracker();
    tracker.update(makeTask({ taskId: 't1', name: 'Task A', progress: 30 }));
    tracker.update(makeTask({ taskId: 't2', name: 'Task B', progress: 60 }));
    expect(tracker.getTotalCount()).toBe(2);

    // Update existing task
    tracker.update(makeTask({ taskId: 't1', name: 'Task A', progress: 80 }));
    expect(tracker.getTotalCount()).toBe(2);

    const tasks = tracker.getTasks();
    const t1 = tasks.find(t => t.taskId === 't1');
    expect(t1?.progress).toBe(80);
  });

  it('should track completed count', () => {
    const tracker = new TaskTracker();
    tracker.update([
      makeTask({ taskId: 't1', status: 'completed' }),
      makeTask({ taskId: 't2', status: 'running' }),
      makeTask({ taskId: 't3', status: 'completed' }),
    ]);

    expect(tracker.getCompletedCount()).toBe(2);
    expect(tracker.getTotalCount()).toBe(3);
  });

  it('should render errors on failed tasks', () => {
    const tracker = new TaskTracker();
    tracker.update([makeTask({ status: 'failed', error: 'Timeout exceeded' })]);
    const output = tracker.render();

    const errorLine = output.lines.find(l => l.includes('Error:'));
    expect(errorLine).toBeDefined();
    expect(errorLine).toContain('Timeout exceeded');
  });

  it('should filter completed tasks when showCompleted is false', () => {
    const tracker = new TaskTracker({ showCompleted: false });
    tracker.update([
      makeTask({ taskId: 't1', status: 'completed', name: 'Done task' }),
      makeTask({ taskId: 't2', status: 'running', name: 'Active task' }),
    ]);
    const output = tracker.render();

    const hasCompleted = output.lines.some(l => l.includes('Done task'));
    const hasActive = output.lines.some(l => l.includes('Active task'));
    expect(hasCompleted).toBe(false);
    expect(hasActive).toBe(true);
  });

  it('should destroy and clear tasks', () => {
    const tracker = new TaskTracker();
    tracker.update([makeTask()]);
    expect(tracker.getTotalCount()).toBe(1);

    tracker.destroy();
    expect(tracker.getTotalCount()).toBe(0);
  });

  it('should be created via factory function', () => {
    const tracker = createTaskTracker({ maxTasks: 5 });
    expect(tracker).toBeInstanceOf(TaskTracker);
    expect(tracker.type).toBe('task-tracker');
  });
});
