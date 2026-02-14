/**
 * Tests for Ink TaskTracker component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { TaskTracker } from '@/ui/tui/ink/components/TaskTracker';
import type { TaskProgress } from '@/ui/tui/interfaces/tui.interface';

function makeTask(overrides: Partial<TaskProgress> = {}): TaskProgress {
  return {
    taskId: 'task-1',
    name: 'Test task',
    status: 'running',
    progress: 40,
    ...overrides,
  };
}

describe('Ink TaskTracker', () => {
  it('should render header', () => {
    const { lastFrame } = render(React.createElement(TaskTracker, { tasks: [] }));
    expect(lastFrame()).toContain('=== Task Progress ===');
  });

  it('should show "No tasks" when empty', () => {
    const { lastFrame } = render(React.createElement(TaskTracker, { tasks: [] }));
    expect(lastFrame()).toContain('No tasks');
  });

  it('should render tasks with progress bars', () => {
    const tasks = [
      makeTask({ taskId: 't1', name: 'Build API', progress: 60, status: 'running' }),
      makeTask({ taskId: 't2', name: 'Write tests', progress: 100, status: 'completed' }),
    ];
    const { lastFrame } = render(React.createElement(TaskTracker, { tasks }));
    const frame = lastFrame()!;

    expect(frame).toContain('Build API');
    expect(frame).toContain('60%');
    expect(frame).toContain('Write tests');
    expect(frame).toContain('100%');
    expect(frame).toContain('\u25CF'); // running icon
    expect(frame).toContain('\u2713'); // completed icon
  });

  it('should display task errors', () => {
    const tasks = [
      makeTask({ taskId: 't1', name: 'Failing task', status: 'failed', error: 'Timeout exceeded' }),
    ];
    const { lastFrame } = render(React.createElement(TaskTracker, { tasks }));
    const frame = lastFrame()!;

    expect(frame).toContain('Timeout exceeded');
    expect(frame).toContain('\u2717'); // failed icon
  });

  it('should filter completed tasks when showCompleted=false', () => {
    const tasks = [
      makeTask({ taskId: 't1', name: 'Done task', status: 'completed' }),
      makeTask({ taskId: 't2', name: 'Active task', status: 'running' }),
    ];
    const { lastFrame } = render(
      React.createElement(TaskTracker, { tasks, showCompleted: false }),
    );
    const frame = lastFrame()!;

    expect(frame).not.toContain('Done task');
    expect(frame).toContain('Active task');
  });
});
