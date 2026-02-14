/**
 * TUIApp — Ink root component for live terminal UI dashboard.
 * Composes all sub-panels using React hooks for ACP MessageBus subscriptions.
 * @module ui/tui/ink
 */

import { Box } from 'ink';
import type { IACPMessageBus } from '@/core/protocols';
import { useAgentStatus, useTaskProgress, useCostSummary, useLogStream } from './hooks';
import { AgentPanel, TaskTracker, CostDisplay, LogViewer } from './components';

export interface TUIAppProps {
  messageBus: IACPMessageBus;
}

export function TUIApp({ messageBus }: TUIAppProps) {
  const agents = useAgentStatus(messageBus);
  const tasks = useTaskProgress(messageBus);
  const costSummary = useCostSummary(messageBus);
  const logs = useLogStream(messageBus);

  return (
    <Box flexDirection="column" paddingX={1}>
      <AgentPanel agents={agents} />
      <TaskTracker tasks={tasks} />
      <CostDisplay summary={costSummary} />
      <LogViewer entries={logs} />
    </Box>
  );
}
