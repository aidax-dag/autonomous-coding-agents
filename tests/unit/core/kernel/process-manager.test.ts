/**
 * Process Manager Tests
 *
 * Tests for the Agent OS kernel process manager.
 */

import {
  ProcessManager,
  createProcessManager,
  ProcessState,
  ProcessType,
  Signal,
} from '../../../../src/core/kernel/process-manager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = createProcessManager({
      enableHealthCheck: false,
      enableAutoRecovery: false,
    });
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('Process Lifecycle', () => {
    it('should create processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);

      expect(process).not.toBeNull();
      expect(process?.name).toBe('test-process');
      expect(process?.type).toBe(ProcessType.TASK);
      expect(process?.state).toBe(ProcessState.CREATED);
    });

    it('should create processes with options', () => {
      const process = manager.create('child-process', ProcessType.TASK, {
        ppid: 'parent-1',
        priority: 75,
        metadata: { tag: 'test' },
      });

      expect(process?.ppid).toBe('parent-1');
      expect(process?.priority).toBe(75);
      expect(process?.metadata?.tag).toBe('test');
    });

    it('should start processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      const started = manager.start(process.pid);
      expect(started).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.RUNNING);
    });

    it('should suspend and resume processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);

      expect(manager.suspend(process.pid)).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.SUSPENDED);

      expect(manager.resume(process.pid)).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.RUNNING);
    });

    it('should terminate processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);

      expect(manager.terminate(process.pid, 0, 'Normal exit')).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.TERMINATED);
      expect(manager.getProcess(process.pid)?.exitCode).toBe(0);
    });

    it('should fail processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);

      const error = new Error('Process failed');
      expect(manager.fail(process.pid, error)).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.FAILED);
    });

    it('should wait and wakeup processes', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);

      expect(manager.wait(process.pid)).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.WAITING);

      expect(manager.wakeup(process.pid)).toBe(true);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.RUNNING);
    });
  });

  describe('Process Information', () => {
    it('should get process by ID', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      const retrieved = manager.getProcess(process.pid);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-process');
    });

    it('should get all processes', () => {
      manager.create('process-1', ProcessType.TASK);
      manager.create('process-2', ProcessType.AGENT);

      const all = manager.getAllProcesses();
      expect(all.length).toBe(2);
    });

    it('should get processes by type', () => {
      manager.create('task-1', ProcessType.TASK);
      manager.create('task-2', ProcessType.TASK);
      manager.create('agent-1', ProcessType.AGENT);

      const tasks = manager.getProcessesByType(ProcessType.TASK);
      expect(tasks.length).toBe(2);
    });

    it('should get processes by state', () => {
      const p1 = manager.create('process-1', ProcessType.TASK);
      manager.create('process-2', ProcessType.TASK);

      if (p1) manager.start(p1.pid);

      const running = manager.getProcessesByState(ProcessState.RUNNING);
      const created = manager.getProcessesByState(ProcessState.CREATED);

      expect(running.length).toBe(1);
      expect(created.length).toBe(1);
    });

    it('should get child processes', () => {
      const parent = manager.create('parent', ProcessType.WORKFLOW);
      if (!parent) throw new Error('Parent not created');

      manager.create('child-1', ProcessType.TASK, { ppid: parent.pid });
      manager.create('child-2', ProcessType.TASK, { ppid: parent.pid });
      manager.create('other', ProcessType.TASK);

      const children = manager.getChildren(parent.pid);
      expect(children.length).toBe(2);
    });

    it('should get process tree', () => {
      const root = manager.create('root', ProcessType.WORKFLOW);
      if (!root) throw new Error('Root not created');

      const child = manager.create('child', ProcessType.TASK, { ppid: root.pid });
      if (!child) throw new Error('Child not created');

      manager.create('grandchild', ProcessType.TASK, { ppid: child.pid });

      const tree = manager.getProcessTree(root.pid);
      expect(tree.length).toBe(3);
    });
  });

  describe('Process Context', () => {
    it('should get process context', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      const context = manager.getContext(process.pid);
      expect(context).toBeDefined();
      expect(context?.pid).toBe(process.pid);
    });

    it('should set and get variables', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.setVariable(process.pid, 'key', 'value');
      const value = manager.getVariable(process.pid, 'key');

      expect(value).toBe('value');
    });

    it('should push and pop stack frames', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.pushFrame(process.pid, 'frame-1', { data: 1 });
      manager.pushFrame(process.pid, 'frame-2', { data: 2 });

      const popped = manager.popFrame(process.pid);
      expect(popped?.name).toBe('frame-2');

      const context = manager.getContext(process.pid);
      expect(context?.stack.length).toBe(1);
    });

    it('should update resource usage', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.updateResourceUsage(process.pid, {
        cpuTimeMs: 100,
        tokensUsed: 500,
      });

      const updated = manager.getProcess(process.pid);
      expect(updated?.resourceUsage.cpuTimeMs).toBe(100);
      expect(updated?.resourceUsage.tokensUsed).toBe(500);
    });
  });

  describe('Checkpointing', () => {
    it('should create checkpoints', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);
      manager.setVariable(process.pid, 'progress', 50);

      const checkpoint = manager.createCheckpoint(process.pid);

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.state).toBe(ProcessState.RUNNING);
    });

    it('should restore from checkpoints', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);
      manager.setVariable(process.pid, 'progress', 50);

      const checkpoint = manager.createCheckpoint(process.pid);

      // Modify state
      manager.setVariable(process.pid, 'progress', 100);
      manager.wait(process.pid);

      // Restore
      expect(manager.restoreFromCheckpoint(process.pid, checkpoint?.id)).toBe(true);

      const restored = manager.getProcess(process.pid);
      expect(restored?.state).toBe(ProcessState.RUNNING);
    });
  });

  describe('Signals', () => {
    it('should send SIGTERM', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);
      manager.sendSignal(process.pid, Signal.SIGTERM);

      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.TERMINATED);
    });

    it('should send SIGKILL', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);
      manager.sendSignal(process.pid, Signal.SIGKILL);

      const terminated = manager.getProcess(process.pid);
      expect(terminated?.state).toBe(ProcessState.TERMINATED);
      expect(terminated?.exitCode).toBe(137);
    });

    it('should send SIGSTOP and SIGCONT', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      manager.start(process.pid);

      manager.sendSignal(process.pid, Signal.SIGSTOP);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.SUSPENDED);

      manager.sendSignal(process.pid, Signal.SIGCONT);
      expect(manager.getProcess(process.pid)?.state).toBe(ProcessState.RUNNING);
    });

    it('should register custom signal handlers', () => {
      const process = manager.create('test-process', ProcessType.TASK);
      if (!process) throw new Error('Process not created');

      const handler = jest.fn();
      manager.onSignal(process.pid, Signal.SIGUSR1, handler);
      manager.sendSignal(process.pid, Signal.SIGUSR1);

      expect(handler).toHaveBeenCalledWith(Signal.SIGUSR1);
    });
  });

  describe('Inter-Process Communication', () => {
    it('should send messages between processes', () => {
      const p1 = manager.create('sender', ProcessType.TASK);
      const p2 = manager.create('receiver', ProcessType.TASK);

      if (!p1 || !p2) throw new Error('Processes not created');

      const msgId = manager.sendMessage(p1.pid, p2.pid, 'greeting', { text: 'Hello' });

      expect(msgId).not.toBeNull();
      expect(manager.getPendingMessagesCount(p2.pid)).toBe(1);
    });

    it('should receive messages', () => {
      const p1 = manager.create('sender', ProcessType.TASK);
      const p2 = manager.create('receiver', ProcessType.TASK);

      if (!p1 || !p2) throw new Error('Processes not created');

      manager.sendMessage(p1.pid, p2.pid, 'data', { value: 42 });

      const message = manager.receiveMessage(p2.pid);

      expect(message).toBeDefined();
      expect(message?.type).toBe('data');
      expect((message?.payload as { value: number }).value).toBe(42);
    });

    it('should wakeup waiting processes on message', () => {
      const p1 = manager.create('sender', ProcessType.TASK);
      const p2 = manager.create('receiver', ProcessType.TASK);

      if (!p1 || !p2) throw new Error('Processes not created');

      manager.start(p2.pid);
      manager.wait(p2.pid);

      expect(manager.getProcess(p2.pid)?.state).toBe(ProcessState.WAITING);

      manager.sendMessage(p1.pid, p2.pid, 'wakeup', {});

      expect(manager.getProcess(p2.pid)?.state).toBe(ProcessState.RUNNING);
    });
  });

  describe('Process Groups', () => {
    it('should create process groups', () => {
      const leader = manager.create('leader', ProcessType.WORKFLOW);
      if (!leader) throw new Error('Leader not created');

      const group = manager.createGroup('test-group', leader.pid);

      expect(group).not.toBeNull();
      expect(group?.name).toBe('test-group');
      expect(group?.leader).toBe(leader.pid);
    });

    it('should add and remove members', () => {
      const leader = manager.create('leader', ProcessType.WORKFLOW);
      const member = manager.create('member', ProcessType.TASK);

      if (!leader || !member) throw new Error('Processes not created');

      const group = manager.createGroup('test-group', leader.pid);
      if (!group) throw new Error('Group not created');

      manager.addToGroup(group.id, member.pid);

      const updated = manager.getGroup(group.id);
      expect(updated?.members.size).toBe(2);

      manager.removeFromGroup(group.id, member.pid);
      expect(manager.getGroup(group.id)?.members.size).toBe(1);
    });

    it('should send signals to entire group', () => {
      const leader = manager.create('leader', ProcessType.WORKFLOW);
      const member1 = manager.create('member1', ProcessType.TASK);
      const member2 = manager.create('member2', ProcessType.TASK);

      if (!leader || !member1 || !member2) throw new Error('Processes not created');

      manager.start(leader.pid);
      manager.start(member1.pid);
      manager.start(member2.pid);

      const group = manager.createGroup('test-group', leader.pid);
      if (!group) throw new Error('Group not created');

      manager.addToGroup(group.id, member1.pid);
      manager.addToGroup(group.id, member2.pid);

      manager.sendGroupSignal(group.id, Signal.SIGSTOP);

      expect(manager.getProcess(leader.pid)?.state).toBe(ProcessState.SUSPENDED);
      expect(manager.getProcess(member1.pid)?.state).toBe(ProcessState.SUSPENDED);
      expect(manager.getProcess(member2.pid)?.state).toBe(ProcessState.SUSPENDED);
    });
  });

  describe('Process Limits', () => {
    it('should enforce max process limit', () => {
      const limitedManager = createProcessManager({
        maxProcesses: 2,
        enableHealthCheck: false,
        enableAutoRecovery: false,
      });

      limitedManager.create('process-1', ProcessType.TASK);
      limitedManager.create('process-2', ProcessType.TASK);
      const third = limitedManager.create('process-3', ProcessType.TASK);

      expect(third).toBeNull();

      limitedManager.shutdown();
    });

    it('should enforce max process per type limit', () => {
      const limitedManager = createProcessManager({
        maxProcesses: 100,
        maxProcessesPerType: {
          [ProcessType.TASK]: 2,
        },
        enableHealthCheck: false,
        enableAutoRecovery: false,
      });

      limitedManager.create('task-1', ProcessType.TASK);
      limitedManager.create('task-2', ProcessType.TASK);
      const third = limitedManager.create('task-3', ProcessType.TASK);

      expect(third).toBeNull();

      // But should allow other types
      const agent = limitedManager.create('agent-1', ProcessType.AGENT);
      expect(agent).not.toBeNull();

      limitedManager.shutdown();
    });
  });

  describe('Events', () => {
    it('should emit process created event', () => {
      const handler = jest.fn();
      manager.on('process:created', handler);

      manager.create('test-process', ProcessType.TASK);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit process started event', () => {
      const handler = jest.fn();
      manager.on('process:started', handler);

      const process = manager.create('test-process', ProcessType.TASK);
      if (process) manager.start(process.pid);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit process terminated event', () => {
      const handler = jest.fn();
      manager.on('process:terminated', handler);

      const process = manager.create('test-process', ProcessType.TASK);
      if (process) {
        manager.start(process.pid);
        manager.terminate(process.pid);
      }

      expect(handler).toHaveBeenCalled();
    });

    it('should emit state changed event', () => {
      const handler = jest.fn();
      manager.on('process:state_changed', handler);

      const process = manager.create('test-process', ProcessType.TASK);
      if (process) {
        manager.start(process.pid);
        manager.suspend(process.pid);
      }

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should emit message event', () => {
      const handler = jest.fn();
      manager.on('process:message', handler);

      const p1 = manager.create('sender', ProcessType.TASK);
      const p2 = manager.create('receiver', ProcessType.TASK);

      if (p1 && p2) {
        manager.sendMessage(p1.pid, p2.pid, 'test', {});
      }

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get process statistics', () => {
      manager.create('task-1', ProcessType.TASK);
      manager.create('task-2', ProcessType.TASK);
      const agent = manager.create('agent-1', ProcessType.AGENT);

      if (agent) manager.start(agent.pid);

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType[ProcessType.TASK]).toBe(2);
      expect(stats.byType[ProcessType.AGENT]).toBe(1);
      expect(stats.byState[ProcessState.CREATED]).toBe(2);
      expect(stats.byState[ProcessState.RUNNING]).toBe(1);
    });
  });

  describe('Zombie Cleanup', () => {
    it('should cleanup zombie processes', async () => {
      const zombieManager = createProcessManager({
        zombieTimeoutMs: 10,
        enableHealthCheck: false,
        enableAutoRecovery: false,
      });

      const process = zombieManager.create('zombie', ProcessType.TASK);
      if (process) {
        zombieManager.start(process.pid);
        zombieManager.terminate(process.pid);
      }

      // Wait for zombie timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Manually trigger health check to mark as zombie
      (zombieManager as any).performHealthCheck();

      const cleaned = zombieManager.cleanupZombies();
      expect(cleaned).toBe(1);

      zombieManager.shutdown();
    });
  });

  describe('Reset', () => {
    it('should reset manager state', () => {
      manager.create('process-1', ProcessType.TASK);
      manager.create('process-2', ProcessType.AGENT);

      manager.reset();

      expect(manager.getAllProcesses().length).toBe(0);
    });
  });
});
