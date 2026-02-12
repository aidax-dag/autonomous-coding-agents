/**
 * Cost Display Component
 * Shows real-time token/cost information.
 * @module ui/tui/components
 */

import type { ITUIComponent, TUIRenderOutput, CostSummary, CostBreakdownEntry } from '../interfaces/tui.interface';

export interface CostDisplayOptions {
  currency?: string;
  showBreakdown?: boolean;
}

export class CostDisplay implements ITUIComponent {
  readonly type = 'cost-display' as const;
  private summary: CostSummary;
  private readonly showBreakdown: boolean;

  constructor(options?: CostDisplayOptions) {
    this.showBreakdown = options?.showBreakdown ?? true;
    this.summary = {
      totalTokens: 0,
      totalCost: 0,
      currency: options?.currency ?? 'USD',
      breakdown: [],
    };
  }

  update(data: unknown): void {
    if (data && typeof data === 'object' && 'totalTokens' in (data as CostSummary)) {
      this.summary = data as CostSummary;
    }
  }

  render(): TUIRenderOutput {
    const lines: string[] = ['=== Cost Summary ==='];
    lines.push(`  Tokens: ${this.formatNumber(this.summary.totalTokens)}`);
    lines.push(`  Cost:   ${this.summary.currency} ${this.summary.totalCost.toFixed(4)}`);

    if (this.showBreakdown && this.summary.breakdown.length > 0) {
      lines.push('  Breakdown:');
      for (const entry of this.summary.breakdown) {
        lines.push(`    ${entry.model}: ${this.formatNumber(entry.tokens)} tokens ($${entry.cost.toFixed(4)})`);
      }
    }
    const width = Math.max(...lines.map(l => l.length));
    return { lines, width, height: lines.length };
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  getSummary(): CostSummary {
    return { ...this.summary, breakdown: [...this.summary.breakdown] };
  }

  addCost(entry: CostBreakdownEntry): void {
    const existing = this.summary.breakdown.find(b => b.model === entry.model);
    if (existing) {
      existing.tokens += entry.tokens;
      existing.cost += entry.cost;
    } else {
      this.summary.breakdown.push({ ...entry });
    }
    this.summary.totalTokens += entry.tokens;
    this.summary.totalCost += entry.cost;
  }

  destroy(): void {
    this.summary = { totalTokens: 0, totalCost: 0, currency: this.summary.currency, breakdown: [] };
  }
}

export function createCostDisplay(options?: CostDisplayOptions): CostDisplay {
  return new CostDisplay(options);
}
