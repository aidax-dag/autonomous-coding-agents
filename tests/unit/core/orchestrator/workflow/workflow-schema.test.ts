/**
 * Workflow Schema Tests
 */

import {
  WorkflowDefinitionSchema,
  WorkflowStepSchema,
  ParallelStepGroupSchema,
  ConditionSchema,
  ConditionGroupSchema,
  RetryConfigSchema,
  StepInputSchema,
  WorkflowTriggerSchema,
  WorkflowVariableSchema,
  validateWorkflowDefinition,
  isParallelGroup,
  getAllStepIds,
  validateDependencies,
  detectCircularDependencies,
} from '../../../../../src/core/orchestrator/workflow/workflow-schema';

// ============================================================================
// Helpers
// ============================================================================

function makeStep(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: `Step ${id}`,
    team: 'development',
    type: 'implement',
    content: `Content for ${id}`,
    ...overrides,
  };
}

function makeWorkflow(steps: unknown[], extra?: Record<string, unknown>) {
  return {
    version: '1.0',
    id: 'test-wf',
    name: 'Test',
    steps,
    ...extra,
  };
}

// ============================================================================
// WorkflowStepSchema
// ============================================================================

describe('WorkflowStepSchema', () => {
  it('should validate a minimal step', () => {
    const result = WorkflowStepSchema.parse(makeStep('step1'));
    expect(result.id).toBe('step1');
    expect(result.team).toBe('development');
    expect(result.continue_on_failure).toBe(false);
  });

  it('should accept all valid team types', () => {
    for (const team of ['planning', 'development', 'qa', 'code-quality']) {
      const result = WorkflowStepSchema.parse(makeStep('s1', { team }));
      expect(result.team).toBe(team);
    }
  });

  it('should accept all valid step types', () => {
    for (const type of ['plan', 'implement', 'test', 'review', 'refactor', 'analyze']) {
      const result = WorkflowStepSchema.parse(makeStep('s1', { type }));
      expect(result.type).toBe(type);
    }
  });

  it('should reject invalid step ID format', () => {
    expect(() => WorkflowStepSchema.parse(makeStep('123bad'))).toThrow();
    expect(() => WorkflowStepSchema.parse(makeStep(''))).toThrow();
  });

  it('should accept valid step ID formats', () => {
    for (const id of ['a', 'step1', 'my-step', 'my_step', 'Step1']) {
      expect(WorkflowStepSchema.parse(makeStep(id)).id).toBe(id);
    }
  });

  it('should accept optional fields', () => {
    const result = WorkflowStepSchema.parse(makeStep('s1', {
      description: 'desc',
      depends_on: ['other'],
      timeout_ms: 5000,
      continue_on_failure: true,
      outputs: ['result'],
    }));
    expect(result.description).toBe('desc');
    expect(result.depends_on).toEqual(['other']);
    expect(result.timeout_ms).toBe(5000);
    expect(result.continue_on_failure).toBe(true);
    expect(result.outputs).toEqual(['result']);
  });

  it('should reject timeout_ms below minimum', () => {
    expect(() => WorkflowStepSchema.parse(makeStep('s1', { timeout_ms: 500 }))).toThrow();
  });

  it('should reject timeout_ms above maximum', () => {
    expect(() => WorkflowStepSchema.parse(makeStep('s1', { timeout_ms: 4000000 }))).toThrow();
  });
});

// ============================================================================
// ConditionSchema
// ============================================================================

describe('ConditionSchema', () => {
  it('should validate a simple condition', () => {
    const result = ConditionSchema.parse({
      field: 'status',
      operator: 'equals',
      value: 'success',
    });
    expect(result.field).toBe('status');
    expect(result.operator).toBe('equals');
  });

  it('should accept exists/not_exists without value', () => {
    const result = ConditionSchema.parse({
      field: 'data',
      operator: 'exists',
    });
    expect(result.operator).toBe('exists');
    expect(result.value).toBeUndefined();
  });

  it('should accept numeric and boolean values', () => {
    expect(ConditionSchema.parse({ field: 'count', operator: 'greater_than', value: 5 }).value).toBe(5);
    expect(ConditionSchema.parse({ field: 'flag', operator: 'equals', value: true }).value).toBe(true);
  });

  it('should accept all comparison operators', () => {
    const ops = [
      'equals', 'not_equals', 'contains', 'not_contains',
      'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
      'matches', 'exists', 'not_exists',
    ];
    for (const op of ops) {
      expect(() => ConditionSchema.parse({ field: 'f', operator: op })).not.toThrow();
    }
  });
});

// ============================================================================
// ConditionGroupSchema
// ============================================================================

