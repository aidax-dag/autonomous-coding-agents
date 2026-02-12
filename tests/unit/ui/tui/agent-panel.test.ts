/**
 * Tests for AgentPanel TUI Component
 */

import { AgentPanel, createAgentPanel } from '@/ui/tui/components/agent-panel';
import type { AgentHUDStatus } from '@/core/hud';

function makeAgent(overrides: Partial<AgentHUDStatus> = {}): AgentHUDStatus {
  return {
    agentId: 'agent-1',
    agentType: 'coder',
    state: 'working',
    currentTask: 'Implement feature',
    progress: 50,
    tokensUsed: 1000,
    elapsedMs: 5000,
    updatedAt: '2026-02-13T12:00:00Z',
    ...overrides,
  };
}

describe('AgentPanel', () => {
  it('should render with no agents', () => {
    const panel = new AgentPanel();
    const output = panel.render();

    expect(output.lines[0]).toBe('=== Agent Status ===');
    expect(output.lines[1]).toBe('  No active agents');
    expect(output.height).toBe(2);
    expect(output.width).toBeGreaterThan(0);
  });

  it('should render with agents', () => {
    const panel = new AgentPanel();
    const agents: AgentHUDStatus[] = [
      makeAgent({ agentId: 'agent-1', state: 'working', progress: 75, currentTask: 'Build auth' }),
      makeAgent({ agentId: 'agent-2', state: 'idle', progress: 0, currentTask: undefined }),
    ];
    panel.update(agents);
    const output = panel.render();

    expect(output.lines[0]).toBe('=== Agent Status ===');
    expect(output.lines.length).toBe(3); // header + 2 agents
    expect(output.lines[1]).toContain('agent-1');
    expect(output.lines[1]).toContain('[75%]');
    expect(output.lines[1]).toContain('Build auth');
    expect(output.lines[2]).toContain('agent-2');
    expect(output.lines[2]).not.toContain('[0%]'); // progress 0 should not show
  });

  it('should update agents', () => {
    const panel = new AgentPanel();
    panel.update([makeAgent({ agentId: 'a1' })]);
    expect(panel.getAgents()).toHaveLength(1);

    panel.update([makeAgent({ agentId: 'a1' }), makeAgent({ agentId: 'a2' })]);
    expect(panel.getAgents()).toHaveLength(2);
  });

  it('should display state icons correctly', () => {
    const panel = new AgentPanel();
    const states: AgentHUDStatus['state'][] = ['idle', 'working', 'blocked', 'error', 'completed'];
    const agents = states.map((state, i) =>
      makeAgent({ agentId: `agent-${i}`, state, progress: 10 }),
    );
    panel.update(agents);
    const output = panel.render();

    // Each agent line should contain the state icon
    expect(output.lines[1]).toContain('\u25CB'); // idle
    expect(output.lines[2]).toContain('\u25CF'); // working
    expect(output.lines[3]).toContain('\u25D0'); // blocked
    expect(output.lines[4]).toContain('\u2717'); // error
    expect(output.lines[5]).toContain('\u2713'); // completed
  });

  it('should respect maxAgents limit', () => {
    const panel = new AgentPanel({ maxAgents: 2 });
    const agents = Array.from({ length: 5 }, (_, i) =>
      makeAgent({ agentId: `agent-${i}` }),
    );
    panel.update(agents);

    expect(panel.getAgents()).toHaveLength(2);
  });

  it('should destroy and clear agents', () => {
    const panel = new AgentPanel();
    panel.update([makeAgent()]);
    expect(panel.getAgents()).toHaveLength(1);

    panel.destroy();
    expect(panel.getAgents()).toHaveLength(0);
  });

  it('should be created via factory function', () => {
    const panel = createAgentPanel({ maxAgents: 5 });
    expect(panel).toBeInstanceOf(AgentPanel);
    expect(panel.type).toBe('agent-panel');
  });
});
