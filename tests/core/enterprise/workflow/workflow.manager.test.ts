/**
 * Custom Workflows Manager Tests
 *
 * Feature: F5.14 - Custom Workflows
 * Tests for workflow builder, execution engine, and workflow templates
 */

import {
  CustomWorkflowsManager,
  type WorkflowStep,
  type WorkflowTrigger,
  type WorkflowEvent,
} from '../../../../src/core/enterprise/workflow/index.js';

describe('CustomWorkflowsManager', () => {
  let manager: CustomWorkflowsManager;
  const testTeamId = 'team-workflow-test';
  const testUserId = 'user-workflow-test';

  beforeEach(() => {
    manager = new CustomWorkflowsManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==================== Workflow CRUD ====================

  describe('createWorkflow', () => {
    it('should create a new workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow');
      expect(workflow.teamId).toBe(testTeamId);
      expect(workflow.status).toBe('draft');
      expect(workflow.version).toBe(1);
      expect(workflow.createdBy).toBe(testUserId);
      expect(workflow.createdAt).toBeInstanceOf(Date);
    });

    it('should create workflow with triggers and steps', async () => {
      const trigger: WorkflowTrigger = {
        id: 'trigger-1',
        type: 'manual',
        config: { type: 'manual' },
        enabled: true,
      };

      const step: WorkflowStep = {
        id: 'step-1',
        name: 'Test Step',
        type: 'action',
        config: { type: 'action', actionType: 'log_message', parameters: {} },
      };

      const workflow = await manager.createWorkflow({
        name: 'Workflow with components',
        teamId: testTeamId,
        createdBy: testUserId,
        triggers: [trigger],
        steps: [step],
      });

      expect(workflow.triggers.length).toBe(1);
      expect(workflow.steps.length).toBe(1);
    });

    it('should emit workflow.created event', async () => {
      const events: WorkflowEvent[] = [];
      manager.onWorkflowEvent((event) => events.push(event));

      await manager.createWorkflow({
        name: 'Event Test Workflow',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      expect(events.some((e) => e.type === 'workflow.created')).toBe(true);
    });
  });

  describe('getWorkflow', () => {
    it('should get a workflow by ID', async () => {
      const created = await manager.createWorkflow({
        name: 'Get Test',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const retrieved = await manager.getWorkflow(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent workflow', async () => {
      const retrieved = await manager.getWorkflow('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow properties', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Original Name',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const updated = await manager.updateWorkflow(workflow.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe(2);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(workflow.updatedAt.getTime());
    });

    it('should not allow changing ID, teamId, or createdBy', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Protected Fields',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const updated = await manager.updateWorkflow(workflow.id, {
        id: 'new-id',
        teamId: 'new-team',
        createdBy: 'new-user',
      } as any);

      expect(updated.id).toBe(workflow.id);
      expect(updated.teamId).toBe(testTeamId);
      expect(updated.createdBy).toBe(testUserId);
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(
        manager.updateWorkflow('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Workflow not found');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete a workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'To Delete',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const deleted = await manager.deleteWorkflow(workflow.id);
      expect(deleted).toBe(true);

      const retrieved = await manager.getWorkflow(workflow.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent workflow', async () => {
      const deleted = await manager.deleteWorkflow('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getWorkflows', () => {
    beforeEach(async () => {
      await manager.createWorkflow({
        name: 'Workflow 1',
        teamId: testTeamId,
        createdBy: testUserId,
      });
      await manager.createWorkflow({
        name: 'Workflow 2',
        teamId: testTeamId,
        createdBy: testUserId,
      });
      await manager.createWorkflow({
        name: 'Other Team Workflow',
        teamId: 'other-team',
        createdBy: testUserId,
      });
    });

    it('should get workflows by team', async () => {
      const workflows = await manager.getWorkflows(testTeamId);
      expect(workflows.length).toBe(2);
      expect(workflows.every((w) => w.teamId === testTeamId)).toBe(true);
    });

    it('should filter by status', async () => {
      const workflows = await manager.getWorkflows(testTeamId, 'draft');
      expect(workflows.every((w) => w.status === 'draft')).toBe(true);
    });

    it('should sort by updated date descending', async () => {
      const workflows = await manager.getWorkflows(testTeamId);

      for (let i = 1; i < workflows.length; i++) {
        expect(workflows[i - 1].updatedAt.getTime()).toBeGreaterThanOrEqual(
          workflows[i].updatedAt.getTime()
        );
      }
    });
  });

  // ==================== Workflow Lifecycle ====================

  describe('activateWorkflow', () => {
    it('should activate a draft workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'To Activate',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      const activated = await manager.activateWorkflow(workflow.id);
      expect(activated.status).toBe('active');
    });

    it('should emit workflow.activated event', async () => {
      const events: WorkflowEvent[] = [];
      manager.onWorkflowEvent((event) => events.push(event));

      const workflow = await manager.createWorkflow({
        name: 'Activation Event',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);

      expect(events.some((e) => e.type === 'workflow.activated')).toBe(true);
    });
  });

  describe('pauseWorkflow', () => {
    it('should pause an active workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'To Pause',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const paused = await manager.pauseWorkflow(workflow.id);

      expect(paused.status).toBe('paused');
    });
  });

  describe('archiveWorkflow', () => {
    it('should archive a workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'To Archive',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const archived = await manager.archiveWorkflow(workflow.id);
      expect(archived.status).toBe('archived');
    });
  });

  describe('cloneWorkflow', () => {
    it('should clone a workflow', async () => {
      const original = await manager.createWorkflow({
        name: 'Original',
        description: 'Original description',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      const cloned = await manager.cloneWorkflow(original.id, 'Cloned Workflow', 'another-user');

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.name).toBe('Cloned Workflow');
      expect(cloned.description).toBe(original.description);
      expect(cloned.steps.length).toBe(original.steps.length);
      expect(cloned.createdBy).toBe('another-user');
      expect(cloned.status).toBe('draft');
    });
  });

  // ==================== Steps Management ====================

  describe('addStep', () => {
    it('should add a step to workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Add Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const step: WorkflowStep = {
        id: 'new-step',
        name: 'New Step',
        type: 'action',
        config: { type: 'action', actionType: 'log_message', parameters: {} },
      };

      const updated = await manager.addStep(workflow.id, step);
      expect(updated.steps.length).toBe(1);
      expect(updated.steps[0].name).toBe('New Step');
    });

    it('should add step after specific step', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Add Step After',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [
          { id: 'step-1', name: 'Step 1', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
          { id: 'step-3', name: 'Step 3', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
        ],
      });

      const newStep: WorkflowStep = {
        id: 'step-2',
        name: 'Step 2',
        type: 'action',
        config: { type: 'action', actionType: 'log_message', parameters: {} },
      };

      const updated = await manager.addStep(workflow.id, newStep, 'step-1');

      expect(updated.steps.length).toBe(3);
      expect(updated.steps[1].id).toBe('step-2');
    });
  });

  describe('updateStep', () => {
    it('should update a step', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Update Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Original Name',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      const updated = await manager.updateStep(workflow.id, 'step-1', {
        name: 'Updated Name',
      });

      expect(updated.steps[0].name).toBe('Updated Name');
    });

    it('should throw error for non-existent step', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Update Step Error',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      await expect(
        manager.updateStep(workflow.id, 'non-existent', { name: 'New Name' })
      ).rejects.toThrow('Step not found');
    });
  });

  describe('removeStep', () => {
    it('should remove a step', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Remove Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [
          { id: 'step-1', name: 'Step 1', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
          { id: 'step-2', name: 'Step 2', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
        ],
      });

      const updated = await manager.removeStep(workflow.id, 'step-1');

      expect(updated.steps.length).toBe(1);
      expect(updated.steps[0].id).toBe('step-2');
    });
  });

  describe('reorderSteps', () => {
    it('should reorder steps', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Reorder Steps Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [
          { id: 'step-1', name: 'Step 1', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
          { id: 'step-2', name: 'Step 2', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
          { id: 'step-3', name: 'Step 3', type: 'action', config: { type: 'action', actionType: 'log_message', parameters: {} } },
        ],
      });

      const updated = await manager.reorderSteps(workflow.id, ['step-3', 'step-1', 'step-2']);

      expect(updated.steps[0].id).toBe('step-3');
      expect(updated.steps[1].id).toBe('step-1');
      expect(updated.steps[2].id).toBe('step-2');
    });
  });

  // ==================== Triggers Management ====================

  describe('addTrigger', () => {
    it('should add a trigger', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Add Trigger Test',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const trigger: WorkflowTrigger = {
        id: 'trigger-1',
        type: 'schedule',
        config: { type: 'schedule', cron: '0 0 * * *' },
        enabled: true,
      };

      const updated = await manager.addTrigger(workflow.id, trigger);
      expect(updated.triggers.length).toBe(1);
    });
  });

  describe('updateTrigger', () => {
    it('should update a trigger', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Update Trigger Test',
        teamId: testTeamId,
        createdBy: testUserId,
        triggers: [{
          id: 'trigger-1',
          type: 'schedule',
          config: { type: 'schedule', cron: '0 0 * * *' },
          enabled: true,
        }],
      });

      const updated = await manager.updateTrigger(workflow.id, 'trigger-1', {
        enabled: false,
      });

      expect(updated.triggers[0].enabled).toBe(false);
    });
  });

  describe('removeTrigger', () => {
    it('should remove a trigger', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Remove Trigger Test',
        teamId: testTeamId,
        createdBy: testUserId,
        triggers: [
          { id: 'trigger-1', type: 'schedule', config: { type: 'schedule', cron: '0 0 * * *' }, enabled: true },
          { id: 'trigger-2', type: 'manual', config: { type: 'manual' }, enabled: true },
        ],
      });

      const updated = await manager.removeTrigger(workflow.id, 'trigger-1');
      expect(updated.triggers.length).toBe(1);
      expect(updated.triggers[0].id).toBe('trigger-2');
    });
  });

  // ==================== Execution ====================

  describe('executeWorkflow', () => {
    it('should execute an active workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Execute Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Log Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: { message: 'test' } },
        }],
      });

      await manager.activateWorkflow(workflow.id);

      const execution = await manager.executeWorkflow({
        workflowId: workflow.id,
        input: { key: 'value' },
        triggeredBy: testUserId,
      });

      expect(execution.id).toBeDefined();
      expect(execution.workflowId).toBe(workflow.id);
      expect(execution.input).toEqual({ key: 'value' });
      expect(execution.trigger.triggeredBy).toBe(testUserId);
    });

    it('should throw error for inactive workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Inactive Workflow',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      await expect(
        manager.executeWorkflow({ workflowId: workflow.id })
      ).rejects.toThrow('Workflow is not active');
    });

    it('should emit execution.started event', async () => {
      const events: WorkflowEvent[] = [];
      manager.onWorkflowEvent((event) => events.push(event));

      const workflow = await manager.createWorkflow({
        name: 'Execution Event Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      await manager.executeWorkflow({ workflowId: workflow.id });

      expect(events.some((e) => e.type === 'execution.started')).toBe(true);
    });
  });

  describe('getExecution', () => {
    it('should get an execution by ID', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Get Execution Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      const retrieved = await manager.getExecution(execution.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(execution.id);
    });
  });

  describe('getExecutions', () => {
    it('should get executions for a workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Get Executions Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      await manager.executeWorkflow({ workflowId: workflow.id });
      await manager.executeWorkflow({ workflowId: workflow.id });

      const executions = await manager.getExecutions(workflow.id);
      expect(executions.length).toBe(2);
    });

    it('should limit executions', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Limit Executions Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      await manager.executeWorkflow({ workflowId: workflow.id });
      await manager.executeWorkflow({ workflowId: workflow.id });
      await manager.executeWorkflow({ workflowId: workflow.id });

      const executions = await manager.getExecutions(workflow.id, undefined, 2);
      expect(executions.length).toBe(2);
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a running execution', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Cancel Execution Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Wait Step',
          type: 'wait',
          config: { type: 'wait', waitType: 'duration', durationMs: 60000 },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      const cancelled = await manager.cancelExecution(execution.id);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('pauseExecution', () => {
    it('should pause a running execution', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Pause Execution Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Wait Step',
          type: 'wait',
          config: { type: 'wait', waitType: 'duration', durationMs: 60000 },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      const paused = await manager.pauseExecution(execution.id);
      expect(paused.status).toBe('paused');
    });
  });

  describe('resumeExecution', () => {
    it('should resume a paused execution', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Resume Execution Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });
      await manager.pauseExecution(execution.id);

      const resumed = await manager.resumeExecution(execution.id);
      expect(resumed.status).toBe('running');
    });
  });

  // ==================== Templates ====================

  describe('getTemplates', () => {
    it('should get all templates', async () => {
      const templates = await manager.getTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const templates = await manager.getTemplates('ci_cd');
      expect(templates.every((t) => t.category === 'ci_cd')).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should get a template by ID', async () => {
      const templates = await manager.getTemplates();
      const template = await manager.getTemplate(templates[0].id);
      expect(template).toBeDefined();
    });

    it('should return undefined for non-existent template', async () => {
      const template = await manager.getTemplate('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('createFromTemplate', () => {
    it('should create workflow from template', async () => {
      const templates = await manager.getTemplates();
      const template = templates[0];

      const workflow = await manager.createFromTemplate({
        templateId: template.id,
        name: 'From Template',
        teamId: testTeamId,
        createdBy: testUserId,
        variables: { deployTarget: 'production' },
      });

      expect(workflow.name).toBe('From Template');
      expect(workflow.teamId).toBe(testTeamId);
      expect(workflow.steps.length).toBeGreaterThan(0);
    });

    it('should throw error for missing required variables', async () => {
      const templates = await manager.getTemplates();
      const template = templates[0];

      await expect(
        manager.createFromTemplate({
          templateId: template.id,
          name: 'Missing Variables',
          teamId: testTeamId,
          createdBy: testUserId,
          variables: {},
        })
      ).rejects.toThrow('Missing required variable');
    });
  });

  describe('saveAsTemplate', () => {
    it('should save workflow as template', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Template Source',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      const template = await manager.saveAsTemplate(
        workflow.id,
        'My Template',
        'custom',
        [{ name: 'varName', displayName: 'Variable', type: 'string', required: true }]
      );

      expect(template.name).toBe('My Template');
      expect(template.category).toBe('custom');
      expect(template.isBuiltIn).toBe(false);
    });
  });

  // ==================== Validation ====================

  describe('validateWorkflow', () => {
    it('should validate a valid workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Valid Workflow',
        teamId: testTeamId,
        createdBy: testUserId,
        triggers: [{
          id: 'trigger-1',
          type: 'manual',
          config: { type: 'manual' },
          enabled: true,
        }],
        steps: [{
          id: 'step-1',
          name: 'Test Step',
          type: 'action',
          config: { type: 'action', actionType: 'log_message', parameters: {} },
        }],
      });

      const result = await manager.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors for invalid workflow', async () => {
      const workflow = await manager.createWorkflow({
        name: '',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      // Manually set empty name to bypass creation validation
      const retrieved = await manager.getWorkflow(workflow.id);
      (retrieved as any).name = '';

      const result = await manager.validateWorkflow(retrieved!);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_NAME')).toBe(true);
    });

    it('should return warnings for workflow without steps', async () => {
      const workflow = await manager.createWorkflow({
        name: 'No Steps',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const result = await manager.validateWorkflow(workflow);
      expect(result.warnings.some((w) => w.code === 'NO_STEPS')).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('should validate valid input', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Input Validation',
        teamId: testTeamId,
        createdBy: testUserId,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      });

      const result = await manager.validateInput(workflow.id, { name: 'Test' });
      expect(result.valid).toBe(true);
    });

    it('should return errors for missing required fields', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Required Input',
        teamId: testTeamId,
        createdBy: testUserId,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      });

      const result = await manager.validateInput(workflow.id, {});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });
  });

  // ==================== Events ====================

  describe('onWorkflowEvent', () => {
    it('should subscribe to events', async () => {
      const events: WorkflowEvent[] = [];
      const unsubscribe = manager.onWorkflowEvent((event) => events.push(event));

      await manager.createWorkflow({
        name: 'Event Test',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      expect(events.length).toBeGreaterThan(0);
      unsubscribe();
    });

    it('should unsubscribe from events', async () => {
      const events: WorkflowEvent[] = [];
      const unsubscribe = manager.onWorkflowEvent((event) => events.push(event));

      await manager.createWorkflow({
        name: 'Event Test 1',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      const countBefore = events.length;
      unsubscribe();

      await manager.createWorkflow({
        name: 'Event Test 2',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      expect(events.length).toBe(countBefore);
    });
  });

  // ==================== Lifecycle ====================

  describe('dispose', () => {
    it('should dispose manager', async () => {
      await manager.createWorkflow({
        name: 'To Dispose',
        teamId: testTeamId,
        createdBy: testUserId,
      });

      manager.dispose();

      await expect(
        manager.createWorkflow({
          name: 'After Dispose',
          teamId: testTeamId,
          createdBy: testUserId,
        })
      ).rejects.toThrow('CustomWorkflowsManager has been disposed');
    });
  });

  // ==================== Step Execution ====================

  describe('step execution', () => {
    it('should execute action steps', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Action Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Set Variable',
          type: 'action',
          config: {
            type: 'action',
            actionType: 'set_variable',
            parameters: { name: 'testVar', value: 'testValue' },
          },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      // Wait for async execution to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalExecution = await manager.getExecution(execution.id);
      expect(finalExecution!.stepExecutions.length).toBeGreaterThan(0);
    });

    it('should execute wait steps', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Wait Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Wait Step',
          type: 'wait',
          config: { type: 'wait', waitType: 'duration', durationMs: 10 },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalExecution = await manager.getExecution(execution.id);
      expect(finalExecution!.stepExecutions.length).toBeGreaterThan(0);
    });

    it('should execute transform steps', async () => {
      const workflow = await manager.createWorkflow({
        name: 'Transform Step Test',
        teamId: testTeamId,
        createdBy: testUserId,
        steps: [{
          id: 'step-1',
          name: 'Transform Step',
          type: 'transform',
          config: { type: 'transform', expression: '.data', transformType: 'jq' },
        }],
      });

      await manager.activateWorkflow(workflow.id);
      const execution = await manager.executeWorkflow({ workflowId: workflow.id });

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalExecution = await manager.getExecution(execution.id);
      expect(finalExecution!.stepExecutions.length).toBeGreaterThan(0);
    });
  });
});
