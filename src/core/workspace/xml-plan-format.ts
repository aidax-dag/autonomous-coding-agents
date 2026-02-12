/**
 * XML Plan Format
 *
 * Parses XML-based execution plans for verification.
 *
 * @module core/workspace/xml-plan-format
 */

/**
 * Parsed plan step
 */
export interface PlanStep {
  id: string;
  action: string;
  target: string;
  description?: string;
  expectedFiles?: string[];
}

/**
 * Parsed plan
 */
export interface ParsedPlan {
  title: string;
  steps: PlanStep[];
  expectedPaths: string[];
}

/**
 * Parse a simple XML plan format
 *
 * Expected format:
 * ```xml
 * <plan title="Feature Name">
 *   <step id="1" action="create" target="src/module.ts">Description</step>
 *   <step id="2" action="modify" target="src/index.ts">Update exports</step>
 * </plan>
 * ```
 */
export function parseXMLPlan(xml: string): ParsedPlan {
  const titleMatch = xml.match(/<plan\s+title="([^"]*)">/);
  const title = titleMatch?.[1] ?? 'Unnamed Plan';

  const steps: PlanStep[] = [];
  const stepRegex = /<step\s+id="([^"]*)"\s+action="([^"]*)"\s+target="([^"]*)">(.*?)<\/step>/gs;
  let match;

  while ((match = stepRegex.exec(xml)) !== null) {
    steps.push({
      id: match[1],
      action: match[2],
      target: match[3],
      description: match[4].trim(),
      expectedFiles: [match[3]],
    });
  }

  const expectedPaths = [...new Set(steps.flatMap((s) => s.expectedFiles ?? []))];

  return { title, steps, expectedPaths };
}

/**
 * Validate XML plan structure
 */
export function validateXMLPlan(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!xml.includes('<plan')) {
    errors.push('Missing <plan> root element');
  }

  if (!xml.includes('<step')) {
    errors.push('No <step> elements found');
  }

  const unclosed = (xml.match(/<step\b/g)?.length ?? 0) - (xml.match(/<\/step>/g)?.length ?? 0);
  if (unclosed !== 0) {
    errors.push(`Unclosed <step> elements: ${Math.abs(unclosed)}`);
  }

  return { valid: errors.length === 0, errors };
}
