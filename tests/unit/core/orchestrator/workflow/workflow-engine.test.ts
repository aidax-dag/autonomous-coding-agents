/**
 * Workflow Engine Tests
 *
 * Tests for YAML-based workflow engine including parsing, conditions, and parallel execution.
 */

import {
  WorkflowEngine,
  createWorkflowEngine,
  StepStatus,
  WorkflowDefinition,
  WorkflowStep,
  parseWorkflowYaml,
  validateWorkflowDefinition,
  validateDependencies,
  detectCircularDependencies,
  isParallelGroup,
  getAllStepIds,
  StepExecutor,
} from '../../../../../src/core/orchestrator/workflow';

describe('Workflow Schema', () => {
  describe('validateWorkflowDefinition', () => {
    it('should validate a simple workflow', () => {
      const workflow = validateWorkflowDefinition({
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            team: 'planning',
            type: 'plan',
            content: 'Test content',
          },
        ],
      });

      expect(workflow.id).toBe('test-workflow');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.steps).toHaveLength(1);
    });

    it('should validate workflow with parallel steps', () => {
      const workflow = validateWorkflowDefinition({
        id: 'parallel-workflow',
        name: 'Parallel Workflow',
        steps: [
          {
            parallel: true,
            steps: [
              { id: 'step1', name: 'Step 1', team: 'development', type: 'implement', content: 'A' },
              { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B' },
            ],
          },
        ],
      });

      expect(workflow.steps).toHaveLength(1);
      expect(isParallelGroup(workflow.steps[0])).toBe(true);
    });

    it('should validate workflow with conditions', () => {
      const workflow = validateWorkflowDefinition({
        id: 'conditional-workflow',
        name: 'Conditional Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Conditional Step',
            team: 'qa',
            type: 'test',
            content: 'Test',
            condition: {
              field: 'variables.enabled',
              operator: 'equals',
              value: true,
            },
          },
        ],
      });

      expect(workflow.steps[0]).toHaveProperty('condition');
    });

    it('should validate workflow with dependencies', () => {
      const workflow = validateWorkflowDefinition({
        id: 'deps-workflow',
        name: 'Dependencies Workflow',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A' },
          {
            id: 'step2',
            name: 'Step 2',
            team: 'development',
            type: 'implement',
            content: 'B',
            depends_on: ['step1'],
          },
        ],
      });

      const step2 = workflow.steps[1] as WorkflowStep;
      expect(step2.depends_on).toContain('step1');
    });
  });

  describe('validateDependencies', () => {
    it('should pass for valid dependencies', () => {
      const workflow = validateWorkflowDefinition({
        id: 'valid-deps',
        name: 'Valid Dependencies',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A' },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', depends_on: ['step1'] },
        ],
      });

      const errors = validateDependencies(workflow);
      expect(errors).toHaveLength(0);
    });

    it('should detect unknown dependencies', () => {
      const workflow = validateWorkflowDefinition({
        id: 'invalid-deps',
        name: 'Invalid Dependencies',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', depends_on: ['unknown'] },
        ],
      });

      const errors = validateDependencies(workflow);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('unknown');
    });

    it('should detect self-dependency', () => {
      const workflow = validateWorkflowDefinition({
        id: 'self-dep',
        name: 'Self Dependency',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', depends_on: ['step1'] },
        ],
      });

      const errors = validateDependencies(workflow);
      expect(errors.some((e) => e.includes('itself'))).toBe(true);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should pass for acyclic graph', () => {
      const workflow = validateWorkflowDefinition({
        id: 'acyclic',
        name: 'Acyclic',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A' },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', depends_on: ['step1'] },
          { id: 'step3', name: 'Step 3', team: 'qa', type: 'test', content: 'C', depends_on: ['step2'] },
        ],
      });

      const errors = detectCircularDependencies(workflow);
      expect(errors).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      const workflow = validateWorkflowDefinition({
        id: 'circular',
        name: 'Circular',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', depends_on: ['step3'] },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', depends_on: ['step1'] },
          { id: 'step3', name: 'Step 3', team: 'qa', type: 'test', content: 'C', depends_on: ['step2'] },
        ],
      });

      const errors = detectCircularDependencies(workflow);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Circular');
    });
  });

  describe('getAllStepIds', () => {
    it('should get all step IDs including parallel steps', () => {
      const workflow = validateWorkflowDefinition({
        id: 'mixed',
        name: 'Mixed',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A' },
          {
            parallel: true,
            steps: [
              { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B' },
              { id: 'step3', name: 'Step 3', team: 'development', type: 'implement', content: 'C' },
            ],
          },
          { id: 'step4', name: 'Step 4', team: 'qa', type: 'test', content: 'D' },
        ],
      });

      const ids = getAllStepIds(workflow);
      expect(ids).toEqual(['step1', 'step2', 'step3', 'step4']);
    });
  });
});

