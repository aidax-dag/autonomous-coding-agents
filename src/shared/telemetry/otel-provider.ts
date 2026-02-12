/**
 * OTel Provider
 *
 * Lightweight telemetry provider that wires TraceManager, MetricsExporter,
 * and CostAnalytics into a single managed lifecycle. No external OTel SDK
 * dependency -- can be optionally bridged to real exporters by replacing
 * the inner components.
 *
 * @module shared/telemetry/otel-provider
 */

import type {
  TelemetryConfig,
  ITraceManager,
  IMetricsExporter,
  ICostAnalytics,
} from './interfaces/telemetry.interface';
import { TraceManager } from './trace-manager';
import { MetricsExporter } from './metrics-exporter';
import { CostAnalytics } from './cost-analytics';

const DEFAULT_CONFIG: Required<TelemetryConfig> = {
  enabled: true,
  serviceName: 'aca',
  exportInterval: 0,
};

/**
 * Unified telemetry provider managing traces, metrics, and cost analytics.
 */
export class OTelProvider {
  private readonly config: Required<TelemetryConfig>;
  private readonly traceManager: TraceManager;
  private readonly metricsExporter: MetricsExporter;
  private readonly costAnalytics: CostAnalytics;
  private initialized: boolean = false;

  constructor(config?: TelemetryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.traceManager = new TraceManager();
    this.metricsExporter = new MetricsExporter();
    this.costAnalytics = new CostAnalytics();
  }

  /**
   * Initialize the provider. Idempotent -- calling multiple times is safe.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Shut down the provider, resetting all internal state.
   */
  shutdown(): void {
    this.traceManager.reset();
    this.metricsExporter.reset();
    this.costAnalytics.reset();
    this.initialized = false;
  }

  /**
   * Whether telemetry collection is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * The configured service name.
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  /**
   * Access the trace manager.
   */
  getTraceManager(): ITraceManager {
    return this.traceManager;
  }

  /**
   * Access the metrics exporter.
   */
  getMetricsExporter(): IMetricsExporter {
    return this.metricsExporter;
  }

  /**
   * Access the cost analytics module.
   */
  getCostAnalytics(): ICostAnalytics {
    return this.costAnalytics;
  }
}

/**
 * Factory: create an OTelProvider instance.
 */
export function createOTelProvider(config?: TelemetryConfig): OTelProvider {
  return new OTelProvider(config);
}
