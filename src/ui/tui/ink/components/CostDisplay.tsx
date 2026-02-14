/**
 * Cost Display — Ink component showing token/cost information.
 * Preserves the exact output format of the class-based CostDisplay.
 * @module ui/tui/ink/components
 */

import { Box, Text } from 'ink';
import type { CostSummary } from '../../interfaces/tui.interface';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export interface CostDisplayProps {
  summary: CostSummary;
  showBreakdown?: boolean;
}

export function CostDisplay({ summary, showBreakdown = true }: CostDisplayProps) {
  return (
    <Box flexDirection="column">
      <Text bold>{'=== Cost Summary ==='}</Text>
      <Text>{`  Tokens: ${formatNumber(summary.totalTokens)}`}</Text>
      <Text>{`  Cost:   ${summary.currency} ${summary.totalCost.toFixed(4)}`}</Text>
      {showBreakdown && summary.breakdown.length > 0 && (
        <>
          <Text>{'  Breakdown:'}</Text>
          {summary.breakdown.map((entry) => (
            <Text key={entry.model}>
              {`    ${entry.model}: ${formatNumber(entry.tokens)} tokens ($${entry.cost.toFixed(4)})`}
            </Text>
          ))}
        </>
      )}
    </Box>
  );
}