describe('Workflow Parser', () => {
  describe('parseWorkflowYaml', () => {
    it('should parse valid YAML workflow', () => {
      const yaml = `
id: yaml-test
name: YAML Test Workflow
steps:
  - id: step1
    name: First Step
    team: planning
    type: plan
    content: Test content
`;

      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.id).toBe('yaml-test');
      expect(workflow.steps).toHaveLength(1);
    });

    it('should parse workflow with parallel steps', () => {
      const yaml = `
id: parallel-yaml
name: Parallel YAML
steps:
  - parallel: true
    steps:
      - id: a
        name: A
        team: development
        type: implement
        content: A content
      - id: b
        name: B
        team: development
        type: implement
        content: B content
`;

      const workflow = parseWorkflowYaml(yaml);
      expect(isParallelGroup(workflow.steps[0])).toBe(true);
    });

    it('should parse workflow with conditions', () => {
      const yaml = `
id: conditional-yaml
name: Conditional YAML
steps:
  - id: step1
    name: Conditional Step
    team: qa
    type: test
    content: Test
    condition:
      field: previous.success
      operator: equals
      value: true
`;

      const workflow = parseWorkflowYaml(yaml);
      const step = workflow.steps[0] as WorkflowStep;
      expect(step.condition).toBeDefined();
    });
  });
});

