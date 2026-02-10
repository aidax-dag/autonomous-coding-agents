/**
 * Tests for HUD Dashboard & Metrics Collector
 */

import {
  MetricsCollector,
  createMetricsCollector,
  HUDDashboard,
  createHUDDashboard,
} from '@/core/hud';
import type { AgentHUDStatus } from '@/core/hud';

describe('MetricsCollector', () => {
  it('should create with default config', () => {
    const mc = new MetricsCollector();
    expect(mc).toBeInstanceOf(MetricsCollector);
  });

  it('should record and retrieve metric points', () => {
    const mc = new MetricsCollector();
    mc.recordValue('latency', 150, 'ms');
    mc.recordValue('tokens', 500, 'tokens');

    const latest = mc.getLatest(10);
    expect(latest).toHaveLength(2);
    expect(latest[0].name).toBe('latency');
    expect(latest[1].name).toBe('tokens');
  });

  it('should record full metric point', () => {
    const mc = new MetricsCollector();
    mc.record({
      name: 'cpu',
      value: 75,
      unit: '%',
      timestamp: '2026-01-01T00:00:00Z',
      tags: { host: 'node-1' },
    });

    const latest = mc.getLatest();
    expect(latest).toHaveLength(1);
    expect(latest[0].tags?.host).toBe('node-1');
  });

  it('should get metrics by name', () => {
    const mc = new MetricsCollector();
    mc.recordValue('latency', 100);
    mc.recordValue('tokens', 500);
    mc.recordValue('latency', 200);

    const latency = mc.getByName('latency');
    expect(latency).toHaveLength(2);
    expect(latency[0].value).toBe(100);
    expect(latency[1].value).toBe(200);
  });

  it('should enforce max points', () => {
    const mc = new MetricsCollector({ maxPoints: 3 });
    for (let i = 0; i < 5; i++) {
      mc.recordValue('val', i);
    }

    const latest = mc.getLatest(10);
    expect(latest).toHaveLength(3);
    expect(latest[0].value).toBe(2);
    expect(latest[2].value).toBe(4);
  });

  it('should clear all metrics', () => {
    const mc = new MetricsCollector();
    mc.recordValue('a', 1);
    mc.recordValue('b', 2);
    mc.clear();

    expect(mc.getLatest()).toHaveLength(0);
  });

  it('should return copies', () => {
    const mc = new MetricsCollector();
    mc.recordValue('x', 10);

    const a = mc.getLatest();
    const b = mc.getLatest();
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]).toEqual(b[0]);
  });

  it('should create via factory', () => {
    const mc = createMetricsCollector({ maxPoints: 5 });
    expect(mc).toBeInstanceOf(MetricsCollector);
  });
});

describe('HUDDashboard', () => {
  function makeAgent(overrides: Partial<AgentHUDStatus> = {}): AgentHUDStatus {
    return {
      agentId: 'agent-1',
      agentType: 'coder',
      state: 'working',
      progress: 50,
      tokensUsed: 1000,
      elapsedMs: 5000,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('should create and produce empty snapshot', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    const snap = hud.snapshot();
    expect(snap.agents).toEqual([]);
    expect(snap.warnings).toEqual([]);
    expect(snap.systemHealth).toBe(100);
  });

  it('should track agent statuses', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.updateAgent(makeAgent({ agentId: 'a1', state: 'working' }));
    hud.updateAgent(makeAgent({ agentId: 'a2', state: 'idle' }));

    const snap = hud.snapshot();
    expect(snap.agents).toHaveLength(2);
  });

  it('should remove agent', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.updateAgent(makeAgent({ agentId: 'a1' }));
    hud.removeAgent('a1');

    expect(hud.snapshot().agents).toHaveLength(0);
  });

  it('should manage warnings', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.addWarning('Token budget low');
    hud.addWarning('Agent blocked');

    const snap = hud.snapshot();
    expect(snap.warnings).toHaveLength(2);

    hud.clearWarnings();
    expect(hud.snapshot().warnings).toHaveLength(0);
  });

  it('should enforce max warnings', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics, maxWarnings: 2 });

    hud.addWarning('w1');
    hud.addWarning('w2');
    hud.addWarning('w3');

    expect(hud.snapshot().warnings).toHaveLength(2);
    expect(hud.snapshot().warnings).toEqual(['w2', 'w3']);
  });

  it('should calculate health — deduct for errors', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.updateAgent(makeAgent({ agentId: 'a1', state: 'error' }));
    hud.updateAgent(makeAgent({ agentId: 'a2', state: 'working' }));

    const snap = hud.snapshot();
    expect(snap.systemHealth).toBe(80); // 100 - 20 (1 error)
  });

  it('should calculate health — deduct for blocked', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.updateAgent(makeAgent({ agentId: 'a1', state: 'blocked' }));

    expect(hud.snapshot().systemHealth).toBe(90); // 100 - 10
  });

  it('should calculate health — deduct for many warnings', () => {
    const metrics = new MetricsCollector();
    const hud = new HUDDashboard({ metrics });

    hud.updateAgent(makeAgent()); // Need at least one agent
    for (let i = 0; i < 11; i++) {
      hud.addWarning(`warning-${i}`);
    }

    expect(hud.snapshot().systemHealth).toBe(90); // 100 - 10 (>10 warnings)
  });

  it('should include metrics in snapshot', () => {
    const metrics = new MetricsCollector();
    metrics.recordValue('latency', 150, 'ms');

    const hud = new HUDDashboard({ metrics });
    const snap = hud.snapshot();

    expect(snap.metrics).toHaveLength(1);
    expect(snap.metrics[0].name).toBe('latency');
  });

  it('should create via factory', () => {
    const metrics = new MetricsCollector();
    const hud = createHUDDashboard({ metrics });
    expect(hud).toBeInstanceOf(HUDDashboard);
  });
});
