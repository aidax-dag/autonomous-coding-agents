/**
 * Prometheus Metrics Exporter
 *
 * Converts MetricPoint data into Prometheus exposition format and provides
 * an HTTP endpoint for Prometheus scraping. No external SDK required.
 *
 * @module shared/telemetry/prometheus-exporter
 */

import type {
  MetricPoint,
  IMetricsExporter,
} from './interfaces/telemetry.interface';
import { createAgentLogger } from '../logging/logger';
import * as http from 'http';

const logger = createAgentLogger('prometheus-exporter');

// ============================================================================
// Configuration
// ============================================================================

export interface PrometheusExporterConfig {
  /** HTTP port for metrics endpoint (default: 9464) */
  port?: number;
  /** Endpoint path (default: /metrics) */
  path?: string;
  /** Metric name prefix (default: aca) */
  prefix?: string;
  /** Default labels applied to all metrics */
  defaultLabels?: Record<string, string>;
}

const DEFAULT_CONFIG: Required<PrometheusExporterConfig> = {
  port: 9464,
  path: '/metrics',
  prefix: 'aca',
  defaultLabels: {},
};

// ============================================================================
// Helpers
// ============================================================================

function escapeLabel(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function formatLabels(
  labels: Record<string, string>,
  defaults: Record<string, string>,
): string {
  const merged = { ...defaults, ...labels };
  const entries = Object.entries(merged);
  if (entries.length === 0) return '';
  return (
    '{' +
    entries.map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',') +
    '}'
  );
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_').replace(/^[^a-zA-Z_:]/, '_');
}

// ============================================================================
// Prometheus Exporter
// ============================================================================

/**
 * Exposes metrics in Prometheus exposition format via an HTTP endpoint.
 */
export class PrometheusExporter {
  private readonly config: Required<PrometheusExporterConfig>;
  private metricsSource: IMetricsExporter | null = null;
  private server: http.Server | null = null;
  private customMetrics: MetricPoint[] = [];

  constructor(config?: PrometheusExporterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Bind an IMetricsExporter to expose its metrics.
   */
  setMetricsSource(source: IMetricsExporter): void {
    this.metricsSource = source;
  }

  /**
   * Record a custom metric point directly.
   */
  record(point: MetricPoint): void {
    this.customMetrics.push(point);
  }

  /**
   * Start the HTTP server for Prometheus scraping.
   */
  async start(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      if (req.url === this.config.path && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        });
        res.end(this.generateOutput());
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    return new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.port, () => {
        logger.info(
          `Prometheus exporter listening on :${this.config.port}${this.config.path}`,
        );
        resolve();
      });
      this.server!.on('error', (err) => {
        logger.error('Prometheus server error', err);
        reject(err);
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.server = null;
        logger.info('Prometheus exporter stopped');
        resolve();
      });
    });
  }

  /**
   * Generate Prometheus exposition format output.
   */
  generateOutput(): string {
    const allMetrics = [
      ...(this.metricsSource?.getMetrics() ?? []),
      ...this.customMetrics,
    ];

    // Group by metric name
    const grouped = new Map<string, MetricPoint[]>();
    for (const point of allMetrics) {
      const fullName = `${this.config.prefix}_${sanitizeName(point.name)}`;
      if (!grouped.has(fullName)) grouped.set(fullName, []);
      grouped.get(fullName)!.push(point);
    }

    const lines: string[] = [];

    for (const [name, points] of grouped) {
      const firstType = points[0].type;
      const promType =
        firstType === 'counter'
          ? 'counter'
          : firstType === 'gauge'
            ? 'gauge'
            : 'histogram';

      lines.push(`# TYPE ${name} ${promType}`);

      if (promType === 'histogram') {
        const values = points.map((p) => p.value);
        const buckets = [
          0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity,
        ];
        const labels = formatLabels(
          points[0].labels,
          this.config.defaultLabels,
        );

        for (const bucket of buckets) {
          const count = values.filter((v) => v <= bucket).length;
          const le = bucket === Infinity ? '+Inf' : String(bucket);
          lines.push(
            `${name}_bucket{le="${le}"${labels ? ',' + labels.slice(1, -1) : ''}} ${count}`,
          );
        }
        lines.push(
          `${name}_sum${labels} ${values.reduce((a, b) => a + b, 0)}`,
        );
        lines.push(`${name}_count${labels} ${values.length}`);
      } else {
        const labelMap = new Map<string, MetricPoint>();
        for (const point of points) {
          const key = formatLabels(point.labels, this.config.defaultLabels);
          if (firstType === 'counter') {
            const existing = labelMap.get(key);
            if (existing) {
              existing.value += point.value;
            } else {
              labelMap.set(key, { ...point });
            }
          } else {
            labelMap.set(key, point);
          }
        }
        for (const [labels, point] of labelMap) {
          lines.push(`${name}${labels} ${point.value}`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a Prometheus metrics exporter.
 */
export function createPrometheusExporter(
  config?: PrometheusExporterConfig,
): PrometheusExporter {
  return new PrometheusExporter(config);
}