describe('Workflow Engine', () => {
  let engine: WorkflowEngine;
  let executorCalls: Array<{ stepId: string; inputs: Record<string, unknown> }>;

  const mockExecutor: StepExecutor = async (step, inputs) => {
    executorCalls.push({ stepId: step.id, inputs });
    return { result: `Output from ${step.id}` };
  };

  beforeEach(() => {
    executorCalls = [];
    engine = createWorkflowEngine({
      executor: mockExecutor,
      defaultTimeout: 5000,
    });
  });

  describe('execute', () => {
    it('should execute a simple workflow', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'simple',
        name: 'Simple Workflow',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', continue_on_failure: false },
        ],
      };

      const result = await engine.execute(workflow);

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
      expect(executorCalls).toHaveLength(1);
      expect(executorCalls[0].stepId).toBe('step1');
    });

    it('should execute steps in dependency order', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'ordered',
        name: 'Ordered Workflow',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', continue_on_failure: false },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', depends_on: ['step1'], continue_on_failure: false },
          { id: 'step3', name: 'Step 3', team: 'qa', type: 'test', content: 'C', depends_on: ['step2'], continue_on_failure: false },
        ],
      };

      const result = await engine.execute(workflow);

      expect(result.success).toBe(true);
      expect(executorCalls.map((c) => c.stepId)).toEqual(['step1', 'step2', 'step3']);
    });

    it('should skip steps when condition is false', async () => {
      const conditionalEngine = createWorkflowEngine({
        executor: mockExecutor,
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'conditional',
        name: 'Conditional Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Conditional Step',
            team: 'planning',
            type: 'plan',
            content: 'A',
            condition: {
              field: 'variables.enabled',
              operator: 'equals',
              value: true,
            },
            continue_on_failure: false,
          },
        ],
      };

      const result = await conditionalEngine.execute(workflow, { enabled: false });

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].status).toBe(StepStatus.SKIPPED);
      expect(executorCalls).toHaveLength(0);
    });

    it('should execute steps when condition is true', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'conditional-true',
        name: 'Conditional True Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Conditional Step',
            team: 'planning',
            type: 'plan',
            content: 'A',
            condition: {
              field: 'variables.enabled',
              operator: 'equals',
              value: true,
            },
            continue_on_failure: false,
          },
        ],
      };

      const result = await engine.execute(workflow, { enabled: true });

      expect(result.success).toBe(true);
      expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
      expect(executorCalls).toHaveLength(1);
    });

    it('should handle step failures', async () => {
      const failingExecutor: StepExecutor = async (step) => {
        if (step.id === 'step2') {
          throw new Error('Step 2 failed');
        }
        return { result: 'ok' };
      };

      const failingEngine = createWorkflowEngine({
        executor: failingExecutor,
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'failing',
        name: 'Failing Workflow',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', continue_on_failure: false },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', depends_on: ['step1'], continue_on_failure: false },
        ],
      };

      const result = await failingEngine.execute(workflow);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step 2 failed');
    });

    it('should continue on failure when configured', async () => {
      const failingExecutor: StepExecutor = async (step) => {
        if (step.id === 'step1') {
          throw new Error('Step 1 failed');
        }
        return { result: 'ok' };
      };

      const failingEngine = createWorkflowEngine({
        executor: failingExecutor,
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'continue-on-failure',
        name: 'Continue on Failure',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', continue_on_failure: true },
          { id: 'step2', name: 'Step 2', team: 'development', type: 'implement', content: 'B', continue_on_failure: false },
        ],
      };

      const result = await failingEngine.execute(workflow);

      expect(result.success).toBe(true);
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
      expect(result.stepResults[1].status).toBe(StepStatus.COMPLETED);
    });
  });

  describe('parallel execution', () => {
    it('should execute parallel steps concurrently', async () => {
      const executionOrder: string[] = [];
      let parallelCount = 0;
      let maxParallelCount = 0;

      const trackingExecutor: StepExecutor = async (step) => {
        parallelCount++;
        maxParallelCount = Math.max(maxParallelCount, parallelCount);
        executionOrder.push(`start:${step.id}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(`end:${step.id}`);
        parallelCount--;
        return { result: step.id };
      };

      const parallelEngine = createWorkflowEngine({
        executor: trackingExecutor,
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'parallel',
        name: 'Parallel Workflow',
        steps: [
          {
            parallel: true,
            steps: [
              { id: 'a', name: 'A', team: 'development', type: 'implement', content: 'A', continue_on_failure: false },
              { id: 'b', name: 'B', team: 'development', type: 'implement', content: 'B', continue_on_failure: false },
              { id: 'c', name: 'C', team: 'development', type: 'implement', content: 'C', continue_on_failure: false },
            ],
            max_concurrency: 5,
            wait_for_all: true,
          },
        ],
      };

      const result = await parallelEngine.execute(workflow);

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(3);
      expect(maxParallelCount).toBeGreaterThan(1); // Confirms parallel execution
    });
  });

  describe('events', () => {
    it('should emit workflow events', async () => {
      const events: string[] = [];

      engine.on('workflow:started', () => events.push('workflow:started'));
      engine.on('workflow:completed', () => events.push('workflow:completed'));
      engine.on('step:started', (stepId) => events.push(`step:started:${stepId}`));
      engine.on('step:completed', (result) => events.push(`step:completed:${result.stepId}`));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'events-test',
        name: 'Events Test',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', continue_on_failure: false },
        ],
      };

      await engine.execute(workflow);

      expect(events).toContain('workflow:started');
      expect(events).toContain('step:started:step1');
      expect(events).toContain('step:completed:step1');
      expect(events).toContain('workflow:completed');
    });
  });

  describe('condition operators', () => {
    const testCondition = async (
      operator: string,
      value: string | number | boolean | undefined,
      variables: Record<string, unknown>,
      expectedExecuted: boolean
    ) => {
      const calls: string[] = [];
      const condEngine = createWorkflowEngine({
        executor: async (step) => {
          calls.push(step.id);
          return { result: 'ok' };
        },
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'cond-test',
        name: 'Condition Test',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            team: 'planning',
            type: 'plan',
            content: 'A',
            condition: {
              field: 'variables.value',
              operator: operator as 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists' | 'matches' | 'not_contains' | 'greater_than_or_equal' | 'less_than_or_equal',
              value,
            },
            continue_on_failure: false,
          },
        ],
      };

      await condEngine.execute(workflow, variables);
      expect(calls.length > 0).toBe(expectedExecuted);
    };

    it('should handle equals operator', async () => {
      await testCondition('equals', 'test', { value: 'test' }, true);
      await testCondition('equals', 'test', { value: 'other' }, false);
    });

    it('should handle not_equals operator', async () => {
      await testCondition('not_equals', 'test', { value: 'other' }, true);
      await testCondition('not_equals', 'test', { value: 'test' }, false);
    });

    it('should handle contains operator', async () => {
      await testCondition('contains', 'est', { value: 'test' }, true);
      await testCondition('contains', 'xyz', { value: 'test' }, false);
    });

    it('should handle greater_than operator', async () => {
      await testCondition('greater_than', 5, { value: 10 }, true);
      await testCondition('greater_than', 5, { value: 3 }, false);
    });

    it('should handle less_than operator', async () => {
      await testCondition('less_than', 10, { value: 5 }, true);
      await testCondition('less_than', 10, { value: 15 }, false);
    });

    it('should handle exists operator', async () => {
      await testCondition('exists', undefined, { value: 'something' }, true);
      await testCondition('exists', undefined, {}, false);
    });

    it('should handle matches (regex) operator', async () => {
      await testCondition('matches', '^test.*$', { value: 'test123' }, true);
      await testCondition('matches', '^test.*$', { value: 'other' }, false);
    });
  });

  describe('input resolution', () => {
    it('should resolve inputs from previous step outputs', async () => {
      const capturedInputs: Record<string, unknown>[] = [];

      const inputEngine = createWorkflowEngine({
        executor: async (step, inputs) => {
          capturedInputs.push(inputs);
          return { value: `result-${step.id}` };
        },
        defaultTimeout: 5000,
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        id: 'inputs',
        name: 'Inputs Workflow',
        steps: [
          { id: 'step1', name: 'Step 1', team: 'planning', type: 'plan', content: 'A', outputs: ['value'], continue_on_failure: false },
          {
            id: 'step2',
            name: 'Step 2',
            team: 'development',
            type: 'implement',
            content: 'B',
            depends_on: ['step1'],
            inputs: {
              previousValue: { from_step: 'step1', field: 'value' },
            },
            continue_on_failure: false,
          },
        ],
      };

      await inputEngine.execute(workflow);

      expect(capturedInputs[1]).toEqual({ previousValue: 'result-step1' });
    });
  });
});