describe('ConditionGroupSchema', () => {
  it('should validate AND group', () => {
    const result = ConditionGroupSchema.parse({
      operator: 'and',
      conditions: [
        { field: 'a', operator: 'equals', value: 1 },
        { field: 'b', operator: 'exists' },
      ],
    });
    expect(result.operator).toBe('and');
    expect(result.conditions).toHaveLength(2);
  });

  it('should validate OR group', () => {
    const result = ConditionGroupSchema.parse({
      operator: 'or',
      conditions: [
        { field: 'x', operator: 'equals', value: 'a' },
      ],
    });
    expect(result.operator).toBe('or');
  });

  it('should validate nested condition groups', () => {
    const result = ConditionGroupSchema.parse({
      operator: 'and',
      conditions: [
        { field: 'a', operator: 'equals', value: 1 },
        {
          operator: 'or',
          conditions: [
            { field: 'b', operator: 'exists' },
            { field: 'c', operator: 'equals', value: 'x' },
          ],
        },
      ],
    });
    expect(result.conditions).toHaveLength(2);
  });
});

// ============================================================================
// RetryConfigSchema
// ============================================================================

describe('RetryConfigSchema', () => {
  it('should use defaults', () => {
    const result = RetryConfigSchema.parse({});
    expect(result.max_attempts).toBe(3);
    expect(result.delay_ms).toBe(1000);
    expect(result.backoff_multiplier).toBe(2);
  });

  it('should accept custom values', () => {
    const result = RetryConfigSchema.parse({
      max_attempts: 5,
      delay_ms: 2000,
      backoff_multiplier: 3,
      retry_on: ['timeout', 'rate_limit'],
    });
    expect(result.max_attempts).toBe(5);
    expect(result.retry_on).toEqual(['timeout', 'rate_limit']);
  });

  it('should reject out-of-range values', () => {
    expect(() => RetryConfigSchema.parse({ max_attempts: 0 })).toThrow();
    expect(() => RetryConfigSchema.parse({ max_attempts: 11 })).toThrow();
    expect(() => RetryConfigSchema.parse({ backoff_multiplier: 0 })).toThrow();
    expect(() => RetryConfigSchema.parse({ backoff_multiplier: 6 })).toThrow();
  });
});

// ============================================================================
// StepInputSchema
// ============================================================================

describe('StepInputSchema', () => {
  it('should accept from_step + field', () => {
    const result = StepInputSchema.parse({ from_step: 's1', field: 'data' });
    expect(result.from_step).toBe('s1');
  });

  it('should accept static value', () => {
    const result = StepInputSchema.parse({ value: 42 });
    expect(result.value).toBe(42);
  });

  it('should accept template', () => {
    const result = StepInputSchema.parse({ template: '${s1.data}' });
    expect(result.template).toBe('${s1.data}');
  });
});

// ============================================================================
// WorkflowTriggerSchema
// ============================================================================

describe('WorkflowTriggerSchema', () => {
  it('should accept manual trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'manual' });
    expect(result.type).toBe('manual');
  });

  it('should accept schedule with cron', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'schedule', cron: '0 * * * *' });
    expect(result.cron).toBe('0 * * * *');
  });

  it('should accept event with name', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'event', event: 'push' });
    expect(result.event).toBe('push');
  });

  it('should accept all trigger types', () => {
    for (const type of ['manual', 'schedule', 'event', 'webhook']) {
      expect(WorkflowTriggerSchema.parse({ type }).type).toBe(type);
    }
  });
});

// ============================================================================
// WorkflowVariableSchema
// ============================================================================

describe('WorkflowVariableSchema', () => {
  it('should validate a variable with defaults', () => {
    const result = WorkflowVariableSchema.parse({ name: 'env' });
    expect(result.name).toBe('env');
    expect(result.required).toBe(false);
  });

  it('should accept all optional fields', () => {
    const result = WorkflowVariableSchema.parse({
      name: 'x',
      default: 'val',
      description: 'desc',
      required: true,
      schema: 'string',
    });
    expect(result.required).toBe(true);
    expect(result.default).toBe('val');
  });
});

// ============================================================================
// ParallelStepGroupSchema
// ============================================================================

describe('ParallelStepGroupSchema', () => {
  it('should validate parallel group', () => {
    const result = ParallelStepGroupSchema.parse({
      parallel: true,
      steps: [makeStep('a'), makeStep('b')],
    });
    expect(result.parallel).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.max_concurrency).toBe(5);
    expect(result.wait_for_all).toBe(true);
  });

  it('should accept custom concurrency', () => {
    const result = ParallelStepGroupSchema.parse({
      parallel: true,
      steps: [makeStep('a')],
      max_concurrency: 3,
      wait_for_all: false,
    });
    expect(result.max_concurrency).toBe(3);
    expect(result.wait_for_all).toBe(false);
  });
});

// ============================================================================
// WorkflowDefinitionSchema
// ============================================================================

