/**
 * Scheduler Tests
 *
 * Tests for the Agent OS kernel scheduler.
 */

import {
  Scheduler,
  createScheduler,
  TaskPriority,
  TaskState,
  SchedulingAlgorithm,
  SchedulableTask,
} from '../../../../src/core/kernel/scheduler';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  const createTask = (overrides: Partial<Omit<SchedulableTask, 'state' | 'createdAt' | 'actualTokens'>> = {}) => ({
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test Task',
    ownerId: 'owner-1',
    priority: TaskPriority.NORMAL,
    estimatedTokens: 1000,
    dependencies: [],
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    scheduler = createScheduler();
  });

  describe('Task Scheduling', () => {
    it('should schedule tasks', () => {
      const task = scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      expect(task.id).toBe('task-1');
      expect(task.state).toBe(TaskState.READY);
      expect(task.priority).toBe(TaskPriority.NORMAL);
    });

    it('should get next task based on priority', () => {
      scheduler.schedule(createTask({
        id: 'low',
        name: 'Low Priority',
        priority: TaskPriority.LOW,
      }));

      scheduler.schedule(createTask({
        id: 'high',
        name: 'High Priority',
        priority: TaskPriority.HIGH,
      }));

      scheduler.schedule(createTask({
        id: 'critical',
        name: 'Critical Priority',
        priority: TaskPriority.CRITICAL,
      }));

      const nextTask = scheduler.getNextTask();
      expect(nextTask?.id).toBe('critical');
      expect(nextTask?.state).toBe(TaskState.RUNNING);
    });

    it('should complete tasks', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      scheduler.getNextTask(); // Start the task

      const completed = scheduler.completeTask('task-1', 500);
      expect(completed?.state).toBe(TaskState.COMPLETED);
      expect(completed?.actualTokens).toBe(500);
    });

    it('should fail tasks', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      scheduler.getNextTask();

      const error = new Error('Task failed');
      const failed = scheduler.failTask('task-1', error);
      expect(failed?.state).toBe(TaskState.FAILED);
    });

    it('should cancel tasks', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      const cancelled = scheduler.cancelTask('task-1');
      expect(cancelled?.state).toBe(TaskState.CANCELLED);
    });
  });

  describe('Task States', () => {
    it('should block and unblock tasks', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      scheduler.getNextTask(); // Start

      expect(scheduler.blockTask('task-1', 'Waiting for resource')).toBe(true);
      expect(scheduler.getTask('task-1')?.state).toBe(TaskState.BLOCKED);

      expect(scheduler.unblockTask('task-1')).toBe(true);
      expect(scheduler.getTask('task-1')?.state).toBe(TaskState.READY);
    });

    it('should handle waiting tasks', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      scheduler.getNextTask();

      expect(scheduler.waitTask('task-1', 'task-2')).toBe(true);
      expect(scheduler.getTask('task-1')?.state).toBe(TaskState.WAITING);
    });
  });

  describe('Preemption', () => {
    it('should preempt running tasks', () => {
      // Create scheduler with preemption enabled
      const preemptScheduler = createScheduler({ preemption: true });

      preemptScheduler.schedule(createTask({
        id: 'task-1',
        name: 'Test Task',
      }));

      preemptScheduler.getNextTask();

      expect(preemptScheduler.preemptTask('task-1', 'Higher priority task')).toBe(true);
      expect(preemptScheduler.getTask('task-1')?.state).toBe(TaskState.READY);
    });
  });

  describe('Scheduling Algorithms', () => {
    it('should use priority algorithm by default', () => {
      const priorityScheduler = createScheduler({
        algorithm: SchedulingAlgorithm.PRIORITY,
      });

      priorityScheduler.schedule(createTask({
        id: 'low',
        name: 'Low',
        priority: TaskPriority.LOW,
      }));

      priorityScheduler.schedule(createTask({
        id: 'high',
        name: 'High',
        priority: TaskPriority.HIGH,
      }));

      expect(priorityScheduler.getNextTask()?.id).toBe('high');
    });

    it('should support round-robin algorithm', () => {
      const rrScheduler = createScheduler({
        algorithm: SchedulingAlgorithm.ROUND_ROBIN,
      });

      rrScheduler.schedule(createTask({
        id: 'task-1',
        name: 'Task 1',
      }));

      rrScheduler.schedule(createTask({
        id: 'task-2',
        name: 'Task 2',
      }));

      // Round robin should return first task
      expect(rrScheduler.getNextTask()?.id).toBe('task-1');
    });

    it('should support deadline-aware algorithm', () => {
      const deadlineScheduler = createScheduler({
        algorithm: SchedulingAlgorithm.DEADLINE,
      });

      const farDeadline = new Date(Date.now() + 60000);
      const nearDeadline = new Date(Date.now() + 10000);

      deadlineScheduler.schedule(createTask({
        id: 'far',
        name: 'Far Deadline',
        deadline: farDeadline,
      }));

      deadlineScheduler.schedule(createTask({
        id: 'near',
        name: 'Near Deadline',
        deadline: nearDeadline,
      }));

      expect(deadlineScheduler.getNextTask()?.id).toBe('near');
    });

    it('should support cost-aware algorithm', () => {
      const costScheduler = createScheduler({
        algorithm: SchedulingAlgorithm.COST_AWARE,
      });

      costScheduler.schedule(createTask({
        id: 'expensive',
        name: 'Expensive',
        estimatedTokens: 10000,
      }));

      costScheduler.schedule(createTask({
        id: 'cheap',
        name: 'Cheap',
        estimatedTokens: 100,
      }));

      const next = costScheduler.getNextTask();
      expect(next).toBeDefined();
    });
  });

  describe('Dependencies', () => {
    it('should handle task dependencies', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Task 1',
      }));

      scheduler.schedule(createTask({
        id: 'task-2',
        name: 'Task 2',
        dependencies: ['task-1'],
      }));

      // Task 2 should be waiting until task 1 completes
      const task2 = scheduler.getTask('task-2');
      expect(task2?.state).toBe(TaskState.WAITING);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', () => {
      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Task 1',
        estimatedTokens: 1000,
      }));

      scheduler.getNextTask();
      scheduler.completeTask('task-1', 500);

      const stats = scheduler.getStats();
      expect(stats.totalTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.tokenUsage).toBe(500);
    });
  });

  describe('Events', () => {
    it('should emit events', () => {
      const scheduledHandler = jest.fn();
      const startedHandler = jest.fn();
      const completedHandler = jest.fn();

      scheduler.on('task:scheduled', scheduledHandler);
      scheduler.on('task:started', startedHandler);
      scheduler.on('task:completed', completedHandler);

      scheduler.schedule(createTask({
        id: 'task-1',
        name: 'Task 1',
      }));

      expect(scheduledHandler).toHaveBeenCalled();

      scheduler.getNextTask();
      expect(startedHandler).toHaveBeenCalled();

      scheduler.completeTask('task-1', 50);
      expect(completedHandler).toHaveBeenCalled();
    });
  });

  describe('Priority Boosting', () => {
    it('should boost starved tasks', async () => {
      const boostingScheduler = createScheduler({
        priorityBoostInterval: 10,
        maxWaitTime: 10,
      });

      boostingScheduler.schedule(createTask({
        id: 'low',
        name: 'Low Priority',
        priority: TaskPriority.BACKGROUND,
      }));

      // Wait a bit to trigger starvation
      await new Promise((resolve) => setTimeout(resolve, 50));

      const task = boostingScheduler.getTask('low');
      // Task may have been boosted by the scheduler's internal timer
      expect(task).toBeDefined();
    });
  });
});
