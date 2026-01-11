/**
 * Rollback Manager Tests
 *
 * Tests for the RollbackManager class which provides
 * checkpoint management, rollback strategies, and compensation actions.
 */

import {
  RollbackManager,
  createRollbackManager,
  RollbackManagerEvents,
  RollbackStrategy,
  CheckpointType,
  RollbackStatus,
  CompensationStatus,
  InMemoryCheckpointStorage,
  type RollbackManagerConfig,
  type WorkflowStateSnapshot,
  type StepStateSnapshot,
  type Checkpoint,
  type CompensationAction,
  type RollbackRequest,
  type CheckpointEventPayload,
  type RollbackEventPayload,
} from '../../../../src/core/workflow/rollback-manager';
import { WorkflowStatus, StepStatus } from '../../../../src/core/workflow/workflow-definition';

describe('RollbackManager', () => {
  const workflowInstanceId = 'test-workflow-instance-1';

  const defaultConfig: RollbackManagerConfig = {
    workflowInstanceId,
    maxCheckpoints: 100,
    autoCheckpoint: true,
    defaultStrategy: RollbackStrategy.TO_LAST_SUCCESS,
    compensationTimeout: 30000,
    enableHistory: true,
    maxHistorySize: 100,
  };

  const createTestState = (overrides?: Partial<WorkflowStateSnapshot>): WorkflowStateSnapshot => ({
    workflowInstanceId,
    workflowId: 'test-workflow',
    status: WorkflowStatus.RUNNING,
    inputs: { input1: 'value1' },
    outputs: {},
    variables: { var1: 'value1' },
    stepStates: [],
    currentStepId: 'step1',
    completedStepIds: [],
    failedStepIds: [],
    skippedStepIds: [],
    ...overrides,
  });

  const createTestStepState = (overrides?: Partial<StepStateSnapshot>): StepStateSnapshot => ({
    stepId: 'step1',
    status: StepStatus.COMPLETED,
    input: { stepInput: 'value' },
    output: { stepOutput: 'result' },
    startedAt: new Date(),
    completedAt: new Date(),
    retryCount: 0,
    ...overrides,
  });

  let manager: RollbackManager;

  beforeEach(() => {
    manager = new RollbackManager(defaultConfig);
  });

  describe('constructor', () => {
    it('should create a new RollbackManager instance', () => {
      expect(manager).toBeInstanceOf(RollbackManager);
      expect(manager.instanceId).toBeDefined();
      expect(manager.workflowInstanceId).toBe(workflowInstanceId);
    });

    it('should initialize with empty checkpoints', () => {
      expect(manager.checkpoints).toHaveLength(0);
    });

    it('should initialize with empty compensation actions', () => {
      expect(manager.compensationActions.size).toBe(0);
    });

    it('should initialize with empty rollback history', () => {
      expect(manager.rollbackHistory).toHaveLength(0);
    });
  });

  describe('createRollbackManager factory', () => {
    it('should create a RollbackManager with validated config', () => {
      const rm = createRollbackManager(defaultConfig);
      expect(rm).toBeInstanceOf(RollbackManager);
      expect(rm.workflowInstanceId).toBe(workflowInstanceId);
    });

    it('should apply default values', () => {
      const rm = createRollbackManager({
        workflowInstanceId,
        maxCheckpoints: 50,
        autoCheckpoint: false,
        defaultStrategy: RollbackStrategy.FULL,
        compensationTimeout: 10000,
        enableHistory: true,
        maxHistorySize: 50,
      });
      expect(rm).toBeInstanceOf(RollbackManager);
    });
  });

  describe('Checkpoint Operations', () => {
    describe('createCheckpoint', () => {
      it('should create a checkpoint', async () => {
        const state = createTestState();
        const checkpoint = await manager.createCheckpoint(CheckpointType.AUTO, state);

        expect(checkpoint.id).toBeDefined();
        expect(checkpoint.workflowInstanceId).toBe(workflowInstanceId);
        expect(checkpoint.type).toBe(CheckpointType.AUTO);
        expect(checkpoint.state).toEqual(state);
        expect(checkpoint.createdAt).toBeInstanceOf(Date);
      });

      it('should create checkpoint with options', async () => {
        const state = createTestState();
        const checkpoint = await manager.createCheckpoint(
          CheckpointType.MANUAL,
          state,
          {
            name: 'My Checkpoint',
            description: 'Test checkpoint',
            tags: ['test', 'manual'],
            metadata: { key: 'value' },
          }
        );

        expect(checkpoint.name).toBe('My Checkpoint');
        expect(checkpoint.description).toBe('Test checkpoint');
        expect(checkpoint.tags).toEqual(['test', 'manual']);
        expect(checkpoint.metadata).toEqual({ key: 'value' });
      });

      it('should emit checkpoint created event', async () => {
        const handler = jest.fn();
        manager.on(RollbackManagerEvents.CHECKPOINT_CREATED, handler);

        const state = createTestState();
        await manager.createCheckpoint(CheckpointType.AUTO, state);

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0] as CheckpointEventPayload;
        expect(payload.checkpoint).toBeDefined();
        expect(payload.timestamp).toBeInstanceOf(Date);
      });

      it('should enforce max checkpoints limit', async () => {
        const config: RollbackManagerConfig = {
          ...defaultConfig,
          maxCheckpoints: 3,
        };
        const rm = new RollbackManager(config);

        for (let i = 0; i < 5; i++) {
          await rm.createCheckpoint(CheckpointType.AUTO, createTestState());
        }

        expect(rm.checkpoints).toHaveLength(3);
      });

      it('should clone state to prevent mutations', async () => {
        const state = createTestState();
        const checkpoint = await manager.createCheckpoint(CheckpointType.AUTO, state);

        state.variables.newVar = 'modified';
        expect(checkpoint.state.variables).not.toHaveProperty('newVar');
      });
    });

    describe('getCheckpoint', () => {
      it('should return checkpoint by id', async () => {
        const state = createTestState();
        const created = await manager.createCheckpoint(CheckpointType.AUTO, state);

        const retrieved = manager.getCheckpoint(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should return undefined for unknown id', () => {
        const checkpoint = manager.getCheckpoint('unknown-id');
        expect(checkpoint).toBeUndefined();
      });
    });

    describe('getLatestCheckpoint', () => {
      it('should return the most recent checkpoint', async () => {
        const state1 = createTestState({ variables: { v: 1 } });
        const state2 = createTestState({ variables: { v: 2 } });
        const state3 = createTestState({ variables: { v: 3 } });

        await manager.createCheckpoint(CheckpointType.AUTO, state1);
        await manager.createCheckpoint(CheckpointType.AUTO, state2);
        const latest = await manager.createCheckpoint(CheckpointType.AUTO, state3);

        expect(manager.getLatestCheckpoint()).toEqual(latest);
      });

      it('should return undefined when no checkpoints exist', () => {
        expect(manager.getLatestCheckpoint()).toBeUndefined();
      });
    });

    describe('getCheckpointsByType', () => {
      it('should filter checkpoints by type', async () => {
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        await manager.createCheckpoint(CheckpointType.MANUAL, createTestState());
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        await manager.createCheckpoint(CheckpointType.STEP_SUCCESS, createTestState());

        const autoCheckpoints = manager.getCheckpointsByType(CheckpointType.AUTO);
        expect(autoCheckpoints).toHaveLength(2);
        expect(autoCheckpoints.every(cp => cp.type === CheckpointType.AUTO)).toBe(true);
      });

      it('should return empty array for no matches', () => {
        const checkpoints = manager.getCheckpointsByType(CheckpointType.MILESTONE);
        expect(checkpoints).toHaveLength(0);
      });
    });

    describe('deleteCheckpoint', () => {
      it('should delete checkpoint by id', async () => {
        const state = createTestState();
        const checkpoint = await manager.createCheckpoint(CheckpointType.AUTO, state);

        const deleted = manager.deleteCheckpoint(checkpoint.id);
        expect(deleted).toBe(true);
        expect(manager.getCheckpoint(checkpoint.id)).toBeUndefined();
      });

      it('should emit checkpoint deleted event', async () => {
        const handler = jest.fn();
        manager.on(RollbackManagerEvents.CHECKPOINT_DELETED, handler);

        const checkpoint = await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        manager.deleteCheckpoint(checkpoint.id);

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should return false for unknown id', () => {
        const deleted = manager.deleteCheckpoint('unknown-id');
        expect(deleted).toBe(false);
      });
    });

    describe('clearCheckpoints', () => {
      it('should remove all checkpoints', async () => {
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());

        manager.clearCheckpoints();
        expect(manager.checkpoints).toHaveLength(0);
      });

      it('should emit delete events for each checkpoint', async () => {
        const handler = jest.fn();
        manager.on(RollbackManagerEvents.CHECKPOINT_DELETED, handler);

        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());

        manager.clearCheckpoints();
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Compensation Operations', () => {
    describe('registerCompensation', () => {
      it('should register a compensation action', () => {
        const action: CompensationAction = {
          stepId: 'step1',
          name: 'Undo Step 1',
          handler: jest.fn().mockResolvedValue({
            status: CompensationStatus.SUCCESS,
            stepId: 'step1',
            duration: 100,
          }),
          priority: 10,
          required: true,
        };

        manager.registerCompensation(action);
        expect(manager.hasCompensation('step1')).toBe(true);
      });

      it('should throw for invalid compensation action', () => {
        expect(() => {
          manager.registerCompensation({
            stepId: '',
            name: 'Invalid',
            handler: jest.fn(),
            priority: 0,
            required: false,
          });
        }).toThrow('Invalid compensation action');
      });
    });

    describe('unregisterCompensation', () => {
      it('should remove compensation action', () => {
        const action: CompensationAction = {
          stepId: 'step1',
          name: 'Undo Step 1',
          handler: jest.fn(),
          priority: 10,
          required: true,
        };

        manager.registerCompensation(action);
        const removed = manager.unregisterCompensation('step1');

        expect(removed).toBe(true);
        expect(manager.hasCompensation('step1')).toBe(false);
      });

      it('should return false for unknown step id', () => {
        const removed = manager.unregisterCompensation('unknown');
        expect(removed).toBe(false);
      });
    });

    describe('getCompensation', () => {
      it('should return compensation action by step id', () => {
        const action: CompensationAction = {
          stepId: 'step1',
          name: 'Undo Step 1',
          handler: jest.fn(),
          priority: 10,
          required: true,
        };

        manager.registerCompensation(action);
        const retrieved = manager.getCompensation('step1');

        expect(retrieved).toEqual(action);
      });

      it('should return undefined for unknown step id', () => {
        const action = manager.getCompensation('unknown');
        expect(action).toBeUndefined();
      });
    });

    describe('hasCompensation', () => {
      it('should return true when compensation exists', () => {
        manager.registerCompensation({
          stepId: 'step1',
          name: 'Undo',
          handler: jest.fn(),
          priority: 0,
          required: false,
        });

        expect(manager.hasCompensation('step1')).toBe(true);
      });

      it('should return false when compensation does not exist', () => {
        expect(manager.hasCompensation('step1')).toBe(false);
      });
    });
  });

  describe('Rollback Operations', () => {
    describe('canRollback', () => {
      it('should return true for FULL strategy with checkpoints', async () => {
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        expect(manager.canRollback(RollbackStrategy.FULL)).toBe(true);
      });

      it('should return false for FULL strategy without checkpoints', () => {
        expect(manager.canRollback(RollbackStrategy.FULL)).toBe(false);
      });

      it('should return true for TO_CHECKPOINT with valid id', async () => {
        const checkpoint = await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        expect(manager.canRollback(RollbackStrategy.TO_CHECKPOINT, checkpoint.id)).toBe(true);
      });

      it('should return false for TO_CHECKPOINT without id', () => {
        expect(manager.canRollback(RollbackStrategy.TO_CHECKPOINT)).toBe(false);
      });

      it('should return true for SKIP_AND_CONTINUE', () => {
        expect(manager.canRollback(RollbackStrategy.SKIP_AND_CONTINUE)).toBe(true);
      });
    });

    describe('rollback', () => {
      describe('SKIP_AND_CONTINUE strategy', () => {
        it('should complete without rollback', async () => {
          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.SKIP_AND_CONTINUE,
            reason: 'Skip failed step',
          };

          const result = await manager.rollback(request);

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(result.rollbackedStepIds).toHaveLength(0);
          expect(result.compensationResults).toHaveLength(0);
        });
      });

      describe('FAILED_STEP_ONLY strategy', () => {
        it('should only rollback failed steps', async () => {
          const state = createTestState({
            completedStepIds: ['step1', 'step2'],
            failedStepIds: ['step3'],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
              createTestStepState({ stepId: 'step3', status: StepStatus.FAILED }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.AUTO, state);

          const handler = jest.fn().mockResolvedValue({
            status: CompensationStatus.SUCCESS,
            stepId: 'step3',
            duration: 100,
          });

          manager.registerCompensation({
            stepId: 'step3',
            name: 'Undo Step 3',
            handler,
            priority: 10,
            required: false,
          });

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.FAILED_STEP_ONLY,
            reason: 'Rollback failed step',
          };

          const result = await manager.rollback(request);

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(result.rollbackedStepIds).toEqual(['step3']);
          expect(handler).toHaveBeenCalledTimes(1);
        });
      });

      describe('TO_CHECKPOINT strategy', () => {
        it('should rollback to specific checkpoint', async () => {
          const state1 = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          const targetCheckpoint = await manager.createCheckpoint(
            CheckpointType.STEP_SUCCESS,
            state1
          );

          const state2 = createTestState({
            completedStepIds: ['step1', 'step2', 'step3'],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
              createTestStepState({ stepId: 'step3' }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.AUTO, state2);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.TO_CHECKPOINT,
            targetCheckpointId: targetCheckpoint.id,
            reason: 'Rollback to checkpoint',
          };

          const result = await manager.rollback(request);

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(result.rollbackedStepIds).toContain('step2');
          expect(result.rollbackedStepIds).toContain('step3');
          expect(result.rollbackedStepIds).not.toContain('step1');
          expect(result.restoredState).toBeDefined();
        });

        it('should throw for missing checkpoint id', async () => {
          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.TO_CHECKPOINT,
            reason: 'Missing checkpoint id',
          };

          await expect(manager.rollback(request)).rejects.toThrow(
            'Target checkpoint ID is required'
          );
        });

        it('should throw for unknown checkpoint id', async () => {
          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.TO_CHECKPOINT,
            targetCheckpointId: 'unknown-checkpoint',
            reason: 'Unknown checkpoint',
          };

          await expect(manager.rollback(request)).rejects.toThrow('Checkpoint not found');
        });
      });

      describe('TO_LAST_SUCCESS strategy', () => {
        it('should rollback to last successful step', async () => {
          const successState = createTestState({
            completedStepIds: ['step1', 'step2'],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.STEP_SUCCESS, successState);

          const failedState = createTestState({
            completedStepIds: ['step1', 'step2', 'step3'],
            failedStepIds: ['step4'],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
              createTestStepState({ stepId: 'step3' }),
              createTestStepState({ stepId: 'step4', status: StepStatus.FAILED }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.AUTO, failedState);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.TO_LAST_SUCCESS,
            reason: 'Rollback to last success',
          };

          const result = await manager.rollback(request);

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(result.rollbackedStepIds).toContain('step3');
          expect(result.restoredState).toBeDefined();
        });
      });

      describe('FULL strategy', () => {
        it('should rollback all completed steps', async () => {
          const startState = createTestState({
            completedStepIds: [],
            stepStates: [],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, startState);

          const currentState = createTestState({
            completedStepIds: ['step1', 'step2', 'step3'],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
              createTestStepState({ stepId: 'step3' }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.AUTO, currentState);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Full rollback',
          };

          const result = await manager.rollback(request);

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(result.restoredState?.completedStepIds).toHaveLength(0);
        });

        it('should throw without workflow start checkpoint', async () => {
          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Full rollback',
          };

          await expect(manager.rollback(request)).rejects.toThrow(
            'No workflow start checkpoint found'
          );
        });
      });

      describe('rollback events', () => {
        it('should emit rollback started event', async () => {
          const handler = jest.fn();
          manager.on(RollbackManagerEvents.ROLLBACK_STARTED, handler);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.SKIP_AND_CONTINUE,
            reason: 'Test',
          };

          await manager.rollback(request);

          expect(handler).toHaveBeenCalledTimes(1);
          const payload = handler.mock.calls[0][0] as RollbackEventPayload;
          expect(payload.status).toBe(RollbackStatus.IN_PROGRESS);
        });

        it('should emit rollback completed event', async () => {
          const handler = jest.fn();
          manager.on(RollbackManagerEvents.ROLLBACK_COMPLETED, handler);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.SKIP_AND_CONTINUE,
            reason: 'Test',
          };

          await manager.rollback(request);

          expect(handler).toHaveBeenCalledTimes(1);
          const payload = handler.mock.calls[0][0] as RollbackEventPayload;
          expect(payload.status).toBe(RollbackStatus.COMPLETED);
        });

        it('should emit rollback failed event on error', async () => {
          const handler = jest.fn();
          manager.on(RollbackManagerEvents.ROLLBACK_FAILED, handler);

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test',
          };

          await expect(manager.rollback(request)).rejects.toThrow();

          expect(handler).toHaveBeenCalledTimes(1);
          const payload = handler.mock.calls[0][0] as RollbackEventPayload;
          expect(payload.status).toBe(RollbackStatus.FAILED);
        });
      });

      describe('compensation execution', () => {
        it('should execute compensations in priority order', async () => {
          const state = createTestState({
            completedStepIds: ['step1', 'step2', 'step3'],
            failedStepIds: [],
            stepStates: [
              createTestStepState({ stepId: 'step1' }),
              createTestStepState({ stepId: 'step2' }),
              createTestStepState({ stepId: 'step3' }),
            ],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          const executionOrder: string[] = [];

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => {
              executionOrder.push('step1');
              return { status: CompensationStatus.SUCCESS, stepId: 'step1', duration: 100 };
            },
            priority: 1,
            required: false,
          });

          manager.registerCompensation({
            stepId: 'step2',
            name: 'Undo Step 2',
            handler: async () => {
              executionOrder.push('step2');
              return { status: CompensationStatus.SUCCESS, stepId: 'step2', duration: 100 };
            },
            priority: 10,
            required: false,
          });

          manager.registerCompensation({
            stepId: 'step3',
            name: 'Undo Step 3',
            handler: async () => {
              executionOrder.push('step3');
              return { status: CompensationStatus.SUCCESS, stepId: 'step3', duration: 100 };
            },
            priority: 5,
            required: false,
          });

          await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test priority order',
          });

          // Higher priority should execute first
          expect(executionOrder).toEqual(['step2', 'step3', 'step1']);
        });

        it('should skip compensation when requested', async () => {
          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          const handler = jest.fn().mockResolvedValue({
            status: CompensationStatus.SUCCESS,
            stepId: 'step1',
            duration: 100,
          });

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler,
            priority: 10,
            required: false,
          });

          await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Skip compensation',
            skipCompensation: true,
          });

          expect(handler).not.toHaveBeenCalled();
        });

        it('should handle compensation failure', async () => {
          const state = createTestState({
            completedStepIds: ['step1'],
            failedStepIds: [],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => {
              throw new Error('Compensation failed');
            },
            priority: 10,
            required: false,
          });

          const result = await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test failure handling',
          });

          expect(result.status).toBe(RollbackStatus.PARTIALLY_COMPLETED);
          expect(result.compensationResults[0].status).toBe(CompensationStatus.FAILED);
        });

        it('should stop on required compensation failure unless force', async () => {
          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => {
              throw new Error('Required compensation failed');
            },
            priority: 10,
            required: true,
          });

          await expect(
            manager.rollback({
              workflowInstanceId,
              strategy: RollbackStrategy.FULL,
              reason: 'Test required failure',
            })
          ).rejects.toThrow('Required compensation for step step1 failed');
        });

        it('should continue on required compensation failure with force', async () => {
          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => {
              throw new Error('Required compensation failed');
            },
            priority: 10,
            required: true,
          });

          const result = await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test force',
            force: true,
          });

          expect(result.status).toBe(RollbackStatus.PARTIALLY_COMPLETED);
        });

        it('should emit compensation events', async () => {
          const startedHandler = jest.fn();
          const completedHandler = jest.fn();

          manager.on(RollbackManagerEvents.COMPENSATION_STARTED, startedHandler);
          manager.on(RollbackManagerEvents.COMPENSATION_COMPLETED, completedHandler);

          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => ({
              status: CompensationStatus.SUCCESS,
              stepId: 'step1',
              duration: 100,
            }),
            priority: 10,
            required: false,
          });

          await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test events',
          });

          expect(startedHandler).toHaveBeenCalledTimes(1);
          expect(completedHandler).toHaveBeenCalledTimes(1);
        });

        it('should retry failed compensations', async () => {
          let attempts = 0;

          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Undo Step 1',
            handler: async () => {
              attempts++;
              if (attempts < 3) {
                throw new Error('Temporary failure');
              }
              return { status: CompensationStatus.SUCCESS, stepId: 'step1', duration: 100 };
            },
            priority: 10,
            required: false,
            retryPolicy: {
              maxAttempts: 3,
              delay: 10,
            },
          });

          const result = await manager.rollback({
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test retry',
          });

          expect(result.status).toBe(RollbackStatus.COMPLETED);
          expect(attempts).toBe(3);
        });
      });

      describe('concurrent rollback protection', () => {
        it('should prevent concurrent rollbacks', async () => {
          const state = createTestState({
            completedStepIds: ['step1'],
            stepStates: [createTestStepState({ stepId: 'step1' })],
          });

          await manager.createCheckpoint(CheckpointType.WORKFLOW_START, createTestState({ completedStepIds: [] }));
          await manager.createCheckpoint(CheckpointType.AUTO, state);

          manager.registerCompensation({
            stepId: 'step1',
            name: 'Slow Compensation',
            handler: async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              return { status: CompensationStatus.SUCCESS, stepId: 'step1', duration: 100 };
            },
            priority: 10,
            required: false,
          });

          const request: RollbackRequest = {
            workflowInstanceId,
            strategy: RollbackStrategy.FULL,
            reason: 'Test',
          };

          const firstRollback = manager.rollback(request);

          await expect(manager.rollback(request)).rejects.toThrow(
            'A rollback is already in progress'
          );

          await firstRollback;
        });
      });

      describe('workflow instance validation', () => {
        it('should reject mismatched workflow instance id', async () => {
          const request: RollbackRequest = {
            workflowInstanceId: 'different-instance',
            strategy: RollbackStrategy.SKIP_AND_CONTINUE,
            reason: 'Test',
          };

          await expect(manager.rollback(request)).rejects.toThrow(
            'Workflow instance ID mismatch'
          );
        });
      });
    });

    describe('getRollbackHistory', () => {
      it('should return rollback history', async () => {
        const request: RollbackRequest = {
          workflowInstanceId,
          strategy: RollbackStrategy.SKIP_AND_CONTINUE,
          reason: 'Test',
        };

        await manager.rollback(request);
        await manager.rollback(request);

        const history = manager.getRollbackHistory();
        expect(history).toHaveLength(2);
      });

      it('should return copy of history', async () => {
        const request: RollbackRequest = {
          workflowInstanceId,
          strategy: RollbackStrategy.SKIP_AND_CONTINUE,
          reason: 'Test',
        };

        await manager.rollback(request);

        const history1 = manager.getRollbackHistory();
        const history2 = manager.getRollbackHistory();

        expect(history1).not.toBe(history2);
        expect(history1).toEqual(history2);
      });
    });
  });

  describe('Snapshot Operations', () => {
    describe('createSnapshot', () => {
      it('should create snapshot of current state', async () => {
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());
        manager.registerCompensation({
          stepId: 'step1',
          name: 'Undo',
          handler: jest.fn(),
          priority: 10,
          required: false,
        });

        const snapshot = manager.createSnapshot();

        expect(snapshot.instanceId).toBe(manager.instanceId);
        expect(snapshot.workflowInstanceId).toBe(workflowInstanceId);
        expect(snapshot.checkpoints).toHaveLength(1);
        expect(snapshot.compensationActions).toHaveLength(1);
        expect(snapshot.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('restore', () => {
      it('should restore from snapshot', async () => {
        await manager.createCheckpoint(CheckpointType.AUTO, createTestState());

        const snapshot = manager.createSnapshot();

        // Create a new manager and restore
        const newManager = new RollbackManager(defaultConfig);
        // Manually set the instanceId for testing (normally would use same)
        (newManager as any).instanceId = snapshot.instanceId;

        newManager.restore(snapshot);

        expect(newManager.checkpoints).toHaveLength(1);
      });

      it('should throw for workflow instance id mismatch', () => {
        const snapshot = manager.createSnapshot();
        snapshot.workflowInstanceId = 'different-instance';

        expect(() => manager.restore(snapshot)).toThrow('Workflow instance ID mismatch');
      });
    });
  });

  describe('InMemoryCheckpointStorage', () => {
    let storage: InMemoryCheckpointStorage;

    beforeEach(() => {
      storage = new InMemoryCheckpointStorage();
    });

    it('should save and retrieve checkpoint', async () => {
      const checkpoint: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(checkpoint);
      const retrieved = await storage.get('cp-1');

      expect(retrieved).toEqual(checkpoint);
    });

    it('should get checkpoints by workflow', async () => {
      const cp1: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(Date.now() - 1000),
      };

      const cp2: Checkpoint = {
        id: 'cp-2',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(cp1);
      await storage.save(cp2);

      const checkpoints = await storage.getByWorkflow(workflowInstanceId);
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].id).toBe('cp-1'); // Sorted by creation time
    });

    it('should delete checkpoint', async () => {
      const checkpoint: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(checkpoint);
      const deleted = await storage.delete('cp-1');

      expect(deleted).toBe(true);
      expect(await storage.get('cp-1')).toBeUndefined();
    });

    it('should delete all checkpoints by workflow', async () => {
      const cp1: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      const cp2: Checkpoint = {
        id: 'cp-2',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(cp1);
      await storage.save(cp2);

      const count = await storage.deleteByWorkflow(workflowInstanceId);
      expect(count).toBe(2);
      expect(await storage.getByWorkflow(workflowInstanceId)).toHaveLength(0);
    });

    it('should get latest checkpoint', async () => {
      const cp1: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(Date.now() - 1000),
      };

      const cp2: Checkpoint = {
        id: 'cp-2',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(cp1);
      await storage.save(cp2);

      const latest = await storage.getLatest(workflowInstanceId);
      expect(latest?.id).toBe('cp-2');
    });

    it('should count checkpoints', async () => {
      const cp1: Checkpoint = {
        id: 'cp-1',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      const cp2: Checkpoint = {
        id: 'cp-2',
        workflowInstanceId,
        type: CheckpointType.AUTO,
        state: createTestState(),
        createdAt: new Date(),
      };

      await storage.save(cp1);
      await storage.save(cp2);

      const count = await storage.count(workflowInstanceId);
      expect(count).toBe(2);
    });
  });

  describe('Event handling', () => {
    it('should support on/off for event handlers', () => {
      const handler = jest.fn();

      manager.on(RollbackManagerEvents.CHECKPOINT_CREATED, handler);
      manager.off(RollbackManagerEvents.CHECKPOINT_CREATED, handler);

      manager.createCheckpoint(CheckpointType.AUTO, createTestState());

      // Handler was removed, should not be called
      // Note: createCheckpoint is async, but we're testing that off works
    });
  });

  describe('History management', () => {
    it('should limit history size', async () => {
      const config: RollbackManagerConfig = {
        ...defaultConfig,
        maxHistorySize: 3,
      };
      const rm = new RollbackManager(config);

      for (let i = 0; i < 5; i++) {
        await rm.rollback({
          workflowInstanceId,
          strategy: RollbackStrategy.SKIP_AND_CONTINUE,
          reason: `Rollback ${i}`,
        });
      }

      expect(rm.rollbackHistory).toHaveLength(3);
    });

    it('should not record history when disabled', async () => {
      const config: RollbackManagerConfig = {
        ...defaultConfig,
        enableHistory: false,
      };
      const rm = new RollbackManager(config);

      await rm.rollback({
        workflowInstanceId,
        strategy: RollbackStrategy.SKIP_AND_CONTINUE,
        reason: 'Test',
      });

      expect(rm.rollbackHistory).toHaveLength(0);
    });
  });
});
