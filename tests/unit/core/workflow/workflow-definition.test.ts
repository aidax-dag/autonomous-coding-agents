/**
 * Workflow Definition Tests
 *
 * Tests for workflow DSL, schemas, and validation utilities.
 */

import {
  // Enums
  WorkflowStatus,
  StepStatus,
  StepType,
  ConditionOperator,
  LoopType,

  // Schemas
  WorkflowDefinitionSchema,
  AgentStepSchema,
  ParallelStepSchema,
  ConditionExpressionSchema,
  RetryPolicySchema,

  // Types
  WorkflowDefinition,
  ConditionExpression,

  // Builder
  WorkflowBuilder,

  // Utilities
  validateWorkflowDefinition,
  validateStepDefinition,
  getAllStepIds,
  checkDuplicateStepIds,
  validateStepDependencies,
  createAgentStep,
  createCondition,
  and,
  or,
  not,
} from '../../../../src/core/workflow';

import { AgentType, TaskPriority } from '../../../../src/core/interfaces';

describe('Workflow Definition', () => {
  // ==========================================================================
  // Enum Tests
  // ==========================================================================

  describe('WorkflowStatus Enum', () => {
    it('should have all expected statuses', () => {
      expect(WorkflowStatus.PENDING).toBe('pending');
      expect(WorkflowStatus.RUNNING).toBe('running');
      expect(WorkflowStatus.PAUSED).toBe('paused');
      expect(WorkflowStatus.COMPLETED).toBe('completed');
      expect(WorkflowStatus.FAILED).toBe('failed');
      expect(WorkflowStatus.CANCELLED).toBe('cancelled');
      expect(WorkflowStatus.TIMEOUT).toBe('timeout');
    });
  });

  describe('StepStatus Enum', () => {
    it('should have all expected statuses', () => {
      expect(StepStatus.PENDING).toBe('pending');
      expect(StepStatus.WAITING).toBe('waiting');
      expect(StepStatus.RUNNING).toBe('running');
      expect(StepStatus.COMPLETED).toBe('completed');
      expect(StepStatus.FAILED).toBe('failed');
      expect(StepStatus.SKIPPED).toBe('skipped');
      expect(StepStatus.CANCELLED).toBe('cancelled');
      expect(StepStatus.TIMEOUT).toBe('timeout');
    });
  });

  describe('StepType Enum', () => {
    it('should have all expected step types', () => {
      expect(StepType.AGENT).toBe('agent');
      expect(StepType.PARALLEL).toBe('parallel');
      expect(StepType.SEQUENTIAL).toBe('sequential');
      expect(StepType.CONDITION).toBe('condition');
      expect(StepType.LOOP).toBe('loop');
      expect(StepType.WAIT).toBe('wait');
      expect(StepType.TRANSFORM).toBe('transform');
      expect(StepType.APPROVAL).toBe('approval');
      expect(StepType.SUBWORKFLOW).toBe('subworkflow');
    });
  });

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('AgentStepSchema', () => {
    it('should validate a valid agent step', () => {
      const step = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        config: {
          agentType: AgentType.CODER,
          taskType: 'code-generation',
          payload: { prompt: 'Write a function' },
        },
      };

      const result = AgentStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should reject step with missing required fields', () => {
      const step = {
        id: 'step1',
        type: StepType.AGENT,
        // Missing name and config
      };

      const result = AgentStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should validate step with optional fields', () => {
      const step = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        description: 'A test step',
        dependsOn: ['step0'],
        timeout: 30000,
        config: {
          agentType: AgentType.REVIEWER,
          taskType: 'code-review',
          payload: { files: ['test.ts'] },
          priority: TaskPriority.HIGH,
        },
        metadata: { custom: 'value' },
      };

      const result = AgentStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('A test step');
        expect(result.data.dependsOn).toEqual(['step0']);
      }
    });
  });

  describe('ParallelStepSchema', () => {
    it('should validate a valid parallel step', () => {
      const step = {
        id: 'parallel1',
        name: 'Parallel Execution',
        type: StepType.PARALLEL,
        config: {
          steps: [
            {
              id: 'sub1',
              name: 'Sub Step 1',
              type: StepType.AGENT,
              config: {
                agentType: AgentType.CODER,
                taskType: 'task1',
                payload: {},
              },
            },
            {
              id: 'sub2',
              name: 'Sub Step 2',
              type: StepType.AGENT,
              config: {
                agentType: AgentType.TESTER,
                taskType: 'task2',
                payload: {},
              },
            },
          ],
          maxConcurrency: 5,
          failFast: true,
        },
      };

      const result = ParallelStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('ConditionExpressionSchema', () => {
    it('should validate simple comparison', () => {
      const condition = {
        left: '${steps.step1.output.value}',
        operator: ConditionOperator.EQUALS,
        right: 'success',
      };

      const result = ConditionExpressionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    it('should validate AND condition', () => {
      const condition = {
        operator: ConditionOperator.AND,
        conditions: [
          { left: 'a', operator: ConditionOperator.EQUALS, right: 'b' },
          { left: 1, operator: ConditionOperator.GREATER_THAN, right: 0 },
        ],
      };

      const result = ConditionExpressionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    it('should validate nested conditions', () => {
      const condition = {
        operator: ConditionOperator.OR,
        conditions: [
          {
            operator: ConditionOperator.AND,
            conditions: [
              { left: 'x', operator: ConditionOperator.EQUALS, right: 'y' },
              { left: 10, operator: ConditionOperator.LESS_THAN, right: 20 },
            ],
          },
          { left: true, operator: ConditionOperator.EQUALS, right: true },
        ],
      };

      const result = ConditionExpressionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    it('should validate NOT condition', () => {
      const condition = {
        operator: ConditionOperator.NOT,
        condition: { left: 'status', operator: ConditionOperator.EQUALS, right: 'failed' },
      };

      const result = ConditionExpressionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });
  });

  describe('RetryPolicySchema', () => {
    it('should validate with defaults', () => {
      const policy = {};
      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxAttempts).toBe(3);
        expect(result.data.initialDelay).toBe(1000);
        expect(result.data.backoffMultiplier).toBe(2);
      }
    });

    it('should validate custom policy', () => {
      const policy = {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 60000,
        backoffMultiplier: 3,
        retryableErrors: ['TIMEOUT', 'RATE_LIMIT'],
      };

      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should reject invalid values', () => {
      const policy = {
        maxAttempts: 100, // Max is 10
        backoffMultiplier: 10, // Max is 5
      };

      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowDefinitionSchema', () => {
    const validWorkflow: WorkflowDefinition = {
      id: 'test-workflow',
      name: 'Test Workflow',
      version: '1.0.0',
      steps: [
        {
          id: 'step1',
          name: 'First Step',
          type: StepType.AGENT,
          config: {
            agentType: AgentType.CODER,
            taskType: 'generate',
            payload: { prompt: 'test' },
          },
        },
      ],
      enabled: true,
      draft: false,
    };

    it('should validate a minimal workflow', () => {
      const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
      expect(result.success).toBe(true);
    });

    it('should reject workflow without steps', () => {
      const workflow = { ...validWorkflow, steps: [] };
      const result = WorkflowDefinitionSchema.safeParse(workflow);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const workflow = { ...validWorkflow, version: 'v1' };
      const result = WorkflowDefinitionSchema.safeParse(workflow);
      expect(result.success).toBe(false);
    });

    it('should validate workflow with all fields', () => {
      const fullWorkflow = {
        ...validWorkflow,
        description: 'A complete workflow',
        inputs: [
          {
            name: 'files',
            type: 'array' as const,
            required: true,
            description: 'Files to process',
          },
        ],
        outputs: [
          {
            name: 'result',
            type: 'object' as const,
            required: true,
          },
        ],
        variables: { tempDir: '/tmp' },
        triggers: [
          { type: 'manual' as const },
          { type: 'schedule' as const, schedule: '0 0 * * *' },
        ],
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
        },
        timeout: {
          stepTimeout: 60000,
          workflowTimeout: 600000,
        },
        errorHandling: {
          onError: 'retry' as const,
        },
        metadata: {
          author: 'test',
          tags: ['test', 'example'],
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(fullWorkflow);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // WorkflowBuilder Tests
  // ==========================================================================

  describe('WorkflowBuilder', () => {
    it('should create a simple workflow', () => {
      const workflow = WorkflowBuilder
        .create('simple', 'Simple Workflow')
        .version('1.0.0')
        .agentStep('step1', 'Do Something', AgentType.CODER, 'generate', { prompt: 'test' })
        .build();

      expect(workflow.id).toBe('simple');
      expect(workflow.name).toBe('Simple Workflow');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].id).toBe('step1');
    });

    it('should chain multiple steps', () => {
      const workflow = WorkflowBuilder
        .create('multi', 'Multi-step Workflow')
        .description('A workflow with multiple steps')
        .agentStep('analyze', 'Analyze', AgentType.ARCHITECT, 'analyze', {})
        .agentStep('code', 'Code', AgentType.CODER, 'generate', {}, { dependsOn: ['analyze'] })
        .agentStep('test', 'Test', AgentType.TESTER, 'test', {}, { dependsOn: ['code'] })
        .build();

      expect(workflow.steps).toHaveLength(3);
      expect(workflow.description).toBe('A workflow with multiple steps');
    });

    it('should create parallel steps', () => {
      const workflow = WorkflowBuilder
        .create('parallel', 'Parallel Workflow')
        .parallel('p1', 'Parallel Tasks', [
          createAgentStep('a', 'Task A', AgentType.CODER, 'task', {}),
          createAgentStep('b', 'Task B', AgentType.TESTER, 'task', {}),
        ], { maxConcurrency: 2 })
        .build();

      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].type).toBe(StepType.PARALLEL);
    });

    it('should create conditional steps', () => {
      const workflow = WorkflowBuilder
        .create('conditional', 'Conditional Workflow')
        .condition(
          'check',
          'Check Condition',
          createCondition('${inputs.mode}', ConditionOperator.EQUALS, 'fast'),
          [createAgentStep('fast', 'Fast Path', AgentType.CODER, 'fast', {})],
          [createAgentStep('slow', 'Slow Path', AgentType.CODER, 'slow', {})]
        )
        .build();

      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].type).toBe(StepType.CONDITION);
    });

    it('should create loop steps', () => {
      const workflow = WorkflowBuilder
        .create('loop', 'Loop Workflow')
        .loop('iterate', 'Process Items', LoopType.FOR_EACH, [
          createAgentStep('process', 'Process', AgentType.CODER, 'process', {
            item: '${item}',
          }),
        ], { items: '${inputs.items}' })
        .build();

      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].type).toBe(StepType.LOOP);
    });

    it('should add policies', () => {
      const workflow = WorkflowBuilder
        .create('policy', 'Policy Workflow')
        .retry({ maxAttempts: 5, initialDelay: 500, maxDelay: 10000, backoffMultiplier: 2 })
        .timeout({ stepTimeout: 30000, workflowTimeout: 300000 })
        .errorHandling({ onError: 'continue' })
        .agentStep('s1', 'Step', AgentType.CODER, 'task', {})
        .build();

      expect(workflow.retry?.maxAttempts).toBe(5);
      expect(workflow.timeout?.stepTimeout).toBe(30000);
      expect(workflow.errorHandling?.onError).toBe('continue');
    });

    it('should add inputs and outputs', () => {
      const workflow = WorkflowBuilder
        .create('io', 'IO Workflow')
        .input({ name: 'file', type: 'string', required: true })
        .output({ name: 'result', type: 'object', required: true })
        .agentStep('s1', 'Step', AgentType.CODER, 'task', {})
        .build();

      expect(workflow.inputs).toHaveLength(1);
      expect(workflow.outputs).toHaveLength(1);
    });

    it('should add triggers', () => {
      const workflow = WorkflowBuilder
        .create('triggered', 'Triggered Workflow')
        .trigger({ type: 'manual' })
        .trigger({ type: 'schedule', schedule: '0 0 * * *' })
        .trigger({ type: 'event', eventName: 'file.uploaded' })
        .agentStep('s1', 'Step', AgentType.CODER, 'task', {})
        .build();

      expect(workflow.triggers).toHaveLength(3);
    });

    it('should throw on invalid workflow', () => {
      expect(() => {
        WorkflowBuilder
          .create('', '') // Invalid: empty id and name
          .build();
      }).toThrow();
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('validateWorkflowDefinition', () => {
    it('should return valid for correct workflow', () => {
      const workflow = WorkflowBuilder
        .create('test', 'Test')
        .agentStep('s1', 'Step', AgentType.CODER, 'task', {})
        .build();

      const result = validateWorkflowDefinition(workflow);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for incorrect workflow', () => {
      const result = validateWorkflowDefinition({
        id: 'test',
        // Missing required fields
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('validateStepDefinition', () => {
    it('should validate correct step', () => {
      const step = createAgentStep('s1', 'Step', AgentType.CODER, 'task', {});
      const result = validateStepDefinition(step);
      expect(result.valid).toBe(true);
    });

    it('should invalidate incorrect step', () => {
      const result = validateStepDefinition({
        id: 's1',
        type: 'invalid_type',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getAllStepIds', () => {
    it('should get all step IDs from simple workflow', () => {
      const workflow = WorkflowBuilder
        .create('test', 'Test')
        .agentStep('s1', 'Step 1', AgentType.CODER, 'task', {})
        .agentStep('s2', 'Step 2', AgentType.TESTER, 'task', {})
        .build();

      const ids = getAllStepIds(workflow);
      expect(ids).toEqual(['s1', 's2']);
    });

    it('should get all step IDs including nested steps', () => {
      const workflow = WorkflowBuilder
        .create('test', 'Test')
        .parallel('p1', 'Parallel', [
          createAgentStep('a', 'A', AgentType.CODER, 'task', {}),
          createAgentStep('b', 'B', AgentType.TESTER, 'task', {}),
        ])
        .condition(
          'c1', 'Condition',
          createCondition('x', ConditionOperator.EQUALS, 'y'),
          [createAgentStep('then1', 'Then', AgentType.CODER, 'task', {})],
          [createAgentStep('else1', 'Else', AgentType.CODER, 'task', {})]
        )
        .build();

      const ids = getAllStepIds(workflow);
      expect(ids).toContain('p1');
      expect(ids).toContain('a');
      expect(ids).toContain('b');
      expect(ids).toContain('c1');
      expect(ids).toContain('then1');
      expect(ids).toContain('else1');
      expect(ids).toHaveLength(6);
    });
  });

  describe('checkDuplicateStepIds', () => {
    it('should return empty array for unique IDs', () => {
      const workflow = WorkflowBuilder
        .create('test', 'Test')
        .agentStep('s1', 'Step 1', AgentType.CODER, 'task', {})
        .agentStep('s2', 'Step 2', AgentType.TESTER, 'task', {})
        .build();

      const duplicates = checkDuplicateStepIds(workflow);
      expect(duplicates).toEqual([]);
    });

    it('should detect duplicate IDs', () => {
      // Manually create workflow with duplicate IDs
      const workflow: WorkflowDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        steps: [
          {
            id: 'dup',
            name: 'Step 1',
            type: StepType.AGENT,
            config: { agentType: AgentType.CODER, taskType: 'task', payload: {} },
          },
          {
            id: 'dup', // Duplicate
            name: 'Step 2',
            type: StepType.AGENT,
            config: { agentType: AgentType.TESTER, taskType: 'task', payload: {} },
          },
        ],
        enabled: true,
        draft: false,
      };

      const duplicates = checkDuplicateStepIds(workflow);
      expect(duplicates).toContain('dup');
    });
  });

  describe('validateStepDependencies', () => {
    it('should validate workflow with correct dependencies', () => {
      const workflow = WorkflowBuilder
        .create('test', 'Test')
        .agentStep('s1', 'Step 1', AgentType.CODER, 'task', {})
        .agentStep('s2', 'Step 2', AgentType.TESTER, 'task', {}, { dependsOn: ['s1'] })
        .build();

      const result = validateStepDependencies(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing dependencies', () => {
      const workflow: WorkflowDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        steps: [
          {
            id: 's1',
            name: 'Step 1',
            type: StepType.AGENT,
            dependsOn: ['nonexistent'],
            config: { agentType: AgentType.CODER, taskType: 'task', payload: {} },
          },
        ],
        enabled: true,
        draft: false,
      };

      const result = validateStepDependencies(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('nonexistent');
    });
  });

  describe('Condition Helpers', () => {
    describe('createCondition', () => {
      it('should create simple condition', () => {
        const cond = createCondition('status', ConditionOperator.EQUALS, 'active');
        expect(cond).toEqual({
          left: 'status',
          operator: ConditionOperator.EQUALS,
          right: 'active',
        });
      });

      it('should create condition without right value', () => {
        const cond = createCondition('value', ConditionOperator.IS_NOT_NULL);
        expect(cond).toEqual({
          left: 'value',
          operator: ConditionOperator.IS_NOT_NULL,
          right: undefined,
        });
      });
    });

    describe('and', () => {
      it('should create AND condition', () => {
        const c1 = createCondition('a', ConditionOperator.EQUALS, 1);
        const c2 = createCondition('b', ConditionOperator.EQUALS, 2);
        const result = and(c1, c2);

        expect(result).toEqual({
          operator: ConditionOperator.AND,
          conditions: [c1, c2],
        });
      });
    });

    describe('or', () => {
      it('should create OR condition', () => {
        const c1 = createCondition('a', ConditionOperator.EQUALS, 1);
        const c2 = createCondition('b', ConditionOperator.EQUALS, 2);
        const result = or(c1, c2);

        expect(result).toEqual({
          operator: ConditionOperator.OR,
          conditions: [c1, c2],
        });
      });
    });

    describe('not', () => {
      it('should create NOT condition', () => {
        const c = createCondition('status', ConditionOperator.EQUALS, 'failed');
        const result = not(c);

        expect(result).toEqual({
          operator: ConditionOperator.NOT,
          condition: c,
        });
      });
    });

    describe('Nested conditions', () => {
      it('should support complex nested conditions', () => {
        const result = or(
          and(
            createCondition('a', ConditionOperator.EQUALS, 1),
            createCondition('b', ConditionOperator.GREATER_THAN, 0)
          ),
          not(createCondition('c', ConditionOperator.IS_NULL))
        );

        expect(result.operator).toBe(ConditionOperator.OR);
        expect((result as { conditions: ConditionExpression[] }).conditions).toHaveLength(2);
      });
    });
  });

  describe('createAgentStep', () => {
    it('should create valid agent step', () => {
      const step = createAgentStep('s1', 'Test Step', AgentType.CODER, 'generate', { x: 1 });

      expect(step.id).toBe('s1');
      expect(step.name).toBe('Test Step');
      expect(step.type).toBe(StepType.AGENT);
      expect(step.config.agentType).toBe(AgentType.CODER);
      expect(step.config.taskType).toBe('generate');
      expect(step.config.payload).toEqual({ x: 1 });
    });
  });

  // ==========================================================================
  // Complex Workflow Tests
  // ==========================================================================

  describe('Complex Workflow Scenarios', () => {
    it('should build a complete CI/CD workflow', () => {
      const workflow = WorkflowBuilder
        .create('ci-cd', 'CI/CD Pipeline')
        .description('Complete CI/CD workflow for code deployment')
        .version('2.0.0')
        .input({ name: 'repository', type: 'string', required: true })
        .input({ name: 'branch', type: 'string', required: true, defaultValue: 'main' })
        .output({ name: 'deploymentUrl', type: 'string', required: true })

        // Parallel: Lint and Test
        .parallel('quality-checks', 'Quality Checks', [
          createAgentStep('lint', 'Lint Code', AgentType.REVIEWER, 'lint', {
            repo: '${inputs.repository}',
          }),
          createAgentStep('test', 'Run Tests', AgentType.TESTER, 'test', {
            repo: '${inputs.repository}',
          }),
        ], { failFast: true })

        // Build
        .agentStep('build', 'Build Application', AgentType.CODER, 'build', {
          repo: '${inputs.repository}',
          branch: '${inputs.branch}',
        }, { dependsOn: ['quality-checks'] })

        // Conditional: Deploy to staging or production
        .condition(
          'deploy-target',
          'Choose Deployment Target',
          createCondition('${inputs.branch}', ConditionOperator.EQUALS, 'main'),
          [createAgentStep('deploy-prod', 'Deploy to Production', AgentType.CODER, 'deploy', {
            environment: 'production',
          })],
          [createAgentStep('deploy-staging', 'Deploy to Staging', AgentType.CODER, 'deploy', {
            environment: 'staging',
          })]
        )

        // Policies
        .retry({ maxAttempts: 3, initialDelay: 5000, maxDelay: 60000, backoffMultiplier: 2 })
        .timeout({ stepTimeout: 300000, workflowTimeout: 1800000 })
        .errorHandling({ onError: 'fail' })

        // Triggers
        .trigger({ type: 'webhook', webhookPath: '/ci/trigger' })
        .trigger({ type: 'event', eventName: 'git.push' })

        // Metadata
        .metadata({
          author: 'devops-team',
          tags: ['ci-cd', 'automation'],
        })

        .build();

      // Validate structure
      expect(workflow.id).toBe('ci-cd');
      expect(workflow.steps).toHaveLength(3); // quality-checks, build, deploy-target
      expect(workflow.inputs).toHaveLength(2);
      expect(workflow.outputs).toHaveLength(1);
      expect(workflow.triggers).toHaveLength(2);

      // Validate all steps
      const allIds = getAllStepIds(workflow);
      expect(allIds).toContain('quality-checks');
      expect(allIds).toContain('lint');
      expect(allIds).toContain('test');
      expect(allIds).toContain('build');
      expect(allIds).toContain('deploy-target');
      expect(allIds).toContain('deploy-prod');
      expect(allIds).toContain('deploy-staging');

      // No duplicates
      expect(checkDuplicateStepIds(workflow)).toEqual([]);

      // Valid dependencies
      expect(validateStepDependencies(workflow).valid).toBe(true);
    });

    it('should build a data processing workflow with loops', () => {
      const workflow = WorkflowBuilder
        .create('data-process', 'Data Processing Pipeline')
        .version('1.0.0')
        .input({ name: 'files', type: 'array', required: true })

        // Loop through files
        .loop('process-files', 'Process Each File', LoopType.FOR_EACH, [
          createAgentStep('validate', 'Validate File', AgentType.REVIEWER, 'validate', {
            file: '${item}',
          }),
          createAgentStep('transform', 'Transform Data', AgentType.CODER, 'transform', {
            file: '${item}',
          }),
        ], { items: '${inputs.files}', maxIterations: 100 })

        // Aggregate results
        .agentStep('aggregate', 'Aggregate Results', AgentType.CODER, 'aggregate', {
          results: '${steps.process-files.output.results}',
        }, { dependsOn: ['process-files'] })

        .build();

      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].type).toBe(StepType.LOOP);

      const allIds = getAllStepIds(workflow);
      expect(allIds).toContain('process-files');
      expect(allIds).toContain('validate');
      expect(allIds).toContain('transform');
      expect(allIds).toContain('aggregate');
    });
  });
});
