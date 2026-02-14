/**
 * Tests for Ink AgentPanel component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel } from '@/ui/tui/ink/components/AgentPanel';
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
    updatedAt: '2026-02-15T12:00:00Z',
    ...overrides,
  };
}

describe('Ink AgentPanel', () => {
  it('should render header', () => {
    const { lastFrame } = render(React.createElement(AgentPanel, { agents: [] }));
    expect(lastFrame()).toContain('=== Agent Status ===');
  });

  it('should show "No active agents" when empty', () => {
    const { lastFrame } = render(React.createElement(AgentPanel, { agents: [] }));
    expect(lastFrame()).toContain('No active agents');
  });

  it('should render agents with details', () => {
    const agents = [
      makeAgent({ agentId: 'agent-1', state: 'working', progress: 75, currentTask: 'Build auth' }),
      makeAgent({ agentId: 'agent-2', state: 'idle', progress: 0, currentTask: undefined }),
    ];
    const { lastFrame } = render(React.createElement(AgentPanel, { agents }));
    const frame = lastFrame()!;

    expect(frame).toContain('agent-1');
    expect(frame).toContain('[75%]');
    expect(frame).toContain('Build auth');
    expect(frame).toContain('agent-2');
    expect(frame).not.toContain('[0%]');
  });

  it('should display correct state icons', () => {
    const agents = [
      makeAgent({ agentId: 'a0', state: 'idle', progress: 10 }),
      makeAgent({ agentId: 'a1', state: 'working', progress: 10 }),
      makeAgent({ agentId: 'a2', state: 'blocked', progress: 10 }),
      makeAgent({ agentId: 'a3', state: 'error', progress: 10 }),
      makeAgent({ agentId: 'a4', state: 'completed', progress: 10 }),
    ];
    const { lastFrame } = render(React.createElement(AgentPanel, { agents }));
    const frame = lastFrame()!;

    expect(frame).toContain('\u25CB'); // idle
    expect(frame).toContain('\u25CF'); // working
    expect(frame).toContain('\u25D0'); // blocked
    expect(frame).toContain('\u2717'); // error
    expect(frame).toContain('\u2713'); // completed
  });
});