describe('WorkflowDefinitionSchema', () => {
  it('should validate minimal workflow', () => {
    const result = WorkflowDefinitionSchema.parse(makeWorkflow([makeStep('s1')]));
    expect(result.id).toBe('test-wf');
    expect(result.version).toBe('1.0');
  });

  it('should accept full workflow with all optional fields', () => {
    const result = WorkflowDefinitionSchema.parse(makeWorkflow([makeStep('s1')], {
      description: 'Full workflow',
      triggers: [{ type: 'manual' }],
      variables: [{ name: 'env' }],
      outputs: [{ name: 'result', value: '${s1.data}' }],
      timeout_ms: 120000,
      retry: { max_attempts: 2 },
      metadata: { author: 'test' },
    }));
    expect(result.description).toBe('Full workflow');
    expect(result.triggers).toHaveLength(1);
    expect(result.variables).toHaveLength(1);
    expect(result.metadata).toEqual({ author: 'test' });
  });

  it('should reject invalid workflow ID', () => {
    expect(() => WorkflowDefinitionSchema.parse(makeWorkflow([makeStep('s1')], { id: '123' }))).toThrow();
  });

  it('should reject missing name', () => {
    expect(() => WorkflowDefinitionSchema.parse({
      version: '1.0',
      id: 'wf',
      steps: [makeStep('s1')],
    })).toThrow();
  });
});

// ============================================================================
// validateWorkflowDefinition
// ============================================================================

describe('validateWorkflowDefinition', () => {
  it('should return parsed result for valid data', () => {
    const result = validateWorkflowDefinition(makeWorkflow([makeStep('s1')]));
    expect(result.id).toBe('test-wf');
  });

  it('should throw for invalid data', () => {
    expect(() => validateWorkflowDefinition({})).toThrow();
  });
});

// ============================================================================
// isParallelGroup
// ============================================================================

describe('isParallelGroup', () => {
  it('should return true for parallel groups', () => {
    const group = ParallelStepGroupSchema.parse({
      parallel: true,
      steps: [makeStep('a')],
    });
    expect(isParallelGroup(group)).toBe(true);
  });

  it('should return false for regular steps', () => {
    const step = WorkflowStepSchema.parse(makeStep('a'));
    expect(isParallelGroup(step)).toBe(false);
  });
});

// ============================================================================
// getAllStepIds
// ============================================================================

describe('getAllStepIds', () => {
  it('should collect IDs from flat steps', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      makeStep('b'),
      makeStep('c'),
    ]));
    expect(getAllStepIds(wf)).toEqual(['a', 'b', 'c']);
  });

  it('should collect IDs from parallel groups', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      { parallel: true, steps: [makeStep('b'), makeStep('c')] },
      makeStep('d'),
    ]));
    expect(getAllStepIds(wf)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should return empty for empty steps', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([]));
    expect(getAllStepIds(wf)).toEqual([]);
  });
});

// ============================================================================
// validateDependencies
// ============================================================================

describe('validateDependencies', () => {
  it('should return empty for valid dependencies', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      makeStep('b', { depends_on: ['a'] }),
    ]));
    expect(validateDependencies(wf)).toEqual([]);
  });

  it('should detect unknown dependency', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a', { depends_on: ['nonexistent'] }),
    ]));
    const errors = validateDependencies(wf);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('nonexistent');
  });

  it('should detect self-dependency', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a', { depends_on: ['a'] }),
    ]));
    const errors = validateDependencies(wf);
    expect(errors.some(e => e.includes('depend on itself'))).toBe(true);
  });

  it('should validate dependencies in parallel groups', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      { parallel: true, steps: [makeStep('a'), makeStep('b', { depends_on: ['missing'] })] },
    ]));
    const errors = validateDependencies(wf);
    expect(errors).toHaveLength(1);
  });

  it('should allow cross-group dependencies', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      { parallel: true, steps: [makeStep('b', { depends_on: ['a'] }), makeStep('c', { depends_on: ['a'] })] },
    ]));
    expect(validateDependencies(wf)).toEqual([]);
  });
});

// ============================================================================
// detectCircularDependencies
// ============================================================================

describe('detectCircularDependencies', () => {
  it('should return empty for acyclic graph', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      makeStep('b', { depends_on: ['a'] }),
      makeStep('c', { depends_on: ['b'] }),
    ]));
    expect(detectCircularDependencies(wf)).toEqual([]);
  });

  it('should detect simple cycle (A→B→A)', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a', { depends_on: ['b'] }),
      makeStep('b', { depends_on: ['a'] }),
    ]));
    const errors = detectCircularDependencies(wf);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Circular');
  });

  it('should detect longer cycle (A→B→C→A)', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a', { depends_on: ['c'] }),
      makeStep('b', { depends_on: ['a'] }),
      makeStep('c', { depends_on: ['b'] }),
    ]));
    const errors = detectCircularDependencies(wf);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle steps with no dependencies', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      makeStep('b'),
    ]));
    expect(detectCircularDependencies(wf)).toEqual([]);
  });

  it('should handle diamond dependency (no cycle)', () => {
    const wf = validateWorkflowDefinition(makeWorkflow([
      makeStep('a'),
      makeStep('b', { depends_on: ['a'] }),
      makeStep('c', { depends_on: ['a'] }),
      makeStep('d', { depends_on: ['b', 'c'] }),
    ]));
    expect(detectCircularDependencies(wf)).toEqual([]);
  });
});
