/**
 * Agent Panel Component
 * Displays real-time agent status monitoring.
 * @module ui/tui/components
 */

import type { ITUIComponent, TUIRenderOutput } from '../interfaces/tui.interface';
import type { AgentHUDStatus } from '@/core/hud';

export interface AgentPanelOptions {
  maxAgents?: number;
}

export class AgentPanel implements ITUIComponent {
  readonly type = 'agent-panel' as const;
  private agents: AgentHUDStatus[] = [];
  private readonly maxAgents: number;

  constructor(options?: AgentPanelOptions) {
    this.maxAgents = options?.maxAgents ?? 10;
  }

  update(data: unknown): void {
    if (Array.isArray(data)) {
      this.agents = (data as AgentHUDStatus[]).slice(0, this.maxAgents);
    }
  }

  render(): TUIRenderOutput {
    const lines: string[] = ['=== Agent Status ==='];
    if (this.agents.length === 0) {
      lines.push('  No active agents');
    } else {
      for (const agent of this.agents) {
        const stateIcon = this.getStateIcon(agent.state);
        const progress = agent.progress > 0 ? ` [${agent.progress}%]` : '';
        const task = agent.currentTask ? ` - ${agent.currentTask}` : '';
        lines.push(`  ${stateIcon} ${agent.agentId} (${agent.agentType})${progress}${task}`);
      }
    }
    const width = Math.max(...lines.map(l => l.length));
    return { lines, width, height: lines.length };
  }

  private getStateIcon(state: AgentHUDStatus['state']): string {
    const icons: Record<AgentHUDStatus['state'], string> = {
      idle: '\u25CB',
      working: '\u25CF',
      blocked: '\u25D0',
      error: '\u2717',
      completed: '\u2713',
    };
    return icons[state] ?? '?';
  }

  getAgents(): AgentHUDStatus[] {
    return [...this.agents];
  }

  destroy(): void {
    this.agents = [];
  }
}

export function createAgentPanel(options?: AgentPanelOptions): AgentPanel {
  return new AgentPanel(options);
}
