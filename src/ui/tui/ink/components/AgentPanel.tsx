/**
 * Agent Panel — Ink component displaying real-time agent status.
 * Preserves the exact output format of the class-based AgentPanel.
 * @module ui/tui/ink/components
 */

import { Box, Text } from 'ink';
import type { AgentHUDStatus } from '@/core/hud';

const ICONS: Record<AgentHUDStatus['state'], string> = {
  idle: '\u25CB',
  working: '\u25CF',
  blocked: '\u25D0',
  error: '\u2717',
  completed: '\u2713',
};

export function AgentPanel({ agents }: { agents: AgentHUDStatus[] }) {
  return (
    <Box flexDirection="column">
      <Text bold>{'=== Agent Status ==='}</Text>
      {agents.length === 0 ? (
        <Text dimColor>{'  No active agents'}</Text>
      ) : (
        agents.map((a) => (
          <Text key={a.agentId}>
            {`  ${ICONS[a.state] ?? '?'} ${a.agentId} (${a.agentType})${a.progress > 0 ? ` [${a.progress}%]` : ''}${a.currentTask ? ` - ${a.currentTask}` : ''}`}
          </Text>
        ))
      )}
    </Box>
  );
}
