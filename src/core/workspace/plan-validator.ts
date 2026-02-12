/**
 * Plan Validator
 *
 * Converts XML plans to GoalDefinitions and validates them.
 *
 * @module core/workspace/plan-validator
 */

import type { GoalDefinition } from '../validation/interfaces/validation.interface';
import { parseXMLPlan, validateXMLPlan, type ParsedPlan } from './xml-plan-format';

/**
 * Convert a parsed plan to a GoalDefinition for verification
 */
export function planToGoalDefinition(plan: ParsedPlan): GoalDefinition {
  return {
    description: plan.title,
    expectedPaths: plan.expectedPaths,
    expectedConnections: plan.steps
      .filter((s) => s.action === 'modify')
      .map((s) => s.target),
    expectedTests: plan.steps
      .filter((s) => s.target.includes('test'))
      .map((s) => s.target),
  };
}

/**
 * Parse XML plan and convert to GoalDefinition
 */
export function parseAndConvertPlan(
  xml: string,
): { goal: GoalDefinition; errors: string[] } {
  const validation = validateXMLPlan(xml);
  if (!validation.valid) {
    return {
      goal: { description: '', expectedPaths: [] },
      errors: validation.errors,
    };
  }

  const plan = parseXMLPlan(xml);
  return {
    goal: planToGoalDefinition(plan),
    errors: [],
  };
}
