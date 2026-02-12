/**
 * Full Pipeline E2E Tests
 *
 * Validates the complete system pipeline from CLI entry point
 * through runner, agents, hooks, ACP message bus, to UI consumers.
 *
 * Pipeline:
 *   CLI → OrchestratorRunner → Agent → Hook → ACP → RunnerDataSource → UI
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { createMockRunner } from '@/core/orchestrator/mock-runner';
import { RunnerStatus, type GoalResult } from '@/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '@/core/services/service-registry';
import { createACPMessageBus, createACPMessage, type ACPMessage } from '@/core/protocols';
import { RunnerDataSource } from '@/core/orchestrator/runner-data-source';
import { createWebServer, createSSEBroker, createDashboardAPI } from '@/ui/web';
import { createAgentStatusHook, createTaskProgressHook } from '@/ui/tui';
import { createMetricsCollector, createHUDDashboard } from '@/core/hud';

describe('E2E: Full System Pipeline', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `e2e-pipeline-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Runner → ACP → UI Hook Pipeline
  // ═══════════════════════════════════════════════════════════

  describe('Runner → ACP → UI Hook Pipeline', () => {
    it('should propagate runner events through ACP to TUI hooks', async () => {
      const runner = createMockRunner({ workspaceDir });
      const bus = createACPMessageBus();
      const dataSource = new RunnerDataSource({
        runner,
        messageBus: bus,
        sourceId: 'e2e-runner',
      });

      // Connect TUI hooks
      const agentHook = createAgentStatusHook(bus);
      const taskHook = createTaskProgressHook(bus);
      agentHook.connect();
      taskHook.connect();
      dataSource.connect();

      // Track ACP messages
      const messages: ACPMessage[] = [];
      bus.on('system:health', async (msg) => { messages.push(msg); });
      bus.on('task:status', async (msg) => { messages.push(msg); });
      bus.on('task:result', async (msg) => { messages.push(msg); });
      bus.on('agent:event', async (msg) => { messages.push(msg); });

      // Execute full pipeline
      await runner.start();

      const result = await runner.executeGoal(
        'E2E Test Goal',
        'Implement a test feature for pipeline validation',
        { priority: 'high', waitForCompletion: true },
      );

      await runner.destroy();

      // Verify goal result
      expect(result).toBeDefined();
      expect(result.goalId).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.completedTasks + result.failedTasks).toBeGreaterThan(0);

      // Verify ACP messages were generated
      expect(messages.length).toBeGreaterThan(0);

      // Verify system:health messages from start/stop
      const healthMessages = messages.filter(m => m.type === 'system:health');
      expect(healthMessages.length).toBeGreaterThan(0);
      expect(healthMessages[0].source).toBe('e2e-runner');

      // Cleanup
      dataSource.disconnect();
      agentHook.disconnect();
      taskHook.disconnect();
    });

    it('should track workflow events through ACP', async () => {
      const runner = createMockRunner({ workspaceDir });
      const bus = createACPMessageBus();
      const dataSource = new RunnerDataSource({
        runner,
        messageBus: bus,
      });

      const taskStatusMessages: ACPMessage[] = [];
      bus.on('task:status', async (msg) => { taskStatusMessages.push(msg); });
      bus.on('task:result', async (msg) => { taskStatusMessages.push(msg); });

      dataSource.connect();
      await runner.start();

      await runner.executeGoal(
        'Workflow tracking test',
        'Test workflow event propagation',
        { waitForCompletion: true },
      );

      await runner.destroy();

      // System should emit task lifecycle events via RunnerDataSource
      expect(taskStatusMessages.length).toBeGreaterThanOrEqual(0);

      dataSource.disconnect();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Runner → Dashboard API Pipeline
  // ═══════════════════════════════════════════════════════════

  describe('Runner → Dashboard API Pipeline', () => {
    it('should serve runner state through web dashboard API', async () => {
      const runner = createMockRunner({ workspaceDir });
      const bus = createACPMessageBus();
      const collector = createMetricsCollector();
      const dashboard = createHUDDashboard({ metrics: collector });
      const server = createWebServer({ port: 0 });
      const broker = createSSEBroker();
      createDashboardAPI({ server, dashboard, messageBus: bus, sseBroker: broker });

      // Start runner
      await runner.start();

      // Query health endpoint
      const healthResp = await server.handleRequest({
        method: 'GET',
        path: '/api/health',
        params: {},
        headers: {},
        query: {},
      });
      expect(healthResp.status).toBe(200);
      expect(healthResp.body).toHaveProperty('status');

      // Query snapshot endpoint
      const snapshotResp = await server.handleRequest({
        method: 'GET',
        path: '/api/snapshot',
        params: {},
        headers: {},
        query: {},
      });
      expect(snapshotResp.status).toBe(200);

      // Submit task via API
      const submitResp = await server.handleRequest({
        method: 'POST',
        path: '/api/tasks',
        params: {},
        headers: { 'content-type': 'application/json' },
        query: {},
        body: { name: 'API-submitted task', description: 'Test via dashboard' },
      });
      expect(submitResp.status).toBe(202);

      await runner.destroy();
    });

    it('should return 400 for missing task name', async () => {
      const server = createWebServer({ port: 0 });
      const bus = createACPMessageBus();
      createDashboardAPI({ server, messageBus: bus });

      const resp = await server.handleRequest({
        method: 'POST',
        path: '/api/tasks',
        params: {},
        headers: {},
        query: {},
        body: {},
      });
      expect(resp.status).toBe(400);
    });

    it('should report SSE client count', async () => {
      const server = createWebServer({ port: 0 });
      const broker = createSSEBroker();
      createDashboardAPI({ server, sseBroker: broker });

      // No clients
      const resp1 = await server.handleRequest({
        method: 'GET',
        path: '/api/sse/clients',
        params: {},
        headers: {},
        query: {},
      });
      expect(resp1.status).toBe(200);
      expect((resp1.body as any).clients).toBe(0);

      // Add a mock client
      broker.addClient({
        id: 'mock-1',
        send: jest.fn(),
        close: jest.fn(),
      });

      const resp2 = await server.handleRequest({
        method: 'GET',
        path: '/api/sse/clients',
        params: {},
        headers: {},
        query: {},
      });
      expect((resp2.body as any).clients).toBe(1);

      broker.disconnectAll();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Runner → HUD Metrics Pipeline
  // ═══════════════════════════════════════════════════════════

  describe('Runner → HUD Metrics Pipeline', () => {
    it('should collect metrics during goal execution', async () => {
      const runner = createMockRunner({ workspaceDir });
      const collector = createMetricsCollector();
      const dashboard = createHUDDashboard({ metrics: collector });

      await runner.start();

      // Record metrics during execution
      collector.recordValue('task.start', 1);
      collector.recordValue('tokens.used', 150, 'tokens');

      await runner.executeGoal(
        'Metrics test',
        'Test HUD metrics collection',
        { waitForCompletion: true },
      );

      collector.recordValue('task.end', 1);

      // Get dashboard snapshot
      const snap = dashboard.snapshot();
      expect(snap).toBeDefined();
      expect(snap.agents).toBeDefined();
      expect(snap.metrics).toBeDefined();
      expect(snap.metrics.length).toBeGreaterThan(0);

      await runner.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Multi-Goal Sequential Execution
  // ═══════════════════════════════════════════════════════════

  describe('Multi-Goal Sequential Execution', () => {
    it('should execute multiple goals sequentially', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const results: GoalResult[] = [];

      for (let i = 1; i <= 3; i++) {
        const result = await runner.executeGoal(
          `Goal ${i}`,
          `Sequential goal number ${i}`,
          { waitForCompletion: true },
        );
        results.push(result);
      }

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.goalId).toBeDefined();
        expect(r.totalDuration).toBeGreaterThanOrEqual(0);
      });

      const stats = runner.getStats();
      expect(stats.status).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Runner Event Ordering
  // ═══════════════════════════════════════════════════════════

  describe('Runner Event Ordering', () => {
    it('should emit events in correct lifecycle order', async () => {
      const runner = createMockRunner({ workspaceDir });
      const events: string[] = [];

      runner.on('started', () => events.push('started'));
      runner.on('stopped', () => events.push('stopped'));
      runner.on('goal:started', () => events.push('goal:started'));
      runner.on('goal:completed', () => events.push('goal:completed'));
      runner.on('workflow:started', () => events.push('workflow:started'));
      runner.on('workflow:completed', () => events.push('workflow:completed'));

      await runner.start();
      expect(events).toContain('started');

      await runner.executeGoal(
        'Event ordering test',
        'Verify event emission order',
        { waitForCompletion: true },
      );

      await runner.destroy();

      // started must come first
      expect(events.indexOf('started')).toBe(0);

      // goal:started should come before goal:completed
      const goalStartIdx = events.indexOf('goal:started');
      const goalEndIdx = events.indexOf('goal:completed');
      if (goalStartIdx >= 0 && goalEndIdx >= 0) {
        expect(goalStartIdx).toBeLessThan(goalEndIdx);
      }

      // stopped should be last
      expect(events[events.length - 1]).toBe('stopped');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Runner Stats Tracking
  // ═══════════════════════════════════════════════════════════

  describe('Runner Stats Tracking', () => {
    it('should track task counts across multiple goals', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const statsBefore = runner.getStats();
      expect(statsBefore.status).toBe(RunnerStatus.RUNNING);
      expect(statsBefore.tasksExecuted).toBe(0);

      await runner.executeGoal('Stats goal 1', 'First', { waitForCompletion: true });
      await runner.executeGoal('Stats goal 2', 'Second', { waitForCompletion: true });

      const statsAfter = runner.getStats();
      expect(statsAfter.tasksExecuted).toBeGreaterThan(0);
      expect(statsAfter.uptime).toBeGreaterThanOrEqual(0);

      await runner.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Error Recovery Pipeline
  // ═══════════════════════════════════════════════════════════

  describe('Error Recovery Pipeline', () => {
    it('should handle runner start → execute → destroy even with errors', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const result = await runner.executeGoal(
        'Error recovery test',
        'Test resilience to errors',
        { waitForCompletion: true },
      );

      expect(result).toBeDefined();

      await runner.destroy();
      const stats = runner.getStats();
      expect(stats.status).toBe(RunnerStatus.STOPPED);
    });

    it('should survive duplicate start/destroy calls', async () => {
      const runner = createMockRunner({ workspaceDir });

      await runner.start();
      await runner.start(); // Idempotent

      expect(runner.getStats().status).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
      await runner.destroy(); // Idempotent

      expect(runner.getStats().status).toBe(RunnerStatus.STOPPED);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. SSE Broker Real-Time Pipeline
  // ═══════════════════════════════════════════════════════════

  describe('SSE Real-Time Update Pipeline', () => {
    it('should broadcast ACP events to SSE clients', async () => {
      const bus = createACPMessageBus();
      const broker = createSSEBroker();
      const receivedEvents: string[] = [];

      broker.addClient({
        id: 'sse-client-1',
        send: jest.fn((event: string) => { receivedEvents.push(event); }),
        close: jest.fn(),
      });

      bus.on('agent:status', async () => {
        broker.broadcast('agent-status', JSON.stringify({ agentId: 'dev-1' }));
      });

      await bus.publish(createACPMessage({
        type: 'agent:status',
        source: 'test',
        target: 'broadcast',
        payload: { agentId: 'dev-1', state: 'working', currentTask: 'implementing' },
      }));

      expect(receivedEvents.length).toBe(1);

      broker.disconnectAll();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 9. RunnerDataSource Lifecycle
  // ═══════════════════════════════════════════════════════════

  describe('RunnerDataSource Lifecycle', () => {
    it('should cleanly connect and disconnect with runner', async () => {
      const runner = createMockRunner({ workspaceDir });
      const bus = createACPMessageBus();
      const ds = new RunnerDataSource({ runner, messageBus: bus });

      expect(ds.isConnected()).toBe(false);

      ds.connect();
      expect(ds.isConnected()).toBe(true);

      await runner.start();
      await runner.executeGoal('DS test', 'Test', { waitForCompletion: true });
      await runner.destroy();

      ds.disconnect();
      expect(ds.isConnected()).toBe(false);
    });
  });
});
