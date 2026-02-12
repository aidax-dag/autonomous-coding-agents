/**
 * Agent Status Hook
 * Subscribes to agent status updates via ACP message bus.
 * @module ui/tui/hooks
 */

import type { IACPMessageBus, ACPSubscription, ACPMessage } from '@/core/protocols';
import type { AgentHUDStatus } from '@/core/hud';

export interface AgentStatusState {
  agents: Map<string, AgentHUDStatus>;
  lastUpdate: string | null;
}

export class AgentStatusHook {
  private state: AgentStatusState = { agents: new Map(), lastUpdate: null };
  private subscription: ACPSubscription | null = null;
  private readonly listeners: Set<(state: AgentStatusState) => void> = new Set();

  constructor(private readonly messageBus: IACPMessageBus) {}

  connect(): void {
    if (this.subscription) return;
    this.subscription = this.messageBus.on('agent:status', async (msg: ACPMessage) => {
      const payload = msg.payload as { agentId: string } & Partial<AgentHUDStatus>;
      if (payload.agentId) {
        const existing = this.state.agents.get(payload.agentId);
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
        this.state.agents.set(payload.agentId, updated);
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

  getState(): AgentStatusState {
    return {
      agents: new Map(this.state.agents),
      lastUpdate: this.state.lastUpdate,
    };
  }

  getAgentList(): AgentHUDStatus[] {
    return Array.from(this.state.agents.values());
  }

  onChange(listener: (state: AgentStatusState) => void): () => void {
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

export function createAgentStatusHook(messageBus: IACPMessageBus): AgentStatusHook {
  return new AgentStatusHook(messageBus);
}
