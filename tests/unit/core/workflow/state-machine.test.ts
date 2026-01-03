/**
 * State Machine Unit Tests
 *
 * Tests for the generic state machine implementation including:
 * - Basic state transitions
 * - Guard conditions
 * - Entry/exit actions
 * - Transition actions
 * - History tracking
 * - Event emission
 * - Workflow and step state machines
 */

import {
  StateMachine,
  StateMachineEvents,
  StateMachineConfig,
  createWorkflowStateMachine,
  createStepStateMachine,
  isWorkflowStatusFinal,
  isStepStatusFinal,
  getValidWorkflowTransitions,
  getValidStepTransitions,
} from '../../../../src/core/workflow/state-machine';
import { WorkflowStatus, StepStatus } from '../../../../src/core/workflow/workflow-definition';

// ============================================================================
// Test Data
// ============================================================================

type TrafficLightState = 'red' | 'yellow' | 'green';

interface TrafficLightContext {
  cycleCount: number;
  lastChangeTime?: Date;
}

function createTrafficLightConfig(): StateMachineConfig<TrafficLightState, TrafficLightContext> {
  return {
    id: 'traffic-light',
    initialState: 'red',
    states: [
      { name: 'red', metadata: { duration: 30000 } },
      { name: 'yellow', metadata: { duration: 5000 } },
      { name: 'green', metadata: { duration: 25000 } },
    ],
    transitions: [
      { from: 'red', to: 'green' },
      { from: 'green', to: 'yellow' },
      { from: 'yellow', to: 'red' },
    ],
    context: { cycleCount: 0 },
    enableHistory: true,
    maxHistorySize: 100,
  };
}

// ============================================================================
// StateMachine Basic Tests
// ============================================================================

