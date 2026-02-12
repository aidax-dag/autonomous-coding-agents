/**
 * Tests for TUIApp Main Orchestrator
 */

import { TUIApp, createTUIApp } from '@/ui/tui/tui-app';
import { AgentPanel } from '@/ui/tui/components/agent-panel';
import { TaskTracker } from '@/ui/tui/components/task-tracker';
import { LogViewer } from '@/ui/tui/components/log-viewer';
import type { TUIRenderOutput } from '@/ui/tui/interfaces/tui.interface';

describe('TUIApp', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create with default config', () => {
    const app = new TUIApp();
    const config = app.getConfig();

    expect(config.refreshIntervalMs).toBe(1000);
    expect(config.maxLogLines).toBe(50);
    expect(config.maxDiffLines).toBe(100);
    expect(config.showCosts).toBe(true);
    expect(config.showMetrics).toBe(true);
  });

  it('should manage start/stop lifecycle', () => {
    jest.useFakeTimers();
    const app = new TUIApp({ refreshIntervalMs: 100 });

    expect(app.isRunning()).toBe(false);
    app.start();
    expect(app.isRunning()).toBe(true);

    // Starting again should be a no-op
    app.start();
    expect(app.isRunning()).toBe(true);

    app.stop();
    expect(app.isRunning()).toBe(false);
  });

  it('should add and remove components', () => {
    const app = new TUIApp();
    const panel = new AgentPanel();
    const tracker = new TaskTracker();

    app.addComponent(panel);
    app.addComponent(tracker);
    expect(app.getComponents()).toHaveLength(2);

    app.removeComponent('agent-panel');
    expect(app.getComponents()).toHaveLength(1);
    expect(app.getComponent('agent-panel')).toBeUndefined();
    expect(app.getComponent('task-tracker')).toBe(tracker);
  });

  it('should render combined output from all components', () => {
    const app = new TUIApp();
    const panel = new AgentPanel();
    const tracker = new TaskTracker();
    app.addComponent(panel);
    app.addComponent(tracker);

    const output = app.render();

    // Should contain header lines from both components
    expect(output.lines.some(l => l.includes('Agent Status'))).toBe(true);
    expect(output.lines.some(l => l.includes('Task Progress'))).toBe(true);
    expect(output.height).toBeGreaterThan(0);
    expect(output.width).toBeGreaterThan(0);
  });

  it('should return empty output with no components', () => {
    const app = new TUIApp();
    const output = app.render();

    expect(output.lines).toHaveLength(0);
    expect(output.width).toBe(0);
    expect(output.height).toBe(0);
  });

  it('should get component by type', () => {
    const app = new TUIApp();
    const panel = new AgentPanel();
    app.addComponent(panel);

    expect(app.getComponent('agent-panel')).toBe(panel);
    expect(app.getComponent('log-viewer')).toBeUndefined();
  });

  it('should notify render listeners on timer tick', () => {
    jest.useFakeTimers();
    const app = new TUIApp({ refreshIntervalMs: 100 });
    const panel = new AgentPanel();
    app.addComponent(panel);

    const outputs: TUIRenderOutput[] = [];
    app.onRender((output) => { outputs.push(output); });

    app.start();
    jest.advanceTimersByTime(350);
    app.stop();

    // Should have received 3 render callbacks (at 100, 200, 300)
    expect(outputs.length).toBe(3);
    expect(outputs[0].lines.some(l => l.includes('Agent Status'))).toBe(true);
  });

  it('should allow unsubscribing from render listener', () => {
    jest.useFakeTimers();
    const app = new TUIApp({ refreshIntervalMs: 100 });
    const panel = new AgentPanel();
    app.addComponent(panel);

    let callCount = 0;
    const unsub = app.onRender(() => { callCount++; });

    app.start();
    jest.advanceTimersByTime(150);
    unsub();
    jest.advanceTimersByTime(200);
    app.stop();

    // Should have only been called once before unsubscribe
    expect(callCount).toBe(1);
  });

  it('should be created via factory function', () => {
    const app = createTUIApp({ refreshIntervalMs: 500 });
    expect(app).toBeInstanceOf(TUIApp);
    expect(app.getConfig().refreshIntervalMs).toBe(500);
  });

  it('should replace component of same type', () => {
    const app = new TUIApp();
    const viewer1 = new LogViewer({ maxLines: 10 });
    const viewer2 = new LogViewer({ maxLines: 20 });

    app.addComponent(viewer1);
    app.addComponent(viewer2);

    expect(app.getComponents()).toHaveLength(1);
    expect(app.getComponent('log-viewer')).toBe(viewer2);
  });
});
