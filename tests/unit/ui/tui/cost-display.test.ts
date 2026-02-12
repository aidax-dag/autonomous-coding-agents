/**
 * Tests for CostDisplay TUI Component
 */

import { CostDisplay, createCostDisplay } from '@/ui/tui/components/cost-display';
import type { CostSummary } from '@/ui/tui/interfaces/tui.interface';

describe('CostDisplay', () => {
  it('should render empty state', () => {
    const display = new CostDisplay();
    const output = display.render();

    expect(output.lines[0]).toBe('=== Cost Summary ===');
    expect(output.lines[1]).toContain('Tokens: 0');
    expect(output.lines[2]).toContain('Cost:');
    expect(output.lines[2]).toContain('USD');
    expect(output.lines[2]).toContain('0.0000');
  });

  it('should update with a cost summary', () => {
    const display = new CostDisplay();
    const summary: CostSummary = {
      totalTokens: 15000,
      totalCost: 0.0325,
      currency: 'USD',
      breakdown: [
        { model: 'claude-3-opus', tokens: 10000, cost: 0.025 },
        { model: 'claude-3-haiku', tokens: 5000, cost: 0.0075 },
      ],
    };
    display.update(summary);
    const output = display.render();

    expect(output.lines[1]).toContain('15.0K');
    expect(output.lines[2]).toContain('0.0325');
    expect(output.lines.some(l => l.includes('claude-3-opus'))).toBe(true);
    expect(output.lines.some(l => l.includes('claude-3-haiku'))).toBe(true);
  });

  it('should aggregate costs via addCost', () => {
    const display = new CostDisplay();
    display.addCost({ model: 'gpt-4', tokens: 1000, cost: 0.01 });
    display.addCost({ model: 'gpt-4', tokens: 2000, cost: 0.02 });
    display.addCost({ model: 'claude', tokens: 500, cost: 0.005 });

    const summary = display.getSummary();
    expect(summary.totalTokens).toBe(3500);
    expect(summary.totalCost).toBeCloseTo(0.035);
    expect(summary.breakdown).toHaveLength(2);

    const gpt4 = summary.breakdown.find(b => b.model === 'gpt-4');
    expect(gpt4?.tokens).toBe(3000);
    expect(gpt4?.cost).toBeCloseTo(0.03);
  });

  it('should format numbers correctly', () => {
    const display = new CostDisplay();
    display.update({
      totalTokens: 2_500_000,
      totalCost: 5.25,
      currency: 'USD',
      breakdown: [],
    } as CostSummary);
    const output = display.render();

    expect(output.lines[1]).toContain('2.5M');
  });

  it('should hide breakdown when showBreakdown is false', () => {
    const display = new CostDisplay({ showBreakdown: false });
    display.update({
      totalTokens: 1000,
      totalCost: 0.01,
      currency: 'USD',
      breakdown: [{ model: 'test-model', tokens: 1000, cost: 0.01 }],
    } as CostSummary);
    const output = display.render();

    const hasModel = output.lines.some(l => l.includes('test-model'));
    expect(hasModel).toBe(false);
  });

  it('should destroy and reset', () => {
    const display = new CostDisplay({ currency: 'EUR' });
    display.addCost({ model: 'test', tokens: 1000, cost: 0.01 });
    display.destroy();

    const summary = display.getSummary();
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.currency).toBe('EUR');
    expect(summary.breakdown).toHaveLength(0);
  });

  it('should be created via factory function', () => {
    const display = createCostDisplay({ currency: 'EUR' });
    expect(display).toBeInstanceOf(CostDisplay);
    expect(display.type).toBe('cost-display');
  });
});