describe('StateMachine', () => {
  describe('construction', () => {
    it('should create with valid configuration', () => {
      const config = createTrafficLightConfig();
      const machine = new StateMachine(config);

      expect(machine.id).toBe('traffic-light');
      expect(machine.currentState).toBe('red');
      expect(machine.context).toEqual({ cycleCount: 0 });
    });

    it('should throw if initial state not in states', () => {
      const config = createTrafficLightConfig();
      config.initialState = 'purple' as TrafficLightState;

      expect(() => new StateMachine(config)).toThrow("Initial state 'purple' not found");
    });

    it('should throw if transition references invalid state', () => {
      const config = createTrafficLightConfig();
      config.transitions.push({ from: 'red', to: 'blue' as TrafficLightState });

      expect(() => new StateMachine(config)).toThrow("Transition 'to' state 'blue' not found");
    });

    it('should throw if transition from invalid state', () => {
      const config = createTrafficLightConfig();
      config.transitions.push({ from: 'purple' as TrafficLightState, to: 'red' });

      expect(() => new StateMachine(config)).toThrow("Transition 'from' state 'purple' not found");
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transitions', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      expect(machine.canTransitionTo('green')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      expect(machine.canTransitionTo('yellow')).toBe(false);
      expect(machine.canTransitionTo('red')).toBe(false);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return all valid transitions from current state', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      expect(machine.getAvailableTransitions()).toEqual(['green']);
    });

    it('should return empty array for final states', () => {
      const config: StateMachineConfig<'start' | 'end', object> = {
        id: 'simple',
        initialState: 'end',
        states: [
          { name: 'start' },
          { name: 'end' },
        ],
        transitions: [{ from: 'start', to: 'end' }],
        context: {},
      };

      const machine = new StateMachine(config);
      expect(machine.getAvailableTransitions()).toEqual([]);
    });
  });

  describe('transition', () => {
    it('should successfully transition to valid state', async () => {
      const machine = new StateMachine(createTrafficLightConfig());

      const result = await machine.transition('green');

      expect(result).toBe(true);
      expect(machine.currentState).toBe('green');
    });

    it('should fail transition to invalid state', async () => {
      const machine = new StateMachine(createTrafficLightConfig());

      const result = await machine.transition('yellow');

      expect(result).toBe(false);
      expect(machine.currentState).toBe('red');
    });

    it('should record transition in history', async () => {
      const machine = new StateMachine(createTrafficLightConfig());

      await machine.transition('green', 'timer');

      expect(machine.history).toHaveLength(1);
      expect(machine.history[0]).toMatchObject({
        from: 'red',
        to: 'green',
        trigger: 'timer',
      });
    });

    it('should complete full cycle', async () => {
      const machine = new StateMachine(createTrafficLightConfig());

      await machine.transition('green');
      await machine.transition('yellow');
      await machine.transition('red');

      expect(machine.currentState).toBe('red');
      expect(machine.history).toHaveLength(3);
    });
  });

  describe('guard conditions', () => {
    it('should block transition when guard returns false', async () => {
      const config: StateMachineConfig<'locked' | 'unlocked', { hasKey: boolean }> = {
        id: 'door',
        initialState: 'locked',
        states: [
          { name: 'locked' },
          { name: 'unlocked' },
        ],
        transitions: [
          {
            from: 'locked',
            to: 'unlocked',
            guard: (ctx) => ctx.hasKey,
          },
          { from: 'unlocked', to: 'locked' },
        ],
        context: { hasKey: false },
      };

      const machine = new StateMachine(config);

      expect(machine.canTransitionTo('unlocked')).toBe(false);
      const result = await machine.transition('unlocked');
      expect(result).toBe(false);
      expect(machine.currentState).toBe('locked');
    });

    it('should allow transition when guard returns true', async () => {
      const config: StateMachineConfig<'locked' | 'unlocked', { hasKey: boolean }> = {
        id: 'door',
        initialState: 'locked',
        states: [
          { name: 'locked' },
          { name: 'unlocked' },
        ],
        transitions: [
          {
            from: 'locked',
            to: 'unlocked',
            guard: (ctx) => ctx.hasKey,
          },
        ],
        context: { hasKey: true },
      };

      const machine = new StateMachine(config);

      expect(machine.canTransitionTo('unlocked')).toBe(true);
      const result = await machine.transition('unlocked');
      expect(result).toBe(true);
    });
  });

  describe('state actions', () => {
    it('should execute onEnter when entering state', async () => {
      const onEnter = jest.fn();
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a' },
          { name: 'b', onEnter },
        ],
        transitions: [{ from: 'a', to: 'b' }],
        context: {},
      };

      const machine = new StateMachine(config);
      await machine.transition('b');

      expect(onEnter).toHaveBeenCalledWith({}, 'b');
    });

    it('should execute onExit when leaving state', async () => {
      const onExit = jest.fn();
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a', onExit },
          { name: 'b' },
        ],
        transitions: [{ from: 'a', to: 'b' }],
        context: {},
      };

      const machine = new StateMachine(config);
      await machine.transition('b');

      expect(onExit).toHaveBeenCalledWith({}, 'a');
    });

    it('should execute actions in correct order', async () => {
      const order: string[] = [];
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a', onExit: () => { order.push('exit-a'); } },
          { name: 'b', onEnter: () => { order.push('enter-b'); } },
        ],
        transitions: [{
          from: 'a',
          to: 'b',
          action: () => { order.push('transition-action'); },
        }],
        context: {},
      };

      const machine = new StateMachine(config);
      await machine.transition('b');

      expect(order).toEqual(['exit-a', 'transition-action', 'enter-b']);
    });
  });

  describe('transition actions', () => {
    it('should execute transition action', async () => {
      const action = jest.fn();
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a' },
          { name: 'b' },
        ],
        transitions: [{ from: 'a', to: 'b', action }],
        context: {},
      };

      const machine = new StateMachine(config);
      await machine.transition('b');

      expect(action).toHaveBeenCalledWith({}, 'a', 'b');
    });

    it('should handle async transition action', async () => {
      let actionComplete = false;
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a' },
          { name: 'b' },
        ],
        transitions: [{
          from: 'a',
          to: 'b',
          action: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            actionComplete = true;
          },
        }],
        context: {},
      };

      const machine = new StateMachine(config);
      await machine.transition('b');

      expect(actionComplete).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit TRANSITION_STARTED event', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());
      machine.on(StateMachineEvents.TRANSITION_STARTED, handler);

      await machine.transition('green');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: 'traffic-light',
          currentState: 'red',
          targetState: 'green',
        })
      );
    });

    it('should emit TRANSITION_COMPLETED event', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());
      machine.on(StateMachineEvents.TRANSITION_COMPLETED, handler);

      await machine.transition('green');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: 'traffic-light',
          currentState: 'green',
          previousState: 'red',
        })
      );
    });

    it('should emit STATE_EXITED event', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());
      machine.on(StateMachineEvents.STATE_EXITED, handler);

      await machine.transition('green');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentState: 'red',
          targetState: 'green',
        })
      );
    });

    it('should emit STATE_ENTERED event', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());
      machine.on(StateMachineEvents.STATE_ENTERED, handler);

      await machine.transition('green');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentState: 'green',
          previousState: 'red',
        })
      );
    });

    it('should emit TRANSITION_DENIED for invalid transition', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());
      machine.on(StateMachineEvents.TRANSITION_DENIED, handler);

      await machine.transition('yellow');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentState: 'red',
          targetState: 'yellow',
        })
      );
    });

    it('should emit TRANSITION_FAILED on action error', async () => {
      const handler = jest.fn();
      const config: StateMachineConfig<'a' | 'b', object> = {
        id: 'test',
        initialState: 'a',
        states: [
          { name: 'a' },
          { name: 'b' },
        ],
        transitions: [{
          from: 'a',
          to: 'b',
          action: () => { throw new Error('Action failed'); },
        }],
        context: {},
      };

      const machine = new StateMachine(config);
      machine.on(StateMachineEvents.TRANSITION_FAILED, handler);

      await expect(machine.transition('b')).rejects.toThrow('Action failed');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentState: 'a',
          targetState: 'b',
          error: expect.any(Error),
        })
      );
    });

    it('should allow unsubscribing from events', async () => {
      const handler = jest.fn();
      const machine = new StateMachine(createTrafficLightConfig());

      machine.on(StateMachineEvents.TRANSITION_COMPLETED, handler);
      machine.off(StateMachineEvents.TRANSITION_COMPLETED, handler);

      await machine.transition('green');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('should track transition history', async () => {
      const machine = new StateMachine(createTrafficLightConfig());

      await machine.transition('green', 'trigger1');
      await machine.transition('yellow', 'trigger2');

      expect(machine.history).toHaveLength(2);
      expect(machine.history[0].from).toBe('red');
      expect(machine.history[0].to).toBe('green');
      expect(machine.history[0].trigger).toBe('trigger1');
      expect(machine.history[1].from).toBe('green');
      expect(machine.history[1].to).toBe('yellow');
    });

    it('should limit history size', async () => {
      const config = createTrafficLightConfig();
      config.maxHistorySize = 2;
      const machine = new StateMachine(config);

      await machine.transition('green');
      await machine.transition('yellow');
      await machine.transition('red');

      expect(machine.history).toHaveLength(2);
      expect(machine.history[0].to).toBe('yellow');
      expect(machine.history[1].to).toBe('red');
    });

    it('should not track history when disabled', async () => {
      const config = createTrafficLightConfig();
      config.enableHistory = false;
      const machine = new StateMachine(config);

      await machine.transition('green');

      expect(machine.history).toHaveLength(0);
    });
  });

  describe('context management', () => {
    it('should update context with updateContext', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      machine.updateContext(ctx => ({ ...ctx, cycleCount: 5 }));

      expect(machine.context.cycleCount).toBe(5);
    });

    it('should set context directly', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      machine.setContext({ cycleCount: 10 });

      expect(machine.context).toEqual({ cycleCount: 10 });
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const machine = new StateMachine(createTrafficLightConfig());
      await machine.transition('green');

      machine.reset();

      expect(machine.currentState).toBe('red');
    });

    it('should clear history on reset', async () => {
      const machine = new StateMachine(createTrafficLightConfig());
      await machine.transition('green');

      machine.reset();

      expect(machine.history).toHaveLength(0);
    });
  });

  describe('snapshot and restore', () => {
    it('should create snapshot of current state', async () => {
      const machine = new StateMachine(createTrafficLightConfig());
      await machine.transition('green');
      machine.updateContext(ctx => ({ ...ctx, cycleCount: 3 }));

      const snapshot = machine.snapshot();

      expect(snapshot.id).toBe('traffic-light');
      expect(snapshot.currentState).toBe('green');
      expect(snapshot.context.cycleCount).toBe(3);
    });

    it('should restore from snapshot', async () => {
      const machine = new StateMachine(createTrafficLightConfig());
      await machine.transition('green');
      const snapshot = machine.snapshot();

      await machine.transition('yellow');
      machine.restore(snapshot);

      expect(machine.currentState).toBe('green');
    });

    it('should throw on ID mismatch during restore', () => {
      const machine = new StateMachine(createTrafficLightConfig());
      const snapshot = machine.snapshot();
      snapshot.id = 'different-id';

      expect(() => machine.restore(snapshot)).toThrow('Snapshot ID mismatch');
    });
  });

  describe('state definition', () => {
    it('should get state definition', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      const def = machine.getStateDefinition('red');

      expect(def).toBeDefined();
      expect(def?.name).toBe('red');
      expect(def?.metadata).toEqual({ duration: 30000 });
    });

    it('should return undefined for unknown state', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      const def = machine.getStateDefinition('purple' as TrafficLightState);

      expect(def).toBeUndefined();
    });
  });

  describe('isFinalState', () => {
    it('should return true for states with no outgoing transitions', () => {
      const config: StateMachineConfig<'start' | 'end', object> = {
        id: 'simple',
        initialState: 'start',
        states: [
          { name: 'start' },
          { name: 'end' },
        ],
        transitions: [{ from: 'start', to: 'end' }],
        context: {},
      };

      const machine = new StateMachine(config);
      machine.transition('end');

      expect(machine.isFinalState()).toBe(true);
    });

    it('should return false for states with outgoing transitions', () => {
      const machine = new StateMachine(createTrafficLightConfig());

      expect(machine.isFinalState()).toBe(false);
    });
  });

  describe('multi-source transitions', () => {
    it('should handle transitions from multiple states', async () => {
      const config: StateMachineConfig<'a' | 'b' | 'error', object> = {
        id: 'multi',
        initialState: 'a',
        states: [
          { name: 'a' },
          { name: 'b' },
          { name: 'error' },
        ],
        transitions: [
          { from: 'a', to: 'b' },
          { from: ['a', 'b'], to: 'error' },
        ],
        context: {},
      };

      const machine = new StateMachine(config);

      // From a to error
      expect(machine.canTransitionTo('error')).toBe(true);

      await machine.transition('b');

      // From b to error
      expect(machine.canTransitionTo('error')).toBe(true);
      await machine.transition('error');
      expect(machine.currentState).toBe('error');
    });
  });
});

