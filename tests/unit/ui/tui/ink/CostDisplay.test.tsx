/**
 * Tests for Ink CostDisplay component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { CostDisplay } from '@/ui/tui/ink/components/CostDisplay';
import type { CostSummary } from '@/ui/tui/interfaces/tui.interface';

describe('Ink CostDisplay', () => {
  it('should render header and totals', () => {
    const summary: CostSummary = {
      totalTokens: 5000,
      totalCost: 0.0125,
      currency: 'USD',
      breakdown: [],
    };
    const { lastFrame } = render(React.createElement(CostDisplay, { summary }));
    const frame = lastFrame()!;

    expect(frame).toContain('=== Cost Summary ===');
    expect(frame).toContain('Tokens: 5.0K');
    expect(frame).toContain('USD 0.0125');
  });

  it('should render breakdown entries', () => {
    const summary: CostSummary = {
      totalTokens: 15000,
      totalCost: 0.05,
      currency: 'USD',
      breakdown: [
        { model: 'claude-opus', tokens: 10000, cost: 0.04 },
        { model: 'claude-haiku', tokens: 5000, cost: 0.01 },
      ],
    };
    const { lastFrame } = render(React.createElement(CostDisplay, { summary }));
    const frame = lastFrame()!;

    expect(frame).toContain('Breakdown:');
    expect(frame).toContain('claude-opus');
    expect(frame).toContain('10.0K tokens');
    expect(frame).toContain('claude-haiku');
  });

  it('should hide breakdown when showBreakdown=false', () => {
    const summary: CostSummary = {
      totalTokens: 1000,
      totalCost: 0.001,
      currency: 'USD',
      breakdown: [{ model: 'test-model', tokens: 1000, cost: 0.001 }],
    };
    const { lastFrame } = render(
      React.createElement(CostDisplay, { summary, showBreakdown: false }),
    );
    const frame = lastFrame()!;

    expect(frame).not.toContain('Breakdown:');
    expect(frame).not.toContain('test-model');
  });

  it('should format large token counts', () => {
    const summary: CostSummary = {
      totalTokens: 2_500_000,
      totalCost: 5.0,
      currency: 'USD',
      breakdown: [],
    };
    const { lastFrame } = render(React.createElement(CostDisplay, { summary }));
    expect(lastFrame()).toContain('2.5M');
  });
});
