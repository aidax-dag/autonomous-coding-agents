/**
 * HUD (Heads-Up Display) Dashboard Interfaces
 *
 * Defines abstractions for real-time agent monitoring,
 * metrics collection, and dashboard rendering.
 *
 * @module core/hud/interfaces
 */

/**
 * Metric data point
 */
export interface MetricPoint {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Unit (e.g., 'ms', 'tokens', '%') */
  unit: string;
  /** Timestamp */
  timestamp: string;
  /** Optional tags */
  tags?: Record<string, string>;
}

/**
 * Agent status for HUD display
 */
export interface AgentHUDStatus {
  /** Agent ID */
  agentId: string;
  /** Agent type */
  agentType: string;
  /** Current state */
  state: 'idle' | 'working' | 'blocked' | 'error' | 'completed';
  /** Current task description */
  currentTask?: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Tokens consumed */
  tokensUsed: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Last updated */
  updatedAt: string;
}

/**
 * HUD snapshot — complete dashboard state
 */
export interface HUDSnapshot {
  /** Snapshot timestamp */
  timestamp: string;
  /** Active agents */
  agents: AgentHUDStatus[];
  /** System metrics */
  metrics: MetricPoint[];
  /** Active warnings */
  warnings: string[];
  /** Overall system health (0-100) */
  systemHealth: number;
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  /** Record a metric data point */
  record(metric: MetricPoint): void;

  /** Record a numeric metric by name */
  recordValue(name: string, value: number, unit?: string): void;

  /** Get latest metrics */
  getLatest(count?: number): MetricPoint[];

  /** Get metrics by name */
  getByName(name: string, count?: number): MetricPoint[];

  /** Clear all collected metrics */
  clear(): void;
}

/**
 * HUD Dashboard interface
 */
export interface IHUDDashboard {
  /** Update agent status */
  updateAgent(status: AgentHUDStatus): void;

  /** Remove agent from dashboard */
  removeAgent(agentId: string): void;

  /** Add a warning */
  addWarning(message: string): void;

  /** Clear warnings */
  clearWarnings(): void;

  /** Get current snapshot */
  snapshot(): HUDSnapshot;
}