// ============================================================================
// Workflow State Machine Tests
// ============================================================================

describe('createWorkflowStateMachine', () => {
  it('should create with initial PENDING state', () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');

    expect(machine.currentState).toBe(WorkflowStatus.PENDING);
    expect(machine.context.instanceId).toBe('inst-1');
    expect(machine.context.workflowId).toBe('wf-1');
  });

  it('should allow PENDING -> RUNNING transition', async () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');

    const result = await machine.transition(WorkflowStatus.RUNNING);

    expect(result).toBe(true);
    expect(machine.currentState).toBe(WorkflowStatus.RUNNING);
    expect(machine.context.startedAt).toBeDefined();
  });

  it('should allow RUNNING -> COMPLETED transition', async () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');
    await machine.transition(WorkflowStatus.RUNNING);

    const result = await machine.transition(WorkflowStatus.COMPLETED);

    expect(result).toBe(true);
    expect(machine.context.completedAt).toBeDefined();
  });

  it('should allow RUNNING -> PAUSED -> RUNNING', async () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');
    await machine.transition(WorkflowStatus.RUNNING);

    await machine.transition(WorkflowStatus.PAUSED);
    expect(machine.currentState).toBe(WorkflowStatus.PAUSED);

    await machine.transition(WorkflowStatus.RUNNING);
    expect(machine.currentState).toBe(WorkflowStatus.RUNNING);
  });

  it('should not allow invalid transitions', async () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');

    // PENDING -> COMPLETED is invalid
    const result = await machine.transition(WorkflowStatus.COMPLETED);

    expect(result).toBe(false);
    expect(machine.currentState).toBe(WorkflowStatus.PENDING);
  });

  it('should call onStateChange callback', async () => {
    const onStateChange = jest.fn();
    const machine = createWorkflowStateMachine('inst-1', 'wf-1', { onStateChange });

    await machine.transition(WorkflowStatus.RUNNING);

    expect(onStateChange).toHaveBeenCalledWith(
      WorkflowStatus.PENDING,
      WorkflowStatus.RUNNING
    );
  });

  it('should not allow transitions from final states', async () => {
    const machine = createWorkflowStateMachine('inst-1', 'wf-1');
    await machine.transition(WorkflowStatus.RUNNING);
    await machine.transition(WorkflowStatus.COMPLETED);

    const result = await machine.transition(WorkflowStatus.RUNNING);

    expect(result).toBe(false);
    expect(machine.currentState).toBe(WorkflowStatus.COMPLETED);
  });
});

