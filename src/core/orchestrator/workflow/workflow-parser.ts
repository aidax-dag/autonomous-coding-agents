/**
 * Workflow Parser
 *
 * Parses YAML workflow definitions and validates them.
 *
 * Feature: Workflow Engine for Agent OS
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  WorkflowDefinition,
  validateWorkflowDefinition,
  validateDependencies,
  detectCircularDependencies,
} from './workflow-schema';
import { createLogger, ILogger } from '../../services/logger.js';

/**
 * Module-level logger
 */
const logger: ILogger = createLogger('WorkflowParser');

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Workflow parse error
 */
export class WorkflowParseError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'WorkflowParseError';
  }
}

/**
 * Workflow validation error
 */
export class WorkflowValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse workflow from YAML string
 */
export function parseWorkflowYaml(yamlContent: string): WorkflowDefinition {
  try {
    const data = yaml.load(yamlContent);

    if (!data || typeof data !== 'object') {
      throw new WorkflowParseError('Invalid YAML: expected object at root');
    }

    return validateWorkflowDefinition(data);
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new WorkflowParseError(
        `YAML syntax error: ${error.message}`,
        undefined,
        error.mark?.line,
        error.mark?.column
      );
    }
    if (error instanceof Error && error.name === 'ZodError') {
      throw new WorkflowParseError(`Schema validation error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse workflow from file
 */
export function parseWorkflowFile(filePath: string): WorkflowDefinition {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new WorkflowParseError(`Workflow file not found: ${absolutePath}`, absolutePath);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  try {
    return parseWorkflowYaml(content);
  } catch (error) {
    if (error instanceof WorkflowParseError && !error.filePath) {
      throw new WorkflowParseError(error.message, absolutePath, error.line, error.column);
    }
    throw error;
  }
}

/**
 * Parse and fully validate workflow
 */
export function parseAndValidateWorkflow(
  input: string | { filePath: string }
): { workflow: WorkflowDefinition; warnings: string[] } {
  const workflow =
    typeof input === 'string'
      ? parseWorkflowYaml(input)
      : parseWorkflowFile(input.filePath);

  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate dependencies
  const depErrors = validateDependencies(workflow);
  errors.push(...depErrors);

  // Check for circular dependencies
  const circularErrors = detectCircularDependencies(workflow);
  errors.push(...circularErrors);

  // Check for unreachable steps (no path from start)
  const unreachableWarnings = checkUnreachableSteps(workflow);
  warnings.push(...unreachableWarnings);

  // Check for unused outputs
  const unusedWarnings = checkUnusedOutputs(workflow);
  warnings.push(...unusedWarnings);

  if (errors.length > 0) {
    throw new WorkflowValidationError('Workflow validation failed', errors);
  }

  return { workflow, warnings };
}

/**
 * Check for unreachable steps
 */
function checkUnreachableSteps(workflow: WorkflowDefinition): string[] {
  const warnings: string[] = [];
  const allSteps = new Map<string, { hasDeps: boolean; referencedBy: string[] }>();

  // Collect all steps and their dependencies
  for (const entry of workflow.steps) {
    const steps = 'parallel' in entry ? entry.steps : [entry];
    for (const step of steps) {
      allSteps.set(step.id, {
        hasDeps: (step.depends_on?.length ?? 0) > 0,
        referencedBy: [],
      });
    }
  }

  // Mark referenced steps
  for (const entry of workflow.steps) {
    const steps = 'parallel' in entry ? entry.steps : [entry];
    for (const step of steps) {
      for (const dep of step.depends_on || []) {
        const depInfo = allSteps.get(dep);
        if (depInfo) {
          depInfo.referencedBy.push(step.id);
        }
      }
    }
  }

  // Find steps that are not first and have no incoming references
  let isFirst = true;
  for (const entry of workflow.steps) {
    const steps = 'parallel' in entry ? entry.steps : [entry];
    for (const step of steps) {
      const info = allSteps.get(step.id);
      if (
        !isFirst &&
        info &&
        !info.hasDeps &&
        info.referencedBy.length === 0
      ) {
        warnings.push(
          `Step "${step.id}" has no dependencies and is not referenced by any other step`
        );
      }
    }
    isFirst = false;
  }

  return warnings;
}

/**
 * Check for unused outputs
 */
function checkUnusedOutputs(workflow: WorkflowDefinition): string[] {
  const warnings: string[] = [];
  const definedOutputs = new Set<string>();
  const usedOutputs = new Set<string>();

  // Collect defined outputs
  for (const entry of workflow.steps) {
    const steps = 'parallel' in entry ? entry.steps : [entry];
    for (const step of steps) {
      for (const output of step.outputs || []) {
        definedOutputs.add(`${step.id}.${output}`);
      }
    }
  }

  // Collect used outputs (in inputs and conditions)
  for (const entry of workflow.steps) {
    const steps = 'parallel' in entry ? entry.steps : [entry];
    for (const step of steps) {
      if (step.inputs) {
        for (const input of Object.values(step.inputs)) {
          if (input.from_step && input.field) {
            usedOutputs.add(`${input.from_step}.${input.field}`);
          }
          if (input.template) {
            // Extract references like ${step_id.field}
            const matches = input.template.match(/\$\{([^}]+)\}/g);
            for (const match of matches || []) {
              const ref = match.slice(2, -1);
              usedOutputs.add(ref);
            }
          }
        }
      }
    }
  }

  // Find unused outputs
  for (const output of definedOutputs) {
    if (!usedOutputs.has(output)) {
      warnings.push(`Output "${output}" is defined but never used`);
    }
  }

  return warnings;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Serialize workflow to YAML
 */
export function serializeWorkflowToYaml(workflow: WorkflowDefinition): string {
  return yaml.dump(workflow, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * Save workflow to file
 */
export function saveWorkflowToFile(
  workflow: WorkflowDefinition,
  filePath: string
): void {
  const content = serializeWorkflowToYaml(workflow);
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absolutePath, content, 'utf-8');
}

/**
 * Load all workflows from a directory
 */
export function loadWorkflowsFromDirectory(dirPath: string): Map<string, WorkflowDefinition> {
  const workflows = new Map<string, WorkflowDefinition>();
  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    return workflows;
  }

  const files = fs.readdirSync(absolutePath);

  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      try {
        const filePath = path.join(absolutePath, file);
        const { workflow } = parseAndValidateWorkflow({ filePath });
        workflows.set(workflow.id, workflow);
      } catch (error) {
        // Log error but continue loading other workflows
        logger.error(`Failed to load workflow ${file}`, { error });
      }
    }
  }

  return workflows;
}

/**
 * Create a simple workflow definition programmatically
 */
export function createWorkflowDefinition(
  id: string,
  name: string,
  steps: WorkflowDefinition['steps'],
  options?: Partial<Omit<WorkflowDefinition, 'id' | 'name' | 'steps'>>
): WorkflowDefinition {
  return validateWorkflowDefinition({
    version: '1.0',
    id,
    name,
    steps,
    ...options,
  });
}
