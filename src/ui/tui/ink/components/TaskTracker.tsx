/**
 * Task Tracker — Ink component displaying task progress.
 * Preserves the exact output format of the class-based TaskTracker.
 * @module ui/tui/ink/components
 */

import { Box, Text } from 'ink';
import type { TaskProgress } from '../../interfaces/tui.interface';

const STATUS_ICONS: Record<TaskProgress['status'], string> = {
  pending: '\u25CB',
  running: '\u25CF',
  completed: '\u2713',
  failed: '\u2717',
  skipped: '\u2298',
};

function renderProgressBar(progress: number): string {
  const width = 20;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

export interface TaskTrackerProps {
  tasks: TaskProgress[];
  showCompleted?: boolean;
}

export function TaskTracker({ tasks, showCompleted = true }: TaskTrackerProps) {
  const visible = showCompleted
    ? tasks
    : tasks.filter((t) => t.status !== 'completed' && t.status !== 'skipped');

  return (
    <Box flexDirection="column">
      <Text bold>{'=== Task Progress ==='}</Text>
      {visible.length === 0 ? (
        <Text dimColor>{'  No tasks'}</Text>
      ) : (
        visible.map((task) => (
          <Box key={task.taskId} flexDirection="column">
            <Text>
              {`  ${STATUS_ICONS[task.status] ?? '?'} ${task.name} ${renderProgressBar(task.progress)} ${task.progress}%`}
            </Text>
            {task.error && (
              <Text color="red">{`    └─ Error: ${task.error}`}</Text>
            )}
          </Box>
        ))
      )}
    </Box>
  );
}