// ============================================================================
// Step State Machine Tests
// ============================================================================

describe('createStepStateMachine', () => {
  it('should create with initial PENDING state', () => {
    const machine = createStepStateMachine('step-1', 'inst-1');

    expect(machine.currentState).toBe(StepStatus.PENDING);
    expect(machine.context.stepId).toBe('step-1');
  });

  it('should allow PENDING -> RUNNING transition', async () => {
    const machine = createStepStateMachine('step-1', 'inst-1');

    await machine.transition(StepStatus.RUNNING);

    expect(machine.currentState).toBe(StepStatus.RUNNING);
    expect(machine.context.startedAt).toBeDefined();
  });

  it('should allow PENDING -> SKIPPED transition', async () => {
    const machine = createStepStateMachine('step-1', 'inst-1');

    await machine.transition(StepStatus.SKIPPED);

    expect(machine.currentState).toBe(StepStatus.SKIPPED);
    expect(machine.context.completedAt).toBeDefined();
  });

  it('should allow RUNNING -> COMPLETED transition', async () => {
    const machine = createStepStateMachine('step-1', 'inst-1');
    await machine.transition(StepStatus.RUNNING);

    await machine.transition(StepStatus.COMPLETED);

    expect(machine.currentState).toBe(StepStatus.COMPLETED);
  });

  it('should allow retry (RUNNING -> RUNNING) when under max retries', async () => {
    const machine = createStepStateMachine('step-1', 'inst-1', { maxRetries: 3 });
    await machine.transition(StepStatus.RUNNING);

    // Retry should be allowed
    expect(machine.canTransitionTo(StepStatus.RUNNING)).toBe(true);

    await machine.transition(StepStatus.RUNNING);
    expect(machine.context.retryCount).toBe(1);

    await machine.transition(StepStatus.RUNNING);
    expect(machine.context.retryCount).toBe(2);

    await machine.transition(StepStatus.RUNNING);
    expect(machine.context.retryCount).toBe(3);

    // Max retries reached
    expect(machine.canTransitionTo(StepStatus.RUNNING)).toBe(false);
  });

  it('should call onStateChange callback', async () => {
    const onStateChange = jest.fn();
    const machine = createStepStateMachine('step-1', 'inst-1', { onStateChange });

    await machine.transition(StepStatus.RUNNING);

    expect(onStateChange).toHaveBeenCalledWith(
      StepStatus.PENDING,
      StepStatus.RUNNING
    );
  });

  it('should support WAITING state', async () => {
    const machine = createStepStateMachine('step-1', 'inst-1');

    await machine.transition(StepStatus.WAITING);
    expect(machine.currentState).toBe(StepStatus.WAITING);

    await machine.transition(StepStatus.RUNNING);
    expect(machine.currentState).toBe(StepStatus.RUNNING);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('isWorkflowStatusFinal', () => {
  it('should return true for final statuses', () => {
    expect(isWorkflowStatusFinal(WorkflowStatus.COMPLETED)).toBe(true);
    expect(isWorkflowStatusFinal(WorkflowStatus.FAILED)).toBe(true);
    expect(isWorkflowStatusFinal(WorkflowStatus.CANCELLED)).toBe(true);
    expect(isWorkflowStatusFinal(WorkflowStatus.TIMEOUT)).toBe(true);
  });

  it('should return false for non-final statuses', () => {
    expect(isWorkflowStatusFinal(WorkflowStatus.PENDING)).toBe(false);
    expect(isWorkflowStatusFinal(WorkflowStatus.RUNNING)).toBe(false);
    expect(isWorkflowStatusFinal(WorkflowStatus.PAUSED)).toBe(false);
  });
});

describe('isStepStatusFinal', () => {
  it('should return true for final statuses', () => {
    expect(isStepStatusFinal(StepStatus.COMPLETED)).toBe(true);
    expect(isStepStatusFinal(StepStatus.FAILED)).toBe(true);
    expect(isStepStatusFinal(StepStatus.SKIPPED)).toBe(true);
    expect(isStepStatusFinal(StepStatus.CANCELLED)).toBe(true);
    expect(isStepStatusFinal(StepStatus.TIMEOUT)).toBe(true);
  });

  it('should return false for non-final statuses', () => {
    expect(isStepStatusFinal(StepStatus.PENDING)).toBe(false);
    expect(isStepStatusFinal(StepStatus.WAITING)).toBe(false);
    expect(isStepStatusFinal(StepStatus.RUNNING)).toBe(false);
  });
});

describe('getValidWorkflowTransitions', () => {
  it('should return valid transitions for PENDING', () => {
    const transitions = getValidWorkflowTransitions(WorkflowStatus.PENDING);

    expect(transitions).toContain(WorkflowStatus.RUNNING);
    expect(transitions).toContain(WorkflowStatus.CANCELLED);
    expect(transitions).not.toContain(WorkflowStatus.COMPLETED);
  });

  it('should return valid transitions for RUNNING', () => {
    const transitions = getValidWorkflowTransitions(WorkflowStatus.RUNNING);

    expect(transitions).toContain(WorkflowStatus.PAUSED);
    expect(transitions).toContain(WorkflowStatus.COMPLETED);
    expect(transitions).toContain(WorkflowStatus.FAILED);
    expect(transitions).toContain(WorkflowStatus.CANCELLED);
    expect(transitions).toContain(WorkflowStatus.TIMEOUT);
  });

  it('should return empty array for final states', () => {
    expect(getValidWorkflowTransitions(WorkflowStatus.COMPLETED)).toEqual([]);
    expect(getValidWorkflowTransitions(WorkflowStatus.FAILED)).toEqual([]);
  });
});

describe('getValidStepTransitions', () => {
  it('should return valid transitions for PENDING', () => {
    const transitions = getValidStepTransitions(StepStatus.PENDING);

    expect(transitions).toContain(StepStatus.WAITING);
    expect(transitions).toContain(StepStatus.RUNNING);
    expect(transitions).toContain(StepStatus.SKIPPED);
    expect(transitions).toContain(StepStatus.CANCELLED);
  });

  it('should return valid transitions for RUNNING', () => {
    const transitions = getValidStepTransitions(StepStatus.RUNNING);

    expect(transitions).toContain(StepStatus.COMPLETED);
    expect(transitions).toContain(StepStatus.FAILED);
    expect(transitions).toContain(StepStatus.RUNNING); // For retry
  });

  it('should return empty array for final states', () => {
    expect(getValidStepTransitions(StepStatus.COMPLETED)).toEqual([]);
    expect(getValidStepTransitions(StepStatus.FAILED)).toEqual([]);
    expect(getValidStepTransitions(StepStatus.SKIPPED)).toEqual([]);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  it('should handle self-transition', async () => {
    const config: StateMachineConfig<'idle' | 'active', { count: number }> = {
      id: 'self-transition',
      initialState: 'active',
      states: [
        { name: 'idle' },
        { name: 'active' },
      ],
      transitions: [
        {
          from: 'active',
          to: 'active',
          action: (ctx) => { ctx.count++; },
        },
      ],
      context: { count: 0 },
    };

    const machine = new StateMachine(config);
    await machine.transition('active');
    await machine.transition('active');

    expect(machine.context.count).toBe(2);
    expect(machine.history).toHaveLength(2);
  });

  it('should handle empty transitions config', () => {
    const config: StateMachineConfig<'only', object> = {
      id: 'single-state',
      initialState: 'only',
      states: [{ name: 'only' }],
      transitions: [],
      context: {},
    };

    const machine = new StateMachine(config);

    expect(machine.getAvailableTransitions()).toEqual([]);
    expect(machine.isFinalState()).toBe(true);
  });

  it('should handle concurrent transition attempts', async () => {
    const config: StateMachineConfig<'a' | 'b' | 'c', object> = {
      id: 'concurrent',
      initialState: 'a',
      states: [
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
      ],
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
      context: {},
    };

    const machine = new StateMachine(config);

    // Start two transitions at the same time
    const [result1, result2] = await Promise.all([
      machine.transition('b'),
      machine.transition('c'),
    ]);

    // One should succeed, one should fail (or both succeed to same state)
    expect(result1 || result2).toBe(true);
  });

  it('should preserve state on action error', async () => {
    const config: StateMachineConfig<'a' | 'b', object> = {
      id: 'error-test',
      initialState: 'a',
      states: [
        { name: 'a' },
        { name: 'b' },
      ],
      transitions: [{
        from: 'a',
        to: 'b',
        action: () => { throw new Error('Boom'); },
      }],
      context: {},
    };

    const machine = new StateMachine(config);

    await expect(machine.transition('b')).rejects.toThrow('Boom');
    expect(machine.currentState).toBe('a');
  });
});
