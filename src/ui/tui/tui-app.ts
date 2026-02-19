/**
 * TUI Application
 * Main orchestrator for terminal user interface components.
 * @module ui/tui
 */

import type { ITUIApp, ITUIComponent, TUIComponentType, TUIRenderOutput, TUIAppConfig } from './interfaces/tui.interface';
import { DEFAULT_REFRESH_INTERVAL_MS, DEFAULT_MAX_LOG_LINES, DEFAULT_MAX_DIFF_LINES } from './constants';

export class TUIApp implements ITUIApp {
  private components: Map<TUIComponentType, ITUIComponent> = new Map();
  private running: boolean = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<TUIAppConfig>;
  private readonly renderListeners: Set<(output: TUIRenderOutput) => void> = new Set();

  constructor(config?: TUIAppConfig) {
    this.config = {
      refreshIntervalMs: config?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
      maxLogLines: config?.maxLogLines ?? DEFAULT_MAX_LOG_LINES,
      maxDiffLines: config?.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES,
      showCosts: config?.showCosts ?? true,
      showMetrics: config?.showMetrics ?? true,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.config.refreshIntervalMs > 0) {
      this.refreshTimer = setInterval(() => {
        if (this.renderListeners.size > 0) {
          const output = this.render();
          for (const listener of this.renderListeners) {
            listener(output);
          }
        }
      }, this.config.refreshIntervalMs);
      if (this.refreshTimer.unref) {
        this.refreshTimer.unref();
      }
    }
  }

  stop(): void {
    this.running = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  addComponent(component: ITUIComponent): void {
    this.components.set(component.type, component);
  }

  removeComponent(type: TUIComponentType): void {
    const component = this.components.get(type);
    if (component) {
      component.destroy();
      this.components.delete(type);
    }
  }

  getComponent(type: TUIComponentType): ITUIComponent | undefined {
    return this.components.get(type);
  }

  getComponents(): ITUIComponent[] {
    return Array.from(this.components.values());
  }

  render(): TUIRenderOutput {
    const allLines: string[] = [];
    let maxWidth = 0;

    for (const component of this.components.values()) {
      const output = component.render();
      allLines.push(...output.lines);
      allLines.push(''); // separator
      if (output.width > maxWidth) maxWidth = output.width;
    }

    // Remove trailing empty line
    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    return {
      lines: allLines,
      width: maxWidth,
      height: allLines.length,
    };
  }

  onRender(listener: (output: TUIRenderOutput) => void): () => void {
    this.renderListeners.add(listener);
    return () => this.renderListeners.delete(listener);
  }

  getConfig(): Required<TUIAppConfig> {
    return { ...this.config };
  }
}

export function createTUIApp(config?: TUIAppConfig): TUIApp {
  return new TUIApp(config);
}
