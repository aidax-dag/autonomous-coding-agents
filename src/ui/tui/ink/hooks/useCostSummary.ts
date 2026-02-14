/**
 * React hook for aggregating cost data from ACP message bus.
 * Listens to agent:event messages containing cost information.
 * @module ui/tui/ink/hooks
 */

import { useState, useEffect } from 'react';
import type { IACPMessageBus, ACPMessage } from '@/core/protocols';
import type { CostSummary, CostBreakdownEntry } from '../../interfaces/tui.interface';

const INITIAL_SUMMARY: CostSummary = {
  totalTokens: 0,
  totalCost: 0,
  currency: 'USD',
  breakdown: [],
};

export function useCostSummary(messageBus: IACPMessageBus): CostSummary {
  const [summary, setSummary] = useState<CostSummary>(INITIAL_SUMMARY);

  useEffect(() => {
    const sub = messageBus.on('agent:event', async (msg: ACPMessage) => {
      const payload = msg.payload as Record<string, unknown>;
      if (payload.event !== 'cost:update') return;

      const entry = payload.cost as CostBreakdownEntry | undefined;
      if (!entry) return;

      setSummary((prev) => {
        const breakdown = [...prev.breakdown];
        const existing = breakdown.findIndex((b) => b.model === entry.model);
        if (existing >= 0) {
          breakdown[existing] = {
            model: entry.model,
            tokens: breakdown[existing].tokens + entry.tokens,
            cost: breakdown[existing].cost + entry.cost,
          };
        } else {
          breakdown.push({ ...entry });
        }
        return {
          totalTokens: prev.totalTokens + entry.tokens,
          totalCost: prev.totalCost + entry.cost,
          currency: prev.currency,
          breakdown,
        };
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [messageBus]);

  return summary;
}
