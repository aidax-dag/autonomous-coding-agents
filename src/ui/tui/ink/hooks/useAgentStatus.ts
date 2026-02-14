/**
 * React hook for subscribing to agent status updates via ACP message bus.
 * Mirrors the merge logic of the class-based AgentStatusHook.
 * @module ui/tui/ink/hooks
 */

import { useState, useEffect } from 'react';
import type { IACPMessageBus, ACPMessage } from '@/core/protocols';
import type { AgentHUDStatus } from '@/core/hud';

export function useAgentStatus(messageBus: IACPMessageBus): AgentHUDStatus[] {
  const [agents, setAgents] = useState<Map<string, AgentHUDStatus>>(new Map());

  useEffect(() => {
    const sub = messageBus.on('agent:status', async (msg: ACPMessage) => {
      const payload = msg.payload as { agentId: string } & Partial<AgentHUDStatus>;
      if (!payload.agentId) return;

      setAgents((prev) => {
        const next = new Map(prev);
        const existing = next.get(payload.agentId);
        const updated: AgentHUDStatus = {
          agentId: payload.agentId,
          agentType: payload.agentType ?? existing?.agentType ?? 'unknown',
          state: payload.state ?? existing?.state ?? 'idle',
          currentTask: payload.currentTask ?? existing?.currentTask,
          progress: payload.progress ?? existing?.progress ?? 0,
          tokensUsed: payload.tokensUsed ?? existing?.tokensUsed ?? 0,
          elapsedMs: payload.elapsedMs ?? existing?.elapsedMs ?? 0,
          updatedAt: msg.timestamp,
        };
        next.set(payload.agentId, updated);
        return next;
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [messageBus]);

  return Array.from(agents.values());
}
