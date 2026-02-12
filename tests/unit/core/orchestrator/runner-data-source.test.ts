/**
 * RunnerDataSource Unit Tests (T16)
 */

import { EventEmitter } from 'events';
import {
  RunnerDataSource,
  createRunnerDataSource,
} from '../../../../src/core/orchestrator/runner-data-source';
import type { IACPMessageBus, ACPMessage } from '../../../../src/core/protocols';

// Minimal mock runner (EventEmitter)
function makeMockRunner(): EventEmitter {
  return new EventEmitter();
}

// Minimal mock message bus
function makeMockBus(): IACPMessageBus & { published: ACPMessage[] } {
  const published: ACPMessage[] = [];
  return {
    published,
    publish: jest.fn(async (msg: ACPMessage) => {
      published.push(msg);
    }),
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    on: jest.fn(() => ({ unsubscribe: jest.fn() })),
    request: jest.fn(),
    subscriptionCount: jest.fn().mockReturnValue(0),
    clear: jest.fn(),
  };
}

describe('RunnerDataSource (T16)', () => {
  let runner: EventEmitter;
  let bus: ReturnType<typeof makeMockBus>;
  let source: RunnerDataSource;

  beforeEach(() => {
    runner = makeMockRunner();
    bus = makeMockBus();
    source = new RunnerDataSource({
      runner: runner as any,
      messageBus: bus,
      sourceId: 'test-runner',
    });
  });

  afterEach(() => {
    source.disconnect();
    runner.removeAllListeners();
  });

  it('should not publish before connect', () => {
    runner.emit('started');
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('should report connected status', () => {
    expect(source.isConnected()).toBe(false);
    source.connect();
    expect(source.isConnected()).toBe(true);
    source.disconnect();
    expect(source.isConnected()).toBe(false);
  });

  it('should not double-connect', () => {
    source.connect();
    source.connect();
    runner.emit('started');
    // Only one listener, so one publish call
    expect(bus.publish).toHaveBeenCalledTimes(1);
  });

  it('should publish system:health on started', () => {
    source.connect();
    runner.emit('started');
    expect(bus.published.length).toBe(1);
    expect(bus.published[0].type).toBe('system:health');
    expect(bus.published[0].source).toBe('test-runner');
    expect((bus.published[0].payload as any).status).toBe('healthy');
  });

  it('should publish system:health on stopped', () => {
    source.connect();
    runner.emit('stopped');
    expect(bus.published[0].type).toBe('system:health');
    expect((bus.published[0].payload as any).status).toBe('unhealthy');
  });

  it('should publish system:health (degraded) on error', () => {
    source.connect();
    runner.emit('error', new Error('boom'));
    expect(bus.published[0].type).toBe('system:health');
    expect((bus.published[0].payload as any).status).toBe('degraded');
    expect((bus.published[0].payload as any).error).toBe('boom');
  });

  it('should publish task:status (running) on workflow:started', () => {
    source.connect();
    runner.emit('workflow:started', 'task-1');
    expect(bus.published[0].type).toBe('task:status');
    expect((bus.published[0].payload as any).taskId).toBe('task-1');
    expect((bus.published[0].payload as any).status).toBe('running');
  });

  it('should publish task:result and task:status on workflow:completed', () => {
    source.connect();
    runner.emit('workflow:completed', {
      success: true,
      taskId: 'task-2',
      result: 'ok',
      duration: 500,
      teamType: 'development',
    });
    expect(bus.published.length).toBe(2);
    expect(bus.published[0].type).toBe('task:result');
    expect((bus.published[0].payload as any).taskId).toBe('task-2');
    expect((bus.published[0].payload as any).success).toBe(true);
    expect(bus.published[1].type).toBe('task:status');
    expect((bus.published[1].payload as any).status).toBe('completed');
  });

  it('should publish task:status (failed) on workflow:failed', () => {
    source.connect();
    runner.emit('workflow:failed', 'task-3', new Error('fail'));
    expect(bus.published[0].type).toBe('task:status');
    expect((bus.published[0].payload as any).taskId).toBe('task-3');
    expect((bus.published[0].payload as any).status).toBe('failed');
    expect((bus.published[0].payload as any).message).toBe('fail');
  });

  it('should publish agent:event on goal:started', () => {
    source.connect();
    runner.emit('goal:started', 'goal-1');
    expect(bus.published[0].type).toBe('agent:event');
    expect((bus.published[0].payload as any).event).toBe('goal:started');
    expect((bus.published[0].payload as any).goalId).toBe('goal-1');
  });

  it('should publish agent:event on goal:completed', () => {
    source.connect();
    runner.emit('goal:completed', {
      success: true,
      goalId: 'goal-2',
      tasks: [],
      totalDuration: 1000,
      completedTasks: 3,
      failedTasks: 0,
    });
    expect(bus.published[0].type).toBe('agent:event');
    expect((bus.published[0].payload as any).event).toBe('goal:completed');
    expect((bus.published[0].payload as any).goalId).toBe('goal-2');
    expect((bus.published[0].payload as any).completedTasks).toBe(3);
  });

  it('should stop publishing after disconnect', () => {
    source.connect();
    source.disconnect();
    runner.emit('started');
    runner.emit('workflow:started', 'task-x');
    expect(bus.published.length).toBe(0);
  });

  it('should use default sourceId when not specified', () => {
    const ds = createRunnerDataSource({
      runner: runner as any,
      messageBus: bus,
    });
    ds.connect();
    runner.emit('started');
    expect(bus.published[0].source).toBe('runner');
    ds.disconnect();
  });
});
