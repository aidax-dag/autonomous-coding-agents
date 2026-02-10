/**
 * API Gateway Tests
 */

import { APIGateway, createAPIGateway } from '../../../src/api/gateway';
import { ACPMessageBus, createACPMessage } from '../../../src/core/protocols/acp-message-bus';
import type { ACPMessage, TaskResultPayload } from '../../../src/core/protocols/interfaces/acp.interface';

describe('APIGateway', () => {
  let bus: ACPMessageBus;
  let gateway: APIGateway;

  beforeEach(() => {
    bus = new ACPMessageBus();
    gateway = new APIGateway({ messageBus: bus, healthTimeout: 200 });
  });

  afterEach(() => {
    bus.clear();
  });

  describe('submitTask', () => {
    it('should publish task submission message', async () => {
      const published: ACPMessage[] = [];
      bus.on('task:submit', async (msg) => { published.push(msg); });

      const response = await gateway.submitTask({
        description: 'Build feature X',
      });

      expect(response.status).toBe('accepted');
      expect(response.taskId).toBeDefined();
      expect(response.message).toContain('Build feature X');
      expect(published).toHaveLength(1);
      expect((published[0].payload as any).description).toBe('Build feature X');
    });

    it('should include target team in message', async () => {
      const published: ACPMessage[] = [];
      bus.on('task:submit', async (msg) => { published.push(msg); });

      await gateway.submitTask({
        description: 'Write tests',
        targetTeam: 'qa',
      });

      expect(published[0].target).toBe('qa');
    });

    it('should generate unique task IDs', async () => {
      const r1 = await gateway.submitTask({ description: 'task 1' });
      const r2 = await gateway.submitTask({ description: 'task 2' });

      expect(r1.taskId).not.toBe(r2.taskId);
    });
  });

  describe('getHealth', () => {
    it('should return healthy when system responds', async () => {
      bus.on('system:health', async (msg) => {
        if (msg.correlationId) return; // ignore response messages
        const response = createACPMessage({
          type: 'system:health',
          source: msg.target,
          target: msg.source,
          payload: {
            status: 'healthy',
            activeAgents: 3,
            pendingTasks: 1,
            uptime: 5000,
            components: { orchestrator: 'healthy' },
          },
          correlationId: msg.id,
        });
        await bus.publish(response);
      });

      const health = await gateway.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.activeAgents).toBe(3);
    });

    it('should return degraded when no response', async () => {
      // No responder registered
      const health = await gateway.getHealth();

      expect(health.status).toBe('degraded');
      expect(health.activeAgents).toBe(0);
    });
  });

  describe('publishStatus', () => {
    it('should publish status update', async () => {
      const received: ACPMessage[] = [];
      bus.on('task:status', async (msg) => { received.push(msg); });

      await gateway.publishStatus({
        taskId: 'test-1',
        status: 'running',
        progress: 50,
        message: 'Half done',
      });

      expect(received).toHaveLength(1);
      expect((received[0].payload as any).progress).toBe(50);
    });
  });

  describe('events', () => {
    it('should emit events on task results', async () => {
      const events: any[] = [];
      gateway.onEvent((event) => events.push(event));

      // Simulate a task result coming through the bus
      const resultMessage = createACPMessage<TaskResultPayload>({
        type: 'task:result',
        source: 'agent',
        target: 'api-gateway',
        payload: {
          taskId: 'task-1',
          success: true,
          result: { output: 'done' },
          duration: 100,
        },
      });

      await bus.publish(resultMessage);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task:completed');
    });

    it('should emit failed event for failed tasks', async () => {
      const events: any[] = [];
      gateway.onEvent((event) => events.push(event));

      const resultMessage = createACPMessage<TaskResultPayload>({
        type: 'task:result',
        source: 'agent',
        target: 'api-gateway',
        payload: {
          taskId: 'task-2',
          success: false,
          error: 'compilation error',
          duration: 50,
        },
      });

      await bus.publish(resultMessage);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task:failed');
    });

    it('should unsubscribe from events', async () => {
      const events: any[] = [];
      const unsub = gateway.onEvent((event) => events.push(event));

      unsub();

      await bus.publish(createACPMessage<TaskResultPayload>({
        type: 'task:result',
        source: 'agent',
        target: 'api-gateway',
        payload: { taskId: 'task-1', success: true, duration: 0 },
      }));

      expect(events).toHaveLength(0);
    });
  });

  it('should be created via factory', () => {
    const gw = createAPIGateway({ messageBus: bus });
    expect(gw).toBeInstanceOf(APIGateway);
  });
});
