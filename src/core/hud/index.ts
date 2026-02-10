/**
 * HUD Dashboard Module
 *
 * @module core/hud
 */

export type {
  IMetricsCollector,
  IHUDDashboard,
  MetricPoint,
  AgentHUDStatus,
  HUDSnapshot,
} from './interfaces/hud.interface';

export {
  MetricsCollector,
  createMetricsCollector,
  type MetricsCollectorConfig,
} from './metrics-collector';

export {
  HUDDashboard,
  createHUDDashboard,
  type HUDDashboardConfig,
} from './hud-dashboard';
