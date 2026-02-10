/**
 * HUD Dashboard
 *
 * Aggregates agent statuses, metrics, and warnings
 * into a unified snapshot for real-time monitoring.
 *
 * @module core/hud
 */

import type {
  IHUDDashboard,
  IMetricsCollector,
  AgentHUDStatus,
  HUDSnapshot,
} from './interfaces/hud.interface';

/**
 * HUD Dashboard config
 */
export interface HUDDashboardConfig {
  /** Metrics collector instance */
  metrics: IMetricsCollector;
  /** Max warnings to retain (default: 50) */
  maxWarnings?: number;
}

/**
 * HUD Dashboard implementation
 */
export class HUDDashboard implements IHUDDashboard {
  private readonly agents = new Map<string, AgentHUDStatus>();
  private readonly warnings: string[] = [];
  private readonly metrics: IMetricsCollector;
  private readonly maxWarnings: number;

  constructor(config: HUDDashboardConfig) {
    this.metrics = config.metrics;
    this.maxWarnings = config.maxWarnings ?? 50;
  }

  updateAgent(status: AgentHUDStatus): void {
    this.agents.set(status.agentId, { ...status });
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  addWarning(message: string): void {
    this.warnings.push(message);
    if (this.warnings.length > this.maxWarnings) {
      this.warnings.splice(0, this.warnings.length - this.maxWarnings);
    }
  }

  clearWarnings(): void {
    this.warnings.length = 0;
  }

  snapshot(): HUDSnapshot {
    const agents = Array.from(this.agents.values()).map((a) => ({ ...a }));
    const systemHealth = this.calculateHealth(agents);

    return {
      timestamp: new Date().toISOString(),
      agents,
      metrics: this.metrics.getLatest(20),
      warnings: [...this.warnings],
      systemHealth,
    };
  }

  private calculateHealth(agents: AgentHUDStatus[]): number {
    if (agents.length === 0) return 100;

    let score = 100;
    const errorCount = agents.filter((a) => a.state === 'error').length;
    const blockedCount = agents.filter((a) => a.state === 'blocked').length;

    score -= errorCount * 20;
    score -= blockedCount * 10;

    if (this.warnings.length > 10) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Factory function
 */
export function createHUDDashboard(config: HUDDashboardConfig): HUDDashboard {
  return new HUDDashboard(config);
}
